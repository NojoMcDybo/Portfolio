import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { PLATEAU_D, TEICH_L, type InselLayout } from './insel-layout';

const GRAS = '#a9b98f';
const ERDE = '#8a6f55';
const ERDE_DUNKEL = '#6d5642';
const STAMM = '#7a5c43';
// Sanftes Grün, nach oben heller
const KRONE_UNTEN = '#6f8c5e';
const KRONE_MITTE = '#7f9c6b';
const KRONE_OBEN = '#91ad7c';

/** Flaches Plateau mit Kerben für die Teiche, Erdkegel darunter, Wald aus gleich großen Bäumen. */
export function Insel({
  layout,
  baeume,
  onBoden,
}: {
  layout: InselLayout;
  baeume: [number, number][];
  /** Klick auf den Rasen (Weltpunkt). Bäume sind für Raycasts unsichtbar, Klicks gehen durch. */
  onBoden?: (p: THREE.Vector3, e: ThreeEvent<MouseEvent>) => void;
}) {
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
      <mesh geometry={gras} receiveShadow onClick={(e) => onBoden?.(e.point, e)}>
        <meshStandardMaterial color={GRAS} roughness={1} />
      </mesh>
      <Uferweg layout={layout} />
      <mesh position={[0, -PLATEAU_D - 3.2, 0]} castShadow>
        <cylinderGeometry args={[kegelR, 0.5, 6.4, N * 2, 4, true]} />
        <meshStandardMaterial color={ERDE_DUNKEL} roughness={1} flatShading />
      </mesh>
      <Wald punkte={baeume} />
    </group>
  );
}

const BAUM_HOEHE = 1.75; // alle gleich groß
const WEG_BREITE = 0.9;
const WEG = '#cdbf9f';

/** Sandiger Rundweg vor allen Teichen, parallel zu den Kanten. Klicks gehen an den Rasen darunter. */
function Uferweg({ layout }: { layout: InselLayout }) {
  const geo = useMemo(() => {
    const N = layout.seiten;
    const k = 1 / Math.cos(Math.PI / N); // Kantenabstand → Eckenradius
    const g = new THREE.RingGeometry(
      (layout.wegR - WEG_BREITE / 2) * k,
      (layout.wegR + WEG_BREITE / 2) * k,
      N,
      1,
      -Math.PI / 2 + Math.PI / N,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.004, 0);
    return g;
  }, [layout]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow raycast={() => null}>
      <meshStandardMaterial color={WEG} roughness={1} />
    </mesh>
  );
}

/** Baumstandorte: gejittertes Raster mit festem Seed, nur auf Land. Auch für die Kollision beim Gehen. */
export function baumStandorte(layout: InselLayout): [number, number][] {
  {
    let s = 7;
    const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const p: [number, number][] = [];
    const r = layout.radius;
    for (let x = -r; x <= r; x += 1.15) {
      for (let z = -r; z <= r; z += 1.15) {
        const px = x + (zufall() - 0.5) * 0.7;
        const pz = z + (zufall() - 0.5) * 0.7;
        // Der Uferweg bleibt frei
        const weg = Math.abs(layout.polyAbstand(px, pz) - layout.wegR) < WEG_BREITE / 2 + 0.3;
        if (layout.aufLand(px, pz, 0.55) && !weg) p.push([px, pz]);
      }
    }
    return p;
  }
}

/** Wald: ein einziges InstancedMesh, ein Draw Call für alle Bäume (plus einer für den Schatten). */
function Wald({ punkte }: { punkte: [number, number][] }) {
  const geo = useMemo(() => baumGeometrie(), []);
  const { mat, tiefe, zeit } = useMemo(() => windMaterialien(), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const im = ref.current!;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eins = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    punkte.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.39);
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, eins));
      // Kaum merkliche Helligkeitsunterschiede, damit der Wald nicht gestempelt wirkt
      const hell = 0.94 + ((i * 37) % 13) / 100;
      im.setColorAt(i, c.setRGB(hell, hell, hell));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [punkte]);
  useEffect(() => () => (geo.dispose(), mat.dispose(), tiefe.dispose()), [geo, mat, tiefe]);

  useFrame(({ clock }) => {
    zeit.value = clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, punkte.length]}
      customDepthMaterial={tiefe}
      castShadow
      receiveShadow
      raycast={() => null}
    />
  );
}

/**
 * Low-Poly-Tanne: Stamm und drei gestaffelte Kegel, flach schattiert, Farben als Vertex-Farben.
 * Opak (kein Alpha-Test): nah im Wald keine Überzeichnung, ≈60 Dreiecke pro Baum.
 */
function baumGeometrie() {
  const teile: THREE.BufferGeometry[] = [];
  const farbig = (g: THREE.BufferGeometry, farbe: string) => {
    const n = g.toNonIndexed();
    const c = new THREE.Color(farbe);
    const f = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < f.length; i += 3) c.toArray(f, i);
    n.setAttribute('color', new THREE.BufferAttribute(f, 3));
    n.deleteAttribute('uv');
    teile.push(n);
    g.dispose();
  };
  farbig(new THREE.CylinderGeometry(0.045, 0.07, 0.5, 5).translate(0, 0.25, 0), STAMM);
  const stufen: [number, number, number, string][] = [
    // Radius, Höhe, Unterkante, Farbe
    [0.5, 0.72, 0.32, KRONE_UNTEN],
    [0.39, 0.6, 0.72, KRONE_MITTE],
    [0.27, 0.5, 1.08, KRONE_OBEN],
  ];
  stufen.forEach(([r, h, y, farbe], i) => {
    const kegel = new THREE.ConeGeometry(r, h, 7, 1);
    kegel.rotateY(i * 0.45); // Kanten der Stufen versetzt
    farbig(kegel.translate(0, y + h / 2, 0), farbe);
  });
  const g = mergeGeometries(teile)!;
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/**
 * Wind im Vertex-Shader: Auslenkung wächst mit der Höhe², jede Tanne hat ihre Phase
 * (aus der Instanzposition), dazu langsame Böen. Der Schatten bekommt dieselbe Formel.
 */
function windMaterialien() {
  const zeit = { value: 0 };
  const wind = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uZeit = zeit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uZeit;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 basis = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float h = clamp(position.y / ${BAUM_HOEHE.toFixed(2)}, 0.0, 1.0);
          float phase = basis.x * 0.7 + basis.z * 0.5;
          float boe = 0.6 + 0.4 * sin(uZeit * 0.23 + basis.x * 0.08);
          float aus = (sin(uZeit * 1.4 + phase) * 0.6 + sin(uZeit * 2.3 + phase * 1.7) * 0.25) * boe;
          transformed.x += aus * 0.06 * h * h;
          transformed.z += aus * 0.035 * h * h;
        }`,
      );
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  mat.onBeforeCompile = wind;
  const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  tiefe.onBeforeCompile = wind;
  return { mat, tiefe, zeit };
}
