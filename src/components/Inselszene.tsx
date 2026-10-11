import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Insel, baumStandorte } from './scene/Insel';
import { Geher, gehBlick, neuerGehZustand, type GehZustand } from './scene/Geher';
import { AUGE, kollidiere, uferPunkt, yawZu } from './scene/gehen';
import { Teich, neuerTeichZustand, MAX_GEISTER, type TeichZustand } from './scene/Teich';
import { inselLayout, tauchHoehe, teichTiefe, TEICH_L, TEICH_W, type InselLayout } from './scene/insel-layout';
import { setzeAnisotropie, useTeichTexturen, type ProjektInfo } from './scene/texturen';
import { TauchOverlay } from './TauchOverlay';
import './inselszene.css';
import { url } from '../lib/url';

const BEIGE = '#ece4d6';
const FOV = 40;
const POLAR = 1.16; // fester Blickwinkel: nur Drehen um die Hochachse. Flacher, damit man die Fälle sieht.
const FLUG_S = 1.6;
const AUFTAUCHEN_S = 0.7;
const OBEN = new THREE.Vector3(0, 1, 0);
const ZIEL = new THREE.Vector3(0, -3.5, 0);
const FOV_GEHEN = 68;
// Beim Gehen rückt der Dunst heran: Stimmung, und was im Dunst liegt, muss nicht scharf sein.
const NEBEL_GEHEN: [number, number] = [3, 30];
const NEBEL_WEIT: [number, number] = [55, 140];

/** 'orbit' = frei: Überblick (OrbitControls) oder Gehen, je nach `modus`. */
export type Phase = 'orbit' | 'fahrt' | 'flug' | 'tauchen' | 'auftauchen' | 'zurueck';
export type Modus = 'ueberblick' | 'gehen';

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
  modus: Modus;
  /** Ziel einer Fahrt zwischen Überblick und Gehen */
  zielPos: THREE.Vector3;
  zielQuat: THREE.Quaternion;
  ueberblickPos: THREE.Vector3;
  ueberblickQuat: THREE.Quaternion;
  geh: GehZustand;
}

