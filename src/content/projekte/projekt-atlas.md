---
title: Projekt Atlas
slug: projekt-atlas
type: website
status: in-arbeit
featured: true
reihenfolge: 5
farbe: "#7a3b2c"
kurzbeschreibung: Eine gezeichnete, interaktive Karte von Mittelerde, die zu jeder Angabe zeigt, woher sie stammt und wie sicher sie ist.
stack: [Python, JSON Schema, SVG, JavaScript]
bilder:
  - src: /projekte/projekt-atlas/karte.jpg
    alt: Handgezeichnet wirkende Karte mit Gebirgen, Flüssen und einer Route von Bruchtal, dazu eine Zeitleiste und eine Infotafel mit den Markierungen belegt und inhaltlich unsicher
    text: Prototyp 2, Ausschnitt Bruchtal bis Caras Galadhon. Ungeprüftes ist sichtbar als ungeprüft markiert.
hinweis: Unautorisiertes, nicht kommerzielles Fanprojekt. Alle zugrunde liegenden Inhalte gehören dem Tolkien Estate.
---

## Die Frage

Karten von Mittelerde zeigen Orte und Wege, als wären sie sicher. Der Textbestand ist es nicht: Datierungen widersprechen sich, Fassungen weichen voneinander ab, und manches ist nur erschlossen. Projekt Atlas macht diese Unsicherheit sichtbar, statt sie zu glätten.

## Wie

- Jedes Ereignis und jede Route trägt eine Quellenangabe und einen Verifikationsstatus. Nichts wird ohne sichtbare Kennzeichnung dargestellt.
- Zeit ist ein Objekt mit Kalendersystem und Präzisionsgrad, keine Zahl. Vor dem Aufgang der Sonne lassen sich Ereignisse ordnen, aber nicht datieren.
- Die Basiskarte wird zur Bauzeit gezeichnet, reproduzierbar über einen festen Seed.
- Ein Prüfstand mit Inspektoren prüft Daten gegen JSON-Schemata, ab Phase 1 arbeiten Agentenrollen mit Kreuzprüfung.

## Stand

Phase 0a: 40 Ereignisse und 33 Orte im Bestand, noch keines gegen den Primärtext geprüft. Ereignistexte sind Paraphrase, niemals Zitat.
