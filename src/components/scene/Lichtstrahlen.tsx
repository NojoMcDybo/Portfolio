import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FARBE, SONNE_RICHTUNG } from './palette';

/**
 * Lichtstrahlen ohne Volumen-Rendering: ein paar lange, weiche Flächen entlang der
 * Sonnenrichtung, additiv geblendet. Jede dreht sich um ihre eigene Achse zur Kamera
 * (Achsen-Billboard), deshalb wirken sie von überall wie Lichtbahnen im Dunst.
 * Kosten: ein Draw Call, ein paar Dutzend Dreiecke.
 */
export function Lichtstrahlen({ staerke }: { staerke: { value: number } }) {
  const { geo, mat } = useMemo(() => {
    const achse = new THREE.Vector3(...SONNE_RICHTUNG).normalize().negate(); // von der Sonne weg
    const quer = new THREE.Vector3().crossVectors(achse, new THREE.Vector3(0, 1, 0)).normalize();
    // Strahlen nebeneinander quer zur Sonne, versetzt in Höhe und Tiefe
    const strahlen: [number, number, number, number, number][] = [
      // quer-Versatz, Höhe, Länge, Breite, Phase
      [-7.5, 3.5, 34, 2.6, 0.0],
      [-4.2, 5.0, 38, 1.4, 1.3],
      [-1.5, 2.5, 30, 3.4, 2.1],
      [1.6, 4.2, 36, 1.8, 3.4],
      [4.4, 3.0, 32, 2.8, 4.2],
      [7.8, 5.5, 40, 1.6, 5.0],
    ];
    const pos: number[] = [];
    const mitte: number[] = [];
    const daten: number[] = [];
    const idx: number[] = [];
    strahlen.forEach(([q, h, l, b, ph], i) => {
      const m = new THREE.Vector3().addScaledVector(quer, q).setY(h).addScaledVector(achse, 2);
      const ecken = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
      for (const [x, y] of ecken) {
        pos.push(x, y, 0);
        mitte.push(m.x, m.y, m.z);
        daten.push(l, b, ph, i);
      }
      const o = i * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aMitte', new THREE.Float32BufferAttribute(mitte, 3));
    geo.setAttribute('aDaten', new THREE.Float32BufferAttribute(daten, 4));
    geo.setIndex(idx);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAchse: { value: achse },
        uFarbe: { value: new THREE.Color(FARBE.sonne) },
        uZeit: { value: 0 },
        uStaerke: staerke,
      },
      vertexShader: /* glsl */ `
        uniform vec3 uAchse;
        attribute vec3 aMitte;
        attribute vec4 aDaten; // Länge, Breite, Phase, Index
        varying vec2 vUv;
        varying float vPhase;
        void main() {
          vec3 zurKamera = normalize(cameraPosition - aMitte);
          vec3 seite = normalize(cross(uAchse, zurKamera));
          vec3 welt = aMitte + uAchse * position.y * aDaten.x + seite * position.x * aDaten.y;
          vUv = position.xy + 0.5;
          vPhase = aDaten.z;
          gl_Position = projectionMatrix * viewMatrix * vec4(welt, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFarbe;
        uniform float uZeit;
        uniform float uStaerke;
        varying vec2 vUv;
        varying float vPhase;
        void main() {
          float quer = pow(sin(vUv.x * 3.14159), 2.2);
          float laengs = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
          float atmen = 0.7 + 0.3 * sin(uZeit * 0.21 + vPhase);
          float a = quer * laengs * atmen * uStaerke;
          gl_FragColor = vec4(uFarbe * a, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [staerke]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  useFrame(({ clock }) => {
    mat.uniforms.uZeit.value = clock.elapsedTime;
  });

  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={20} raycast={() => null} />;
}

/** Hintergrund: warmer Verlauf von oben nach unten, heller Schein dort, wo die Sonne steht. */
export function himmelTextur() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const verlauf = g.createLinearGradient(0, 0, 0, 256);
  verlauf.addColorStop(0, FARBE.himmelOben);
  verlauf.addColorStop(1, FARBE.himmelUnten);
  g.fillStyle = verlauf;
  g.fillRect(0, 0, 256, 256);
  const schein = g.createRadialGradient(20, 10, 0, 20, 10, 210);
  schein.addColorStop(0, 'rgba(255, 238, 205, 0.95)');
  schein.addColorStop(1, 'rgba(255, 238, 205, 0)');
  g.fillStyle = schein;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
