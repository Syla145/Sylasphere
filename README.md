# Sylasphere – Quiz Arena

Sylasphere ist eine Multiplayer-Quiz-Website im Stil einer Spielshow. Ein **Moderator** steuert das Quiz am PC, die **Spieler** machen mit ihrem Handy mit, und eine **Zuschaueransicht** kann auf Beamer oder TV laufen.

- Reines HTML, CSS und JavaScript. Kein Build-Schritt, kein npm, kein eigener Server.
- Läuft auf **GitHub Pages** (kostenlos).
- Online-Spiel über **Firebase** (kostenloser Spark-Tarif): Realtime Database und Authentication.
- Ein **lokaler Testmodus** läuft ohne Internet in mehreren Tabs desselben Browsers.

Aktuelle Version: siehe `CHANGELOG.md`.

---

## Inhalt

1. [Seiten und Rollen](#seiten-und-rollen)
2. [So läuft ein Quizabend](#so-läuft-ein-quizabend)
3. [Konten und Moderator-Freigabe](#konten-und-moderator-freigabe)
4. [Quizze erstellen und speichern](#quizze-erstellen-und-speichern)
5. [Bilder, Musik und Videos](#bilder-musik-und-videos)
6. [Fragetypen](#fragetypen)
7. [Designs](#designs)
8. [Update einspielen](#update-einspielen)
9. [Kosten und Grenzen](#kosten-und-grenzen)
10. [Projektstruktur](#projektstruktur)
11. [Tests](#tests)

---

## Seiten und Rollen

| Seite | Für wen | Wofür |
|---|---|---|
| `index.html` | alle | Startseite: erst **Anmelden** oder **Als Gast fortfahren**, dann nur die passenden Bereiche |
| `spieler.html` | Spieler | Mit Raumcode beitreten und antworten. Kein Konto nötig, man tritt als Gast bei |
| `moderator.html` | Moderatoren | Quiz auswählen, Raum erstellen, Fragen öffnen, schließen, auflösen und Punkte vergeben |
| `zuschauer.html` | Beamer/TV | Große Anzeige mit Frage, Timer, Statistik und Rangliste |
| `editor.html` | Moderatoren | Quizze erstellen und bearbeiten, online in „Meine Quizze“ speichern (nur mit Moderator-Konto) |
| `admin.html` | Admin | Moderator-Anfragen freischalten und Rechte entziehen |

## So läuft ein Quizabend

1. Der Moderator meldet sich auf `moderator.html` an, wählt ein Quiz und tippt auf **🌐 Online-Sitzung erstellen**.
2. Es erscheint ein **Raumcode** wie `58SN9A` mit **QR-Code**. Die Spieler scannen ihn oder öffnen `spieler.html` und geben den Code ein. Die Handys gehen während des Quiz nicht in den Standby.
3. Optional läuft `zuschauer.html` mit demselben Code auf Beamer oder TV.
4. Der Moderator öffnet jede Frage, schließt die Antworten und löst auf. Die Punkte werden automatisch vergeben, er kann sie aber jederzeit korrigieren.
   - Kurzbefehle: **Leertaste** öffnet, schließt die Antworten und löst auf. **← / →** springt zur vorigen oder nächsten Frage.

**Lokal testen:** „💻 Lokal testen“ nutzen und die Spieleransicht in weiteren Tabs **desselben Browsers** öffnen. Die Anmeldung als Moderator braucht dafür einmal Internet.

## Konten und Moderator-Freigabe

- **Spieler** brauchen nie ein Konto.
- **Moderatoren** melden sich mit **Google** oder **E-Mail + Passwort** an. Eine Anmeldung allein gibt **keine** Moderator-Rechte. Neue Konten tippen auf „Moderator-Zugang anfragen“.
- Der **Admin** schaltet Anfragen auf `admin.html` frei, lehnt sie ab oder entzieht Rechte später wieder. Beim Anfragenden geht es nach der Freigabe sofort weiter.
- Admins trägst du einmalig von Hand in der Firebase-Konsole ein, unter `admins/<Konto-ID>: true`.
- Der frühere Moderator-Code ist seit v21 abgeschafft. Moderieren geht nur noch mit einem freigeschalteten Konto.

**Was sieht wer auf der Startseite?**

| Wer | Bereiche |
|---|---|
| Moderator oder Admin (angemeldet) | Moderieren, Mitspielen, Zuschauen, Quiz-Editor (Admins zusätzlich: Verwaltung) |
| Angemeldet ohne Moderator-Rechte | Mitspielen, Zuschauen, dazu der Hinweis „Moderator-Zugang anfragen“ |
| Gast (nicht angemeldet) | Mitspielen, Zuschauen |

- Die Wahl „Als Gast fortfahren“ merkt sich der Browser. Oben rechts gibt es jederzeit **Anmelden**.
- **Einladungslinks** wie `spieler.html?code=ABC234` führen immer direkt zum Beitritt, ohne Auswahl.
- Angemeldete Spieler bekommen ihren Namen beim Beitreten vorausgefüllt. **Geplant:** eigene Statistiken für angemeldete Konten.

Die Einrichtung in Firebase steht Schritt für Schritt in **`FIREBASE_SETUP.md`**.

## Quizze erstellen und speichern

Im **Editor** (`editor.html`):

- **Neues Quiz erstellen** oder ein vorhandenes öffnen. Möglich sind „Meine Quizze“, die Beispiel-Quizze aus `data/` und JSON-Dateien.
- Runden, Fragen, Punkte, Timer, Themen (mit Icon und Farbe) und das Design festlegen.
- **👁 Vorschau** zeigt eine Frage so, wie Spieler sie sehen.
- **Quiz prüfen** zeigt Fehler und Hinweise, zum Beispiel eine fehlende Lösung oder ein ungeeignetes Bildformat.

**Speichern:**

| Wo | Wie | Für wen |
|---|---|---|
| ☁️ **Meine Quizze** (online) | „☁️ Online speichern“. Danach wird jede Änderung automatisch gespeichert, Strg+S speichert sofort | angemeldete, freigeschaltete Moderatoren |
| Dieses Gerät | Automatisch als Entwurf im Browser („Letzten Entwurf fortsetzen“) | alle |
| JSON-Datei | „JSON exportieren“ oder importieren, gut als Sicherung oder zum Weitergeben | alle |

- „Meine Quizze“ sind auf jedem Gerät verfügbar, auf dem du mit deinem Konto angemeldet bist.
- Nur du kannst deine Quizze lesen, auch Admins nicht.
- Beim Moderator stehen sie oben in der Quiz-Auswahl. Aus dem Editor geht es direkt mit **▶ Moderieren** los.
- Wird dasselbe Quiz auf zwei Geräten gleichzeitig bearbeitet, gewinnt die zuletzt gespeicherte Änderung.

> **Wichtig:** Online gespeichert wird nur der **Text** des Quiz. **Bilder und Musik werden nicht mit hochgeladen.** Im Quiz steht nur, wo die Datei liegt. Wie das geht, steht im nächsten Abschnitt.

## Bilder, Musik und Videos

### So kommt eine Datei ins Quiz

1. **Auf GitHub hochladen:** Im Repo den Ordner `assets` öffnen, dann **Add file → Upload files**.
   - Für Ordnung sorgen Unterordner wie `assets/bilder/` und `assets/musik/`. Beim Hochladen einfach den Ordnernamen vor den Dateinamen schreiben.
   - Dann auf **Commit changes** klicken.
   - Im Editor bringt dich auch der Knopf **⬆ Neue Datei auf GitHub hochladen** im Auswahlfenster direkt dorthin.
2. **Etwa 1–2 Minuten warten.** So lange braucht GitHub Pages, bis die Datei auf der Website erreichbar ist.
3. **Im Editor auswählen:** Neben jedem Bild- oder Audiofeld gibt es **📁 Auswählen**.
   - Das Fenster zeigt alle Dateien aus `assets/` mit Vorschau, Größe und Ordner. Audio kannst du dort mit ▶ probehören.
   - Ein Klick auf **Übernehmen** trägt den Pfad ein, zum Beispiel `./assets/bilder/eiffelturm.webp`.
   - Neu hochgeladene Dateien erscheinen nach **↻**.
4. **Prüfung unter dem Feld beachten:**
   - ✓ **Gefunden**: alles in Ordnung, mit Dateigröße.
   - ⚠ **Hinweis**: funktioniert, ist aber nicht ideal, zum Beispiel wegen eines großen WAV oder Leerzeichen im Namen.
   - ✗ **Fehler**: funktioniert nicht, zum Beispiel wenn die Datei nicht gefunden wird oder HEIC ist.
   - Bei falscher **Groß- und Kleinschreibung** schlägt der Editor den richtigen Namen vor („Meintest du …? Übernehmen“).

### Welche Dateiformate

| Wofür | Empfohlen | Geht auch | Vermeiden | Ziel-Größe |
|---|---|---|---|---|
| **Bilder** (Bilderquiz, Hotspot, Albumcover) | **WebP**, **JPG** | PNG, SVG, GIF, AVIF | **HEIC** (iPhone-Fotos), TIFF, BMP | ca. 1200–1600 px breit, **unter 500 KB** |
| **Audio** (Audio-Quiz, Song-Enthüllung) | **MP3** (128–192 kbit/s) | M4A / AAC | **WAV** (zehnmal so groß), **OGG/Opus** (läuft nicht auf älteren iPhones), FLAC, WMA | ein ganzer Song ca. 3–5 MB, ein Clip unter 1 MB |
| **Video** (noch kein Fragetyp) | **MP4 (H.264)** | WebM | MOV, AVI, MKV | unter 25 MB |

- **Bilder verkleinern oder umwandeln:** zum Beispiel mit [squoosh.app](https://squoosh.app). Das ist kostenlos und läuft im Browser.
- **iPhone-Fotos (HEIC):** Unter Einstellungen → Kamera → Formate → **„Maximale Kompatibilität“** speichert das iPhone neue Fotos als JPG. Vorhandene HEIC-Fotos vorher mit einem HEIC-zu-JPG-Konverter umwandeln.
- **Audio in MP3 umwandeln:** zum Beispiel mit [Audacity](https://www.audacityteam.org) (Export → MP3) oder einem Online-Konverter.

### Dateinamen

- Nur **Kleinbuchstaben, Zahlen und Bindestriche**, also `eiffel-turm.jpg` statt `Eiffel Turm.JPG`.
- **Keine Leerzeichen, keine Umlaute.**
- GitHub unterscheidet **Groß- und Kleinschreibung**: `Bild.jpg` ist nicht `bild.jpg`.
- **Song-Enthüllung:** Songs **neutral benennen**, zum Beispiel `song-01.mp3`, weil Spielergeräte den Dateinamen sehen könnten. Der Editor warnt, wenn der Name die Lösung verrät.

### Links von anderen Websites (`https://…`)

| | Bild | Audio-Quiz | Song-Enthüllung |
|---|---|---|---|
| Direkter Link auf eine Datei (`…/bild.jpg`, `…/clip.mp3`) | meistens ✓ | oft ✓ | meist ✗ (braucht eine Freigabe der fremden Seite) |
| Google Drive, Dropbox, OneDrive, iCloud | fast nie | fast nie | ✗ |
| YouTube, Spotify | ✗ | ✗ | ✗ |

Fremde Links können jederzeit verschwinden. Für Quizabende ist **ins Repo hochladen** am zuverlässigsten, bei Musik ist es praktisch Pflicht.

### Wie viel passt

| Grenze | Wert |
|---|---|
| Eine Datei beim Hochladen über github.com | max. **25 MB** |
| Ganzes Repo (Empfehlung von GitHub) | unter **1 GB**, das sind grob 200 Songs als MP3 plus Bilder |
| Datenabruf GitHub Pages | ca. **100 GB pro Monat**. Ein Quizabend mit 10 Spielern und 10 Songs braucht etwa 0,5 GB |

## Fragetypen

| | Fragetyp | Kurz erklärt |
|---|---|---|
| ◉ | Multiple Choice | Klassische Auswahl mit einer richtigen Antwort |
| ⚖ | Wahr oder falsch | Eine Aussage ist wahr oder falsch |
| ▣ | Bilderquiz | Bild plus Antwortoptionen |
| ♪ | Audio-Quiz | Audio-Clip plus Antwortoptionen |
| 🎧 | Song-Enthüllung | Song in Stufen anspielen (0,1 s → 10 s). Wer früher richtig liegt, bekommt mehr Punkte, der Moderator prüft |
| ≈ | Schätzfrage | Wert per Regler schätzen, wer nah dran ist, bekommt Punkte (Toleranz einstellbar) |
| ↕ | Sortierquiz | Elemente per Drag & Drop in die richtige Reihenfolge bringen |
| ⇄ | Zuordnen | Paare bilden, zum Beispiel Land ↔ Hauptstadt |
| ✍ | Lückentext | Wort eintippen, der Moderator bestätigt (Rechtschreibung ist egal) |
| ✎ | Fight List | Möglichst viele passende Begriffe sammeln. Das System zählt die Treffer, auch mit kleinen Tippfehlern, und du kannst die Zahl pro Spieler anpassen |
| ↗ | Higher / Lower | Werte paarweise als höher oder niedriger einschätzen |
| ⌖ | Hotspot | Auf einem Bild die gesuchte Stelle treffen |
| ▥ | Publikums-Duell | Die häufigste Umfrage-Antwort finden |
| ◎ | Gleich gedacht | Punkte für die Antwort der Mehrheit |
| ⚡ | Buzzer | Wer zuerst buzzert, darf antworten, der Moderator entscheidet |
| ⏱ | Zeitduell | Bilder-Duell mit Schachuhr: reihum raten, Passen kostet Zeit, wer auf 0 fällt, scheidet aus. Punkte nach Platzierung. Mündlich oder getippt |

Das Beispiel-Quiz **„Sylasphere: Showtime“** enthält alle 16 Typen. **„Zeitduell – Demo“** enthält zwei fertige Zeitduelle. Wie man einen neuen Fragetyp ergänzt, steht in `js/question-types/README.md`.

### Zeitduell im Detail

1. **Vorbereiten:** Bilder in einen eigenen Ordner laden, zum Beispiel `assets/duell-tiere/`. Etwa 15–40 Bilder einplanen, damit sie nicht zu früh ausgehen. Im Editor „📁 Alle Bilder übernehmen“ nutzen. Die Lösung wird aus dem Dateinamen vorgeschlagen, bitte kurz prüfen.
2. **Einstellen:** Zeit pro Spieler (Standard 30 s), Strafzeit fürs Passen (3 s), Modus **mündlich** oder **tippen**, Punkte nach Platz (zum Beispiel `100, 60, 30`).
3. **Spielen:** Frage öffnen, dann **🎲 Duell starten**. Der Zufall bestimmt, wer anfängt.
   - **Mündlich:** Du siehst die Lösung und drückst **✓ Richtig** (Enter) oder **⏭ Passen** (P).
   - **Tippen:** Der Spieler, der dran ist, tippt auf dem Handy. Richtige Antworten erkennt das System, Groß- und Kleinschreibung ist egal. Du kannst trotzdem jederzeit ✓ oder Passen drücken.
   - **Pause** mit der Leertaste, **🏁 Duell beenden** jederzeit. Dann zählt die aktuelle Restzeit.
4. **Ende:** Wenn nur noch einer übrig ist oder die Bilder ausgehen, tippst du auf **✨ Frage auflösen**. Die Punkte werden nach Platzierung vergeben.

Hinweis: Das Moderator-Gerät führt die Uhr. Es sollte während des Duells geöffnet bleiben und nicht in den Standby gehen.

## Designs

Es gibt vier Designs: **Neon Arena**, **Retro-Show**, **Clean Light** (gut für Beamer) und **Pub Quiz**.

- Du wählst das Design pro Quiz im Editor. Der Moderator kann es für eine Sitzung ändern.
- Spieler und Zuschauer übernehmen das Design automatisch.
- Zum Ausprobieren `?theme=retro` (oder `light`, `pub`) an eine Adresse anhängen.

## Update einspielen

1. ZIP entpacken und den **Inhalt** ins Repo hochladen: Add file → Upload files, dann alle Dateien und Ordner hineinziehen und bestehende Dateien überschreiben.
2. Im `CHANGELOG.md` nachsehen, ob Dateien gelöscht werden müssen oder die **Firebase-Regeln** neu zu veröffentlichen sind.
3. Nach 1–2 Minuten die Seite neu laden, am PC mit **Strg+Shift+R**. Oben links muss die neue Versionsnummer stehen.

## Kosten und Grenzen

Alles läuft **kostenlos**:

| Dienst | Wofür | Gratis-Grenze |
|---|---|---|
| GitHub Pages | Website, Bilder, Musik | 1 GB Repo, ca. 100 GB Abruf pro Monat |
| Firebase Authentication | Anmeldung (Google, E-Mail, Gäste) | für diese Nutzung praktisch unbegrenzt |
| Firebase Realtime Database | Räume, Antworten, „Meine Quizze“ | 100 gleichzeitige Verbindungen, 1 GB Speicher, 10 GB Abruf pro Monat |

- **100 gleichzeitige Verbindungen** heißt ungefähr 100 Geräte auf einmal, verteilt auf alle gleichzeitig laufenden Räume.
- Den Firebase-Dateispeicher (Cloud Storage) nutzt Sylasphere bewusst **nicht**, weil er nicht mehr kostenlos ist.

## Projektstruktur

```
index.html · spieler.html · moderator.html · zuschauer.html · editor.html · admin.html
css/main.css                    Gestaltung aller Seiten und die 4 Designs
data/                           Beispiel-Quizze (JSON) + quiz-list.json
assets/                         Bilder, Musik, Schriften (hier eigene Mediendateien ablegen)
js/core/
  app.js                        kleine Helfer (Toast, JSON-Import/-Export …)
  firebase-service.js           Verbindung zu Firebase
  account.js / account-ui.js    Konten, Rollen, Login-Oberfläche
  cloud-quizzes.js              „Meine Quizze“ (Online-Speicher)
  moderator-gate.js             Zugang zu Moderatorseite und Editor (nur freigeschaltete Konten)
  session-engine.js             lokaler Spielablauf (Testmodus)
  online-session-engine.js      Online-Spielablauf über Firebase
  quiz-utils.js · quiz-validator.js · timer-engine.js · topics.js · themes.js · media-player.js
js/question-types/              ein Modul pro Fragetyp (+ README zum Erweitern)
js/editor/                      Editor, Themenauswahl, Medien-Auswahl
js/views/                       Startseite, Moderator-, Spieler-, Zuschauer- und Verwaltungsansicht
firebase-database.rules.json    Sicherheitsregeln (in Firebase veröffentlichen)
tests/                          automatische Tests
```

## Tests

Die Tests brauchen nur [Node.js](https://nodejs.org):

```bash
for t in tests/*.js; do node "$t"; done
```

Jede Datei endet mit `PASS x / FAIL 0`. Geprüft werden unter anderem die Fragetypen und die Punktevergabe, der Online-Ablauf, die Buzzer-Logik und die Firebase-Regeln. Bei den Regeln geht es darum, wer was lesen und schreiben darf.
