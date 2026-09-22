# Schmobin – Abschlussprüfung

Stand: 22.09.2026

## Automatisch geprüft

- JavaScript-Syntax aller produktiven `.js`-Dateien mit `node --check`: **bestanden**.
- JSON-Parsing von `manifest.json`, `quiz-list.json`, `quiz-sample.json`, `quiz-demo-komplett.json`: **bestanden**.
- HTML: doppelte IDs und fehlende lokale `src`/`href`-Dateireferenzen: **keine gefunden**.
- Quiz-Validator: beide mitgelieferten Quizze ohne Fehler; absichtlich defektes Quiz erzeugt verständliche Fehler für u. a. negative Timer/Punkte, doppelte IDs, leere Fragen, unbekannten Typ und ungültige Multiple-Choice-Daten.
- Abwärtskompatibilität: Quiz mit älterer Top-Level-`questions`-Struktur wird in eine Runde normalisiert.
- Kategorien: Unicode/Umlaute, `&`, Leerzeichen sowie Groß-/Kleinschreibung geprüft; Zuordnung an Fragen bleibt erhalten, Übersichten deduplizieren kanonisch.
- Import/Export-Roundtrip auf Datenebene: `quiz-demo-komplett.json` normalisiert → serialisiert → erneut geparst/validiert; **12/12 Fragen erhalten**.
- Punkteberechnung: alle sechs Fragetypen separat geprüft.
- Vollständiger Session-Durchlauf auf Engine-Ebene: **12 Fragen / 3 Runden**, Antworten, Multiplikatoren, Scoring, Rundensnapshots und Spielende; erwarteter Testscore **2565 Punkte** erreicht.
- Renderer aller sechs Fragetypen in Chromium-DOM getestet; Interaktionen (Auswahl, Slider, Sortiersteuerung, Freitextliste, Higher/Lower) reagieren korrekt.
- Smartphone-Breite 390 px: alle sechs Fragetypen ohne horizontalen Overflow. Dabei wurde ein Range-Input-Overflow gefunden und behoben.
- Visuelle Startseitenprüfung in Chromium bei 1440×1000 px durchgeführt.

## Behobener QA-Fund

Vor dem Öffnen einer Frage durfte Spieler/Zuschauer die Lösung nicht sehen. Der Session-Zustand setzt beim Fragenwechsel nun `questionStartedAt` zurück; Spieler- und Zuschaueransicht zeigen bis zum Start einen neutralen Wartezustand. Lösung und Punkte erscheinen erst nach einer tatsächlich gestarteten und geschlossenen Frage.

## Nicht live verifiziert

Ein echter GitHub-Pages-Deploy war in dieser Arbeitsumgebung nicht möglich, weil kein zugehöriges Repository/keine Pages-URL als bearbeitbarer Projektstand vorlag. Deshalb wurden Pfade, Groß-/Kleinschreibung, `.nojekyll`, statische Dateireferenzen und Project-Pages-relative URLs automatisiert geprüft. Es gibt keine lokale oder Build-Abhängigkeit im ausgelieferten Projekt.
