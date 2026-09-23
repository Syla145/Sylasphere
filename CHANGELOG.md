# JH-Quiz – Changelog

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
