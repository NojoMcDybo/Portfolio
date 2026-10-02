---
title: Nebel
slug: nebel
type: app
status: in-arbeit
featured: true
reihenfolge: 9
farbe: "#4f5d66"
kurzbeschreibung: Ein Browser-Simulator, der Angehörigen und Freunden zeigt, wie sich ein Tag mit Typ-1-Diabetes anfühlt.
stack: [TypeScript, Physiologisches Modell, HTML]
bilder:
  - src: /projekte/nebel/prototyp.jpg
    alt: Helle Startseite von nebel mit dem Satz Der Sensor zeigt dir nicht, wie es deinem Körper geht, sondern wie es ihm vor fünf Minuten ging, darunter fünf Regeln und Beispiel-Therapiewerte
    text: UX-Prototyp. Er ist keine physiologische Quelle.
hinweis: Nebel dient ausschließlich der Bildung und dem Perspektivwechsel. Kein Medizinprodukt, keine Dosierempfehlungen, keine echten Gesundheitsdaten.
---

## Für wen

Für Partnerinnen, Eltern, Geschwister, Freunde und Trainer. Menschen mit Typ-1-Diabetes selbst brauchen kein Empathiewerkzeug. Angehörige sehen das Ergebnis, aber nicht den Prozess.

## Was sichtbar werden soll

- **Die Dauerbelastung ohne Ereignis.** Es passiert nichts Dramatisches, und trotzdem läuft im Kopf permanent ein Nebenprozess.
- **Die Verzögerung.** Eine Entscheidung wirkt erst in 20 bis 90 Minuten. Man handelt gegen eine Zukunft, die man nicht kennt.
- **Die Unsicherheit der Zahl.** Der Sensorwert ist eine gefilterte, verzögerte Schätzung.

## Unter der Oberfläche

Die physiologische Engine ist ein eigenständiges TypeScript-Modul und implementiert das erweiterte Hovorka-Modell nach Hobbs et al. (2019) und Siket, Rashid & Cinar (2025). Eine Validierungsmatrix existiert bereits als Testsuite und schlägt absichtlich fehl, bis die Module gebaut sind. Eine GPL-lizenzierte Referenzimplementierung dient nur als Vergleichsorakel in den Tests, Code daraus wurde nicht übernommen.

## Stand

Zielgruppe, Spezifikation und rechtliche Einordnung stehen, die Engine hat ihr Grundgerüst. Nebel bleibt unentgeltlich, das ist Teil der Zweckbestimmung.
