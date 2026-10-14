// Tiny-Glade-Tag: warme, tief stehende Sonne, kühles Himmelslicht (Schatten werden bläulich),
// sattes, weiches Grün, Pastellhimmel. Alles, was Farbe hat, kommt von hier.
export const FARBE = {
  himmelOben: '#a9c8e2',
  himmelUnten: '#f2e6cf',
  dunst: '#e6e4d6', // Nebel = Horizont
  sonne: '#ffe1b0',
  himmelLicht: '#c3d8ee',
  bodenLicht: '#6f8f45',
  gras: '#79ad45',
  grasHell: '#b7d667',
  grasDunkel: '#4c8a33',
  weg: '#d9c49b',
  erde: '#8a6446',
  erdeDunkel: '#654631',
  stamm: '#7c5d45',
  kroneUnten: '#3f7a2f',
  kroneOben: '#a8d05a',
  stein: '#cfc8b8',
  steinDunkel: '#9f9787',
  moos: '#8fb052',
  wasser: '#7fc4c0',
  spiegel: '#cfe3ef', // was das Wasser schräg gesehen spiegelt: der Himmel
  blumen: ['#fffaf0', '#fbe7a1', '#d9c6f0', '#f6c9d3', '#ffffff'],
} as const;

/** Richtung zur Sonne: links, leicht von hinten, hoch genug, dass Kronen und Wiese Licht fangen */
export const SONNE_RICHTUNG: [number, number, number] = [-0.7, 0.66, -0.28];
