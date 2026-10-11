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
npm run artefakt     # Fassung mit relativen Pfaden für Hosting unter einer Unteradresse → artefakt/
```

## Seiten

| Route | Was |
|---|---|
| `/` | Insel im Überblick: Ziehen dreht um die Hochachse, Klick auf Teich = eintauchen, Klick auf den Wald oder „Insel betreten“ = zu Fuß weiter, `/#slug` = Deep-Link |
| `/` zu Fuß | Ego-Perspektive ohne Körper. WASD/Pfeile gehen (Shift schneller), Ziehen schaut, Klick auf den Boden = hingehen, Klick auf einen Teich = hinlaufen und eintauchen, am Ufer `E`. `Esc` taucht auf bzw. führt zurück in den Überblick |
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
- **Low-Poly-Tannen statt EZ-Tree.** Ein Baum ist Stamm plus drei gestaffelte Kegel, opak, flach
  schattiert, Farben als Vertex-Farben (≈60 Dreiecke). Der ganze Wald ist ein InstancedMesh. Wind läuft
  im Vertex-Shader (Höhe², Phase aus der Instanzposition, langsame Böen), der Schatten nutzt dieselbe
  Formel. Die erste Fassung mit EZ-Tree-Nadelkarten war zu Fuß zu teuer (Alpha-Überzeichnung).
- **Eigene Kamerafahrt statt `camera-controls`.** Eine exakte Draufsicht mit festem Roll ist für
  `setLookAt` mit Welt-Y als Up-Vektor degeneriert. Position-Lerp und Quaternion-Slerp in
  `Inselszene.tsx` sind einfacher und pixelgenau.
- **Alle Teiche nutzen den Seiten-Trick**, auch Apps und Objekte (ihre Projektseite). Die
  Slit-Scan-Pipeline für Bildschirmaufnahmen ist noch offen, `source` ist dafür im Schema vorgesehen.
- **JPEG statt KTX2**, und Motion ist noch nicht eingebunden (bisher reicht CSS).

## Zu Fuß: wie es billig bleibt

- Keine Physik-Engine. Die Insel ist flach (Bodenhöhe 0), Kollision ist 2D: Kreise für Bäume, Rechtecke für Teiche, Halbebenen für den Inselrand (`src/components/scene/gehen.ts`). Am Hindernis rutscht man entlang statt hängenzubleiben.
- Ein baumfreier Uferweg verbindet alle Teiche. Man startet auf ihm, mit Blick auf den ersten Teich.
- Beim Gehen rückt der Dunst heran (3–30 statt 55–140) und das Sichtfeld öffnet sich auf 68°. Was im Dunst liegt, muss nicht scharf sein.
- Wellen und Strömung blenden beim Anflug aus und rasten am Ziel auf 0 ein, unabhängig von der Bildrate. Sonst stimmt die Oberfläche nicht mit der Seite überein.

## Bekannte Grenzen

- Vom inneren Ufer aus steht der Text auf der Oberfläche auf dem Kopf. Das ist der Preis dafür, dass der Wasserfall von außen lesbar ist (Seitenanfang innen).

- Auf dem Handy wird das 640-px-Iframe herunterskaliert (Text klein). Lösung später: auf schmalen
  Screens die Projektseite nach dem Eintauchen direkt öffnen.
- Seitenhöhe ≤ 4096 px pro Textur, längere Seiten werden verkleinert statt gekachelt.
- Screenshots der Projekte sind lokal aus den Repos gerendert (Desktop-Apps mit Demodaten bzw. einer Tauri-Attrappe), nicht von den Live-Seiten.

## Inhalte

`src/content/projekte/*.md`, Felder laut Schema in `src/content.config.ts`:
`title, slug, type, status, featured, draft, source, kurzbeschreibung` (+ `reihenfolge`, `farbe`).
`draft: true` wird nicht gebaut, die Insel zeigt `featured` (max. 10) in der Reihenfolge von `reihenfolge`.
Nach Inhaltsänderungen `npm run shots`, sonst stimmen Textur und Seite nicht überein.
