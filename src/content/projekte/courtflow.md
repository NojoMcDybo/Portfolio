---
title: CourtFlow
slug: courtflow
type: website
status: in-arbeit
featured: true
reihenfolge: 8
farbe: "#a52a8a"
kurzbeschreibung: Übungsbibliothek für Kinder- und Jugendbasketball von U8 bis U18, die zeigt, wie gut jede Übung belegt ist.
stack: [TypeScript, Vite, Python]
links:
  live: https://nojomcdybo.github.io/courtflow/
  repo: https://github.com/NojoMcDybo/courtflow
bilder:
  - src: /projekte/courtflow/start.jpg
    alt: CourtFlow-Startseite in Schwarz mit drei großen Farbverlauf-Ziffern für Drill-Liste, Trainingsaufbau und automatischen Plan
    text: Drei Einstiege.
  - src: /projekte/courtflow/bibliothek.jpg
    alt: Abdeckungsmatrix mit Themen wie Ballhandling und Spacing gegen Altersstufen U8 bis U18, darunter Übungskarten
    text: Die Abdeckungsmatrix zeigt, wie viele Übungen es je Thema und Altersstufe gibt.
---

## Der eigentliche Beitrag

Jr. NBA, FIBA/WABC und der DBB veröffentlichen Übungen, aber keine dieser Quellen sagt, wie gut die einzelne Aufgabe belegt ist. CourtFlow ordnet jede Übung einer Kompetenz, einem Altersfenster und einem Belastungsprofil zu, nennt die Originalquelle und weist die Belegtiefe aus. Dünne und dichte Datensätze sehen nicht mehr gleich aus.

## Drei Flächen

1. **Drill-Bibliothek:** 146 Übungen, navigierbar über die Abdeckungsmatrix aus Thema und Alter.
2. **Trainingsaufbau:** Altersgruppe, Trainingsart und Dauer wählen, dann Block für Block Übungen einsetzen.
3. **Automatischer Plan:** Rahmen eingeben, Einheit bekommen, auf Wunsch neu würfeln. Die Karten sammeln sich dabei zu einem Stapel und werden neu ausgeteilt.

## Daten

Grundlage ist ein eigener Kompetenzkatalog (v3.8). Eine Python-Pipeline extrahiert, normalisiert und prüft ihn. 144 der 146 Übungen haben eine Quelle, zwei sind offen. Die ganze Oberfläche gibt es auf Deutsch und Englisch.
