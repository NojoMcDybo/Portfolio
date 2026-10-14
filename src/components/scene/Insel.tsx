import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { PLATEAU_D, TEICH_L, TEICH_W, type InselLayout } from './insel-layout';
import { FARBE, SONNE_RICHTUNG } from './palette';
import { windShader } from './wind';
import { Gras } from './Gras';
import type { Hoehe } from './gelaende';

export const BAUM_HOEHE = 1.9;
const WEG_BREITE = 0.9;

/** Seed-fester Zufall, damit jeder Aufruf dieselbe Insel ergibt */
function zufallsquelle(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Runde Insel: Gelände, Uferweg, Erdkegel, Wiese, Steine, Blumen, Laubwald. */
export function Insel({
  layout,
  hoehe,
  grasAnteil = 1,
  baeume,
  onBoden,
}: {
  layout: InselLayout;
  hoehe: Hoehe;
  grasAnteil?: number;
  baeume: [number, number][];
  /** Klick auf den Boden (Weltpunkt). Pflanzen und Steine sind für Raycasts unsichtbar. */
  onBoden?: (p: THREE.Vector3, e: ThreeEvent<MouseEvent>) => void;
}) {
  const plateau = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(layout.form, { depth: PLATEAU_D, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); // (sx, sy, e) → (sx, e, −sy)
    // Oberkante knapp unter null: darüber liegen Deckel und Gelände, sonst scheint Erde durch
    g.translate(0, -PLATEAU_D - 0.012, 0);
    return g;
  }, [layout]);
  // Flacher Deckel mit exakten Kanten an Rand und Teichen; das Gelände liegt darüber
  const deckel = useMemo(() => {
    const g = new THREE.ShapeGeometry(layout.form, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.004, 0);
    return g;
  }, [layout]);
  const huegel = useMemo(() => gelaendeGeometrie(layout, hoehe), [layout, hoehe]);
  const wieseMat = useMemo(() => wiesenMaterial(), []);
  useEffect(
    () => () => (plateau.dispose(), deckel.dispose(), huegel.dispose(), wieseMat.dispose()),
    [plateau, deckel, huegel, wieseMat],
  );

  // Der Kegel bleibt innerhalb der Teiche, damit die Wasserfälle frei hängen.
  const kegelR = layout.apothem - TEICH_L - 0.5;
  return (
    <group>
      <mesh geometry={plateau} receiveShadow>
        <meshStandardMaterial attach="material-0" color={FARBE.erdeDunkel} roughness={1} />
        <meshStandardMaterial attach="material-1" color={FARBE.erde} roughness={1} />
      </mesh>
      {/* Klicks treffen den flachen Deckel; das Gelände (max. ≈0,5 hoch) ist dafür unsichtbar */}
      <mesh geometry={deckel} material={wieseMat} receiveShadow onClick={(e) => onBoden?.(e.point, e)} />
      <mesh geometry={huegel} material={wieseMat} receiveShadow castShadow raycast={() => null} />
      <Uferweg layout={layout} />
      <mesh position={[0, -PLATEAU_D - 3.2, 0]} castShadow>
        <cylinderGeometry args={[kegelR, 0.5, 6.4, 40, 4, true]} />
        <meshStandardMaterial color={FARBE.erdeDunkel} roughness={1} />
      </mesh>
      <Gras layout={layout} hoehe={hoehe} wegBreite={WEG_BREITE} anteil={grasAnteil} />
      <Blumen layout={layout} hoehe={hoehe} />
      <Steine layout={layout} hoehe={hoehe} />
      <Wald punkte={baeume} hoehe={hoehe} />
    </group>
  );
}

