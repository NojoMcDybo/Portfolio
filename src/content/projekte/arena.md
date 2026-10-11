---
title: Arena
slug: arena
type: app
status: in-arbeit
featured: true
reihenfolge: 3
farbe: "#6e2c2c"
kurzbeschreibung: Live-Sport, Spielplan, Tabellen und die eigenen Teams als Windows-App. Die Notch zeigt den Spielstand nebenbei, Arena ist der Ort, den man dafür öffnet.
stack: [Tauri v2, Rust, TypeScript, ONNX Runtime]
links:
  repo: https://github.com/NojoMcDybo/arena
---

## Vier Ansichten

- **Live:** alle Spiele von heute, das gewählte groß. Beim Fußball Ballverlauf, Druckphasen und Statistik, beim Basketball das Wurfbild beider Teams. Dazu Ticker, Aufstellung in der Formation und Spielort.
- **Spielplan:** eine Woche zurück bis drei Wochen voraus. Je Tag stehen die Wettbewerbe nebeneinander, Fußball neben NBA neben NFL, jeder in seiner Ligafarbe.
- **Ligen:** Tabelle, Spielplan und Schlagzeilen nebeneinander.
- **Teams:** Form, Stärken des Kaders als Radar, letzte Aufstellungen und Kader. Jeder Spieler öffnet eine Spielerkarte.

## Nichts blinkt

Neue Daten ändern nur, was neu ist. Stand und Minute wechseln als Text, neue Tickerzeilen laufen oben ein, Wappen, Spielfeld und Karten bleiben stehen. Dieselbe Logik läuft auch in der [Notch](/projekte/notch/).

## Details, die Arbeit gemacht haben

- **Stadion** von oben aus dem echten OpenStreetMap-Grundriss, maßstabsgetreu, und von der Seite mit Rängen nach Kapazität
- **Ähnliche Spieler:** Saisonwerte je 90 Minuten, bezogen auf den Ligaschnitt, innerhalb der Positionsgruppe
- **Spielverlauf:** alle Ballaktionen zum Durchscrollen oder im Zeitraffer, Abschlüsse in der Teamfarbe des Schützen
- **Wappen statt Vereinsnamen**, gestaltet in derselben Designsprache wie [Folio](/projekte/folio/): Grau, Liquid Glass für alles Schwebende, Licht als Information

## KI, aber lokal und optional

Ein kleines Modell (Laya, Apache-2.0) ordnet Schlagzeilen ein: Transfer fix, Gerücht, Verlängerung, Verletzung, Spiel. Es läuft auf dem eigenen Rechner in einem Web Worker über ONNX Runtime und wird nur geladen, wenn man es will.

## Was es nicht gibt

Marktwerte und Fußball-Transferlisten. Dafür gibt es keine offene Schnittstelle, und Scraping verstößt gegen die Nutzungsbedingungen. Arena lässt sie deshalb weg.
