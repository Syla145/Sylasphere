# Sylasphere v13 – Firebase Setup

Die Firebase-Webkonfiguration und die Realtime-Database-URL sind bereits im Projekt hinterlegt.

## Einmalig prüfen

1. Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** aktivieren.
2. Firebase Console → **Realtime Database** → **Rules**.
3. Den kompletten Inhalt aus `firebase-database.rules.json` einfügen.
4. **Publish / Veröffentlichen**.

## Neu in v13: Moderator-Code

Online-Räume darf nur noch anlegen, wer einen gültigen Moderator-Code eingegeben hat. Firebase prüft den Code selbst, deshalb lässt sich das nicht über den Browser umgehen.

**Reihenfolge ist wichtig. Erst den Code anlegen, dann die Regeln veröffentlichen.** Sonst kann kurzzeitig niemand einen Online-Raum erstellen.

### 1. Eigenen Code festlegen

1. Die Seite `tools/moderator-code.html` öffnen (lokal oder auf deiner Website).
2. Neuen Code eingeben (mindestens 6 Zeichen, keine der Zeichen `. # $ [ ] /`).
3. Der angezeigte **Hash** kommt in `js/core/moderator-gate.js` bei `MODERATOR_CODE_HASH`.
   Er schaltet die Moderatorseite im Browser frei, auch im lokalen Testmodus.

Voreingestellt ist der Platzhalter-Code `Quizmaster`. Bitte ersetzen.

### 2. Code in Firebase hinterlegen

Firebase Console → **Realtime Database** → Reiter **Daten**:

1. Mit der Maus auf die oberste Zeile (Datenbank-URL) → **+** klicken.
2. Schlüssel `config` anlegen, darunter `moderatorKeys`, darunter als Schlüssel **deinen Code**, Wert `true`.

Ergebnis:

```
config
  └─ moderatorKeys
       └─ DeinCode: true
```

Mehrere Codes (z. B. für mehrere Moderatoren) sind möglich: einfach weitere Einträge unter `moderatorKeys`.
Einen Code **sperren**: Eintrag löschen. Moderatoren mit diesem Code können danach keine neuen Räume mehr anlegen. Laufende Räume funktionieren weiter.

Den Pfad `config` kann kein Spieler und kein Moderator lesen oder verändern. Nur du in der Konsole.

### 3. Regeln veröffentlichen

Wie oben: Inhalt von `firebase-database.rules.json` einfügen → **Veröffentlichen**.

## Wie es technisch funktioniert

- Beim Freischalten schreibt die Moderatorseite den Code nach `moderatorGrants/<anonyme-UID>`.
  Die Regel erlaubt das nur, wenn `config/moderatorKeys/<Code>` den Wert `true` hat.
- Beim Anlegen eines Raums prüft die Regel für `rooms/<code>/meta`, ob die UID einen gültigen Grant besitzt.
- Die lokale Sperre (Hash in `moderator-gate.js`) ist nur eine Bequemlichkeit für die Oberfläche und den lokalen Modus. Der echte Schutz liegt in Firebase.
- Später wird das durch Login + Moderator-Rolle ersetzt. Der Aufbau (`moderatorGrants/<uid>`) passt dazu.

## Neu in v16: Song-Enthüllung

Bitte die Regeln aus `firebase-database.rules.json` **einmal neu veröffentlichen** (Realtime Database → Regeln → Inhalt ersetzen → Veröffentlichen). Dein Moderator-Code und `config/moderatorKeys` bleiben unverändert.

Neu geprüft wird: Bei Song-Fragen darf eine Antwort nur **einmal** abgegeben werden, und die mitgeschickte Stufe muss der aktuellen Stufe entsprechen. So kann niemand eine Antwort nachträglich einer früheren (wertvolleren) Stufe zuordnen.

## Frühere Updates

- **v12:** Moderator darf Buzzer-Sperren auf Fragenebene zurücksetzen.
- **v10:** Echter Online-Buzzer mit geschützten Pfaden für atomare Buzzer-Claims und gesperrte Spieler.

Die Spieler benötigen weiterhin kein sichtbares Konto, keine E-Mail und kein Passwort. Die anonyme Firebase-ID dient nur technisch für Reconnect und Zugriffsrechte.
