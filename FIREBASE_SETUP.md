# Sylasphere – Firebase Setup

Die Firebase-Webkonfiguration und die Realtime-Database-URL sind bereits im Projekt hinterlegt.

## Einmalig prüfen

1. Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** aktivieren.
2. Firebase Console → **Realtime Database** → **Rules**.
3. Den kompletten Inhalt aus `firebase-database.rules.json` einfügen.
4. **Publish / Veröffentlichen**.

## Neu in v28: XP, Stufen und Statistiken

**Was du tun musst (einmalig, ca. 2 Minuten):**

1. **Realtime Database** → *Regeln*: den kompletten Inhalt von `firebase-database.rules.json` einfügen → *Veröffentlichen*.
2. `admin.html` einmal öffnen (als Admin angemeldet). Die Seite trägt die Emote-Liste automatisch in Firebase ein. Unter „🧹 Aufräumen & XP“ muss „✓ Liste in Firebase aktualisiert“ bzw. „✓ Liste ist aktuell“ stehen.

Sonst ist nichts nötig. Storage- und Firestore-Regeln bleiben unverändert, und du musst keine neue Anmeldeart aktivieren: Spieler melden sich mit Google oder E-Mail an, wie Moderatoren, nur ohne Freischaltung.

**Neue Bereiche in der Realtime Database:**

| Pfad | Inhalt | Wer schreibt | Wer liest |
|---|---|---|---|
| `players/<uid>/profile` | Spielername, „in der Bestenliste zeigen“ | der Spieler selbst (nur mit Konto) | der Spieler selbst |
| `players/<uid>/games/<Raum>` | Ergebnis eines Spiels (Platz, Richtige, XP, Treffer pro Fragetyp und Thema) | nur der Besitzer dieses Raums, genau einmal, nur für Spieler im Raum, nicht für sich selbst, höchstens 250 XP | der Spieler selbst, Admin |
| `players/<uid>/xp` | Gesamt-XP und XP des Tages | der Raumbesitzer, nur zusammen mit einem neuen Spielergebnis; die Regel prüft, dass die Summe genau stimmt, und das Tageslimit von 600 XP | alle Angemeldeten |
| `leaderboard/<uid>` | Name + XP (nur wer „in der Bestenliste zeigen“ einschaltet) | der Spieler selbst, XP muss dem echten Stand entsprechen | alle Angemeldeten |
| `modStats/<uid>/<Quiz>` | wie oft jede Frage gestellt und richtig beantwortet wurde | der Moderator selbst | der Moderator selbst |
| `userRooms/<uid>/<Raum>` | eigene Räume (zum automatischen Aufräumen) | der Moderator selbst | der Moderator selbst |
| `emotes/<Emoji>` | ab wie vielen XP ein Emote freigeschaltet ist | Admin (automatisch über `admin.html`) | alle Angemeldeten |

**Geänderte Regeln bei den Räumen:**
- Ein ganzer Raum darf jetzt gelöscht werden, vom Besitzer und vom Admin (für das Aufräumen). Nur der Admin darf die Liste aller Räume lesen.
- Spielerprofile im Raum dürfen `account` (Spieler mit Konto) und `xp` enthalten. `xp` darf nicht höher sein als der echte XP-Stand, damit niemand eine falsche Stufe zeigt.
- Reaktionen: Emotes aus `emotes` gehen nur, wenn der Spieler genug XP hat. Die 8 Grund-Emojis gehen immer.

**Gut zu wissen:**
- Admins dürfen `players/<uid>` von Hand korrigieren, zum Beispiel XP zurücksetzen, falls jemand geschummelt hat.
- Alte Räume: Beim Erstellen eines neuen Raums löscht jeder Moderator automatisch seine eigenen Räume, die älter als 24 Stunden sind. Ältere Räume von vor v28 räumst du auf `admin.html` mit „Jetzt aufräumen“ ab (alles älter als 2 Tage). Ergebnisse, XP und Statistiken bleiben dabei erhalten.
- Datenmenge: ungefähr 1 KB pro Spieler und Spiel, weit innerhalb der kostenlosen Grenze.

## Neu in v27: Emoji-Reaktionen