const FAHRT_S = 1.3;
function schrittFahrt(s: Sim, dt: number) {
  return (s.k = s.sofort ? 1 : Math.min(1, s.k + dt / FAHRT_S));
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
  // Länge des Wasserfalls = Scrollweg der Seite
  const groessen = useMemo(
    () => projekte.map((p) => new THREE.Vector3(TEICH_W, teichTiefe(texturen[p.slug].seiteH), TEICH_L)),
    [projekte, texturen],
  );

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
    modus: 'ueberblick',
    zielPos: new THREE.Vector3(),
    zielQuat: new THREE.Quaternion(),
    ueberblickPos: new THREE.Vector3(),
    ueberblickQuat: new THREE.Quaternion(),
    geh: neuerGehZustand(),
  });
  const kamera = useRef<THREE.Camera | null>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const gepusht = useRef(false);

  const [phase, setPhase] = useState<Phase>('orbit');
  const [modus, setModus] = useState<Modus>('ueberblick');
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [naehe, setNaehe] = useState(-1);
  const naeheRef = useRef(-1);
  naeheRef.current = naehe;
  const baeume = useMemo(() => baumStandorte(layout), [layout]);

  useEffect(() => {
    zustaende.forEach(
      (z, i) => (z.hover = phase === 'orbit' && (modus === 'gehen' ? i === naehe : i === hover) ? 1 : 0),
    );
  }, [hover, naehe, phase, modus, zustaende]);

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
      setNaehe(-1);
      ladeScharf(projekte[i].slug);
      if (push) {
        history.pushState({ teich: projekte[i].slug }, '', `#${projekte[i].slug}`);
        gepusht.current = true;
      }
    },
    [ladeScharf, projekte],
  );

  const fahreZu = useCallback((pos: THREE.Vector3, quat: THREE.Quaternion) => {
    const s = sim.current;
    if (!kamera.current) return;
    s.vonPos.copy(kamera.current.position);
    s.vonQuat.copy(kamera.current.quaternion);
    s.zielPos.copy(pos);
    s.zielQuat.copy(quat);
    s.k = 0;
    s.sofort = matchMedia('(prefers-reduced-motion: reduce)').matches;
    s.phase = 'fahrt';
    setPhase('fahrt');
  }, []);

  /** Vom Überblick auf die Insel: an einen geklickten Punkt oder vor den ersten Teich. */
  const betreten = useCallback(
    (punkt?: THREE.Vector3) => {
      const s = sim.current;
      const cam = kamera.current;
      if (s.phase !== 'orbit' || s.modus !== 'ueberblick' || !cam) return;
      if (controls.current) controls.current.enabled = false;
      s.ueberblickPos.copy(cam.position);
      s.ueberblickQuat.copy(cam.quaternion);
      const g = s.geh;
      if (punkt) {
        g.pos.set(punkt.x, punkt.z);
        const blick = cam.getWorldDirection(new THREE.Vector3());
        g.yaw = Math.atan2(-blick.x, -blick.z);
      } else {
        // Auf dem Uferweg, Blick auf den ersten Teich und über die Kante
        const k = layout.plaetze[0].kante;
        const u = uferPunkt(layout, 0);
        g.pos.copy(u);
        g.yaw = yawZu(g.pos, new THREE.Vector2(k.x, k.z));
      }
      kollidiere(g.pos, layout, baeume);
      g.pitch = -0.12;
      g.ziel = null;
      g.zielTeich = -1;
      s.modus = 'gehen';
      setModus('gehen');
      setHover(null);
      fahreZu(new THREE.Vector3(g.pos.x, AUGE, g.pos.y), gehBlick(g));
    },
    [layout, baeume, fahreZu],
  );

  const verlassen = useCallback(() => {
    const s = sim.current;
    if (s.phase !== 'orbit' || s.modus !== 'gehen') return;
    s.modus = 'ueberblick';
    setModus('ueberblick');
    setNaehe(-1);
    fahreZu(s.ueberblickPos, s.ueberblickQuat);
  }, [fahreZu]);

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
    const taste = (e: KeyboardEvent) => {
      const s = sim.current;
      const frei = s.phase === 'orbit' && s.modus === 'gehen';
      if (e.key === 'Escape') {
        if (frei) verlassen();
        else auftauchen();
      } else if (frei && (e.code === 'KeyE' || e.key === 'Enter') && naeheRef.current >= 0) {
        if (e.target instanceof HTMLElement && /^(BUTTON|A|INPUT)$/.test(e.target.tagName)) return;
        tauche(naeheRef.current);
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [auftauchen, verlassen, tauche]);

  const gehAktiv = useCallback(() => sim.current.modus === 'gehen' && sim.current.phase === 'orbit', []);
  const [reduziert] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!webgl) return <Fallback projekte={projekte} grund="Dein Browser kann kein WebGL2." />;

  const imOrbit = phase === 'orbit';
  const ueberblick = imOrbit && modus === 'ueberblick';
  const gehend = imOrbit && modus === 'gehen';
  const info = hover !== null ? projekte[hover] : null;

  return (
    <div className={`insel-szene${gehend ? ' gehend' : ''}`}>
      <Canvas
        flat
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.1, far: 250 }}
        onCreated={({ camera, gl, size }) => {
          kamera.current = camera;
          setzeAnisotropie(gl.capabilities.getMaxAnisotropy());
          const dist = Math.min(90, 38 * Math.max(1, 1.3 / (size.width / size.height)));
          camera.position.set(0, ZIEL.y + dist * Math.cos(POLAR), dist * Math.sin(POLAR));
          camera.lookAt(ZIEL);
          setBereit(true);
        }}
      >
        <color attach="background" args={[BEIGE]} />
        <fog attach="fog" args={[BEIGE, 55, 140]} />
        <hemisphereLight args={['#fffaf0', '#8a7560', 1.4]} />
        <directionalLight
          position={[9, 16, 7]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-camera-near={1}
          shadow-camera-far={50}
        />

        <Insel
          layout={layout}
          baeume={baeume}
          onBoden={(p, e) => {
            if (e.delta > 6) return; // war Ziehen, kein Klick
            const s = sim.current;
            if (s.phase !== 'orbit') return;
            if (s.modus === 'gehen') {
              s.geh.ziel = kollidiere(new THREE.Vector2(p.x, p.z), layout, baeume);
              s.geh.zielTeich = -1;
            } else betreten(p);
          }}
        />
        {projekte.map((p, i) => {
          const t = texturen[p.slug];
          const platz = layout.plaetze[i];
          return (
            <Teich
              key={p.slug}
              textur={t.tex}
              seiteH={t.seiteH}
              groesse={groessen[i]}
              zustand={zustaende[i]}
              position={platz.ursprung}
              quaternion={platz.quaternion}
              onClick={(e) => {
                if (e.delta > 6) return; // war ein Drehen, kein Klick
                e.stopPropagation();
                const s = sim.current;
                if (s.modus === 'gehen' && naeheRef.current !== i) {
                  // Erst hingehen, dann eintauchen
                  s.geh.ziel = uferPunkt(layout, i);
                  s.geh.zielTeich = i;
                } else tauche(i);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (sim.current.phase === 'orbit' && sim.current.modus === 'ueberblick') {
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
          minDistance={20}
          maxDistance={95}
        />
        <Kamerafahrt sim={sim} layout={layout} zustaende={zustaende} groessen={groessen} controls={controls} onPhase={setPhase} />
        <Geher
          aktiv={gehAktiv}
          g={sim.current.geh}
          layout={layout}
          baeume={baeume}
          sofort={reduziert}
          onNaehe={setNaehe}
          onAnkunftTeich={(i) => {
            const g = sim.current.geh;
            g.yaw = yawZu(g.pos, new THREE.Vector2(layout.plaetze[i].kante.x, layout.plaetze[i].kante.z));
            tauche(i);
          }}
        />
      </Canvas>

      {gehend && (
        <>
          <header className="hud-kopf">
            <button className="hud-knopf" onClick={verlassen}>
              ↑ Überblick <kbd>Esc</kbd>
            </button>
            <p className="hud-hilfe">WASD gehen · Shift schneller · Ziehen schauen · Klick: hingehen</p>
          </header>
          <div className="fadenkreuz" aria-hidden="true" />
          {naehe >= 0 && (
            <button className="eintauch-hinweis" onClick={() => tauche(naehe)}>
              <strong>{projekte[naehe].title}</strong> <span>E oder Klick: eintauchen</span>
            </button>
          )}
        </>
      )}

      <header className="hud-kopf" hidden={!ueberblick}>
        <p className="hud-titel">Portfolio <span>Prototyp</span></p>
        <nav>
          <a href={url('/projekte/')}>Archiv</a>
          <a href={url('/labor/')}>Block-Labor</a>
        </nav>
      </header>

      <div className="hud-fuss" hidden={!imOrbit}>
        <p className="hud-info" aria-live="polite">
          {info ? (
            <>
              <strong>{info.title}</strong> {info.kurzbeschreibung}
            </>
          ) : ueberblick ? (
            'Ziehen: drehen · Teich anklicken: eintauchen · Wald anklicken: dort betreten'
          ) : null}
        </p>
        {ueberblick && (
          <button className="hud-knopf betreten" onClick={() => betreten()}>
            Insel betreten
          </button>
        )}
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


function Kamerafahrt({
  sim,
  layout,
  zustaende,
  groessen,
  controls,
  onPhase,
}: {
  sim: React.RefObject<Sim>;
  layout: InselLayout;
  zustaende: TeichZustand[];
  groessen: THREE.Vector3[];
  controls: React.RefObject<OrbitControlsImpl | null>;
  onPhase: (p: Phase) => void;
}) {
  const { camera, size, scene } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rohDt) => {
    const s = sim.current;
    const dt = Math.min(rohDt, 1 / 20);

    // Gehen: weites Sichtfeld und naher Dunst. Überblick und Tauchen: schmal und weit.
    const geht = s.modus === 'gehen' && (s.phase === 'orbit' || s.phase === 'fahrt' || s.phase === 'zurueck');
    const pc = camera as THREE.PerspectiveCamera;
    const sollFov = geht ? FOV_GEHEN : FOV;
    if (Math.abs(pc.fov - sollFov) > 0.01) {
      pc.fov = s.sofort ? sollFov : THREE.MathUtils.damp(pc.fov, sollFov, 3, dt);
      pc.updateProjectionMatrix();
    }
    const nebel = scene.fog as THREE.Fog | null;
    if (nebel) {
      const [nah, fern] = geht ? NEBEL_GEHEN : NEBEL_WEIT;
      nebel.near = THREE.MathUtils.damp(nebel.near, nah, 2, dt);
      nebel.far = THREE.MathUtils.damp(nebel.far, fern, 2, dt);
    }

    if (s.phase === 'orbit') return;
    if (s.phase === 'fahrt') {
      const e = glatt(schrittFahrt(s, dt));
      camera.position.lerpVectors(s.vonPos, s.zielPos, e);
      camera.quaternion.slerpQuaternions(s.vonQuat, s.zielQuat, e);
      if (s.k >= 1) {
        s.phase = 'orbit';
        if (controls.current && s.modus === 'ueberblick') controls.current.enabled = true;
        onPhase('orbit');
      }
      return;
    }
    const platz = layout.plaetze[s.ziel];
    const tiefe = groessen[s.ziel].y;
    const z = zustaende[s.ziel];
    // Strömung aus, sobald die Kamera über dem Teich steht: die Oberfläche muss die Seite sein
    z.wasser = s.phase === 'tauchen' || s.phase === 'auftauchen' || (s.phase === 'flug' && s.k > 0.5) ? 0 : 1;
    const h = tauchHoehe(size.width, size.height, pc.fov);
    const schritt = (dauer: number) => (s.k = s.sofort ? 1 : Math.min(1, s.k + dt / dauer));

    if (s.phase === 'flug') {
      const e = glatt(schritt(FLUG_S));
      camera.position.lerpVectors(s.vonPos, platz.oberflaeche(0, tiefe, tmp).addScaledVector(OBEN, h), e);
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
      camera.position.copy(platz.oberflaeche(s.w, tiefe, tmp)).addScaledVector(OBEN, h);
      camera.quaternion.copy(platz.draufsicht);
    } else if (s.phase === 'zurueck') {
      const e = glatt(schritt(FLUG_S));
      camera.position.lerpVectors(s.vonPos, s.orbitPos, e);
      camera.position.y += Math.sin(Math.PI * e) * 2.5;
      camera.quaternion.slerpQuaternions(s.vonQuat, s.orbitQuat, e);
      if (s.k >= 1) {
        s.phase = 'orbit';
        // Zurück dorthin, woher man kam: in den Überblick oder auf die Insel
        if (controls.current && s.modus === 'ueberblick') controls.current.enabled = true;
        onPhase('orbit');
      }
    }

    // Wasseroberfläche + Nachschimmern: die letzten Scrollpositionen als Geister-Ebenen.
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
            <a href={url(`/projekte/${p.slug}/`)}>{p.title}</a> – {p.kurzbeschreibung}
          </li>
        ))}
      </ul>
      <p>
        <a href={url('/projekte/')}>Alle Projekte im Archiv</a>
      </p>
    </main>
  );
}