/** Raster über der Insel, Höhe aus h(x, z). Nur Dreiecke, die ganz auf Land liegen. */
function gelaendeGeometrie(layout: InselLayout, hoehe: Hoehe) {
  const r = layout.apothem;
  const n = 150;
  const g = new THREE.PlaneGeometry(2 * r, 2 * r, n, n);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const land: boolean[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, hoehe(x, z));
    land.push(layout.aufLand(x, z, 0));
  }
  const idx = g.index!.array;
  const behalten: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (land[idx[i]] && land[idx[i + 1]] && land[idx[i + 2]]) behalten.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(behalten);
  g.computeVertexNormals();
  return g;
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
          wiese = mix(wiese, uHell, smoothstep(0.6, 0.9, gross));
          diffuseColor.rgb = wiese * (0.92 + 0.12 * fein);
        }`,
      );
  };
  return m;
}

/** Erdiger Rundweg vor allen Teichen. Klicks gehen an die Wiese darunter. */
function Uferweg({ layout }: { layout: InselLayout }) {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(layout.wegR - WEG_BREITE / 2, layout.wegR + WEG_BREITE / 2, 96, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.006, 0);
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
  const zufall = zufallsquelle(7);
  const p: [number, number][] = [];
  const r = layout.apothem;
  for (let x = -r; x <= r; x += 1.05) {
    for (let z = -r; z <= r; z += 1.05) {
      const px = x + (zufall() - 0.5) * 0.7;
      const pz = z + (zufall() - 0.5) * 0.7;
      // Weg und ein Wiesenstreifen davor bleiben frei: der Wald steht als Block in der Mitte
      const amWeg = layout.randAbstand(px, pz) > layout.wegR - WEG_BREITE / 2 - 0.6;
      // Eine Lichtung in der Mitte: ein Ort, an dem man ankommt
      const lichtung = Math.hypot(px - 0.6, pz + 0.4) < 1.3;
      if (layout.aufLand(px, pz, 0.55) && !amWeg && !lichtung) p.push([px, pz]);
    }
  }
  return p;
}

/** Wald: ein InstancedMesh, ein Draw Call für alle Bäume (plus einer für den Schatten). */
function Wald({ punkte, hoehe }: { punkte: [number, number][]; hoehe: Hoehe }) {
  const { camera } = useThree();
  const geo = useMemo(() => baumGeometrie(), []);
  const { mat, tiefe, zeit, sonneView } = useMemo(() => laubMaterialien(), []);
  const sonneWelt = useMemo(() => new THREE.Vector3(...SONNE_RICHTUNG).normalize(), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const im = ref.current!;
    const zufall = zufallsquelle(31);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    punkte.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), zufall() * Math.PI * 2);
      const k = 0.82 + zufall() * 0.38;
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, hoehe(x, z) - 0.03, z), q, s.set(k, k * (0.92 + zufall() * 0.16), k)));
      // Etwas Farbvariation: manche Kronen gelblicher, manche tiefer grün
      const t = zufall();
      im.setColorAt(i, c.setRGB(0.92 + t * 0.12, 0.95 + t * 0.06, 0.88 - t * 0.04));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [punkte, hoehe]);
  useEffect(() => () => (geo.dispose(), mat.dispose(), tiefe.dispose()), [geo, mat, tiefe]);

  useFrame(({ clock }) => {
    zeit.value = clock.elapsedTime;
    sonneView.value.copy(sonneWelt).transformDirection(camera.matrixWorldInverse);
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
 * Laub: Wind plus Durchleuchten. Wer gegen die Sonne schaut, sieht die Kronenränder
 * warm aufleuchten, wie Licht durch Blätter. Billig: eine Zeile im Fragment-Shader.
 */
function laubMaterialien() {
  const zeit = { value: 0 };
  const sonneView = { value: new THREE.Vector3(0, 1, 0) };
  const sonnenFarbe = { value: new THREE.Color(FARBE.sonne) };
  const wind = windShader(zeit, BAUM_HOEHE, 1);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  mat.onBeforeCompile = (shader) => {
    wind(shader);
    shader.uniforms.uSonneView = sonneView;
    shader.uniforms.uSonnenFarbe = sonnenFarbe;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBlatt;\nvarying float vBlatt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlatt = aBlatt;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSonneView;\nuniform vec3 uSonnenFarbe;\nvarying float vBlatt;')
      .replace(
        '#include <opaque_fragment>',
        `{
          float gegen = pow(max(dot(normalize(-vViewPosition), uSonneView), 0.0), 3.0);
          float rand = 1.0 - abs(dot(normalize(vViewPosition), normal));
          outgoingLight += uSonnenFarbe * diffuseColor.rgb * vBlatt * (0.15 + gegen * 0.9) * (0.35 + rand);
        }
        #include <opaque_fragment>`,
      );
  };
  const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  tiefe.onBeforeCompile = wind;
  return { mat, tiefe, zeit, sonneView };
}

