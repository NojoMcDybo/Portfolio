import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FARBE } from './palette';

/**
 * Pollen und Staub im Sonnenlicht: ein paar hundert weiche Punkte, die langsam treiben und
 * aufblitzen. Die Bewegung rechnet der Vertex-Shader, die CPU tut nichts. Ein Draw Call.
 */
export function Pollen({ radius, staerke }: { radius: number; staerke: { value: number } }) {
  const { geo, mat } = useMemo(() => {
    const n = 320;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const w = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      pos.set([Math.cos(w) * r, 0.15 + Math.random() * 2.6, Math.sin(w) * r], i * 3);
      seed.set([Math.random() * 6.28, Math.random() * 6.28, Math.random()], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uZeit: { value: 0 }, uStaerke: staerke, uFarbe: { value: new THREE.Color(FARBE.sonne) } },
      vertexShader: /* glsl */ `
        uniform float uZeit;
        attribute vec3 aSeed;
        varying float vA;
        void main() {
          vec3 p = position + vec3(
            sin(uZeit * 0.21 + aSeed.x) * 0.45,
            sin(uZeit * 0.33 + aSeed.y) * 0.18,
            cos(uZeit * 0.17 + aSeed.x * 1.3) * 0.45
          );
          vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uZeit * (0.8 + aSeed.z) + aSeed.y * 3.0), 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.6 + aSeed.z) * 60.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStaerke;
        uniform vec3 uFarbe;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d) * vA * uStaerke;
          gl_FragColor = vec4(uFarbe * a, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [radius, staerke]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uZeit.value = clock.elapsedTime;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} raycast={() => null} renderOrder={21} />;
}
