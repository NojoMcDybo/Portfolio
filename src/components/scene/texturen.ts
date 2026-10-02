import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { platzhalterTextur } from './teich-material';

export interface ManifestEintrag {
  lo: string;
  hi: string;
  /** Seitenhöhe in CSS-px bei 640 px Breite */
  hoehe: number;
}
export interface Manifest {
  vpW: number;
  vpH: number;
  teiche: Record<string, ManifestEintrag>;
}

export interface TeichTextur {
  tex: THREE.Texture;
  seiteH: number;
  scharf: boolean;
}

export interface ProjektInfo {
  slug: string;
  title: string;
  type: string;
  status: string;
  kurzbeschreibung: string;
  farbe: string;
}

const loader = new THREE.TextureLoader();
let anisotropie = 4;
export function setzeAnisotropie(n: number) {
  anisotropie = Math.min(8, n);
}

function lade(url: string): Promise<THREE.Texture> {
  return loader.loadAsync(url).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropie;
    return t;
  });
}

let manifestPromise: Promise<Manifest | null> | null = null;
export function ladeManifest() {
  manifestPromise ??= fetch('/teiche/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifestPromise;
}

/** Außenansicht: niedrig aufgelöste Texturen, Platzhalter solange nichts da ist. */
export function useTeichTexturen(projekte: ProjektInfo[]) {
  const [texturen, setTexturen] = useState<Record<string, TeichTextur>>(() =>
    Object.fromEntries(projekte.map((p) => [p.slug, { tex: platzhalterTextur(p.farbe), seiteH: 2400, scharf: false }])),
  );

  useEffect(() => {
    let aktiv = true;
    setTexturen((alt) => {
      const fehlend = projekte.filter((p) => !alt[p.slug]);
      if (!fehlend.length) return alt;
      const neu = { ...alt };
      for (const p of fehlend) neu[p.slug] = { tex: platzhalterTextur(p.farbe), seiteH: 2400, scharf: false };
      return neu;
    });
    ladeManifest().then((m) => {
      if (!m) return;
      for (const p of projekte) {
        const e = m.teiche[p.slug];
        if (!e) continue;
        lade(e.lo).then((tex) => {
          if (!aktiv) return;
          setTexturen((alt) => (alt[p.slug]?.scharf ? alt : { ...alt, [p.slug]: { tex, seiteH: e.hoehe, scharf: false } }));
        });
      }
    });
    return () => {
      aktiv = false;
    };
  }, [projekte]);

  /** Scharfe Version erst beim Eintauchen. */
  const ladeScharf = async (slug: string) => {
    const m = await ladeManifest();
    const e = m?.teiche[slug];
    if (!e) return;
    const tex = await lade(e.hi);
    setTexturen((alt) => ({ ...alt, [slug]: { tex, seiteH: e.hoehe, scharf: true } }));
  };

  return { texturen, ladeScharf };
}
