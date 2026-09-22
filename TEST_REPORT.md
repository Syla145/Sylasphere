# JH-Quiz – Abschlussprüfung v7 „Precise Score Update"

Stand: 22.09.2026

## Ergebnis v7

Die Auflösung wurde vollständig von der Antwortphase getrennt. Der Timer schließt jetzt nur noch die Eingabe; Lösung, Statistiken und Punkte erscheinen erst nach dem expliziten Moderator-Klick auf **„✨ Frage auflösen“**.

### Geprüfter Zustandsablauf

**Frage öffnen → Antworten möglich → Timer abgelaufen / Antworten manuell schließen → Antworten gesperrt, Lösung verborgen → Moderator löst auf → Punkte und Lösung erscheinen → Navigation freigegeben.**

Automatisch bestanden:

- **22 Session-/State-Flow-Checks** für Öffnen, Schließen, Auflösen, Doppelscoring-Schutz und Navigation
- **10 Scoring-Checks** über alle zehn Fragetypen
- **53 JSON-/Quiz-Validierungschecks** über alle mitgelieferten Quizdateien
- **54 lokale HTML-Referenz-, Versions- und Cache-Buster-Checks**
- JavaScript-Syntaxprüfung aller produktiven JavaScript-Dateien
- sichtbare Versionsmarke **Quiz Arena v7** in allen Ansichten
- CSS-/JS-Cache-Buster **`?v=7`**
- `[hidden]`-Regression weiterhin abgesichert
- bestehende Zwei-Spieler-/Duplicate-Tab-Identitätslogik bleibt unverändert erhalten


### Spezifische v7-Regressionen

- `+1` erhöht exakt um einen Punkt
- `−1` reduziert exakt um einen Punkt
- bestehende `+10` / `−10`-Korrekturen bleiben erhalten
- direkter Gesamtpunktestand kann auf einen beliebigen ganzzahligen Wert gesetzt werden
- negative Korrekturwerte werden korrekt gespeichert
- alle Änderungen laufen über die bestehende SessionEngine und synchronisieren dadurch die Ranglisten
- Moderator-UI enthält pro Spieler fünf präzise Bedienelemente (`−10`, `−1`, Direktwert, `+1`, `+10`)
- alle fünf HTML-Ansichten verwenden **v7** und `?v=7`

### Spezifische v6-Regressionen

- Timerablauf vergibt **keine Punkte** und zeigt **keine Lösung**.
- Nach Timerablauf werden weitere Antworten abgewiesen.
- Der Moderator kann eine Frage auch vor Timerende über **„Antworten schließen“** sperren.
- Fragen mit Timer `0` lassen sich manuell schließen und anschließend auflösen.
- Eine geschlossene, noch nicht aufgelöste Frage kann nicht erneut gestartet oder übersprungen werden.
- **„Frage auflösen“** vergibt Punkte exakt einmal; mehrfaches Klicken erzeugt kein Doppelscoring.
- Spieler sehen in der Zwischenphase **„Antworten geschlossen“** statt der Lösung.
- Presenter/Zuschauer sehen in der Zwischenphase ebenfalls keine Lösung oder Antwortstatistik.
- Der Moderator sieht einen deutlich hervorgehobenen Reveal-Button, sobald aufgelöst werden kann.

---

## Bestehende v5-Prüfungen (weiterhin gültig)


## Neue Fragetypen v5

Zu den sechs bestehenden Typen kommen vier vollständig integrierte Spielmodi:

1. `audio-quiz` – Audio + Antwortauswahl
2. `survey` – Publikums-Duell mit prozentualen Antwortwerten
3. `consensus` – dynamische Mehrheitsfrage; die gewinnende Antwort entsteht aus den aktuellen Spielerantworten
4. `hotspot` – Klick-/Tap-Zielbereich auf einem Bild

Weiterhin unterstützt: `multiple-choice`, `image-quiz`, `estimate`, `sort`, `fight-list`, `higher-lower`.

## Automatische Kernprüfungen

Bestanden:

- JavaScript-Syntax aller produktiven `.js`-Dateien mit `node --check`
- JSON-Parsing von `manifest.json` und sämtlichen Quiz-Dateien
- `quiz-sample.json` validiert und importierbar
- `quiz-demo-komplett.json` validiert und importierbar
- `quiz-showtime.json` validiert, enthält alle 10 Fragetypen
- `quiz-party-mix.json` validiert und importierbar
- Import → Normalisierung → JSON-Roundtrip → erneute Validierung
- Punkteberechnung aller zehn Fragetypen
- Kategorien-Deduplizierung ohne Verlust des gespeicherten Anzeigenamens
- Unicode-/Umlaut-Kategorie (`Café & Kultur`)
- Legacy-`correctAnswer` als numerischer Index einschließlich korrekter Lösungsausgabe
- Quiz ohne Fragen wird als Fehler blockiert
- Survey mit ausschließlich 0-%-Werten wird als Fehler blockiert
- Higher/Lower mit identischen Nachbarwerten erzeugt einen Plausibilitätshinweis
- Timer `0` bleibt wirklich untimed und fällt nicht auf den Standardtimer zurück
- Rundenmultiplikator `0` bleibt `0`
- bereits geschlossene Fragen werden nicht doppelt gewertet

