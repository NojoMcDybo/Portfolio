import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { InselLayout } from './insel-layout';
import { FARBE } from './palette';
import { windShader } from './wind';

// Augenhöhe ist 0,5: die Wiese reicht bis knapp über den Knöchel
const HALM_H = 0.075;
const HALM_B = 0.02;

/**
 * Gras-Engine: ein InstancedMesh, ein Draw Call. Halme stehen auf der Wiese, nicht auf dem
 * Weg und nicht im Wasser. Normalen zeigen nach oben (Wiese statt Einzelblatt), beide Seiten
 * als eigene Dreiecke statt DoubleSide, damit die Rückseite nicht dunkel wird.
 */
export function Gras({ layout, wegBreite }: { layout: InselLayout; wegBreite: number }) {
  const anzahl = useMemo(() => {
    const klein = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    return klein ? 22000 : 60000;
  }, []);
  const geo = useMemo(() => halmGeometrie(), []);
  const { mat, zeit } = useMemo(() => {
    const zeit = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    mat.onBeforeCompile = windShader(zeit, HALM_H, 0.55);
    return { mat, zeit };
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const im = ref.current!;
    let s = 11;
    const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const skala = new THREE.Vector3();
    const achse = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const r = layout.apothem;
    let i = 0;
    for (let versuch = 0; i < anzahl && versuch < anzahl * 4; versuch++) {
      const x = (zufall() * 2 - 1) * r;
      const z = (zufall() * 2 - 1) * r;
      if (!layout.aufLand(x, z, 0.04)) continue;
      // Weg frei lassen, die Ränder franst das Gras aus
      if (Math.abs(layout.randAbstand(x, z) - layout.wegR) < wegBreite / 2 - 0.06 - zufall() * 0.12) continue;
      const k = 0.65 + zufall() * 0.7;
      q.setFromAxisAngle(achse, zufall() * Math.PI);
      im.setMatrixAt(i, m.compose(pos.set(x, 0, z), q, skala.set(k, k * (0.8 + zufall() * 0.5), k)));
      const hell = 0.85 + zufall() * 0.3;
      im.setColorAt(i, c.setRGB(hell, hell, hell * 0.95));
      i++;
    }
    im.count = i;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [layout, anzahl, wegBreite]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  useFrame(({ clock }) => {
    zeit.value = clock.elapsedTime;
  });

  return <instancedMesh ref={ref} args={[geo, mat, anzahl]} receiveShadow raycast={() => null} />;
}

/** Ein Halm: drei Segmente, spitz zulaufend, Vorder- und Rückseite. */
function halmGeometrie() {
  const stufen: [number, number][] = [
    // Höhe (0..1), Breite (0..1)
    [0, 1],
    [0.45, 0.72],
    [0.8, 0.4],
  ];
  const p: number[] = [];
  for (const [h, b] of stufen) p.push(-(HALM_B / 2) * b, h * HALM_H, 0, (HALM_B / 2) * b, h * HALM_H, 0);
  p.push(0.004, HALM_H, 0); // Spitze, leicht geneigt
  const vorne = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  const hinten: number[] = [];
  for (let i = 0; i < vorne.length; i += 3) hinten.push(vorne[i], vorne[i + 2], vorne[i + 1]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const anz = p.length / 3;
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(anz).fill([0, 1, 0]).flat(), 3));
  const unten = new THREE.Color(FARBE.grasDunkel).multiplyScalar(0.72);
  const oben = new THREE.Color(FARBE.grasHell);
  const farben: number[] = [];
  for (let i = 0; i < anz; i++) {
    const t = p[i * 3 + 1] / HALM_H;
    const c = unten.clone().lerp(oben, t);
    farben.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.setIndex([...vorne, ...hinten]);
  return g;
}
