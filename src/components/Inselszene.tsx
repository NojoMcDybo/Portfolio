import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Insel } from './scene/Insel';
import { Teich, neuerTeichZustand, MAX_GEISTER, type TeichZustand } from './scene/Teich';
import { inselLayout, tauchHoehe, PLATEAU_D, TEICH_L, TEICH_W, type InselLayout } from './scene/insel-layout';
import { setzeAnisotropie, useTeichTexturen, type ProjektInfo } from './scene/texturen';
import { TauchOverlay } from './TauchOverlay';
import './inselszene.css';

const BEIGE = '#ece4d6';
const FOV = 40;
const POLAR = 1.02; // fester Blickwinkel: nur Drehen um die Hochachse
const FLUG_S = 1.6;
const AUFTAUCHEN_S = 0.7;
const OBEN = new THREE.Vector3(0, 1, 0);
const ZIEL = new THREE.Vector3(0, -1.2, 0);

export type Phase = 'orbit' | 'flug' | 'tauchen' | 'auftauchen' | 'zurueck';

export interface Sim {
  phase: Phase;
  ziel: number;
  k: number;
  vonPos: THREE.Vector3;
  vonQuat: THREE.Quaternion;
  orbitPos: THREE.Vector3;
  orbitQuat: THREE.Quaternion;
  /** Scrollposition des Iframes, 0..1 – kommt aus dem DOM */
  scrollFrac: number;
  /** Aktuelle Tiefe der Wasseroberfläche, 0..1 */
  w: number;
  wStart: number;
  verlauf: number[];
  sofort: boolean;
}

const glatt = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

function hatWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export default function Inselszene({ projekte }: { projekte: ProjektInfo[] }) {
  const [webgl] = useState(hatWebGL2);
  const layout = useMemo(() => inselLayout(projekte.length), [projekte.length]);
  const zustaende = useMemo(() => projekte.map(() => neuerTeichZustand()), [projekte]);
  const { texturen, ladeScharf } = useTeichTexturen(projekte);

  const sim = useRef<Sim>({
    phase: 'orbit',
    ziel: 0,
    k: 0,
    vonPos: new THREE.Vector3(),
    vonQuat: new THREE.Quaternion(),
    orbitPos: new THREE.Vector3(),
    orbitQuat: new THREE.Quaternion(),
    scrollFrac: 0,
    w: 0,
    wStart: 0,
    verlauf: [],
    sofort: false,
  });
  const kamera = useRef<THREE.Camera | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const gepusht = useRef(false);

  const [phase, setPhase] = useState<Phase>('orbit');
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    zustaende.forEach((z, i) => (z.hover = i === hover && phase === 'orbit' ? 1 : 0));
  }, [hover, phase, zustaende]);

  const tauche = useCallback(
    (i: number, push = true) => {
      const s = sim.current;
      if (s.phase !== 'orbit' || !kamera.current) return;
      if (controls.current) controls.current.enabled = false;
      s.ziel = i;
      s.k = 0;
      s.w = 0;
      s.scrollFrac = 0;
      s.verlauf = [];
      s.sofort = matchMedia('(prefers-reduced-motion: reduce)').matches;
      s.vonPos.copy(kamera.current.position);
      s.vonQuat.copy(kamera.current.quaternion);
      s.orbitPos.copy(kamera.current.position);
      s.orbitQuat.copy(kamera.current.quaternion);
      s.phase = 'flug';
      setPhase('flug');
      setAktiv(i);
      setHover(null);
      ladeScharf(projekte[i].slug);
      if (push) {
        history.pushState({ teich: projekte[i].slug }, '', `#${projekte[i].slug}`);
        gepusht.current = true;
      }
    },
    [ladeScharf, projekte],
  );

  const auftauchenIntern = useCallback(() => {
    const s = sim.current;
    if (s.phase === 'tauchen') {
      s.phase = 'auftauchen';
      s.k = 0;
      s.wStart = s.w;
      setPhase('auftauchen');
    } else if (s.phase === 'flug' && kamera.current) {
      s.phase = 'zurueck';
      s.k = 0;
      s.vonPos.copy(kamera.current.position);
      s.vonQuat.copy(kamera.current.quaternion);
      setPhase('zurueck');
    }
  }, []);

  // Esc, Button und Browser-Zurück laufen alle über die History.
  const auftauchen = useCallback(() => {
    if (gepusht.current) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      auftauchenIntern();
    }
  }, [auftauchenIntern]);

  useEffect(() => {
    const beiHash = () => {
      const slug = decodeURIComponent(location.hash.slice(1));
      const i = projekte.findIndex((p) => p.slug === slug);
      if (i >= 0) tauche(i, false);
      else {
        gepusht.current = false;
        auftauchenIntern();
      }
    };
    window.addEventListener('popstate', beiHash);
    return () => window.removeEventListener('popstate', beiHash);
  }, [projekte, tauche, auftauchenIntern]);

  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    // Deep-Link: /#slug taucht direkt ein
    if (!bereit) return;
    const i = projekte.findIndex((p) => p.slug === decodeURIComponent(location.hash.slice(1)));
    if (i >= 0) tauche(i, false);
  }, [bereit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && auftauchen();
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [auftauchen]);

  if (!webgl) return <Fallback projekte={projekte} grund="Dein Browser kann kein WebGL2." />;

  const imOrbit = phase === 'orbit';
  const info = hover !== null ? projekte[hover] : null;

  return (
    <div className="insel-szene">
      <Canvas
        flat
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.1, far: 250 }}
        onCreated={({ camera, gl, size }) => {
          kamera.current = camera;
          setzeAnisotropie(gl.capabilities.getMaxAnisotropy());
          const dist = Math.min(72, 31 * Math.max(1, 1.3 / (size.width / size.height)));
          camera.position.set(0, ZIEL.y + dist * Math.cos(POLAR), dist * Math.sin(POLAR));
          camera.lookAt(ZIEL);
          setBereit(true);
        }}
      >
        <color attach="background" args={[BEIGE]} />
        <fog attach="fog" args={[BEIGE, 45, 120]} />
        <hemisphereLight args={['#fffaf0', '#8a7560', 1.4]} />
        <directionalLight position={[8, 14, 6]} intensity={1.6} />

        <Insel layout={layout} />
        {projekte.map((p, i) => {
          const t = texturen[p.slug];
          const platz = layout.plaetze[i];
          return (
            <Teich
              key={p.slug}
              textur={t.tex}
              seiteH={t.seiteH}
              groesse={TEICH_GROESSE}
              zustand={zustaende[i]}
              position={platz.ursprung}
              quaternion={platz.quaternion}
              onClick={(e) => {
                if (e.delta > 6) return; // war ein Drehen, kein Klick
                e.stopPropagation();
                tauche(i);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (sim.current.phase === 'orbit') {
                  setHover(i);
                  document.body.style.cursor = 'pointer';
                }
              }}
              onPointerOut={() => {
                setHover((h) => (h === i ? null : h));
                document.body.style.cursor = '';
              }}
            />
          );
        })}

        <OrbitControls
          ref={controls}
          makeDefault
          target={ZIEL}
          enablePan={false}
          enableDamping
          minPolarAngle={POLAR}
          maxPolarAngle={POLAR}
          minDistance={18}
          maxDistance={75}
        />
        <Kamerafahrt sim={sim} layout={layout} zustaende={zustaende} controls={controls} onPhase={setPhase} />
      </Canvas>

      <header className="hud-kopf" hidden={!imOrbit}>
        <p className="hud-titel">Portfolio <span>Prototyp · Graybox</span></p>
        <nav>
          <a href="/projekte/">Archiv</a>
          <a href="/labor/">Block-Labor</a>
        </nav>
      </header>

      <div className="hud-fuss" hidden={!imOrbit}>
        <p className="hud-info" aria-live="polite">
          {info ? (
            <>
              <strong>{info.title}</strong> {info.kurzbeschreibung}
            </>
          ) : (
            'Ziehen: Insel drehen · Klick auf einen Teich: eintauchen'
          )}
        </p>
        <ul className="hud-teiche" aria-label="Teiche">
          {projekte.map((p, i) => (
            <li key={p.slug}>
              <button
                onClick={() => tauche(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {aktiv !== null && !imOrbit && (
        <TauchOverlay projekt={projekte[aktiv]} sichtbar={phase === 'tauchen'} sim={sim} onExit={auftauchen} />
      )}
    </div>
  );
}

const TEICH_GROESSE = new THREE.Vector3(TEICH_W, PLATEAU_D, TEICH_L);

function Kamerafahrt({
  sim,
  layout,
  zustaende,
  controls,
  onPhase,
}: {
  sim: React.RefObject<Sim>;
  layout: InselLayout;
  zustaende: TeichZustand[];
  controls: React.RefObject<OrbitControlsImpl | null>;
  onPhase: (p: Phase) => void;
}) {
  const { camera, size } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rohDt) => {
    const s = sim.current;
    if (s.phase === 'orbit') return;
    const dt = Math.min(rohDt, 1 / 20);
    const platz = layout.plaetze[s.ziel];
    const h = tauchHoehe(size.width, size.height, FOV);
    const schritt = (dauer: number) => (s.k = s.sofort ? 1 : Math.min(1, s.k + dt / dauer));

    if (s.phase === 'flug') {
      const e = glatt(schritt(FLUG_S));
      camera.position.lerpVectors(s.vonPos, platz.oberflaeche(0, tmp).addScaledVector(OBEN, h), e);
      camera.position.y += Math.sin(Math.PI * e) * 2.5;
      camera.quaternion.slerpQuaternions(s.vonQuat, platz.draufsicht, e);
      if (s.k >= 1) {
        s.phase = 'tauchen';
        onPhase('tauchen');
      }
    } else if (s.phase === 'tauchen' || s.phase === 'auftauchen') {
      if (s.phase === 'tauchen') s.w = s.scrollFrac;
      else {
        s.w = s.wStart * (1 - glatt(schritt(AUFTAUCHEN_S)));
        if (s.k >= 1) {
          s.phase = 'zurueck';
          s.k = 0;
          s.w = 0;
          s.vonPos.copy(camera.position);
          s.vonQuat.copy(camera.quaternion);
          onPhase('zurueck');
        }
      }
      // Kamera sinkt mit der Oberfläche: Abstand bleibt, Overlay bleibt deckungsgleich.
      camera.position.copy(platz.oberflaeche(s.w, tmp)).addScaledVector(OBEN, h);
      camera.quaternion.copy(platz.draufsicht);
    } else if (s.phase === 'zurueck') {
      const e = glatt(schritt(FLUG_S));
      camera.position.lerpVectors(s.vonPos, s.orbitPos, e);
      camera.position.y += Math.sin(Math.PI * e) * 2.5;
      camera.quaternion.slerpQuaternions(s.vonQuat, s.orbitQuat, e);
      if (s.k >= 1) {
        s.phase = 'orbit';
        if (controls.current) controls.current.enabled = true;
        onPhase('orbit');
      }
    }

    // Wasseroberfläche + Nachschimmern: die letzten Scrollpositionen als Geister-Ebenen.
    const z = zustaende[s.ziel];
    z.min.z = s.w;
    s.verlauf.push(s.w);
    if (s.verlauf.length > 40) s.verlauf.shift();
    z.geister = Array.from({ length: MAX_GEISTER }, (_, i) => {
      const alt = s.verlauf[Math.max(0, s.verlauf.length - 1 - (i + 1) * 6)] ?? s.w;
      // Schimmer nur bei echter Bewegung; große Sprünge (Anker, Taste Ende) zeigen keinen Geist
      const d = Math.abs(s.w - alt);
      const bewegung = Math.min(1, d * 60) * THREE.MathUtils.clamp(1 - (d - 0.04) / 0.04, 0, 1);
      return { w: alt, a: 0.5 ** (i + 1) * bewegung * (s.sofort ? 0 : 1) };
    });
  });

  return null;
}

export function Fallback({ projekte, grund }: { projekte: ProjektInfo[]; grund: string }) {
  return (
    <main className="insel-fallback">
      <h1>Portfolio</h1>
      <p>{grund} Hier ist die Liste.</p>
      <ul>
        {projekte.map((p) => (
          <li key={p.slug}>
            <a href={`/projekte/${p.slug}/`}>{p.title}</a> – {p.kurzbeschreibung}
          </li>
        ))}
      </ul>
      <p>
        <a href="/projekte/">Alle Projekte im Archiv</a>
      </p>
    </main>
  );
}
