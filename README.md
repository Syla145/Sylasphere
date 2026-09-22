# Schmobin – Quiz Arena

Statische Multi-Page-Quiz-Anwendung für GitHub Pages. Kein Build-Schritt, kein npm und kein Servercode für den Frontend-MVP erforderlich.

## Seiten

- `index.html` – Rollenwahl
- `moderator.html` – Quiz laden/importieren, Sitzung erstellen und Spiel steuern
- `spieler.html` – per Raumcode beitreten, antworten, Rangliste
- `zuschauer.html` – Presenter-/Beameransicht
- `editor.html` – Quiz erstellen, validieren, autospeichern, importieren und exportieren

## Fragetypen

`multiple-choice`, `estimate`, `image-quiz`, `sort`, `fight-list`, `higher-lower`.

## Kategorien

Kategorien bleiben freie Textwerte an Fragen. Es gibt keine fest codierte Kategorienliste. Die Oberfläche führt Kategorien für Übersichten Unicode-sicher und unabhängig von Groß-/Kleinschreibung bzw. Rand-Leerzeichen zusammen, ohne die gespeicherte Kategorie einer Frage umzuschreiben. Neue Kategorien funktionieren daher ohne Codeänderung.

## GitHub Pages Deployment

1. **Den kompletten Inhalt dieses Ordners** in das gewünschte GitHub-Repository hochladen. `.nojekyll` muss im Root bleiben.
2. In GitHub unter **Settings → Pages** als Quelle den Branch/Ordner wählen, in dem `index.html` liegt (typisch `main` + `/root`).
3. Nach dem Deployment die von GitHub angezeigte Pages-URL öffnen. Alle App-Pfade sind relativ und funktionieren auch unter Project-Pages-URLs wie `https://name.github.io/repo/`.
4. Nach größeren Änderungen bei altem Browserstand einmal Hard-Refresh durchführen. Die Quiz-Liste wird bewusst mit `cache: no-store` plus Cache-Buster geladen.

## Beispielquizze

- `data/quiz-sample.json` – kompakter Referenztest mit allen sechs Fragetypen.
- `data/quiz-demo-komplett.json` – drei Runden, 13 Kategorien, 12 Fragen, verschiedene Timer/Punkte/Multiplikatoren und Sonderzeichen.

## Technische Grenze des Frontend-MVP

Die Live-Synchronisierung verwendet `localStorage` + `BroadcastChannel`. Die gemeinsame Sitzung liegt in `localStorage`, während die eigene Spieler-ID tab-lokal in `sessionStorage` gespeichert wird, damit mehrere Spieler-Tabs desselben Browsers parallel teilnehmen können. Das funktioniert zuverlässig zwischen Tabs/Fenstern **desselben Browsers auf demselben Gerät**. GitHub Pages kann selbst keinen WebSocket-Server bereitstellen. Für echten Moderator-PC ↔ Spieler-Handys-Multiplayer wird als nächster Architektur-Schritt ein separates Realtime-Backend benötigt; das statische Frontend kann dabei weiterhin auf GitHub Pages bleiben.
