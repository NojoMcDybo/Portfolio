import { useEffect, useMemo } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createGeistMaterial, createTeichMaterial } from './teich-material';
import { TEICH_VP_H } from '../../lib/teich-konstanten';

export const MAX_GEISTER = 3;

/** Wird pro Frame gelesen, nicht über React-State: Scrollen soll keine Re-Renders auslösen. */
export interface TeichZustand {
  /** Volumen-Ausschnitt (u, v, w). min.z = Wasseroberfläche. */
  min: THREE.Vector3;
  max: THREE.Vector3;
  geister: { w: number; a: number }[];
  hover: number;
  /** 1 = Wasserfall mit Strömung, 0 = reine Seite (beim Eintauchen) */
  wasser: number;
}

export function neuerTeichZustand(): TeichZustand {
  return { min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(1, 1, 1), geister: [], hover: 0, wasser: 1 };
}

interface Props {
  textur: THREE.Texture;
  seiteH: number;
  groesse: THREE.Vector3; // W, D, L
  zustand: TeichZustand;
  position?: THREE.Vector3;
  quaternion?: THREE.Quaternion;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export function Teich({ textur, seiteH, groesse, zustand, position, quaternion, ...events }: Props) {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(groesse.x, groesse.y, groesse.z);
    g.translate(groesse.x / 2, -groesse.y / 2, groesse.z / 2);
    return g;
  }, [groesse.x, groesse.y, groesse.z]);

  const mat = useMemo(() => createTeichMaterial(textur, seiteH, TEICH_VP_H, groesse.clone()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const geister = useMemo(() => Array.from({ length: MAX_GEISTER }, () => createGeistMaterial(mat.uniforms as never)), [mat]);
  const geistGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(() => {
    mat.uniforms.uSeite.value = textur;
    mat.uniforms.uSeiteH.value = seiteH;
  }, [mat, textur, seiteH]);
  useEffect(() => {
    mat.uniforms.uSize.value.copy(groesse);
  }, [mat, groesse]);
  useEffect(
    () => () => {
      geo.dispose();
      geistGeo.dispose();
      mat.dispose();
      geister.forEach((g) => g.dispose());
    },
    [geo, geistGeo, mat, geister],
  );

  const gischt = useMemo(() => {
    const m = gischtMaterial();
    m.uniforms.uSize = mat.uniforms.uSize; // gleiche Größe wie der Block
    return m;
  }, [mat]);
  const gischtGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 36;
    const seed = new Float32Array(n * 3);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    return g;
  }, []);
  useEffect(() => () => (gischt.dispose(), gischtGeo.dispose()), [gischt, gischtGeo]);

  useFrame(({ clock }, dt) => {
    const u = mat.uniforms;
    u.uZeit.value = clock.elapsedTime;
    u.uWasser.value = THREE.MathUtils.damp(u.uWasser.value, zustand.wasser, 6, dt);
    gischt.uniforms.uZeit.value = clock.elapsedTime;
    gischt.uniforms.uAlpha.value = u.uWasser.value * (zustand.max.z > 0.999 ? 1 : 0);
    u.uMin.value.copy(zustand.min);
    u.uMax.value.copy(zustand.max);
    u.uHover.value = THREE.MathUtils.damp(u.uHover.value, zustand.hover, 10, dt);
    geister.forEach((g, i) => {
      const z = zustand.geister[i];
      g.uniforms.uW.value = z?.w ?? 0;
      g.uniforms.uAlpha.value = z?.a ?? 0;
    });
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={geo} material={mat} {...events} />
      <points geometry={gischtGeo} material={gischt} frustumCulled={false} raycast={() => null} renderOrder={5} />
      {geister.map((m, i) => (
        <mesh key={i} geometry={geistGeo} material={m} frustumCulled={false} renderOrder={10 + i} raycast={() => null} />
      ))}
    </group>
  );
}

/** Dunst am unteren Ende: weiche Punkte, die langsam auseinandertreiben und verblassen. */
function gischtMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 }, uAlpha: { value: 1 }, uSize: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: /* glsl */ `
      uniform float uZeit;
      uniform vec3 uSize;
      attribute vec3 aSeed;
      varying float vA;
      void main() {
        float phase = fract(uZeit * (0.05 + 0.05 * aSeed.z) + aSeed.x);
        vec3 p = vec3(
          (aSeed.x * 1.3 - 0.15) * uSize.x,
          -uSize.y + 0.6 - phase * 2.4,
          uSize.z * (0.55 + aSeed.y * 0.7) + phase * 1.2
        );
        vA = sin(phase * 3.14159) * (0.10 + 0.12 * aSeed.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.2 + 2.0 * aSeed.z) * (0.7 + phase) * 420.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(smoothstep(1.0, 0.0, d), 1.6) * vA * uAlpha;
        gl_FragColor = vec4(vec3(0.98, 0.97, 0.94), a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}
