# Portfolio – Teich-Prototyp

Schwebendes Plateau, Wald in der Mitte, Teiche am Rand. Jeder Teich ist ein Projekt, seine Tiefe ein
Raum-Zeit-Block aus der Projektseite. Klick → Draufsicht → man scrollt durch genau diesen Block.

Stand: Prototyp-Schritte 1–4 aus der Recherche (Block, Insel, Übergang mit Scroll-Sync, Optik).
Die Insel ist flach, die Teiche hängen als Wasserfälle über die Kante: Ihre Länge ist der Scrollweg
der Projektseite, 1 px Scroll = 1 px Breite, die Seite hängt also unverzerrt herunter.

```sh
npm install
npm run dev          # http://localhost:4321
npm run shots        # baut, macht Full-Page-Screenshots aller Projektseiten, baut erneut
npm run build
node scripts/baum.mjs  # nur bei Änderungen am Baum: EZ-Tree → public/modelle/baum.glb
```

## Seiten

| Route | Was |
|---|---|
| `/` | Insel. Ziehen dreht nur um die Hochachse, Klick auf Teich = Kamerafahrt + Eintauchen, `Esc`/Zurück = Auftauchen, `/#slug` = Deep-Link |
| `/labor/` | Schritt 1: ein Block. Seiten-Scroll = Zeit, Regler für Schnitte und Nachschimmern |
| `/projekte/` | Archiv (alle außer Drafts), gleichzeitig Fallback ohne WebGL |
| `/projekte/<slug>/` | Echte Projektseite. Mit `?embed=1` exakt so, wie sie im Teich und im Screenshot erscheint |

## Wie der Block funktioniert

Eine Scroll-Aufnahme ist `V(u, v, w) = Seite(u, v·480 + w·(H − 480))`. Der Block ist eine Box, deren
Shader an jeder Oberflächenposition genau diesen Wert aus **einem** Screenshot sampelt
(`src/components/scene/teich-material.ts`). Schnitte und das Absinken der Oberfläche sind nur
Uniforms (`uMin`/`uMax`), keine neue Geometrie.

Im Tauchmodus liegt die echte Seite als Iframe (640 × 480, skaliert) pixelgenau über der
Oberfläche. Ihr Scrollen treibt `w`, die Kamera sinkt mit. „Volumenblick“ blendet das DOM beim
Scrollen kurz aus, dann sieht man den Block mit Nachschimmern (Geister-Ebenen bei früheren `w`,
Opazität `gⁱ`).

## Entscheidungen, die von der Recherche abweichen

- **Südwand außen, nicht Nordwand.** Wenn die Seite von oben richtig herum lesbar ist und ihr Anfang
  außen liegt, ist die Nordwand von außen zwangsläufig spiegelverkehrt. Jetzt liegt der Seitenanfang
  innen am Wald, nach außen zeigt `Seite(x, 480 + t)`. Von außen liest man die Oberfläche zum Rand hin
  und dann die Wand hinunter, wie eine über die Kante gefaltete Seite.
- **Wasserfälle statt Teiche in einem dicken Plateau.** Unterhalb des 0,8 dicken Plateaus hängen die
  Blöcke frei, deshalb sind die Ost-/West-Schlieren jetzt auch auf der Insel sichtbar. Strömung,
  Schaumkante und Dunst am Ende hängen an `uWasser` und schalten sich beim Eintauchen ab, damit die
  Oberfläche pixelgleich zur echten Seite bleibt.
- **EZ-Tree wird nicht im Browser ausgeführt.** Das Paket bringt 3,9 MB mit eingebetteten Texturen mit.
  `scripts/baum.mjs` erzeugt stattdessen einmal ein reduziertes Modell (≈2 800 Dreiecke, 237 KB),
  das als zwei InstancedMeshes gerendert wird. Bis es geladen ist, stehen Graybox-Kegel da.
- **Eigene Kamerafahrt statt `camera-controls`.** Eine exakte Draufsicht mit festem Roll ist für
  `setLookAt` mit Welt-Y als Up-Vektor degeneriert. Position-Lerp und Quaternion-Slerp in
  `Inselszene.tsx` sind einfacher und pixelgenau.
- **Alle Teiche nutzen den Seiten-Trick**, auch Apps und Objekte (ihre Projektseite). Die
  Slit-Scan-Pipeline für Bildschirmaufnahmen ist noch offen, `source` ist dafür im Schema vorgesehen.
- **JPEG statt KTX2**, und Motion ist noch nicht eingebunden (bisher reicht CSS).

## Bekannte Grenzen

- Auf dem Handy wird das 640-px-Iframe herunterskaliert (Text klein). Lösung später: auf schmalen
  Screens die Projektseite nach dem Eintauchen direkt öffnen.
- Seitenhöhe ≤ 4096 px pro Textur, längere Seiten werden verkleinert statt gekachelt.
- Screenshots der Projekte sind lokal aus den Repos gerendert (Desktop-Apps mit Demodaten bzw. einer Tauri-Attrappe), nicht von den Live-Seiten.

## Inhalte

`src/content/projekte/*.md`, Felder laut Schema in `src/content.config.ts`:
`title, slug, type, status, featured, draft, source, kurzbeschreibung` (+ `reihenfolge`, `farbe`).
`draft: true` wird nicht gebaut, die Insel zeigt `featured` (max. 10) in der Reihenfolge von `reihenfolge`.
Nach Inhaltsänderungen `npm run shots`, sonst stimmen Textur und Seite nicht überein.
