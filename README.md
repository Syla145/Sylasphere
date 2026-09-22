# JH-Quiz – Quiz Arena v5

Aktueller Stand: **v5 – Showtime Update**. Die Versionsnummer steht in jeder Ansicht direkt neben „Quiz Arena“, damit nach einem GitHub-Pages-Update sofort erkennbar ist, welcher Stand geladen wurde.

JH-Quiz ist eine statische Multi-Page-Quiz-Anwendung für GitHub Pages. Für die fertige Anwendung sind kein Build-Schritt, kein npm und kein Servercode erforderlich.

## Seiten

- `index.html` – Rollenwahl und Feature-Übersicht
- `moderator.html` – Quiz laden/importieren, Sitzung erstellen, Spiel steuern und Antworten auswerten
- `spieler.html` – per Raumcode beitreten, mobil optimiert antworten, Live-Rangliste und Finale
- `zuschauer.html` – Presenter-/Beameransicht mit Live-Auswertungen
- `editor.html` – Quiz erstellen, Vorschau, validieren, autospeichern, importieren und exportieren

## 10 Fragetypen

### Bestehende Klassiker
- `multiple-choice` – eine richtige Antwort
- `image-quiz` – Bild + Multiple Choice
- `estimate` – Schätzfrage mit Skala
- `sort` – Elemente in die richtige Reihenfolge bringen
- `fight-list` – mehrere freie Begriffe nennen
- `higher-lower` – Werte höher/niedriger einschätzen

### Neu in v5
- `audio-quiz` – Audio anhören und Antwort wählen
- `survey` – **Publikums-Duell**: Welche Antwort wurde in einer hinterlegten Umfrage am häufigsten genannt?
- `consensus` – **Gleich gedacht**: Punkte für die tatsächliche Mehrheitsantwort der aktuellen Spieler
- `hotspot` – Zielbereich direkt auf einem Bild treffen

Alle zehn Typen sind in Spieler-, Moderator-, Zuschauer- und Editoransicht integriert und Bestandteil der Import-/Export-Validierung.

## Showtime-Upgrade v5

- Rundeneinstiege vor der jeweils nächsten Frage
- sichtbarer Spielfortschritt in der Spieleransicht
- Abschluss-Podium für die Top 3
- Punkte-Delta in den Live-Ranglisten
- deterministische Kategorie-Akzentfarben
- deutlichere Richtig-/Falsch- und Auflösungszustände
- Live-Verteilungen in der Zuschaueransicht für geeignete Fragetypen
- Statusfolge im Presenter: Lobby → Live → Auflösung → Beendet
- kopierbare Spieler-/Presenter-Links im Moderator
- Schutz vor versehentlicher Doppelwertung einer bereits ausgewerteten Frage
- Timer `0` funktioniert korrekt als manuell geschlossene/untimed Frage
- Rundenmultiplikator `0` wird korrekt respektiert

## Editor-Upgrades

- Fragetyp bereits beim Hinzufügen einer neuen Frage auswählen
- Fragen und Runden nach oben/unten verschieben
- Fragen/Runden duplizieren
- alle zehn Fragetypen vollständig editierbar
- Hotspot-Zielpunkt direkt im Vorschaubild anklicken/tippen
- Quiz-Vorschau, Autosave, Import, Validierung und Export
- Kategorien bleiben frei editierbar; zusätzlich bietet das Eingabefeld Vorschläge wie Sport, Gaming, Filme & Serien, Technik, Reisen, Essen & Trinken, Bilderrätsel, Musik & Sounds und Community & Popkultur
- alte Quizdateien mit numerischem `correctAnswer` werden weiterhin korrekt erkannt und im Editor dargestellt

## Kategorien

Kategorien bleiben **freie Textwerte direkt an den Fragen**. Es gibt keine verpflichtende Kategorienliste. Eigene Kategorien funktionieren daher ohne Codeänderung und bleiben beim Import/Export erhalten.

Für Übersichten werden Kategorien Unicode-sicher und unabhängig von Groß-/Kleinschreibung bzw. Rand-Leerzeichen zusammengeführt. Der gespeicherte Kategoriename der Frage wird dadurch nicht verändert.

## Beispielquizze

- `data/quiz-showtime.json` – **v5-Showcase mit 3 Runden, 10 Fragen und allen 10 Fragetypen**
- `data/quiz-party-mix.json` – **neues Partyquiz mit 3 Runden, 12 Fragen und Kategorien wie Sport, Gaming, Technik, Geschichte, Reisen, Essen, Film und Popkultur**
- `data/quiz-sample.json` – Legacy-Referenz mit den ursprünglichen sechs Fragetypen
- `data/quiz-demo-komplett.json` – umfangreicher Regressionstest mit 3 Runden und 12 Fragen
- `assets/demo-tone.wav` – lokales Demo-Audio für das Audio-Quiz
- `assets/demo-landmark.svg` – lokales Demo-Bild für Bild-/Hotspot-Fragen

## Lokaler Mehrspielerbetrieb

Die gemeinsame Sitzung liegt in `localStorage`. Die Spieleridentität wird tab-lokal verwaltet und zusätzlich über eine Presence-Prüfung mit `BroadcastChannel` abgesichert. Dadurch funktionieren mehrere gleichzeitig geöffnete bzw. duplizierte Spielertabs im selben Browser als getrennte Spieler. Ein echter Reload desselben Spielertabs kann seine Identität dagegen wiederverwenden.

Der in v4 behobene Zwei-Spieler-/Duplicate-Tab-Fall bleibt Bestandteil der v5-Regressionstests.

## GitHub Pages Deployment

1. **Den kompletten Inhalt dieses Ordners** in das GitHub-Repository hochladen bzw. die vorhandenen Dateien ersetzen. `.nojekyll` muss im Root bleiben.
2. In GitHub unter **Settings → Pages** den Branch/Ordner auswählen, in dem `index.html` liegt (typisch `main` + `/root`).
3. Pages-URL öffnen.
4. In der Kopfzeile prüfen, ob **Quiz Arena v5** angezeigt wird.
5. Falls noch eine alte Version sichtbar ist, einmal Hard-Refresh ausführen (`Strg + F5`).

Alle internen Pfade sind relativ und damit für Project-Pages-URLs wie `https://name.github.io/repo/` ausgelegt.

## Technische Grenze

Die derzeitige Live-Synchronisierung ist frontend-only und funktioniert zwischen Tabs/Fenstern **desselben Browsers auf demselben Gerät**. Für echten Moderator-PC ↔ Spieler-Handys-Multiplayer über das Internet ist ein separates Realtime-Backend nötig; das statische JH-Quiz-Frontend kann dabei weiterhin auf GitHub Pages bleiben.
