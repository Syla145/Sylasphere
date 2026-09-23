# Sylasphere v10 – Firebase Setup

Die Firebase-Webkonfiguration und die Realtime-Database-URL sind bereits im Projekt hinterlegt.

## Einmalig prüfen

1. Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** aktivieren.
2. Firebase Console → **Realtime Database** → **Rules**.
3. Den kompletten Inhalt aus `firebase-database.rules.json` einfügen.
4. **Publish / Veröffentlichen**.

## Wichtig beim Update auf v10

v10 enthält einen echten Online-Buzzer. Dafür wurden zusätzliche geschützte Pfade für atomare Buzzer-Claims und für gesperrte Spieler ergänzt. Deshalb müssen die mitgelieferten v10-Regeln erneut veröffentlicht werden.

Die Spieler benötigen weiterhin kein sichtbares Konto, keine E-Mail und kein Passwort. Die anonyme Firebase-ID dient nur technisch für Reconnect und Zugriffsrechte.
