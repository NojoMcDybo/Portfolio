import * as THREE from 'three';

/*
 * Raum-Zeit-Block aus einem einzigen Full-Page-Screenshot.
 *
 * Eine Scroll-Aufnahme ist V(u, v, w) = Seite(u, v·vpH + w·T), T = seiteH − vpH.
 *   u ∈ [0,1]  Seitenbreite                      → lokal +X
 *   v ∈ [0,1]  Ausschnitt-Höhe (Nord = 0)         → lokal +Z
 *   w ∈ [0,1]  Zeit = Scrollposition (oben = 0)   → lokal −Y
 *
 * Die Geometrie ist eine echte Box (W × D × L, Ecke oben-Nord-West im Ursprung),
 * damit Raycasting und Frustum-Culling stimmen. Der Vertex-Shader staucht sie auf
 * den Volumen-Ausschnitt [uMin, uMax]. Schnitt in X = uMin.x/uMax.x,
 * Absinken der Oberfläche beim Scrollen = uMin.z.
 */

const vertex = /* glsl */ `
uniform vec3 uMin;
uniform vec3 uMax;
uniform vec3 uSize; // W, D, L in Welt-Einheiten
varying vec3 vQ;
varying vec3 vN;
varying float vShade;
#include <fog_pars_vertex>

void main() {
  vec3 p = vec3(position.x / uSize.x, 1.0 + position.y / uSize.y, position.z / uSize.z);
  vQ = vec3(
    mix(uMin.x, uMax.x, p.x),
    mix(uMin.y, uMax.y, p.z),
    mix(uMin.z, uMax.z, 1.0 - p.y)
  );
  vec3 lokal = vec3(vQ.x * uSize.x, -vQ.z * uSize.y, vQ.y * uSize.z);
  vN = normal;

  // Flächen leicht unterschiedlich hell, damit Kanten lesbar sind. Oben exakt 1.0:
  // die Oberfläche muss pixelgleich zur echten Seite sein.
  vShade = normal.y > 0.5 ? 1.0 : normal.y < -0.5 ? 0.72 : abs(normal.z) > 0.5 ? 0.97 : 0.88;

  vec4 mvPosition = modelViewMatrix * vec4(lokal, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragment = /* glsl */ `
uniform sampler2D uSeite;
uniform float uSeiteH; // CSS-px
uniform float uVpH;    // CSS-px
uniform vec3 uSize;
uniform float uHover;
uniform float uZeit;
uniform float uWasser; // 0 = reine Seite (Tauchen), 1 = Wasserfall
uniform vec3 uDunst;
varying vec3 vQ;
varying vec3 vN;
varying float vShade;
#include <fog_pars_fragment>

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  float T = max(uSeiteH - uVpH, 1.0);
  bool oben = vN.y > 0.5;
  bool unten = vN.y < -0.5;
  vec2 uv = vec2(vQ.x, 0.0);
  float py = vQ.y * uVpH + vQ.z * T;

  if (oben) {
    // Wasseroberfläche: kaum merkliche Wellen, nur außerhalb des Tauchens
    float t = uZeit * 0.9;
    uv.x += uWasser * 0.0025 * sin(vQ.y * 38.0 + t * 1.7) ;
    py += uWasser * 2.5 * sin(vQ.x * 31.0 + t * 1.3);
  }
  uv.y = 1.0 - py / uSeiteH;
  vec3 c = texture2D(uSeite, uv).rgb * vShade;

  if (oben) {
    // Schaumkante, wo das Wasser über den Rand fällt (Süd = außen)
    float lippe = smoothstep(0.93, 1.0, vQ.y);
    float glanz = 0.5 + 0.5 * sin(vQ.x * 70.0 + vQ.y * 20.0 + uZeit * 2.0);
    c = mix(c, vec3(1.0), uWasser * (lippe * (0.35 + 0.25 * glanz) + 0.04));
  } else if (!unten) {
    // Wände: Strömungsstreifen laufen nach unten
    float quer = abs(vN.x) > 0.5 ? vQ.y * uSize.z : vQ.x * uSize.x;
    float spalte = floor(quer * 9.0);
    float tief = vQ.z * uSize.y;
    float f = fract(tief * (0.18 + 0.12 * hash(spalte)) - uZeit * (0.45 + 0.35 * hash(spalte + 7.0)) + hash(spalte + 3.0));
    float strahl = smoothstep(0.82, 1.0, f) * (0.5 + 0.5 * hash(spalte + 11.0));
    c = mix(c, vec3(1.0), uWasser * strahl * 0.28);
    // Kurz unter der Kante beschleunigt das Wasser: oben heller Saum
    c = mix(c, vec3(1.0), uWasser * 0.25 * (1.0 - smoothstep(0.0, 0.35, tief)));
  }

  // Unten löst sich der Fall in Dunst auf
  float dunst = unten ? 1.0 : smoothstep(max(0.0, 1.0 - 2.2 / uSize.y), 1.0, vQ.z);
  if (!oben) c = mix(c, uDunst, dunst * 0.85);

  c = mix(c, vec3(1.0), uHover * 0.18);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

