import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { PLATEAU_D, TEICH_L, type InselLayout } from './insel-layout';
import { FARBE } from './palette';
import { windShader } from './wind';
import { Gras } from './Gras';

export const BAUM_HOEHE = 1.88; // alle gleich groß
const WEG_BREITE = 0.9;

/** Runde Insel mit Kerben für die Teiche, Erdkegel darunter, Wiese, Uferweg und Laubwald. */
export function Insel({
  layout,
  baeume,
  onBoden,
}: {
  layout: InselLayout;
  baeume: [number, number][];
  /** Klick auf den Boden (Weltpunkt). Bäume und Gras sind für Raycasts unsichtbar. */
  onBoden?: (p: THREE.Vector3, e: ThreeEvent<MouseEvent>) => void;
}) {
  const plateau = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(layout.form, { depth: PLATEAU_D, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); // (sx, sy, e) → (sx, e, −sy)
    g.translate(0, -PLATEAU_D, 0);
    return g;
  }, [layout]);
  // Wiese als eigener Deckel: so bleibt die Unterseite des Plateaus Erde.
  const wiese = useMemo(() => {
    const g = new THREE.ShapeGeometry(layout.form, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.002, 0);
    return g;
  }, [layout]);
  const wieseMat = useMemo(() => wiesenMaterial(), []);
  useEffect(() => () => (plateau.dispose(), wiese.dispose(), wieseMat.dispose()), [plateau, wiese, wieseMat]);

  // Der Kegel bleibt innerhalb der Teiche, damit die Wasserfälle frei hängen.
  const kegelR = layout.apothem - TEICH_L - 0.5;
  return (
    <group>
      <mesh geometry={plateau} receiveShadow>
        <meshStandardMaterial attach="material-0" color={FARBE.erdeDunkel} roughness={1} />
        <meshStandardMaterial attach="material-1" color={FARBE.erde} roughness={1} />
      </mesh>
      <mesh geometry={wiese} material={wieseMat} receiveShadow onClick={(e) => onBoden?.(e.point, e)} />
      <Uferweg layout={layout} />
      <mesh position={[0, -PLATEAU_D - 3.2, 0]} castShadow>
        <cylinderGeometry args={[kegelR, 0.5, 6.4, 40, 4, true]} />
        <meshStandardMaterial color={FARBE.erdeDunkel} roughness={1} flatShading />
      </mesh>
      <Gras layout={layout} wegBreite={WEG_BREITE} />
      <Wald punkte={baeume} />
    </group>
  );
}

/**
 * Wiese: Farbe aus zwei Rauschebenen in Weltkoordinaten (große helle Flecken, feine
 * Unruhe). Kein Texturbild, kein zusätzlicher Draw Call.
 */
function wiesenMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  const hell = new THREE.Color(FARBE.grasHell);
  const mitte = new THREE.Color(FARBE.gras);
  const dunkel = new THREE.Color(FARBE.grasDunkel);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHell = { value: hell };
    shader.uniforms.uMitte = { value: mitte };
    shader.uniforms.uDunkel = { value: dunkel };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBoden;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoden = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vBoden;
        uniform vec3 uHell; uniform vec3 uMitte; uniform vec3 uDunkel;
        float rausch(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float gross = rausch(vBoden * 0.28) * 0.65 + rausch(vBoden * 0.9) * 0.35;
          float fein = rausch(vBoden * 7.0);
          vec3 wiese = mix(uDunkel, uMitte, smoothstep(0.2, 0.55, gross));
          wiese = mix(wiese, uHell, smoothstep(0.55, 0.85, gross));
          diffuseColor.rgb = wiese * (0.92 + 0.12 * fein);
        }`,
      );
  };
  return m;
}

/** Sandiger Rundweg vor allen Teichen. Klicks gehen an die Wiese darunter. */
function Uferweg({ layout }: { layout: InselLayout }) {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(layout.wegR - WEG_BREITE / 2, layout.wegR + WEG_BREITE / 2, 96, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.004, 0);
    return g;
  }, [layout]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow raycast={() => null}>
      <meshStandardMaterial color={FARBE.weg} roughness={1} />
    </mesh>
  );
}

/** Baumstandorte: gejittertes Raster mit festem Seed, nur auf Land. Auch für die Kollision beim Gehen. */
export function baumStandorte(layout: InselLayout): [number, number][] {
  let s = 7;
  const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p: [number, number][] = [];
  const r = layout.apothem;
  for (let x = -r; x <= r; x += 1.0) {
    for (let z = -r; z <= r; z += 1.0) {
      const px = x + (zufall() - 0.5) * 0.6;
      const pz = z + (zufall() - 0.5) * 0.6;
      // Der Uferweg und ein Streifen davor bleiben frei: der Wald steht als Block in der Mitte
      const amWeg = layout.randAbstand(px, pz) > layout.wegR - WEG_BREITE / 2 - 0.55;
      if (layout.aufLand(px, pz, 0.55) && !amWeg) p.push([px, pz]);
    }
  }
  return p;
}

/** Wald: ein einziges InstancedMesh, ein Draw Call für alle Bäume (plus einer für den Schatten). */
function Wald({ punkte }: { punkte: [number, number][] }) {
  const geo = useMemo(() => baumGeometrie(), []);
  const { mat, tiefe, zeit } = useMemo(() => {
    const zeit = { value: 0 };
    const wind = windShader(zeit, BAUM_HOEHE, 1);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    mat.onBeforeCompile = wind;
    const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    tiefe.onBeforeCompile = wind;
    return { mat, tiefe, zeit };
  }, []);
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
      const hell = 0.93 + ((i * 37) % 13) / 90;
      im.setColorAt(i, c.setRGB(hell, hell, hell * 0.97));
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
 * Low-Poly-Laubbaum: Stamm und vier Ikosaeder als Krone, flach schattiert. Farbe als
 * Vertex-Farbe von dunkel (unten) nach sonnig (oben), ≈90 Dreiecke. Die Krone beginnt
 * über Augenhöhe: zu Fuß geht man unter dem Blätterdach.
 */
function baumGeometrie() {
  const teile: THREE.BufferGeometry[] = [];
  const unten = new THREE.Color(FARBE.kroneUnten);
  const oben = new THREE.Color(FARBE.kroneOben);
  const einfaerben = (g: THREE.BufferGeometry, farbe: (y: number) => THREE.Color) => {
    const n = g.index ? g.toNonIndexed() : g;
    const pos = n.attributes.position;
    const f = new Float32Array(pos.count * 3);
    // Pro Dreieck eine Farbe (Schwerpunkt), passend zum flachen Schattieren
    for (let i = 0; i < pos.count; i += 3) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const c = farbe(y);
      for (let k = 0; k < 3; k++) c.toArray(f, (i + k) * 3);
    }
    n.setAttribute('color', new THREE.BufferAttribute(f, 3));
    if (n.attributes.uv) n.deleteAttribute('uv');
    teile.push(n);
  };
  const stammFarbe = new THREE.Color(FARBE.stamm);
  einfaerben(new THREE.CylinderGeometry(0.045, 0.075, 0.95, 6).translate(0, 0.475, 0), () => stammFarbe);
  const kronen: [number, number, number, number][] = [
    // x, y, z, Radius
    [0, 1.3, 0, 0.5],
    [0.3, 1.1, 0.12, 0.36],
    [-0.26, 1.14, -0.16, 0.38],
    [0.04, 1.58, -0.06, 0.32],
  ];
  const tmp = new THREE.Color();
  for (const [x, y, z, r] of kronen) {
    einfaerben(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), (h) =>
      tmp.copy(unten).lerp(oben, THREE.MathUtils.smoothstep(h, 0.8, 1.85)),
    );
  }
  const g = mergeGeometries(teile)!;
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}
