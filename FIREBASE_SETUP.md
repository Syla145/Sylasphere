# JH-Quiz v8 – Firebase einmalig aktivieren

Die Web-Konfiguration und die Realtime-Database-URL sind bereits in v8 hinterlegt.
Damit Online-Räume funktionieren, müssen in Firebase nur zwei Dinge aktiv sein.

## 1. Anonyme Anmeldung

Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** → aktivieren → speichern.

Spieler sehen davon nichts. JH-Quiz nutzt die anonyme ID nur technisch für Reconnect und Zugriffsrechte.

## 2. Realtime-Database-Regeln veröffentlichen

Firebase Console → **Realtime Database** → **Rules**.

Den kompletten Inhalt der Datei `firebase-database.rules.json` aus diesem Projekt einfügen und auf **Publish / Veröffentlichen** klicken.

Die Regeln sorgen u. a. dafür, dass:

- niemand ohne Firebase-Authentifizierung Raumdaten lesen kann;
- man Räume nicht ohne Kenntnis des 6-stelligen Codes auflisten kann;
- nur der Moderator Spielstatus, Reveal und Punkte verändern kann;
- Spieler nur ihr eigenes Profil und ihre eigenen Antworten schreiben können;
- Antworten nur angenommen werden, solange die Frage geöffnet und der Timer nicht abgelaufen ist;
- vollständige Quiz-/Lösungsdaten im Host-Bereich nur für den Moderator lesbar sind.

## 3. GitHub Pages

Danach einfach den kompletten v8-Projektinhalt in das bestehende GitHub-Pages-Repository hochladen.
Keine Firebase CLI, kein npm und kein Build-Schritt nötig.

## Schnelltest

1. Moderator-Seite auf Gerät A öffnen.
2. Quiz wählen → **Online-Sitzung erstellen**.
3. Den Spieler-Link auf Gerät B über Mobilfunk oder ein anderes WLAN öffnen.
4. Name + Avatar wählen → beitreten.
5. Der Spieler muss in der Moderator-Lobby erscheinen.
6. Eine Frage starten, beantworten, Timer ablaufen lassen, manuell auflösen und Rangliste prüfen.
7. Spieler-Seite neu laden: derselbe Spieler sollte wieder verbunden werden.