/**
 * Flauschiger Laubbaum: Stamm und sieben Laub-Klumpen. Die Normalen der Klumpen zeigen
 * größtenteils vom Kronenzentrum weg: die Krone wird weich beleuchtet wie eine Wolke,
 * statt facettiert. Farbe dunkel innen/unten, sonnig außen/oben. ≈600 Dreiecke.
 */
function baumGeometrie() {
  const teile: THREE.BufferGeometry[] = [];
  const zentrum = new THREE.Vector3(0, 1.35, 0);
  const unten = new THREE.Color(FARBE.kroneUnten);
  const oben = new THREE.Color(FARBE.kroneOben);
  const stammFarbe = new THREE.Color(FARBE.stamm);

  const markieren = (g: THREE.BufferGeometry, blatt: number) => {
    if (g.attributes.uv) g.deleteAttribute('uv');
    g.setAttribute('aBlatt', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(blatt), 1));
    teile.push(g);
  };

  const stamm = new THREE.CylinderGeometry(0.045, 0.08, 1.0, 7, 3).translate(0, 0.5, 0).toNonIndexed();
  const sf: number[] = [];
  for (let i = 0; i < stamm.attributes.position.count; i++) sf.push(stammFarbe.r, stammFarbe.g, stammFarbe.b);
  stamm.setAttribute('color', new THREE.Float32BufferAttribute(sf, 3));
  markieren(stamm, 0);

  const klumpen: [number, number, number, number][] = [
    // x, y, z, Radius
    [0, 1.38, 0, 0.44],
    [0.32, 1.18, 0.14, 0.32],
    [-0.3, 1.2, -0.16, 0.33],
    [0.1, 1.15, -0.34, 0.3],
    [-0.12, 1.2, 0.33, 0.3],
    [0.18, 1.62, 0.08, 0.3],
    [-0.14, 1.6, -0.12, 0.28],
  ];
  const v = new THREE.Vector3();
  const raus = new THREE.Vector3();
  const c = new THREE.Color();
  for (const [x, y, z, r] of klumpen) {
    // Ab Unterteilung 1 liefert three.js bereits glatte (kugelförmige) Normalen
    const g = new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const farben: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      raus.subVectors(v, zentrum).normalize();
      // Weiche Kronen-Normale: überwiegend kugelförmig um das Kronenzentrum
      const n = new THREE.Vector3().fromBufferAttribute(nor, i).lerp(raus, 0.72).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
      const hoch = THREE.MathUtils.smoothstep(v.y, 0.85, 1.95);
      const aussen = 0.55 + 0.45 * THREE.MathUtils.clamp(v.distanceTo(zentrum) / 0.6, 0, 1);
      c.copy(unten).lerp(oben, hoch * 0.85).multiplyScalar(0.7 + 0.3 * aussen);
      farben.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
    markieren(g, 1);
  }
  const g = mergeGeometries(teile)!;
  g.computeBoundingBox();
  return g;
}

/**
 * Steine: runde Kiesel als Rand um jeden Teich (innen und an den Seiten) und ein paar
 * Gruppen größerer Steine auf der Wiese. Oben ein Hauch Moos. Ein InstancedMesh.
 */
