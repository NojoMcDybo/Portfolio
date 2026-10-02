// Erzeugt public/modelle/baum.glb aus EZ-Tree (MIT, github.com/dgreenheck/ez-tree).
// Einmal ausführen, das Ergebnis ist eingecheckt:  node scripts/baum.mjs
// So landet EZ-Tree (3,9 MB mit eingebetteten Texturen) nicht im Client-Bundle.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const EINSTELLUNGEN = { preset: 'Pine Small', seed: 1954, blaetter: 12, aeste: 38, blattgroesse: 3.4 };

const server = await createServer({ root: 'scripts/baum', logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('Seite:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.bereit, null, { timeout: 60000 });
const r = await page.evaluate((e) => window.exportiere(e), EINSTELLUNGEN);
await browser.close();
await server.close();

await mkdir('public/modelle', { recursive: true });
await writeFile('public/modelle/baum.glb', Buffer.from(r.glb, 'base64'));
console.log(`baum.glb: ${r.dreiecke} Dreiecke, Höhe ${r.hoehe.toFixed(1)}, Breite ${r.breite.toFixed(1)}, ${(r.glb.length * 0.75 / 1024).toFixed(0)} KB`);
