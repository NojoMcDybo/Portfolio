// Goldene Stunde: Gegenlicht von hinten links, warme Luft, gelbgrünes Laub.
export const FARBE = {
  himmelOben: '#f7dcc0',
  himmelUnten: '#f3c6a2',
  dunst: '#f4cfab', // Nebel = Horizont
  sonne: '#ffd49a',
  himmelLicht: '#ffe8cc',
  bodenLicht: '#6f7a3a',
  gras: '#9cb83a',
  grasHell: '#c9d64e',
  grasDunkel: '#6f9128',
  weg: '#dcc59a',
  erde: '#7d5636',
  erdeDunkel: '#5e3f27',
  stamm: '#8a6b4c',
  kroneUnten: '#5f8a1f',
  kroneOben: '#cbd94c',
  wasser: '#7fc4b8',
  spiegel: '#b9dccf', // was das Wasser schräg gesehen spiegelt: kühl gegen den warmen Himmel
} as const;

/** Richtung zur Sonne: links, leicht von hinten, tief genug für lange Schatten, hoch genug, dass die Kronen Licht fangen */
export const SONNE_RICHTUNG: [number, number, number] = [-0.72, 0.62, -0.3];
