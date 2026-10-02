import { useEffect, useRef, useState } from 'react';
import { tauchSkala } from './scene/insel-layout';
import { TEICH_VP_H, TEICH_VP_W } from '../lib/teich-konstanten';
import type { ProjektInfo } from './scene/texturen';
import type { Sim } from './Inselszene';

/**
 * Die echte, bedienbare Projektseite liegt als Iframe exakt über der Wasseroberfläche.
 * Ihr Scrollen treibt die Tiefe des Blocks (sim.scrollFrac). Im Volumenblick wird die
 * DOM-Seite beim Scrollen kurz ausgeblendet, dann sieht man den Block mit Nachschimmern.
 */
export function TauchOverlay({
  projekt,
  sichtbar,
  sim,
  onExit,
}: {
  projekt: ProjektInfo;
  sichtbar: boolean;
  sim: React.RefObject<Sim>;
  onExit: () => void;
}) {
  const [skala, setSkala] = useState(() => tauchSkala(innerWidth, innerHeight));
  const [geladen, setGeladen] = useState(false);
  const [volumenblick, setVolumenblick] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const frame = useRef<HTMLIFrameElement>(null);
  const rahmen = useRef<HTMLDivElement>(null);
  const volumenRef = useRef(volumenblick);
  volumenRef.current = volumenblick;
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    const neu = () => setSkala(tauchSkala(innerWidth, innerHeight));
    addEventListener('resize', neu);
    return () => removeEventListener('resize', neu);
  }, []);

  const beimLaden = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    const doc = win.document;
    // Links aus dem Iframe öffnen die Seite oben, nicht im Teich
    doc.querySelectorAll('a').forEach((a) => (a.target = '_top'));
    let timer = 0;
    win.addEventListener(
      'scroll',
      () => {
        const max = doc.documentElement.scrollHeight - win.innerHeight;
        sim.current.scrollFrac = max > 0 ? Math.min(1, Math.max(0, win.scrollY / max)) : 0;
        if (!volumenRef.current || !rahmen.current) return;
        rahmen.current.classList.add('scrollt');
        clearTimeout(timer);
        timer = window.setTimeout(() => rahmen.current?.classList.remove('scrollt'), 280);
      },
      { passive: true },
    );
    win.addEventListener('keydown', (e) => e.key === 'Escape' && exitRef.current());
    setGeladen(true);
  };

  const an = sichtbar && geladen;
  useEffect(() => {
    if (an) frame.current?.contentWindow?.focus();
  }, [an]);

  return (
    <div
      className={`tauchen${an ? ' an' : ''}`}
      onWheel={(e) => frame.current?.contentWindow?.scrollBy(0, e.deltaY)}
    >
      <div
        ref={rahmen}
        className="tauch-rahmen"
        style={{ width: TEICH_VP_W, height: TEICH_VP_H, transform: `translate(-50%, -50%) scale(${skala})` }}
      >
        <iframe
          ref={frame}
          src={`/projekte/${projekt.slug}/?embed=1`}
          title={projekt.title}
          width={TEICH_VP_W}
          height={TEICH_VP_H}
          onLoad={beimLaden}
        />
      </div>
      <div className="tauch-leiste">
        <button onClick={onExit}>↑ Auftauchen <kbd>Esc</kbd></button>
        <span className="tauch-titel">{projekt.title}</span>
        <label>
          <input type="checkbox" checked={volumenblick} onChange={(e) => setVolumenblick(e.target.checked)} /> Volumenblick
        </label>
        <a href={`/projekte/${projekt.slug}/`}>Seite öffnen ↗</a>
      </div>
    </div>
  );
}
