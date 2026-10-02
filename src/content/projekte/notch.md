---
title: Notch
slug: notch
type: app
status: in-arbeit
featured: true
reihenfolge: 2
farbe: "#1b2523"
kurzbeschreibung: Eine Dynamic-Island-artige Infoanzeige für Windows, bündig an der oberen Bildschirmkante.
stack: [Tauri v2, Rust, TypeScript]
links:
  repo: https://github.com/NojoMcDybo/notch
bilder:
  - src: /projekte/notch/einstellungen.jpg
    alt: Einstellungsfenster der Notch mit Vorschau der kleinen Notch, die Musik, Blutzucker 112 und einen Timer zeigt, darunter die Rangliste der Quellen
    text: Einstellungen im Modus „Ausprobieren“ mit Beispielwerten.
---

## Drei Zustände

Im Ruhezustand ist die Notch eine kleine schwarze Form. Läuft Musik oder meldet eine Quelle etwas, wird sie kompakt und zeigt es. Fährt die Maus darüber, zieht man eine Datei darauf oder kommt ein Alarm, klappt sie auf.

## Eine Rangliste statt Zufall

Was die kleine Notch zeigt, entscheidet eine Rangliste, zwei Plätze gleichzeitig: Blutzucker aus [Haze](/projekte/haze/), Musik, Timer, Puls, [Folio](/projekte/folio/) und andere Apps. Die Regeln sind bewusst einfach:

- Blutzucker außerhalb des Zielbereichs steht ganz oben und schlägt alles andere.
- Puls über einer Schwelle (Standard 140) rückt nach oben und erst unter Schwelle minus 5 wieder zurück, damit nichts flackert.
- Ein laufender Timer macht die Notch breiter, statt etwas zu verdrängen.
- Folio blättert: Die Seitenzahl übernimmt kurz den letzten Platz.

## Andocken und Vollbild

Die Notch lässt sich greifen und an die obere, linke oder rechte Kante ziehen, seitlich wird sie zur senkrechten Pille. Bei Vollbild-Programmen fährt sie weg, wartet am Rand oder bleibt klein und durchklickbar.

## Sprachassistent

Ein Mikrofon-Knopf startet ein Sprachgespräch über die OpenAI Realtime API. Der API-Schlüssel bleibt im Rust-Teil, das Frontend bekommt nur einen kurzlebigen Sitzungsschlüssel.
