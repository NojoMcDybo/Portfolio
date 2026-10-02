import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projekte = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projekte' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    type: z.enum(['website', 'app', 'konzept', 'objekt']),
    status: z.enum(['idee', 'in-arbeit', 'fertig']),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    // Quelle für den Block. Leer = Full-Page-Screenshot der eigenen Projektseite (Seiten-Trick).
    // Später: Pfad zu Bildschirmaufnahme (app) oder Bildfolge (konzept/objekt).
    source: z.string().optional(),
    kurzbeschreibung: z.string(),
    // Position im Ring. Ohne Angabe: alphabetisch nach den nummerierten.
    reihenfolge: z.number().optional(),
    // Nur für die Platzhalter-Optik der Projektseite.
    farbe: z.string().default('#5f7f5a'),
  }),
});

export const collections = { projekte };
