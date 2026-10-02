---
title: Folio
slug: folio
type: app
status: in-arbeit
featured: true
reihenfolge: 3
farbe: "#2a2a30"
kurzbeschreibung: Ein PDF-Reader für Windows, dessen Bedienung als Glas über dem Dokument schwebt.
stack: [Tauri v2, Rust, TypeScript, PDF.js, WebGL]
links:
  repo: https://github.com/NojoMcDybo/folio
bilder:
  - src: /projekte/folio/leser.jpg
    alt: Folio-Leseansicht auf anthrazitfarbenem Grund mit einer geöffneten PDF-Seite und runden Glasknöpfen in den Ecken
    text: Leseansicht. Das Dokument ist das Glossar aus LitCultLingu.
---

## Idee

Ein PDF-Reader, bei dem das Dokument den ganzen Raum bekommt. Das Fenster ist rahmenlos, die Bedienung schwebt in Glas darüber, und F11 blendet sie ganz aus. Das Glas läuft auf WebGL und bricht den Seiteninhalt darunter, ohne Kunstlicht.

## Was es kann

- Bibliothek als eigenes Fenster, zuletzt geöffnete Dokumente als Kacheln
- Jedes Dokument in einem eigenen Fenster; dieselbe Datei kommt nach vorn statt doppelt aufzugehen
- Textmarker, Stift und Textfeld, Änderungen werden ins PDF zurückgeschrieben
- Suche, Invertierung und Werkzeuge lassen sich frei verschieben
- Fortlaufendes Scrollen, gerendert wird nur der Sichtbereich
- Zoom mit Strg+Rad, der Punkt unter der Maus bleibt stehen

## Entscheidungen

MuPDF wird bewusst nicht verwendet, wegen der AGPL. PDF.js steht unter Apache-2.0, Folio selbst unter MIT. Die Gestaltung ist von Apples Liquid Glass inspiriert, die Umsetzung ist eigener Code.