Die Regeln haben einen neuen Bereich `reactions` bekommen. Realtime Database → *Regeln* → Inhalt von `firebase-database.rules.json` einfügen → *Veröffentlichen*. Sonst funktionieren Reaktionen nur im lokalen Testmodus.

## Neu in v25.1: Datei-Upload (Firebase Storage)

Bilder und Musik lassen sich jetzt direkt im Editor hochladen (⬆ neben jedem Medienfeld, in der Dateiauswahl unter „☁️ Meine Uploads“ und als „⬆ Bilder hochladen“ beim Zeitduell und bei Einordnen). Dafür braucht das Projekt den **Blaze-Tarif**. Der Gratis-Anteil bleibt: 5 GB Speicher und 100 GB Abruf pro Monat, wenn der Speicher in einem US-Standort liegt.

### 1. Storage einschalten
Firebase Console → *Build* → **Storage** → *Get started* → Standort **US-CENTRAL1** (oder us-east1 / us-west1) → *Production mode*.
Nur diese drei Standorte sind kostenlos, und der Standort lässt sich später nicht mehr ändern.

### 2. Firestore einschalten (Liste „wer darf hochladen“)
*Build* → **Firestore Database** → *Create database* → *Standard edition* → Standort beliebig, zum Beispiel europe-west3 (Frankfurt) → *Production mode*.

### 3. Regeln veröffentlichen (drei Stellen)
1. **Realtime Database** → *Regeln*: Inhalt von `firebase-database.rules.json` einfügen → *Veröffentlichen*. Neu ist der Bereich `userMedia`, die Liste deiner Dateien.
2. **Firestore Database** → *Regeln*: Inhalt von `firestore.rules` einfügen. **Vorher `DEINE_ADMIN_UID` durch deine Konto-ID ersetzen**, das ist dieselbe ID, die in der Realtime Database unter `admins` steht. Dann *Veröffentlichen*.
3. **Storage** → *Regeln*: Inhalt von `storage.rules` einfügen → *Veröffentlichen*. Beim ersten Mal fragt Firebase, ob Storage auf Firestore zugreifen darf. Mit *Zulassen* bestätigen.

### 4. Musik abspielbar machen (CORS, einmalig)
Damit die Song-Enthüllung hochgeladene MP3s sekundengenau abspielen kann, muss der Speicher Abrufe von deiner Website erlauben:
1. console.cloud.google.com öffnen, oben das Projekt **jh-quiz** wählen.
2. Oben rechts das Symbol **Cloud Shell aktivieren** (`>_`) anklicken und warten, bis unten ein Terminal erscheint.
3. Diese zwei Zeilen einfügen und mit Enter bestätigen:

```
echo '[{"origin":["*"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length","Range"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://jh-quiz.firebasestorage.app --cors-file=cors.json
```

Bei der Frage nach der Autorisierung *Authorize* klicken. Die Meldung „Updating gs://…“ bedeutet: fertig.

### 5. Freigabe aktivieren
Öffne einmal die **Verwaltung** (`admin.html`). Unten steht dann „☁️ Datei-Upload: ✓ … Konten dürfen Dateien hochladen“. Die Seite trägt dich und alle Moderatoren automatisch in die Firestore-Liste ein. Schaltest du später jemanden frei oder entziehst die Rechte, wird die Liste beim Öffnen der Verwaltung angepasst.

### Gut zu wissen
- Bilder werden beim Hochladen im Browser auf höchstens 1600 px verkleinert und als WebP gespeichert (bei älteren iPhones als JPG). Audio wird unverändert hochgeladen, höchstens 20 MB, am besten als MP3.
- Die Dateien bekommen neutrale Namen, zum Beispiel `m1abc….webp`. Spieler können aus der Adresse keine Lösung ablesen. Den Originalnamen siehst nur du in der Dateiauswahl.
- Richtwert pro Moderator: 500 MB. Die Dateiauswahl zeigt den Füllstand, mit 🗑 löschst du Dateien. Achtung: Eine gelöschte Datei fehlt danach in jedem Quiz, das sie verwendet.
- Dateien aus `assets/` im GitHub-Repo funktionieren weiter (Reiter „📁 GitHub“).
- Kosten im Blick behalten: console.cloud.google.com → *Billing* → *Budgets & alerts*, Budget 1 € mit E-Mail-Warnung.

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
