# Sylasphere – Quiz Arena v10

Sylasphere ist eine statische Quiz-/Game-Show-Web-App für GitHub Pages. Sie funktioniert ohne npm, Build-Schritt oder eigenen Webserver und unterstützt sowohl lokale Tests als auch echten Online-Multiplayer über Firebase Realtime Database.

## v10 Highlights

- Neuer Editor-Einstieg: **Quiz editieren** oder **Neues Quiz erstellen**.
- Vorhandene Quizze aus `data/` direkt im Editor laden; JSON-Import bleibt erhalten.
- Fragen-IDs werden automatisch erzeugt und sind nur noch unter **Erweiterte Einstellungen** sichtbar.
- Schätzfragen unterstützen Toleranz-Presets **5 %, 10 %, 20 %** sowie benutzerdefinierte prozentuale oder feste Toleranzen.
- Bestehende `tolerance`-Werte ohne `toleranceMode` bleiben abwärtskompatibel und gelten als feste ±-Toleranz.
- Buzzer-Fragen aus v9 sind im lokalen und Online-Modus abgesichert: erster Claim gewinnt atomar, falsche Spieler können gesperrt und der Buzzer erneut freigegeben werden.
- Branding: **Sylasphere**, Quiz Arena v10.

## Deployment

Den kompletten Inhalt dieses Ordners in das GitHub-Pages-Repository hochladen. `.nojekyll` muss im Repository-Root bleiben. Danach die Seite hart neu laden und prüfen, ob **Quiz Arena v10** sichtbar ist.

## Firebase

Für Online-Spiele müssen Anonymous Authentication und die aktuellen Realtime-Database-Regeln aktiv sein. **Wichtig für v10:** Wegen des Buzzer-Modus bitte `firebase-database.rules.json` erneut in Firebase veröffentlichen, auch wenn bereits v8/v9-Regeln aktiv sind.

Weitere Details: `FIREBASE_SETUP.md`.
