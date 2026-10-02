import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PLATEAU_D, TEICH_L, type InselLayout } from './insel-layout';

const GRAS = '#a9b98f';
const ERDE = '#8a6f55';
const ERDE_DUNKEL = '#6d5642';
const STAMM = '#7a5c43';
const KRONE = '#7f9c6e';
const KRONE_TINT = '#e2ecd2'; // multipliziert die Nadeltextur
const KRONE_SCHEIN = '#9fbf86';

/** Flaches Plateau mit Kerben für die Teiche, Erdkegel darunter, Wald aus gleich großen Bäumen. */
export function Insel({ layout }: { layout: InselLayout }) {
  const plateau = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(layout.form, { depth: PLATEAU_D, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // (sx, sy, e) → (sx, e, −sy)
    g.translate(0, -PLATEAU_D, 0);
    return g;
  }, [layout]);
  // Gras als eigener Deckel: so bleibt die Unterseite des Plateaus Erde.
  const gras = useMemo(() => {
    const g = new THREE.ShapeGeometry(layout.form);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.002, 0);
    return g;
  }, [layout]);
  useEffect(() => () => (plateau.dispose(), gras.dispose()), [plateau, gras]);

  const N = layout.seiten;
  // Der Kegel bleibt innerhalb der Teiche, damit die Wasserfälle frei hängen.
  const kegelR = layout.apothem - TEICH_L - 0.5;
  return (
    <group>
      <mesh geometry={plateau} receiveShadow>
        <meshStandardMaterial attach="material-0" color={ERDE_DUNKEL} roughness={1} />
        <meshStandardMaterial attach="material-1" color={ERDE} roughness={1} />
      </mesh>
      <mesh geometry={gras} receiveShadow>
        <meshStandardMaterial color={GRAS} roughness={1} />
      </mesh>
      <mesh position={[0, -PLATEAU_D - 3.2, 0]} castShadow>
        <cylinderGeometry args={[kegelR, 0.5, 6.4, N * 2, 4, true]} />
        <meshStandardMaterial color={ERDE_DUNKEL} roughness={1} flatShading />
      </mesh>
      <Wald layout={layout} />
    </group>
  );
}

const BAUM_HOEHE = 1.75; // alle gleich groß
const BAUM_URL = '/modelle/baum.glb';

/** Baumstandorte: gejittertes Raster mit festem Seed, nur auf Land. */
function useStandorte(layout: InselLayout) {
  return useMemo(() => {
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
}

function Wald({ layout }: { layout: InselLayout }) {
  const punkte = useStandorte(layout);
  return (
    <Suspense fallback={<GrayboxWald punkte={punkte} />}>
      <EzWald punkte={punkte} />
    </Suspense>
  );
}

/** EZ-Tree-Modell (scripts/baum.mjs), zwei InstancedMeshes: Äste und Nadeln. */
function EzWald({ punkte }: { punkte: [number, number][] }) {
  const { scene } = useGLTF(BAUM_URL);
  const teile = useMemo(() => {
    const t: { geo: THREE.BufferGeometry; mat: THREE.Material; nadeln: boolean }[] = [];
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      const nadeln = o.name.includes('blaetter');
      if (nadeln) {
        // Die Nadeltextur ist ein dunkles Fichtengrün. Eigenschein aus derselben Textur macht es sanfter.
        mat.color.set(KRONE_TINT);
        mat.emissive.set(KRONE_SCHEIN);
        mat.emissiveMap = mat.map;
        mat.emissiveIntensity = 0.85;
      }
      t.push({ geo: m.geometry, mat, nadeln });
    });
    return t;
  }, [scene]);
  const hoehe = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return box.max.y - box.min.y;
  }, [scene]);

  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const k = BAUM_HOEHE / hoehe;
    const skala = new THREE.Vector3(k, k, k);
    for (const im of refs.current) {
      if (!im) continue;
      punkte.forEach(([x, z], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.39);
        im.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, skala));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [punkte, hoehe, teile]);

  return (
    <group>
      {teile.map((t, i) => (
        <instancedMesh
          key={i}
          ref={(el) => void (refs.current[i] = el)}
          args={[t.geo, t.mat, punkte.length]}
          castShadow
          receiveShadow={!t.nadeln}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
useGLTF.preload(BAUM_URL);

/** Ersatz, solange das Modell lädt: Kegel und Stamm. */
function GrayboxWald({ punkte }: { punkte: [number, number][] }) {
  const staemme = useRef<THREE.InstancedMesh>(null);
  const kronen = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eins = new THREE.Vector3(1, 1, 1);
    punkte.forEach(([x, z], i) => {
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
