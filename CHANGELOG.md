# JH-Quiz – Changelog

## v7 – Precise Score Update · 22.09.2026

- Moderator kann Spielerpunkte jetzt auf die **1er-Stelle genau** anpassen
- neue Schnellaktionen `−10`, `−1`, `+1`, `+10` pro Spieler
- direkter editierbarer Gesamtpunktestand pro Spieler
- Eingabe wird auf ganze Punkte normalisiert
- bestehende automatische Punkteauswertung und Ranglisten-Synchronisation bleiben erhalten
- sichtbare Versionsmarke **Quiz Arena v7** und `?v=7` Cache-Buster

# JH-Quiz Changelog

## v6 – Moderator Reveal Update · 22.09.2026

- Timer beendet nur noch die Antwortphase; keine automatische Auflösung mehr
- neuer Moderator-Button **„✨ Frage auflösen“**
- neue Zwischenphase **„Antworten geschlossen“** für Moderator, Spieler und Presenter
- Lösung, Statistiken und Punkte bleiben bis zum manuellen Reveal verborgen
- manuelles **„Antworten schließen“** für Fragen mit und ohne Timer
- Navigation wird blockiert, solange eine gestartete Frage noch nicht aufgelöst wurde
- Leertasten-Shortcut folgt jetzt dem Ablauf Öffnen → Schließen → Auflösen
- sichtbare Versionsmarke **Quiz Arena v6** und `?v=6` Cache-Buster

## v5 – Showtime Update · 22.09.2026

### Neu
- 4 neue Fragetypen: Audio-Quiz, Publikums-Duell, Gleich gedacht, Hotspot
- 10 Fragetypen insgesamt
- Rundeneinstiege und Kategorie-Preview
- Top-3-Podium
- Live-Punkte-Delta in Ranglisten
- Presenter-Live-Auswertungen
- sichtbarer Spielfortschritt
- Hotspot-Zielpunkt-Picker im Editor
- Kategorie-Vorschläge im Editor, freie Kategorien bleiben erhalten
- neues Showcase-Quiz `quiz-showtime.json`
- neues Partyquiz `quiz-party-mix.json`

### Stabilität
- v4-Multiplayer-/Duplicate-Tab-Fix beibehalten und regressionsgetestet
- Schutz gegen Doppelwertung
- Timer 0 korrekt unterstützt
- Rundenmultiplikator 0 korrekt unterstützt
- robustere Legacy-`correctAnswer`-Kompatibilität
- strengere Survey-/Quiz-Validierung
- Hinweis bei uneindeutigen Higher/Lower-Nachbarwerten
- Spieler-Topbar-/Progress-Zuordnung korrigiert
- lokale Assets und relative GitHub-Pages-Pfade geprüft

### Branding / Deployment
- JH-Quiz Branding
- sichtbare Versionsmarke `Quiz Arena v5`
- CSS-/JS-Cache-Buster `?v=5`
