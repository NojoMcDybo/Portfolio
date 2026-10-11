import * as THREE from 'three';
import { TEICH_L, TEICH_W, type InselLayout } from './insel-layout';

// Alles in 2D (x, z): die Insel ist flach, Bodenhöhe = 0. Keine Physik-Engine nötig.

export const AUGE = 0.5; // Augenhöhe. Bäume sind 1,75 hoch: man fühlt sich klein im Wald.
const KOERPER = 0.18; // Radius des unsichtbaren Körpers
const STAMM = 0.36; // Kollisionsradius eines Baums: die unterste Kronenstufe ist 0,5 breit
const RAND = 0.35; // Abstand zur Inselkante
const UFER = 0.12; // Abstand zum Wasser

/** Schiebt p aus Bäumen, Teichen und über den Inselrand zurück. Verändert p. */
export function kollidiere(p: THREE.Vector2, layout: InselLayout, baeume: [number, number][]) {
  for (let durchgang = 0; durchgang < 2; durchgang++) {
    for (const [bx, bz] of baeume) {
      const dx = p.x - bx;
      const dz = p.y - bz;
      const min = KOERPER + STAMM;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = bx + (dx / d) * min;
        p.y = bz + (dz / d) * min;
      }
    }
    for (const pl of layout.plaetze) {
      // Teich als Rechteck: entlang der Kante |e| < W/2, nach innen 0..L
      const dx = p.x - pl.kante.x;
      const dz = p.y - pl.kante.z;
      const e = -dx * pl.n.z + dz * pl.n.x;
      const i = -(dx * pl.n.x + dz * pl.n.z);
      const halb = TEICH_W / 2 + KOERPER + UFER;
      const tief = TEICH_L + KOERPER + UFER;
      if (Math.abs(e) < halb && i < tief) {
        // kürzester Weg hinaus: nach innen oder zur Seite
        const raus = [tief - i, halb - Math.abs(e)];
        if (raus[0] <= raus[1]) {
          p.x -= pl.n.x * raus[0];
          p.y -= pl.n.z * raus[0];
        } else {
          const s = Math.sign(e) || 1;
          p.x += -pl.n.z * raus[1] * s;
          p.y += pl.n.x * raus[1] * s;
        }
      }
    }
    for (const n of layout.normalen) {
      const ueber = p.x * n.x + p.y * n.y - (layout.apothem - RAND);
      if (ueber > 0) {
        p.x -= n.x * ueber;
        p.y -= n.y * ueber;
      }
    }
  }
  return p;
}

/** Steht man am Ufer eines Teichs und schaut ungefähr hin? Gibt den Index zurück, sonst -1. */
export function teichInReichweite(p: THREE.Vector2, blick: THREE.Vector2, layout: InselLayout) {
  let best = -1;
  let bestAbstand = Infinity;
  layout.plaetze.forEach((pl, k) => {
    const dx = p.x - pl.kante.x;
    const dz = p.y - pl.kante.z;
    const e = -dx * pl.n.z + dz * pl.n.x;
    const i = -(dx * pl.n.x + dz * pl.n.z);
    const abstand = i - TEICH_L; // Abstand zum inneren Ufer
    const schautHin = blick.x * pl.n.x + blick.y * pl.n.z > 0.25;
    if (Math.abs(e) < TEICH_W / 2 + 0.6 && abstand < 1.1 && abstand > -0.1 && schautHin && abstand < bestAbstand) {
      best = k;
      bestAbstand = abstand;
    }
  });
  return best;
}

/** Wo man steht, wenn man zu Teich k hingeht: mittig vor dem inneren Ufer. */
export function uferPunkt(layout: InselLayout, k: number) {
  const pl = layout.plaetze[k];
  const r = layout.wegR; // mitten auf dem Uferweg
  return new THREE.Vector2(pl.n.x * r, pl.n.z * r);
}

/** Blickrichtung (yaw) zu einem Punkt. Kamera schaut entlang −Z, yaw dreht um Y. */
export function yawZu(von: THREE.Vector2, nach: THREE.Vector2) {
  return Math.atan2(-(nach.x - von.x), -(nach.y - von.y));
}
