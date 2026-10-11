import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AUGE, kollidiere, teichInReichweite, yawZu } from './gehen';
import type { InselLayout } from './insel-layout';

const TEMPO = 2.2;
const TEMPO_SCHNELL = 4.2;
const DREH = 0.0032; // Radiant pro Pixel beim Ziehen

/** Zustand des unsichtbaren Körpers. Liegt im Sim-Objekt, damit Kamerafahrten ihn lesen können. */
export interface GehZustand {
  pos: THREE.Vector2;
  yaw: number;
  pitch: number;
  ziel: THREE.Vector2 | null;
  /** Teich, in den man nach Ankunft eintaucht, sonst −1 */
  zielTeich: number;
  stau: number;
  schritt: number;
}

export function neuerGehZustand(): GehZustand {
  return { pos: new THREE.Vector2(), yaw: 0, pitch: -0.1, ziel: null, zielTeich: -1, stau: 0, schritt: 0 };
}

export function gehBlick(g: GehZustand, ziel = new THREE.Quaternion()) {
  return ziel.setFromEuler(new THREE.Euler(g.pitch, g.yaw, 0, 'YXZ'));
}

/**
 * Ego-Perspektive ohne Körper. Ziehen = schauen, WASD/Pfeile = gehen (Shift schneller),
 * Klick auf den Boden setzt ein Ziel (siehe Inselszene). Läuft nur, wenn `aktiv`.
 */
export function Geher({
  aktiv,
  g,
  layout,
  baeume,
  sofort,
  onNaehe,
  onAnkunftTeich,
}: {
  aktiv: () => boolean;
  g: GehZustand;
  layout: InselLayout;
  baeume: [number, number][];
  sofort: boolean;
  onNaehe: (teich: number) => void;
  onAnkunftTeich: (teich: number) => void;
}) {
  const { camera, gl } = useThree();
  const tasten = useRef(new Set<string>());
  const naehe = useRef(-1);
  const tmp = useMemo(() => ({ neu: new THREE.Vector2(), vor: new THREE.Vector2(), rechts: new THREE.Vector2(), q: new THREE.Quaternion() }), []);

  useEffect(() => {
    const el = gl.domElement;
    let ziehen: { x: number; y: number } | null = null;
    const runter = (e: PointerEvent) => {
      if (!aktiv() || e.button !== 0) return;
      ziehen = { x: e.clientX, y: e.clientY };
    };
    const bewegen = (e: PointerEvent) => {
      if (!ziehen || !aktiv()) return;
      g.yaw -= (e.clientX - ziehen.x) * DREH;
      g.pitch = THREE.MathUtils.clamp(g.pitch - (e.clientY - ziehen.y) * DREH, -1.3, 1.1);
      ziehen = { x: e.clientX, y: e.clientY };
    };
    const hoch = () => (ziehen = null);
    const feld = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const ab = (e: KeyboardEvent) => {
      if (!aktiv() || feld(e)) return;
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) {
        tasten.current.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
    };
    const auf = (e: KeyboardEvent) => tasten.current.delete(e.code);
    const weg = () => tasten.current.clear();
    el.addEventListener('pointerdown', runter);
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', hoch);
    window.addEventListener('keydown', ab);
    window.addEventListener('keyup', auf);
    window.addEventListener('blur', weg);
    return () => {
      el.removeEventListener('pointerdown', runter);
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', hoch);
      window.removeEventListener('keydown', ab);
      window.removeEventListener('keyup', auf);
      window.removeEventListener('blur', weg);
    };
  }, [gl, g, aktiv]);

  useFrame((_, rohDt) => {
    if (!aktiv()) {
      tasten.current.clear();
      return;
    }
    const dt = Math.min(rohDt, 1 / 20);
    const t = tasten.current;
    const { neu, vor, rechts } = tmp;
    vor.set(-Math.sin(g.yaw), -Math.cos(g.yaw));
    rechts.set(Math.cos(g.yaw), -Math.sin(g.yaw));
    const tempo = t.has('ShiftLeft') || t.has('ShiftRight') ? TEMPO_SCHNELL : TEMPO;

    const wunsch = new THREE.Vector2();
    if (t.has('KeyW') || t.has('ArrowUp')) wunsch.add(vor);
    if (t.has('KeyS') || t.has('ArrowDown')) wunsch.sub(vor);
    if (t.has('KeyD') || t.has('ArrowRight')) wunsch.add(rechts);
    if (t.has('KeyA') || t.has('ArrowLeft')) wunsch.sub(rechts);

    let erwartet = 0;
    if (wunsch.lengthSq() > 0) {
      // Tasten haben Vorrang vor dem Klickziel
      g.ziel = null;
      g.zielTeich = -1;
      wunsch.normalize().multiplyScalar(tempo * dt);
      erwartet = wunsch.length();
    } else if (g.ziel) {
      wunsch.subVectors(g.ziel, g.pos);
      const rest = wunsch.length();
      if (rest < 0.06) {
        ankunft();
      } else {
        erwartet = Math.min(rest, TEMPO * dt);
        wunsch.multiplyScalar(erwartet / rest);
        // Blick dreht sich in Laufrichtung, Neigung kehrt langsam zur Horizontalen zurück
        const sollYaw = yawZu(g.pos, g.ziel);
        const d = Math.atan2(Math.sin(sollYaw - g.yaw), Math.cos(sollYaw - g.yaw));
        g.yaw += d * (1 - Math.exp(-6 * dt));
        g.pitch = THREE.MathUtils.damp(g.pitch, -0.1, 2, dt);
      }
    }

    if (erwartet > 0) {
      neu.copy(g.pos).add(wunsch);
      kollidiere(neu, layout, baeume);
      const geschafft = neu.distanceTo(g.pos);
      g.pos.copy(neu);
      g.schritt += geschafft * 7;
      // Festgelaufen (Baum, Ufer): Klickziel aufgeben, am Teich trotzdem ankommen
      if (g.ziel) {
        g.stau = geschafft < erwartet * 0.25 ? g.stau + dt : 0;
        if (g.stau > 0.35) ankunft();
      }
    }

    // Kaum merkliches Wippen beim Gehen, nicht bei reduzierter Bewegung
    const wippen = sofort ? 0 : Math.sin(g.schritt) * 0.012;
    camera.position.set(g.pos.x, AUGE + wippen, g.pos.y);
    camera.quaternion.copy(gehBlick(g, tmp.q));

    vor.set(-Math.sin(g.yaw), -Math.cos(g.yaw));
    const n = teichInReichweite(g.pos, vor, layout);
    if (n !== naehe.current) {
      naehe.current = n;
      onNaehe(n);
    }
  });

  function ankunft() {
    const teich = g.zielTeich;
    g.ziel = null;
    g.zielTeich = -1;
    g.stau = 0;
    if (teich >= 0) onAnkunftTeich(teich);
  }

  return null;
}
