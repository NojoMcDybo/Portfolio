---
title: Haze
slug: haze
type: app
status: in-arbeit
featured: true
reihenfolge: 1
farbe: "#8a5d12"
kurzbeschreibung: Dashboard und schwebendes Windows-Widget für Glukosewerte aus einer vorhandenen Nightscout-Instanz.
stack: [Electron, React, TypeScript, Vite]
links:
  repo: https://github.com/NojoMcDybo/Haze
  download: https://github.com/NojoMcDybo/Haze/releases
bilder:
  - src: /projekte/haze/dashboard.jpg
    alt: Haze-Dashboard mit großem Messwert 143 mg/dL, Trendpfeil und Verlauf der letzten drei Stunden
    text: Dashboard im Vorschaumodus mit Demodaten.
hinweis: Kein Medizinprodukt. Werte können verzögert, unvollständig oder falsch sein. Therapieentscheidungen gehören zum zugelassenen CGM-System, nicht zu Haze.
---

## Was es ist

Haze liest Werte aus einer Nightscout-Instanz und zeigt sie an zwei Stellen: als ruhiges Dashboard mit Verlauf und als minimalistisches Widget direkt auf dem Windows-Desktop. Das Widget zeigt Wert, Trend, Einheit, Messwertalter und die Änderung seit der letzten Messung, sonst nichts. Keine Werkzeugleiste, keine Hover-Knöpfe.

## Das Widget

- Dockt an Bildschirmkanten an. Nahe der Kante bildet sich ein Hals, der sich beim Weiterziehen dehnt und erst nach einer einstellbaren Haftstrecke abreißt. Beim Loslassen federt das Widget an die Kante.
- Klar oder als farbloses Liquid Glass mit nativer Randbrechung und einstellbarer Weichzeichnung.
- Profile „Arbeit“ und „Gaming“: Gaming kann Sperre und Durchklicken speichern, damit das Widget im Spiel nicht im Weg ist.

## Sorgfalt

- Nur lesender Zugriff auf Nightscout, Zugangsdaten DPAPI-geschützt.
- „Server erreichbar“ heißt nicht „aktuelle Messung“: Der Verbindungstest zeigt den letzten gültigen Wert mit Datum und Uhrzeit.
- Ein Demo-Modus mit Beispieldaten, damit man die App ohne eigene Daten erkunden kann.

Haze ist Teil einer kleinen Familie: [Notch](/projekte/notch/) zeigt den Wert auch in der Bildschirm-Insel an.
