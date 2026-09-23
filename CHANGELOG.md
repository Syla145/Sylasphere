# Sylasphere – Changelog

## v13 – Moderator-Code & flüssigere Spieleransicht
- **Moderator-Code:** Die Moderatorseite ist jetzt mit einem Code geschützt. Online prüft Firebase den Code selbst (`config/moderatorKeys`, für niemanden lesbar). Nur freigeschaltete Moderatoren können Online-Räume anlegen. Einrichtung siehe `FIREBASE_SETUP.md`, Code erzeugen mit `tools/moderator-code.html`. Der Code bleibt auf dem Gerät gespeichert, „🔒 Sperren“ in der Kopfzeile meldet ab.
- **Spieleransicht:** Die Frage wird nur noch neu gezeichnet, wenn sich für den Spieler etwas ändert (neue Frage, Phase, Buzzer-Status). Antworten anderer Spieler unterbrechen das Tippen in Textfeldern (Aufzählfrage, Text-Buzzer) und das Ziehen am Schätz-Regler nicht mehr.
- **Tests:** `tests/v13-rules-eval.js` wertet die echten Firebase-Regeln gegen Testfälle aus (Code-Prüfung, Raum anlegen, Buzzer).
- **Aufräumen:** Die alten Dateien im Hauptordner werden nicht mehr mitgeliefert.

## v12.2 – Lösung für den Moderator
- Der Moderator sieht die Lösung jetzt dauerhaft in einer gelb gestrichelten Box „🔒 Lösung · nur für dich sichtbar“: schon vor dem Öffnen der Frage (inkl. Fragetext), während der Antwortphase und beim Buzzer während der Prüfung.
- Schätzfragen zeigen zusätzlich die Toleranz, Hotspot-Fragen markieren den Zielbereich direkt auf dem Bild. Bei Konsens-Fragen gibt es naturgemäß keine feste Lösung.
- Spieler und Zuschaueransicht sehen die Lösung weiterhin erst bei der Auflösung. Online liegt die Lösung ohnehin nur im Moderator-Bereich der Datenbank.

## v12.1 – Online-Buzzer-Fix
- Mündlicher Buzzer: Die Antwort des Spielers wurde als `null` gesendet, von Firebase verworfen und scheiterte an der Regelprüfung. Dadurch fehlte der Antwort-Datensatz („0/2 Buzzer-Versuche“). Wird jetzt korrekt gespeichert.
- Auflösen einer Buzzer-Frage: Fehlerhafte Firebase-Meldung „values argument contains a path … ancestor of another path“ behoben. Der Datensatz des Gewinners wird nun in einem Schritt inklusive Wertung geschrieben.
- Neuer Test `tests/v12-online-buzzer.js` spielt den Ablauf Buzzern → Falsch → Zweiter Spieler buzzert → Auflösen online durch.

## v12 – Feinschliff Editor, Spieler-UX & Buzzer-Fix
- **Editor:** Fragetyp-Auswahl im Rundenkopf entfernt – der Typ wird direkt in der Frage gewählt. „+ Frage“ übernimmt den Typ der letzten Frage der Runde (sonst Multiple Choice). Titel und Multiplikator stehen jetzt bündig nebeneinander.
- **Spieler:** Infotexte unter den Antworten („Antwort gespeichert …“, „Antworten sind geschlossen“, Auflösung, Buzzer-Hinweise) haben einheitlich mehr Abstand; ebenso in der Zuschaueransicht.
- **Sortierquiz:** Echtes Drag & Drop für Maus und Touch (Griff ⠿ oder kurz gedrückt halten), mit Animation, Auto-Scroll am Bildschirmrand und Live-Nummerierung. ↑/↓-Buttons bleiben als Alternative. Eingehende Updates anderer Spieler unterbrechen das Ziehen nicht mehr.
- **Online-Buzzer:** `PERMISSION_DENIED` beim Starten einer Buzzer-Frage durch den Moderator behoben. Gesperrte Spieler werden jetzt einzeln zurückgesetzt, was mit den bestehenden v10-Regeln funktioniert. Die Regeln erlauben dem Moderator zusätzlich das Zurücksetzen auf Fragenebene (erneutes Veröffentlichen optional).

