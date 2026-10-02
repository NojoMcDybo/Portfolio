// Full-Page-Screenshots aller Projektseiten → Teich-Texturen + Manifest.
//
//   npm run shots            baut, fotografiert, baut nochmal (damit dist die Bilder enthält)
//   npm run shots -- --nur   fotografiert nur (dist muss existieren)
//
// Die Seite wird genau so gerendert wie im Teich-Iframe: 640 × 480 CSS-px, ?embed=1.
// Texturkante max. 4096 px (sicher auf älteren Handys). Längere Seiten werden
// per deviceScaleFactor < 1 verkleinert, statt abgeschnitten.
//
// TODO (nach dem Prototyp): JPEG → KTX2 (toktx/basisu), Slit-Scan-Pipeline für App-Aufnahmen.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const VP_W = 640;
const VP_H = 480;
const MAX_TEXTUR = 4096;
const LO_FAKTOR = 0.4; // Außenansicht
const DIST = 'dist';
const ZIEL = 'public/teiche';

const nur = process.argv.includes('--nur');
const bau = () => {
  const r = spawnSync('npx', ['astro', 'build'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!nur) bau();

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  let pfad = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let datei = join(DIST, pfad);
  try {
    if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html');
    res.writeHead(200, { 'content-type': typen[extname(datei)] ?? 'application/octet-stream' });
    res.end(await readFile(datei));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

const liste = await (await fetch(`${basis}/teiche.json`)).json();
await mkdir(ZIEL, { recursive: true });

const browser = await chromium.launch();
const manifest = { vpW: VP_W, vpH: VP_H, teiche: {} };

async function foto(url, dsf, datei) {
  const ctx = await browser.newContext({ viewport: { width: VP_W, height: VP_H }, deviceScaleFactor: dsf, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: datei, fullPage: true, type: 'jpeg', quality: 85 });
  await ctx.close();
  return hoehe;
}

for (const { slug } of liste) {
  const url = `${basis}/projekte/${slug}/?embed=1`;
  // erst messen, dann mit passender Skalierung fotografieren
  const hoehe = await foto(url, 1, join(ZIEL, `${slug}.jpg`));
  const dsfHi = Math.min(1, MAX_TEXTUR / hoehe);
  if (dsfHi < 1) await foto(url, dsfHi, join(ZIEL, `${slug}.jpg`));
  await foto(url, dsfHi * LO_FAKTOR, join(ZIEL, `${slug}-lo.jpg`));
  manifest.teiche[slug] = { hi: `/teiche/${slug}.jpg`, lo: `/teiche/${slug}-lo.jpg`, hoehe };
  console.log(`  ${slug}: ${hoehe} px${dsfHi < 1 ? ` (skaliert ×${dsfHi.toFixed(2)})` : ''}`);
}

await browser.close();
server.close();
await writeFile(join(ZIEL, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifest: ${Object.keys(manifest.teiche).length} Teiche → ${ZIEL}/manifest.json`);

if (!nur) bau();