function Steine({ layout, hoehe }: { layout: InselLayout; hoehe: Hoehe }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const pos = g.attributes.position;
    const stein = new THREE.Color(FARBE.stein);
    const dunkel = new THREE.Color(FARBE.steinDunkel);
    const moos = new THREE.Color(FARBE.moos);
    const f: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      c.copy(dunkel).lerp(stein, THREE.MathUtils.smoothstep(y, -0.6, 0.3));
      c.lerp(moos, THREE.MathUtils.smoothstep(y, 0.55, 0.95) * 0.7);
      f.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
    return g;
  }, []);
  const steine = useMemo(() => {
    const zufall = zufallsquelle(53);
    const liste: { p: THREE.Vector3; s: THREE.Vector3; r: number }[] = [];
    const dazu = (x: number, z: number, groesse: number) => {
      const s = new THREE.Vector3(groesse * (0.9 + zufall() * 0.4), groesse * (0.55 + zufall() * 0.3), groesse * (0.8 + zufall() * 0.4));
      liste.push({ p: new THREE.Vector3(x, hoehe(x, z) - s.y * 0.25, z), s, r: zufall() * Math.PI });
    };
    // Teichränder: innen entlang der Kante und an beiden Seiten
    for (const pl of layout.plaetze) {
      const t = new THREE.Vector2(-pl.n.z, pl.n.x);
      const punkt = (innen: number, e: number) =>
        dazu(pl.kante.x - pl.n.x * innen + t.x * e, pl.kante.z - pl.n.z * innen + t.y * e, 0.07 + zufall() * 0.06);
      const ab = 0.1;
      for (let e = -TEICH_W / 2 - ab; e <= TEICH_W / 2 + ab; e += 0.17 + zufall() * 0.06) punkt(TEICH_L + ab, e);
      for (let innen = 0.35; innen < TEICH_L + ab; innen += 0.17 + zufall() * 0.06) {
        punkt(innen, -TEICH_W / 2 - ab);
        punkt(innen, TEICH_W / 2 + ab);
      }
    }
    // Gruppen auf der Wiese und am Waldrand
    for (let g = 0; g < 16; g++) {
      const w = zufall() * Math.PI * 2;
      const r = 1.5 + zufall() * (layout.apothem - 2.5);
      const gx = Math.cos(w) * r;
      const gz = Math.sin(w) * r;
      if (!layout.aufLand(gx, gz, 0.6) || Math.abs(layout.randAbstand(gx, gz) - layout.wegR) < 0.8) continue;
      const anzahl = 2 + Math.floor(zufall() * 3);
      for (let k = 0; k < anzahl; k++) dazu(gx + (zufall() - 0.5) * 0.5, gz + (zufall() - 0.5) * 0.5, 0.1 + zufall() * 0.18);
    }
    return liste;
  }, [layout, hoehe]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current!;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    steine.forEach(({ p, s, r }, i) => {
      q.setFromEuler(new THREE.Euler(0, r, (r - 1.5) * 0.15));
      im.setMatrixAt(i, m.compose(p, q, s));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [steine]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <instancedMesh ref={ref} args={[geo, undefined, steine.length]} castShadow receiveShadow raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </instancedMesh>
  );
}

/** Blumen: kleine Blütenköpfe in Flecken über der Wiese, wiegen mit dem Gras im Wind. */
function Blumen({ layout, hoehe }: { layout: InselLayout; hoehe: Hoehe }) {
  const anzahl = useMemo(() => (matchMedia('(pointer: coarse)').matches ? 1000 : 2600), []);
  const geo = useMemo(() => {
    // Fünf Blütenblätter, leicht gewölbt, auf einem gedachten Stiel (y = Halmhöhe)
    const g = new THREE.CircleGeometry(0.017, 6);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      pos.setY(i, 0.095 + r * 0.8);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const { mat, zeit } = useMemo(() => {
    const zeit = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide });
    mat.onBeforeCompile = windShader(zeit, 0.095, 0.55);
    return { mat, zeit };
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const im = ref.current!;
    const zufall = zufallsquelle(97);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const r = layout.apothem;
    let i = 0;
    // Flecken: um wenige Zentren dicht, sonst leer
    const flecken = Array.from({ length: 26 }, () => [(zufall() * 2 - 1) * r, (zufall() * 2 - 1) * r, 0.6 + zufall() * 1.2]);
    for (let versuch = 0; i < anzahl && versuch < anzahl * 6; versuch++) {
      const [fx, fz, fr] = flecken[Math.floor(zufall() * flecken.length)];
      const w = zufall() * Math.PI * 2;
      const d = Math.sqrt(zufall()) * fr;
      const x = fx + Math.cos(w) * d;
      const z = fz + Math.sin(w) * d;
      if (!layout.aufLand(x, z, 0.1) || Math.abs(layout.randAbstand(x, z) - layout.wegR) < WEG_BREITE / 2 + 0.05) continue;
      q.setFromEuler(new THREE.Euler((zufall() - 0.5) * 0.5, zufall() * 6.28, (zufall() - 0.5) * 0.5));
      const k = 0.7 + zufall() * 0.6;
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, hoehe(x, z), z), q, s.set(k, k, k)));
      im.setColorAt(i, c.set(FARBE.blumen[Math.floor(zufall() * FARBE.blumen.length)]));
      i++;
    }
    im.count = i;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [layout, hoehe, anzahl]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame(({ clock }) => {
    zeit.value = clock.elapsedTime;
  });

  return <instancedMesh ref={ref} args={[geo, mat, anzahl]} raycast={() => null} />;
}
