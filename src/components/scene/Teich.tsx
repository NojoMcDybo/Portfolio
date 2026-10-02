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
}

export function neuerTeichZustand(): TeichZustand {
  return { min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(1, 1, 1), geister: [], hover: 0 };
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

  useFrame((_, dt) => {
    const u = mat.uniforms;
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
      {geister.map((m, i) => (
        <mesh key={i} geometry={geistGeo} material={m} frustumCulled={false} renderOrder={10 + i} raycast={() => null} />
      ))}
    </group>
  );
}