Der zentrale Node-/VM-Regressionslauf umfasst **101 Kernchecks** plus zusätzliche v5-Final-Validator-Edge-Cases.

## Vollständige Session-Simulation

Ein kompletter Engine-Durchlauf wurde deterministisch mit **zwei Spielern**, **drei Runden** und **allen zehn Fragetypen** simuliert.

Geprüft wurden u. a.:

- zwei getrennte Spieler-IDs
- Spielstart
- Frage öffnen und Antwortabgabe
- Frage schließen und Wertung
- Rundenmultiplikatoren
- dynamische Mehrheitswertung
- Hotspot-Auswertung
- Rundensnapshots
- Navigation zur nächsten Frage/Runde
- Schutz vor Doppelwertung
- Spielende

Ergebnis des Testlaufs:

- Anna: **1.591 Punkte**
- Ben: **1.591 Punkte**
- Rundenzusammenfassungen: **3/3**
- Engine-Fehler: **0**

## Zwei-Spieler-/Duplicate-Tab-Regression

Die Spieleridentität wurde separat mit nachgebildetem `BroadcastChannel` und getrennten Tab-Speichern getestet:

- Spieler 1 aktiv → Spieler 2 erhält eigene ID
- duplizierter Tab übernimmt zunächst denselben `sessionStorage`-Wert → Presence-Prüfung verhindert Wiederverwendung der aktiven ID
- echter Reload nach Ende des alten Tabs → vorhandene Spieler-ID kann wiederverwendet werden

Ergebnis: **bestanden**.

## Statische GitHub-Pages-Prüfung

Bestanden:

- `.nojekyll` vorhanden
- ausschließlich statische HTML/CSS/JS/JSON-/Asset-Dateien
- keine npm-/Build-Abhängigkeit
- alle HTML-internen lokalen `src`-/`href`-Referenzen vorhanden
- alle Einträge aus `quiz-list.json` zeigen auf vorhandene JSON-Dateien
- alle lokalen Quiz-Bild-/Audio-Assets vorhanden
- sämtliche produktiven CSS-/JS-Referenzen verwenden `?v=5`
- sichtbare Versionsmarke **Quiz Arena v5** in allen fünf HTML-Ansichten
- kein produktives `TODO`, `debugger` oder `console.log/debug`

## Layout-/Browserprüfung

Vor dem finalen Patchsatz wurden Desktop- und 390-px-Mobile-Renderings der v5-Oberfläche sowie des Editors visuell geprüft. Dabei wurde unter anderem ein Mobile-Overflow im Editor behoben. Ein kleiner Abstandskonflikt an den Rollen-Karten wurde im finalen Patch ebenfalls korrigiert.

Ein erneuter vollautomatisierter Chromium-Navigationslauf des finalen Ordners konnte in dieser Ausführungsumgebung **nicht** durchgeführt werden, weil der installierte Browser lokale/HTTP-Navigation per Administratorrichtlinie mit `ERR_BLOCKED_BY_ADMINISTRATOR` blockiert. Das ist eine Einschränkung der Testumgebung, nicht der ausgelieferten GitHub-Pages-Dateien. Deshalb wurden die finalen Änderungen zusätzlich über Syntax-, DOM-ID-, Datei-/Asset-, Engine- und Datenmodelltests abgesichert.

## UX-/Game-Show-Upgrade

Enthalten und geprüft:

- Rundeneinstiege
- Kategorie-/Typ-/Punkte-Preview
- Spieler-Fortschrittsbalken
- dynamisches Punkte-Delta in Ranglisten
- Top-3-Podium im Finale
- Presenter-Status Lobby/Live/Auflösung/Beendet
- Presenter-Auswertungen für Auswahl-, Schätz-, Fight-List- und Hotspot-Fragen
- differenzierte Reveal-Zustände
- kopierbare Spieler-/Presenter-Links
- deterministische Kategorie-Farben
- Hotspot-Zielpunkt-Picker im Editor
- Kategorie-Vorschläge bei weiterhin frei definierbaren Kategorien

## Bekannte Plattformgrenze

Der Frontend-only-Mehrspielermodus synchronisiert Tabs/Fenster desselben Browsers/Geräts. Geräteübergreifendes Internet-Multiplayer benötigt ein separates Realtime-Backend.
