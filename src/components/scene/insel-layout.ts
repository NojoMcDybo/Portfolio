import * as THREE from 'three';
import { TEICH_VP_W, TEICH_VP_H } from '../../lib/teich-konstanten';

// Teichmaße in Welt-Einheiten. Seitenverhältnis = Iframe-Ausschnitt, sonst passt
// die Oberfläche nicht pixelgenau auf die echte Seite.
export const TEICH_W = 3.6;
export const TEICH_L = (TEICH_W * TEICH_VP_H) / TEICH_VP_W;
// Das Plateau ist flach. Die Teiche hängen als Wasserfälle über die Kante hinaus.
export const PLATEAU_D = 0.8;
/** Welt-Einheiten pro CSS-Pixel. Gilt in x und in der Zeit: Die Seite hängt unverzerrt herunter. */
export const PX_WELT = TEICH_W / TEICH_VP_W;
const MAX_TIEFE = 24; // ≈ 4300 px Scrollweg

/** Länge des Wasserfalls = Scrollweg der Seite (seiteH − Ausschnitt), mindestens etwas mehr als das Plateau. */
export function teichTiefe(seiteH: number) {
  return Math.min(MAX_TIEFE, Math.max(PLATEAU_D + 0.6, (seiteH - TEICH_VP_H) * PX_WELT));
}

const OBEN = new THREE.Vector3(0, 1, 0);

/*
 * Ausrichtung: Der Seitenanfang (Nord, v = 0) liegt innen am Wald, nach außen zeigt
 * die Südwand = Seite(x, vpH + t·v). Andersherum (Nordwand außen) wäre die Wand von
 * außen zwingend spiegelverkehrt und die Oberfläche stünde auf dem Kopf. So liest
 * man oben vom Wald zum Rand und dann die Wand hinunter: eine über die Kante
 * gefaltete Seite.
 */
export interface TeichPlatz {
  /** Außennormale der Schnittkante = lokale +Z-Achse (Süd) */
  n: THREE.Vector3;
  /** Mitte der Kante an der Oberfläche */
  kante: THREE.Vector3;
  /** Ecke oben-Nord-West = lokaler Ursprung (innen) */
  ursprung: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Mitte der Wasseroberfläche bei Zeit w ∈ [0,1] in einem Teich der Tiefe `tiefe` */
  oberflaeche(w: number, tiefe: number, ziel?: THREE.Vector3): THREE.Vector3;
  /** Kamera-Orientierung für die Draufsicht: Seitenanfang (Nord) zeigt nach oben. */
  draufsicht: THREE.Quaternion;
}

export interface InselLayout {
  seiten: number;
  radius: number;
  apothem: number;
  plaetze: TeichPlatz[];
  form: THREE.Shape;
  /** Liegt ein Punkt (x, z) auf dem Plateau und nicht in einem Teich? */
  aufLand(x: number, z: number, rand: number): boolean;
}

export function inselLayout(anzahlTeiche: number): InselLayout {
  const N = Math.max(anzahlTeiche, 6);
  // Jede Kante braucht Platz für einen Teich plus Ufer links und rechts.
  const R = Math.max(9, (TEICH_W + 2.8) / (2 * Math.sin(Math.PI / N)));
  const a = R * Math.cos(Math.PI / N);
  const winkel = (k: number) => Math.PI / 2 + (2 * Math.PI * k) / N; // Teich 0 zeigt zur Startkamera (+Z)

  const plaetze: TeichPlatz[] = [];
  const umriss: THREE.Vector2[] = [];
  // Shape-Koordinaten (sx, sy) → Welt (x, z) = (sx, −sy), siehe rotateX unten.
  const push = (v: THREE.Vector3) => umriss.push(new THREE.Vector2(v.x, -v.z));

  for (let k = 0; k < N; k++) {
    const th = winkel(k);
    const ecke = new THREE.Vector3(R * Math.cos(th - Math.PI / N), 0, R * Math.sin(th - Math.PI / N));
    push(ecke);
    if (k >= anzahlTeiche) continue;

    const n = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const t = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th)); // entlang der Kante, Umlaufrichtung
    const m = n.clone().multiplyScalar(a);
    // Kerbe im Plateau, die der Teich exakt ausfüllt (in Umlaufrichtung)
    const kerbe = m.clone().addScaledVector(t, -TEICH_W / 2);
    push(kerbe);
    push(kerbe.clone().addScaledVector(n, -TEICH_L));
    push(kerbe.clone().addScaledVector(t, TEICH_W).addScaledVector(n, -TEICH_L));
    push(kerbe.clone().addScaledVector(t, TEICH_W));

    // Lokale Achsen: X = −t, Y = oben, Z = n (rechtshändig: −t × Y = n)
    const x = t.clone().negate();
    const ursprung = m.clone().addScaledVector(n, -TEICH_L).addScaledVector(x, -TEICH_W / 2);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, OBEN, n));
    // Draufsicht: Bild-oben = innen (Seitenanfang), Bild-rechts = lokale X
    const draufsicht = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(x, n.clone().negate(), OBEN),
    );
    const mitte = m.clone().addScaledVector(n, -TEICH_L / 2);
    plaetze.push({
      n,
      kante: m,
      ursprung,
      quaternion,
      draufsicht,
      oberflaeche: (w, tiefe, ziel = new THREE.Vector3()) => ziel.copy(mitte).setY(-w * tiefe),
    });
  }

  const form = new THREE.Shape(umriss);

  const aufLand = (x: number, z: number, rand: number) => {
    for (let k = 0; k < N; k++) {
      const th = winkel(k);
      if (x * Math.cos(th) + z * Math.sin(th) > a - rand) return false;
    }
    for (const p of plaetze) {
      const dx = x - p.kante.x;
      const dz = z - p.kante.z;
      const entlang = Math.abs(-dx * p.n.z + dz * p.n.x);
      const innen = -(dx * p.n.x + dz * p.n.z);
      if (entlang < TEICH_W / 2 + rand && innen > -rand && innen < TEICH_L + rand) return false;
    }
    return true;
  };

  return { seiten: N, radius: R, apothem: a, plaetze, form, aufLand };
}

/**
 * Skalierung des Iframes (640 × 480 CSS-px) im Tauchmodus. Kamera-Höhe und
 * Overlay rechnen beide hiermit, damit Oberfläche und DOM deckungsgleich sind.
 */
export function tauchSkala(vw: number, vh: number) {
  return Math.max(0.3, Math.min((vw - 32) / TEICH_VP_W, (vh - 150) / TEICH_VP_H, 1.6));
}

/** Kamerahöhe über der Oberfläche, bei der der Teich genau tauchSkala·640 px breit erscheint. */
export function tauchHoehe(vw: number, vh: number, fovGrad: number) {
  const zielPx = TEICH_VP_W * tauchSkala(vw, vh);
  return (TEICH_W * vh) / (2 * Math.tan(THREE.MathUtils.degToRad(fovGrad) / 2) * zielPx);
}
