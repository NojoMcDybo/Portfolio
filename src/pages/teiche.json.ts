import { getProjekte } from '../lib/projekte';

// Liste für das Screenshot-Skript: welche Projektseiten werden zu Teich-Texturen.
export async function GET() {
  const projekte = await getProjekte();
  return new Response(JSON.stringify(projekte.map((p) => ({ slug: p.id, title: p.data.title }))));
}
