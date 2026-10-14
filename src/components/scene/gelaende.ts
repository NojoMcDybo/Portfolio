import { TEICH_L, TEICH_W, type InselLayout } from './insel-layout';

/**
 * Sanft gewelltes Gelände. Eine Funktion h(x, z), die alle teilen: Wiese, Bäume, Gras,
 * Blumen, Steine und die Kamera beim Gehen. Am Inselrand, am Uferweg und an den Teichen
 * ist sie flach (h = 0), damit Wasserfälle bündig bleiben und der Weg eben ist.
 */
export type Hoehe = (x: number, z: number) => number;

const AMPLITUDE = 0.55;

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function rausch(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const glatt = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function gelaende(layout: InselLayout): Hoehe {
  return (x, z) => {
    const r = Math.hypot(x, z);
    // Flach an Rand und Weg
    let maske = 1 - glatt(layout.apothem - 1.6, layout.apothem - 0.5, r);
    maske *= glatt(0.55, 1.4, Math.abs(r - layout.wegR));
    // Flach um die Teiche
    for (const p of layout.plaetze) {
      const dx = x - p.kante.x;
      const dz = z - p.kante.z;
      const e = Math.abs(-dx * p.n.z + dz * p.n.x) - TEICH_W / 2;
      const i = -(dx * p.n.x + dz * p.n.z) - TEICH_L;
      const abstand = Math.max(e, i, 0);
      if (e < 1.5 && i < 1.5) maske *= glatt(0.3, 1.3, abstand);
    }
    if (maske <= 0) return 0;
    const n = rausch(x * 0.22 + 3.1, z * 0.22 - 1.7) * 0.7 + rausch(x * 0.55, z * 0.55) * 0.3;
    return Math.max(0, n - 0.32) * AMPLITUDE * 1.6 * maske;
  };
}
