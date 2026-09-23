# Sylasphere – Firebase Setup

Die Firebase-Webkonfiguration und die Realtime-Database-URL sind bereits im Projekt hinterlegt.

## Einmalig prüfen

1. Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** aktivieren.
2. Firebase Console → **Realtime Database** → **Rules**.
3. Den kompletten Inhalt aus `firebase-database.rules.json` einfügen.
4. **Publish / Veröffentlichen**.

## Neu in v19: Konten, Moderator-Freigabe und „Meine Quizze“

Moderatoren melden sich jetzt mit **Google** oder **E-Mail + Passwort** an. Eine Anmeldung allein gibt **keine** Moderator-Rechte: Neue Konten fragen den Zugang an, und du schaltest sie als Admin frei. Spieler brauchen weiterhin kein Konto.

Alles bleibt im kostenlosen Spark-Tarif.

**Wichtig: Reihenfolge einhalten.** Erst die Anmeldearten aktivieren, dann die Regeln veröffentlichen, dann dich als Admin eintragen.

### 1. Anmeldearten aktivieren

Firebase Console → **Authentication** → **Sign-in method** → **Neuen Anbieter hinzufügen**:

1. **E-Mail/Passwort** → aktivieren (nur den oberen Schalter, „E-Mail-Link“ bleibt aus) → Speichern.
2. **Google** → aktivieren → bei „Support-E-Mail“ deine E-Mail wählen → Speichern.
3. **Anonym** bleibt aktiviert (für Spieler und Zuschauer).

### 2. Deine Website freigeben

Authentication → **Einstellungen** (Settings) → **Autorisierte Domains** → **Domain hinzufügen**:
deine GitHub-Pages-Adresse ohne `https://` und ohne Pfad, also z. B. `syla145.github.io`.
`localhost` steht dort schon.

Ohne diesen Schritt meldet der Google-Login „Diese Website ist in Firebase noch nicht freigegeben“.

### 3. Regeln veröffentlichen

Realtime Database → **Regeln** → Inhalt von `firebase-database.rules.json` komplett einfügen → **Veröffentlichen**.

### 4. Dich selbst als Admin eintragen (einmalig)

1. Auf deiner Website `moderator.html` öffnen und **mit dem Konto anmelden, das Admin sein soll** (z. B. Google).
2. Du siehst „Noch nicht freigeschaltet“. Dort auf **Konto-ID anzeigen** tippen und die ID kopieren (⧉).
   (Alternativ: Authentication → Nutzer → Spalte „Nutzer-UID“.)
3. Firebase Console → Realtime Database → **Daten**: Mit der Maus auf die oberste Zeile → **+**
   Schlüssel `admins`, darunter als Schlüssel **deine Konto-ID**, Wert `true`.

```
admins
  └─ AbC123deineKontoID: true
```

4. Seite neu laden. Du bist jetzt Admin und damit auch Moderator.

### Moderatoren freischalten

- Neue Moderatoren melden sich auf `moderator.html` an und tippen auf **Moderator-Zugang anfragen**.
- Du öffnest **`admin.html`** (auch über dein Konto-Menü oben rechts → „Moderatoren verwalten“) und tippst auf **✓ Freischalten**.
- Beim Anfragenden geht es danach automatisch weiter, ohne Neuladen.
- **Entziehen:** In `admin.html` bei „Moderatoren“. Das Konto kann danach keine neuen Räume mehr erstellen. Seine Quizze bleiben gespeichert, sind aber erst nach erneuter Freischaltung wieder erreichbar.
- Weitere Admins: wie Schritt 4 unter `admins` eintragen.

### Meine Quizze (Online-Speicher)

- Im Editor: **☁️ Online speichern**. Danach wird jede Änderung automatisch gespeichert (nach ca. 2 Sekunden).
- Die Quizze liegen in der Realtime Database unter `userQuizzes/<Konto-ID>`. Nur der Besitzer kann sie lesen, auch Admins nicht.
- Beim Moderator stehen sie in der Quiz-Auswahl oben unter „☁️ Meine Quizze“.
- Platz: Der Gratis-Tarif hat 1 GB. Ein normales Quiz braucht 10 bis 50 KB, das reicht also für zehntausende Quizze.
- **Bilder und Audio** bitte weiterhin im GitHub-Repo (`assets/`) ablegen oder per Link einbinden. Den Firebase-Dateispeicher gibt es nicht mehr kostenlos.

### Gastmodus mit Moderator-Code

Der bisherige Moderator-Code funktioniert weiter unter „Ohne Konto mit Moderator-Code fortfahren“. Damit lassen sich Räume erstellen, aber keine Quizze online speichern. Der Gastmodus lässt sich abschalten, indem du alle Einträge unter `config/moderatorKeys` löschst (dann klappt nur noch der lokale Testmodus mit dem Code).

### Später: automatische Freigabe

Der Aufbau (`moderatorRequests` → `moderators`) erlaubt es, später z. B. Einladungslinks oder eine automatische Freigabe zu ergänzen, ohne bestehende Konten umzustellen.

## v13: Moderator-Code (Gastmodus)

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
