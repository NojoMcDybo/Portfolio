import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Teich, neuerTeichZustand, MAX_GEISTER } from './scene/Teich';
import { teichTiefe, TEICH_L, TEICH_W } from './scene/insel-layout';
import { setzeAnisotropie, useTeichTexturen, type ProjektInfo } from './scene/texturen';
import { Fallback } from './Inselszene';
import './labor.css';

const BEIGE = '#ece4d6';

/**
 * Prototyp-Schritt 1: ein einzelner Raum-Zeit-Block.
 * Seiten-Scroll = Zeit (die Oberfläche sinkt), Ziehen = drehen, Regler = Schnitte.
 */
export default function Labor({ projekte }: { projekte: ProjektInfo[] }) {
  const [webgl] = useState(() => !!document.createElement('canvas').getContext('webgl2'));
  const [slug, setSlug] = useState(projekte[0]?.slug);
  const projekt = projekte.find((p) => p.slug === slug) ?? projekte[0];
  const liste = useMemo(() => (projekt ? [projekt] : []), [projekt]);
  const { texturen, ladeScharf } = useTeichTexturen(liste);
  const zustand = useMemo(() => neuerTeichZustand(), []);

  const [w, setW] = useState(0);
  const [west, setWest] = useState(0);
  const [ost, setOst] = useState(0.9);
  const [sued, setSued] = useState(1);
  const [geister, setGeister] = useState(true);
  const [delta, setDelta] = useState(0.04);
  const [g, setG] = useState(0.5);

  useEffect(() => {
    if (projekt) ladeScharf(projekt.slug);
  }, [projekt?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seiten-Scroll = Zeit
  useEffect(() => {
    const neu = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setW(max > 0 ? scrollY / max : 0);
    };
    addEventListener('scroll', neu, { passive: true });
    return () => removeEventListener('scroll', neu);
  }, []);

  zustand.min.set(west, 0, w);
  zustand.max.set(Math.max(ost, west + 0.01), sued, 1);
  // opacity = g^i für die Ausschnitte bei t − iΔ
  zustand.geister = Array.from({ length: MAX_GEISTER }, (_, i) => {
    const wi = w - (i + 1) * delta;
    return { w: Math.max(0, wi), a: geister && wi >= 0 ? g ** (i + 1) : 0 };
  });

  if (!webgl) return <Fallback projekte={projekte} grund="Dein Browser kann kein WebGL2." />;
  if (!projekt) return <p>Keine Projekte.</p>;
  const t = texturen[projekt.slug];
  if (!t) return null;
  const tiefe = teichTiefe(t.seiteH);

  const scrolle = (wert: number) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: wert * max });
  };

  return (
    <>
      <div className="labor-buehne">
        <Canvas
          flat
          dpr={[1, 2]}
          camera={{ fov: 35, position: [13, 4, 17], near: 0.1, far: 120 }}
          onCreated={({ gl }) => setzeAnisotropie(gl.capabilities.getMaxAnisotropy())}
        >
          <color attach="background" args={[BEIGE]} />
          <Teich
            key={projekt.slug}
            textur={t.tex}
            seiteH={t.seiteH}
            groesse={new THREE.Vector3(TEICH_W, tiefe, TEICH_L)}
            zustand={zustand}
            position={new THREE.Vector3(-TEICH_W / 2, tiefe / 2, -TEICH_L / 2)}
          />
          <OrbitControls makeDefault enablePan={false} enableZoom={false} target={[0, 0, 0]} />
        </Canvas>
      </div>

      <aside className="labor-panel">
        <h1>Block-Labor</h1>
        <p className="leise">
          Scrollen = Zeit, die Oberfläche sinkt. Ziehen = drehen. Die Vorderseite (Süd) ist die Seite selbst, Ost/West
          ist eine Pixelspalte über die Zeit, also die Schlieren. Der Rand einer Seite ist meist nur Hintergrund, darum
          steht der Ost-Schnitt im Inhalt.
        </p>
        <label>
          Projekt
          <select value={projekt.slug} onChange={(e) => setSlug(e.target.value)}>
            {projekte.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <Regler label="Zeit (Scroll)" wert={w} setze={scrolle} />
        <Regler label="Schnitt West" wert={west} setze={(v) => setWest(Math.min(v, ost - 0.01))} />
        <Regler label="Schnitt Ost" wert={ost} setze={(v) => setOst(Math.max(v, west + 0.01))} />
        <Regler label="Schnitt Süd" wert={sued} setze={(v) => setSued(Math.max(0.02, v))} />
        <label className="zeile">
          <input type="checkbox" checked={geister} onChange={(e) => setGeister(e.target.checked)} /> Nachschimmern
        </label>
        <Regler label="Δ" wert={delta} max={0.15} setze={setDelta} />
        <Regler label="g (opacity = gⁱ)" wert={g} setze={setG} />
        <p className="leise">
          Textur: {t.scharf ? 'Screenshot' : 'Platzhalter (npm run shots fehlt?)'} · Seite {Math.round(t.seiteH)} px
        </p>
        <p>
          <a href="/">← Insel</a>
        </p>
      </aside>
      <div className="labor-scrollraum" aria-hidden="true" />
    </>
  );
}

function Regler({ label, wert, setze, max = 1 }: { label: string; wert: number; setze: (v: number) => void; max?: number }) {
  return (
    <label>
      <span>
        {label} <output>{wert.toFixed(2)}</output>
      </span>
      <input type="range" min={0} max={max} step={0.001} value={wert} onChange={(e) => setze(+e.target.value)} />
    </label>
  );
}
