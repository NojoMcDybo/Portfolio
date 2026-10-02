import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PLATEAU_D, type InselLayout } from './insel-layout';

const GRAS = '#a9b98f';
const ERDE = '#8a6f55';
const ERDE_DUNKEL = '#6d5642';
const STAMM = '#7a5c43';
const KRONE = '#7f9c6e';

/** Graybox: Plateau mit Kerben für die Teiche, Erdkegel darunter, Wald aus gleich großen Bäumen. */
export function Insel({ layout }: { layout: InselLayout }) {
  const plateau = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(layout.form, { depth: PLATEAU_D, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // (sx, sy, e) → (sx, e, −sy)
    g.translate(0, -PLATEAU_D, 0);
    return g;
  }, [layout]);

  const N = layout.seiten;
  return (
    <group>
      {/* ExtrudeGeometry: Gruppe 0 = Deckel, Gruppe 1 = Seiten */}
      <mesh geometry={plateau}>
        <meshStandardMaterial attach="material-0" color={GRAS} roughness={1} />
        <meshStandardMaterial attach="material-1" color={ERDE} roughness={1} />
      </mesh>
      <mesh position={[0, -PLATEAU_D - 2.6, 0]}>
        <cylinderGeometry args={[layout.radius * 0.97, 0.6, 5.2, N, 1, true, Math.PI / N]} />
        <meshStandardMaterial color={ERDE_DUNKEL} roughness={1} flatShading />
      </mesh>
      <Wald layout={layout} />
    </group>
  );
}

function Wald({ layout }: { layout: InselLayout }) {
  const staemme = useRef<THREE.InstancedMesh>(null);
  const kronen = useRef<THREE.InstancedMesh>(null);

  const punkte = useMemo(() => {
    // Gejittertes Raster mit festem Seed: jeder Reload gleicher Wald.
    let s = 7;
    const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const p: [number, number][] = [];
    const r = layout.radius;
    for (let x = -r; x <= r; x += 1.15) {
      for (let z = -r; z <= r; z += 1.15) {
        const px = x + (zufall() - 0.5) * 0.7;
        const pz = z + (zufall() - 0.5) * 0.7;
        if (layout.aufLand(px, pz, 0.55)) p.push([px, pz]);
      }
    }
    return p;
  }, [layout]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eins = new THREE.Vector3(1, 1, 1);
    punkte.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.39);
      staemme.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.25, z), q, eins));
      kronen.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 1.1, z), q, eins));
    });
    staemme.current!.instanceMatrix.needsUpdate = true;
    kronen.current!.instanceMatrix.needsUpdate = true;
    staemme.current!.computeBoundingSphere();
    kronen.current!.computeBoundingSphere();
  }, [punkte]);

  return (
    <group>
      <instancedMesh ref={staemme} args={[undefined, undefined, punkte.length]} raycast={() => null}>
        <cylinderGeometry args={[0.07, 0.09, 0.5, 6]} />
        <meshStandardMaterial color={STAMM} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={kronen} args={[undefined, undefined, punkte.length]} raycast={() => null}>
        <coneGeometry args={[0.42, 1.3, 7]} />
        <meshStandardMaterial color={KRONE} roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