## v10 – Editor Upgrade
- Editor-Einstieg trennt **Quiz editieren** und **Neues Quiz erstellen**.
- Bestehende Quizze aus `data/` können direkt im Editor geladen werden.
- Fragen-IDs werden automatisch erzeugt und nur noch unter **Erweiterte Einstellungen** angezeigt.
- Schätzfragen: Toleranz-Presets 5 %, 10 %, 20 % sowie benutzerdefinierte prozentuale oder feste Werte.
- Alte `tolerance`-Werte bleiben als feste ±-Toleranz kompatibel.
- Online-Buzzer auf atomare, regelkonforme Firebase-Claims gehärtet; v10-Regeln müssen neu veröffentlicht werden.


## v8 – Online Multiplayer Beta · 23.09.2026

### Online Multiplayer
- Firebase Realtime Database als zweite Session-Schicht ergänzt
- Firebase Anonymous Authentication ohne sichtbaren Nutzer-Login
- 6-stelliger Raumcode funktioniert geräte- und standortübergreifend
- Online-Räume werden bei manueller Code-Eingabe automatisch erkannt
- lokaler Testmodus aus v7 bleibt vollständig erhalten
- Reconnect mit derselben anonymen Spieleridentität
- Duplicate-Tab-Schutz erzeugt bei Bedarf eine neue anonyme Spieler-UID
- `onDisconnect()` markiert verlorene Verbindungen als offline
- sichtbarer Online-/Reconnect-Status in Moderator, Spieler und Presenter

### Sicherheit / Datenmodell
- vollständiges Quiz liegt in `host/quiz` und ist nur für die Moderator-UID lesbar
- öffentliche Quiz-Vorschau enthält vor Start keinen Fragetext
- Lösungen, Schätzwerte, Sortierreihenfolge, Fight-List-Lösungen, Survey-Prozente und Hotspot-Ziel werden vor Reveal nicht öffentlich übertragen
- Spieler können über Security Rules nur das eigene Profil und eigene Antworten verändern
- Punkte, Spielstatus, Reveal und Navigation sind Moderator-Schreibrechte
- serverseitiger Resolve-Lock schützt vor doppelter Punktevergabe
- Antworten werden serverzeitbasiert nach Timerende abgewiesen
- Produktionsregeln in `firebase-database.rules.json`

### Spieler-UX
- Live-Rangliste auf Desktop rechts neben dem Quiz
- unter 900 px automatisch einspaltig; auf Smartphone Rangliste unter der Frage
- Online-Verbindungsstatus und Reconnect-Anzeige
- bei lokal abgelaufenem Timer wird die Eingabe auch dann sofort gesperrt, wenn der Moderator-Status kurz verzögert ankommt

### Bestehende Funktionen erhalten
- 10 Fragetypen
- frei definierbare Kategorien
- manueller Reveal nach Timer
- exakte Punktkorrektur `−10 / −1 / Direktwert / +1 / +10`
- Editor, Import/Export, Presenter und lokale Mehrspieler-Simulation
- sichtbare Versionsmarke **Quiz Arena v8** und `?v=8` Cache-Buster

## v7 – Precise Score Update · 22.09.2026
- Exakte manuelle Punktkorrektur inklusive ±1 und direktem Gesamtwert.

## v6 – Moderator Reveal Update · 22.09.2026
- Timer schließt nur die Antwortphase; Auflösung erfolgt manuell durch den Moderator.

## v5 – Showtime Update · 22.09.2026
- Vier neue Fragetypen, Game-Show-UX, Podium, Rundeneinstiege und Editor-Upgrades.

## v9
- Rebranding auf **Sylasphere** inkl. angepasster Startseite, neuem Logo-Text und Hinweis „Erstellt von JH“.
- Landingpage vereinfacht: vier kleine Infoblöcke entfernt.
- Neuer Fragetyp **Buzzer** im Editor mit zwei Modi:
  - mündliche Antwort nach dem Buzzer
  - erste Textantwort gewinnt
- Moderator-Workflow für Buzzer-Fragen:
  - erster Spieler sperrt den Buzzer
  - Moderator kann **richtig werten & auflösen** oder **falsch werten, Spieler sperren und Buzzer neu freigeben**
- Spieleransicht für Buzzer-Fragen mit Live-Status, Sperrhinweis und schneller Button-/Text-Eingabe.

## v11
- Editor-Einstieg visuell an die Startseiten-Karten angepasst.
- „Quiz editieren“ und „Neues Quiz erstellen“ verwenden jetzt dieselben hochwertigen Role-Cards wie die Landingpage.
- Versionsanzeige robuster gemacht: sichtbare Versionsnummer steht statisch in jeder HTML-Seite und kann nicht mehr durch eine veraltete `app.js` zurückgesetzt werden.
- Alle HTML-/CSS-/JS-Cache-Buster auf `v11` gesetzt.
