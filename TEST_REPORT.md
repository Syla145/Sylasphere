# JH-Quiz – Abschlussprüfung v8 „Online Multiplayer Beta"

Stand: 23.09.2026

## Ergebnis

v8 erweitert den in v7 funktionierenden lokalen Modus um eine zweite, echte Realtime-Session-Schicht über Firebase. Die UI-, Quiz-, Kategorien-, Editor- und Auswertungslogik bleibt dabei erhalten. Moderator, Spieler und Presenter verwenden im Online-Modus denselben kompatiblen State-Vertrag wie im lokalen Modus.

## Automatisierte Prüfungen

### 1. v8 Kern-/Regressionstest
**32/32 bestanden**

Geprüft u. a.:
- 10 vorhandene Fragetypen bleiben registriert
- lokaler Zwei-Spieler-Betrieb bleibt getrennt
- manueller Reveal bleibt erhalten
- Timer/Lock wertet nicht automatisch
- Doppelscoring bleibt verhindert
- `+1` und exakter Punktestand funktionieren lokal
- Online-Outline enthält vor Start keinen Fragetext
- korrekte Antworten/Sortierreihenfolge/Fight-List-Lösungen/Hotspot-Ziel/Survey-Werte werden vor Reveal aus dem öffentlichen Payload entfernt

### 2. vollständige Online-Firebase-Simulation
**61/61 bestanden**

Eine Realtime Database wurde in-memory mit getrennten Moderator-, Spieler- und Presenter-Identitäten simuliert.

Geprüft:
- Online-Raum mit 6-stelligem Code erzeugen
- zwei unabhängige Remote-Spieler gleichzeitig beitreten
- Spieler sehen einander in der Rangliste
- Presenter verbindet sich separat
- Spielstart und Fragenstart
- Lösung vor Reveal nicht im Player-State
- beide Antworten treffen beim Moderator ein
- Antworten schließen vergibt keine Punkte
- manueller Reveal vergibt Punkte
- Lösung erscheint erst nach Reveal
- aggregierte Presenter-Statistik
- `+1` online
- exakter Online-Punktestand `137`
- Reconnect derselben anonymen UID erzeugt keinen Doppelspieler
- **alle 10 Fragetypen** wurden anschließend durch dieselbe Online-Session gespielt und aufgelöst
- alle **3 Runden** wurden durchlaufen
- Finale/`finished` wurde erreicht
- `resetScores()` setzt Scores und Resolve-Marker zurück
- explizites Verlassen markiert Spieler als offline
- Moderator kann Online-Spieler entfernen

### 3. Quiz-/Datenprüfung
**34/34 bestanden**

- alle Einträge aus `quiz-list.json` existieren
- alle mitgelieferten Quizdateien validieren
- Normalize → JSON-Roundtrip → Revalidate
- alle 10 Fragetypen sind in den Bundled-Quizzen vertreten
- kanonisch korrekte Antworten punkten bei allen deterministischen Fragetypen
- Consensus-Mehrheit wird korrekt berechnet
- Kategorien werden weiterhin extrahiert

### 4. statische GitHub-Pages-Prüfung
**77/77 bestanden**

- keine doppelten HTML-IDs
- alle lokalen `src`-/`href`-Referenzen vorhanden
- alle produktiven JS-/CSS-Referenzen verwenden `?v=8`
- sichtbare Versionsmarke `Quiz Arena v8` auf allen fünf Ansichten
- `.nojekyll` vorhanden
- alle `quiz-list.json`-Dateien vorhanden
- lokale Bild-/Audio-Assets vorhanden
- kein produktives `TODO`, `debugger`, `console.log` oder `console.debug`

### 5. Syntax-/Parsing-Prüfung
Bestanden:
- `node --check` auf sämtlichen produktiven JavaScript-Dateien und Tests
- JSON-Parsing aller Quizdateien, Manifest und Firebase-Regeln

**Gesamt: 204 explizite Assertions/statische Checks + vollständige JavaScript-Syntax- und JSON-Parsing-Prüfung.**

## Security-/Berechtigungsprüfung

Die mitgelieferten Regeln sind bewusst granular:

- global standardmäßig kein Lese-/Schreibzugriff
- Raum-Metadaten/öffentlicher Spielzustand nur für authentifizierte (anonyme) Firebase-Nutzer lesbar
- Moderator-UID wird beim Erstellen des Raums festgelegt
- nur Moderator darf `public`, `host`, Scores und Reveal-Zustände steuern
- Spieler dürfen nur das eigene Profil und eigene Antworten schreiben
- Antwort-Write ist nur für die aktuell offene Frage und bis zum serverseitigen Timerende erlaubt
- vollständiges Quiz liegt ausschließlich im `host`-Bereich
- Resolve-Lock verhindert doppelte Online-Auswertung
- Moderator kann Antwort-Subtrees für Reset/Spielerentfernung verwalten

Zusätzlich werden für den Online-Modus Fragen-IDs mit Firebase-ungültigen Key-Zeichen (`. # $ [ ] /`) vor der Raumerstellung verständlich abgelehnt. Der lokale Modus bleibt davon unberührt.

## Reconnect / Presence

- Firebase Auth für Spieler: Session-Persistenz
- Firebase Auth für Moderator: Local-Persistenz
- Duplicate-Tab-Presence aus v4/v7 bleibt zusätzlich aktiv
- wenn ein duplizierter Tab dieselbe gespeicherte UID geerbt hat, wird für den neuen Tab eine frische anonyme Firebase-Identität erzeugt
- Firebase `onDisconnect()` setzt `active=false` bei Verbindungsabbruch
- beim bewussten Raumwechsel wird `active=false` sofort geschrieben
- UI zeigt bei verlorener Realtime-Verbindung `Reconnect`

## Desktop-/Mobile-Layout

Die Spieleransicht verwendet in v8:

- Desktop/weite Tablets: Frage links, Live-Rangliste sticky rechts
- unter 900 px: einspaltig
- Smartphone: Frage zuerst, Rangliste darunter

Damit bleibt die mobile Bedienung aus v7 erhalten, während die Live-Tabelle auf Desktop dauerhaft sichtbar ist.

## Einschränkung der Testumgebung

Ein echter Login/Write gegen das konkrete Firebase-Projekt konnte aus der Ausführungsumgebung nicht automatisiert durchgeführt werden, weil aus dem Container kein externer Netzwerkzugriff auf Firebase möglich ist. Die Firebase-Webkonfiguration und die angegebene Realtime-Database-URL sind jedoch vollständig eingebaut. Die verwendete Firebase-Browsermodul-Version sowie das Security-Rules-/Anonymous-Auth-Verfahren wurden gegen die aktuelle offizielle Firebase-Dokumentation geprüft.

Der erste echte Infrastrukturtest erfolgt daher nach:
1. Aktivierung von Anonymous Auth,
2. Veröffentlichung von `firebase-database.rules.json`,
3. Upload von v8 auf GitHub Pages.

Dafür liegt `ONLINE_TEST_CHECKLIST.md` bei.

## Noch bewusst Beta

- laufende Online-Räume werden noch nicht automatisch zeitgesteuert gelöscht
- ein Raum bleibt an die anonyme Moderator-Identität des Ersteller-Browsers gebunden; vollständiges Löschen der Site-Daten dieses Browsers verliert die Moderator-Zuordnung zu diesem bestehenden Raum
- Firebase Browser-ESM wird direkt vom offiziellen Google-CDN geladen, damit GitHub Pages weiterhin ohne Build-Schritt funktioniert
