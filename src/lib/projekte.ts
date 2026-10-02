import { getCollection, type CollectionEntry } from 'astro:content';

export type Projekt = CollectionEntry<'projekte'>;

// Maximal so viele Teiche trägt der Ring um den Wald.
export const MAX_TEICHE = 10;

/** Alle Projekte ohne Drafts, sortiert nach `reihenfolge`, dann Titel. */
export async function getProjekte(): Promise<Projekt[]> {
  const alle = await getCollection('projekte', (e) => !e.data.draft);
  return alle.sort(
    (a, b) =>
      (a.data.reihenfolge ?? Infinity) - (b.data.reihenfolge ?? Infinity) ||
      a.data.title.localeCompare(b.data.title, 'de'),
  );
}

/** Die kuratierte Auswahl für die Insel. */
export async function getInselProjekte(): Promise<Projekt[]> {
  return (await getProjekte()).filter((p) => p.data.featured).slice(0, MAX_TEICHE);
}

export const TYP_LABEL = { website: 'Website', app: 'App', konzept: 'Konzept', objekt: 'Objekt' } as const;
export const STATUS_LABEL = { idee: 'Idee', 'in-arbeit': 'In Arbeit', fertig: 'Fertig' } as const;
