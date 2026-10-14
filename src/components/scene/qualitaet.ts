// Qualitätsstufen. Ein PerformanceMonitor (Inselszene) senkt die Stufe, wenn die Bildrate
// fällt. Gemessen in SwiftShader, Anteil an der Bildzeit bei allem an: weiche VSM-Schatten
// ≈ 48 % (deshalb PCF mit Filterradius), Gras ≈ 30 %, AO ≈ 25 %, MSAA ≈ 23 %.
// Zum Testen: window.__STUFE = 0..3 vor dem Laden setzen (schaltet den Monitor ab).
export interface Qualitaet {
  ao: boolean; // Umgebungsverdeckung (N8AO), rendert die Szene ein zweites Mal
  grasAnteil: number; // 0..1 der Halme
  msaa: number; // Kantenglättung im Composer
  tiltShift: boolean;
  dpr: [number, number];
}

export const MAX_STUFE = 3;

export function feste(): number | undefined {
  const s = typeof window !== 'undefined' ? (window as unknown as { __STUFE?: number }).__STUFE : undefined;
  return typeof s === 'number' ? s : undefined;
}

export function startStufe() {
  const klein = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return feste() ?? (klein ? 1 : 0);
}

export function qualitaet(stufe: number): Qualitaet {
  return {
    ao: stufe < 1,
    msaa: stufe < 2 ? 4 : 0,
    dpr: stufe < 2 ? [1, 1.5] : [1, 1],
    grasAnteil: stufe < 3 ? 1 : 0.4,
    tiltShift: stufe < 3,
  };
}
