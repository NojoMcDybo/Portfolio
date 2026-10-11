// Pfade im Client-Code. Normal ist die Basis "/". Für statisches Hosting unter einer
// Unteradresse (z. B. als Artifact) setzt scripts/artefakt.mjs pro Seite eine relative
// Basis und verlangt ausgeschriebene Dateinamen statt Verzeichnis-URLs.
declare global {
  interface Window {
    __BASIS?: string;
    __DATEIEN?: boolean;
  }
}

export function url(pfad: string) {
  const w = typeof window === 'undefined' ? undefined : window;
  const basis = w?.__BASIS ?? '/';
  const i = pfad.search(/[?#]/);
  let teil = (i < 0 ? pfad : pfad.slice(0, i)).replace(/^\//, '');
  const rest = i < 0 ? '' : pfad.slice(i);
  if (w?.__DATEIEN && (teil === '' || teil.endsWith('/'))) teil += 'index.html';
  return basis + teil + rest;
}
