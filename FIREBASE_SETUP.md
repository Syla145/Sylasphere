# Sylasphere – Firebase Setup

Die Firebase-Webkonfiguration und die Realtime-Database-URL sind bereits im Projekt hinterlegt.

## Einmalig prüfen

1. Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** aktivieren.
2. Firebase Console → **Realtime Database** → **Rules**.
3. Den kompletten Inhalt aus `firebase-database.rules.json` einfügen.
4. **Publish / Veröffentlichen**.

## Neu in v21: Moderator-Code abgeschafft

Moderieren geht nur noch mit einem freigeschalteten Konto (siehe v19 unten).

1. Regeln aus `firebase-database.rules.json` **neu veröffentlichen**. Der alte Code-Zugang ist darin entfernt.
2. **Aufräumen (optional):** In Realtime Database → Daten kannst du jetzt `config` (mit `moderatorKeys`) und `moderatorGrants` löschen. Beides wird nicht mehr gebraucht. **`admins`, `moderators`, `moderatorRequests` und `userQuizzes` bitte nicht löschen!**
3. **Anonym** unter Authentication → Sign-in method bleibt aktiviert. Das brauchen Spieler und Zuschauer, die als Gast teilnehmen.

## v19: Konten, Moderator-Freigabe und „Meine Quizze“

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

- Neue Moderatoren melden sich auf der Startseite an und tippen auf **Moderator-Zugang anfragen**.
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

### Später: automatische Freigabe

Der Aufbau (`moderatorRequests` → `moderators`) erlaubt es, später z. B. Einladungslinks oder eine automatische Freigabe zu ergänzen, ohne bestehende Konten umzustellen.

## v13: Moderator-Code

Abgeschafft seit v21. Moderieren geht nur noch mit freigeschaltetem Konto.

## Neu in v16: Song-Enthüllung

Bitte die Regeln aus `firebase-database.rules.json` **einmal neu veröffentlichen** (Realtime Database → Regeln → Inhalt ersetzen → Veröffentlichen).

Neu geprüft wird: Bei Song-Fragen darf eine Antwort nur **einmal** abgegeben werden, und die mitgeschickte Stufe muss der aktuellen Stufe entsprechen. So kann niemand eine Antwort nachträglich einer früheren (wertvolleren) Stufe zuordnen.

## Frühere Updates

- **v12:** Moderator darf Buzzer-Sperren auf Fragenebene zurücksetzen.
- **v10:** Echter Online-Buzzer mit geschützten Pfaden für atomare Buzzer-Claims und gesperrte Spieler.

Die Spieler benötigen weiterhin kein sichtbares Konto, keine E-Mail und kein Passwort. Die anonyme Firebase-ID dient nur technisch für Reconnect und Zugriffsrechte.
