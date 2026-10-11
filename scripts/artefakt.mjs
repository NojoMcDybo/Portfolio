// Macht aus dist/ eine Fassung für statisches Hosting unter einer Unteradresse (z. B. als
// claude.ai-Artifact): alle Pfade relativ, Verzeichnis-URLs als …/index.html, und die
// Startseite ohne <html>/<head>/<body>, weil der Artifact-Host dieses Gerüst selbst setzt.
//
//   npm run build && node scripts/artefakt.mjs   → artefakt/
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const QUELLE = 'dist';
const ZIEL = 'artefakt';
const TITEL = 'Nojo Portfolio';

await rm(ZIEL, { recursive: true, force: true });
await cp(QUELLE, ZIEL, { recursive: true });

async function* dateien(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* dateien(p);
    else yield p;
  }
}

/** "/projekte/haze/?x#y" → "../../projekte/haze/index.html?x#y" relativ zur Seite */
function relativ(pfad, basis) {
  const i = pfad.search(/[?#]/);
  let teil = (i < 0 ? pfad : pfad.slice(0, i)).replace(/^\//, '');
  const rest = i < 0 ? '' : pfad.slice(i);
  if (teil === '' || teil.endsWith('/')) teil += 'index.html';
  return basis + teil + rest;
}

let html = 0;
for await (const datei of dateien(ZIEL)) {
  const rel = relative(ZIEL, datei).split(sep).join('/');
  if (datei.endsWith('.css')) {
    // CSS liegt in _astro/, Schriften auch
    const s = await readFile(datei, 'utf8');
    await writeFile(datei, s.replace(/url\(\/_astro\//g, 'url('));
    continue;
  }
  if (!datei.endsWith('.html')) continue;
  html++;
  const tiefe = rel.split('/').length - 1;
  const basis = tiefe === 0 ? './' : '../'.repeat(tiefe);
  let s = await readFile(datei, 'utf8');
  s = s.replace(
    /\b(href|src|component-url|renderer-url|before-hydration-url)="(\/(?!\/)[^"]*)"/g,
    (_, attr, pfad) => `${attr}="${relativ(pfad, basis)}"`,
  );
  // Laufzeit-Basis für den Client-Code (src/lib/url.ts), vor allen anderen Skripten
  const kopf = `<script>window.__BASIS=${JSON.stringify(basis)};window.__DATEIEN=true</script>`;
  s = s.replace(/<head>/, `<head>${kopf}`);

  if (rel === 'index.html') {
    // Der Artifact-Host setzt Doctype, <html>, <head> und <body> selbst
    const head = s.match(/<head>([\s\S]*?)<\/head>/)[1]
      .replace(/<meta charset="[^"]*"\s*\/?>/i, '')
      .replace(/<meta name="viewport"[^>]*>/i, '')
      .replace(/<title>[\s\S]*?<\/title>/i, '');
    const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    s = `<title>${TITEL}</title>\n${head}\n${body}\n`;
  }
  await writeFile(datei, s);
}
console.log(`${ZIEL}/: ${html} Seiten umgeschrieben`);