// Nachschimmern: eine halbtransparente Ebene bei einer früheren Zeit w.
const geistVertex = /* glsl */ `
uniform vec3 uMin;
uniform vec3 uMax;
uniform vec3 uSize;
uniform float uW;
varying vec2 vUV;
void main() {
  vec2 p = position.xy + 0.5;
  vUV = vec2(mix(uMin.x, uMax.x, p.x), mix(uMin.y, uMax.y, 1.0 - p.y));
  vec3 lokal = vec3(vUV.x * uSize.x, -uW * uSize.y + 0.002, vUV.y * uSize.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(lokal, 1.0);
}
`;

const geistFragment = /* glsl */ `
uniform sampler2D uSeite;
uniform float uSeiteH;
uniform float uVpH;
uniform float uW;
uniform float uAlpha;
varying vec2 vUV;
void main() {
  float T = max(uSeiteH - uVpH, 1.0);
  float py = vUV.y * uVpH + uW * T;
  vec4 c = texture2D(uSeite, vec2(vUV.x, 1.0 - py / uSeiteH));
  // leicht aufgehellt: Schimmer, kein zweites Bild
  gl_FragColor = vec4(mix(c.rgb, vec3(1.0), 0.15), uAlpha);
  #include <colorspace_fragment>
}
`;

export interface TeichUniforms {
  uSeite: { value: THREE.Texture };
  uSeiteH: { value: number };
  uVpH: { value: number };
  uMin: { value: THREE.Vector3 };
  uMax: { value: THREE.Vector3 };
  uSize: { value: THREE.Vector3 };
  uHover: { value: number };
  uZeit: { value: number };
  uWasser: { value: number };
  uDunst: { value: THREE.Color };
  [k: string]: THREE.IUniform;
}

export function createTeichMaterial(tex: THREE.Texture, seiteH: number, vpH: number, size: THREE.Vector3) {
  const uniforms: TeichUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uSeite: { value: tex },
    uSeiteH: { value: seiteH },
    uVpH: { value: vpH },
    uMin: { value: new THREE.Vector3(0, 0, 0) },
    uMax: { value: new THREE.Vector3(1, 1, 1) },
    uSize: { value: size },
    uHover: { value: 0 },
    uZeit: { value: 0 },
    uWasser: { value: 1 },
    uDunst: { value: new THREE.Color('#ece4d6') },
  };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, fog: true });
}

export function createGeistMaterial(shared: TeichUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      // Textur, Maße und Schnitt teilen sich Block und Geister (gleiche Objekte).
      uSeite: shared.uSeite,
      uSeiteH: shared.uSeiteH,
      uVpH: shared.uVpH,
      uMin: shared.uMin,
      uMax: shared.uMax,
      uSize: shared.uSize,
      uW: { value: 0 },
      uAlpha: { value: 0 },
    },
    vertexShader: geistVertex,
    fragmentShader: geistFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Ersatztextur, solange es keinen Screenshot gibt: Streifen statt Seite. */
export function platzhalterTextur(farbe: string, hoehe = 2400): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = Math.round(hoehe / 4);
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f1e7';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = farbe;
  g.fillRect(0, 0, c.width, 95);
  for (let y = 120; y < c.height - 40; y += 28) {
    g.globalAlpha = 0.25 + ((y * 7) % 50) / 100;
    g.fillRect(8, y, 40 + ((y * 13) % 110), 8);
  }
  g.globalAlpha = 1;
  g.fillStyle = '#22201c';
  g.fillRect(0, c.height - 40, c.width, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
