# Sylareads

**Learn to read the world.** Ein Lesetrainer für GeoGuessr-Spieler: fremde Schriften lesen, Ortsnamen erkennen, Schilderwörter verstehen.

Stand: **Meilenstein M3 + Orte-Ausbau** – vollständige Engine und vier Kurse: *Russian Cyrillic*, *Greek*, *Thai* und *Bengali* (Bangladesch). Jeder Kurs hat 100 Städte und alle Regionen erster Ebene; jeder Ort hat Koordinaten für die spätere Karte.

## Was drin ist

- 41 Lektionen Russisch: 33 Buchstaben in didaktischer Reihenfolge (Easy Wins → False Friends → neue Formen → komplexe Zeichen), Kleinbuchstaben-Fallen, Ortsnamen-Endungen, Namensbausteine, 4 Begriffslektionen, 11 Städte- und 13 Regionslektionen (auf der Karte)
- 100 Städte (die größten nach Einwohnerzahl) und alle 83 international anerkannten Föderationssubjekte (ohne Krim und Sewastopol), 51 GeoGuessr-Begriffe mit Abkürzungen, 35 Übungswörter, 56 Kombinationen
- Lernen, Üben, Freies Üben, alle acht Modi (Letters, Combinations, Words, Cities, Regions, GeoGuessr Terms, Weak Items, Mixed), Smart Practice, Scan-Aufgabe
- Exaktes Answer Matching ohne Fuzzy-Logik: deutscher Name, englischer Name und Transliteration gleichwertig
- Leitner-SRS mit 8 Boxen, Mastery (New / Learning / Familiar / Mastered), Weak Items inklusive Verwechslungspaaren
- XP, Level, Streak, 15 Achievements, Lesbarkeits-Meilenstein („31 / 100 cities readable“)
- DE/EN-Oberfläche, Dark Mode, Desktop und Mobile, komplett per Tastatur bedienbar
- Fortschritt in localStorage, Export/Import als `sylareads-progress.json`

### Greek

- 27 Lektionen: 24 Buchstaben (Easy Wins → False Friends wie Η, Ρ, Ν, Β → neue Formen), zwei Lektionen Buchstabenpaare (αι ει οι ου, αυ ευ μπ ντ γκ γγ), Klein- und Großschrift ohne Akzente, Namensbausteine (Άγιος, Νέα, Άνω, Κάτω), 4 Begriffslektionen, 11 Städte- und 3 Regionslektionen
- 100 Städte (die größten eigenständigen Orte; Vororte von Athen und Thessaloniki zählen zur Stadt, Piräus ausgenommen), alle 13 Regionen, 14 Inseln, 38 Schilderbegriffe
- Transliteration nach ELOT 743 wie auf griechischen Wegweisern (Athina, Irakleio); die gängige gesprochene Form gilt ebenfalls (Iraklio, Pireas). Buchstabenpaare sind eigene Leseeinheiten: ευ ist ev/ef, nie „eu“.

### Thai

- 41 Lektionen: 42 Konsonanten, 15 Vokalzeichen und 5 Sonderzeichen (Tonzeichen, Karan, Mai Taikhu, Mai Yamok, Paiyannoi) in 11 Buchstabenlektionen, 3 Regellektionen (Silbenende, zusammengesetzte Vokale, unsichtbare Vokale), Namensbausteine, 4 Begriffslektionen, 11 Städte- und 11 Provinzlektionen (auf der Karte)
- 100 Städte (alle 77 Provinzhauptstädte plus die 23 größten weiteren Städte wie Hat Yai, Pattaya, Ko Samui), alle 77 Provinzen (inkl. Bangkok), 36 Schilderbegriffe, 52 Übungswörter
- Thai wird in Silben gelesen, nicht Buchstabe für Buchstabe. Deshalb gibt es keine regelbasierte Transliteration: Jedes Wort hat eine Liste erlaubter Lesungen nach RTGS (der Umschrift auf thailändischen Schildern), dazu verbreitete Varianten (Phuket, Chiang Mai, Ayutthaya). Tonhöhen werden nicht abgefragt – sie helfen beim Lesen von Schildern nicht.
- Vokalzeichen erscheinen mit Platzhalterkreis (◌า), damit sichtbar ist, wo sie am Konsonanten sitzen.

### Bengali

- 41 Lektionen: 36 Konsonanten, 11 unabhängige Vokale, 10 Vokalzeichen und 4 Sonderzeichen in 11 Buchstabenlektionen, Phala und Reph, 2 Lektionen Ligaturen (ট্ট ল্ল ক্স ঞ্জ ঙ্গ ক্ষ ষ্ট হ্ম ন্ধ ঞ্চ স্ট স্ক), Ortsnamen-Endungen (-পুর, -গঞ্জ, -বাজার, -হাট, -গ্রাম, -খালী), 4 Begriffslektionen, 1 Divisionslektion, 10 Distriktlektionen und 11 Städtelektionen
- 100 Städte (alle 64 Distrikthauptstädte plus 36 große Orte wie Savar, Sreemangal, Teknaf, Benapole), alle 8 Divisionen und alle 64 Distrikte, 32 Schilderbegriffe (viele englische Lehnwörter wie রোড, স্টেশন, কলেজ)
- Englische Namen nach der offiziellen Schreibweise von 2018 (Chattogram, Cumilla, Barishal, Jashore, Bogura); die älteren Formen (Chittagong, Comilla, Barisal, Jessore, Bogra) gelten ebenfalls. Ligaturen sind eigene Leseeinheiten, weil man sie als Ganzes erkennt.

### Karten (Bengali, Russian Cyrillic, Thai)

Drei Kurse haben eine klickbare Karte mit allen Gebieten der ersten Verwaltungsebene:

| Kurs | Gebiete | Gruppiert nach | Lektionen |
|------|---------|----------------|-----------|
| Bengali | 64 Distrikte | 8 Divisionen | 10 |
| Russian Cyrillic | 83 Föderationssubjekte (ohne Krim und Sewastopol) | 8 Föderationskreise | 13 |
| Thai | 77 Provinzen | 6 Landesteile | 11 |

- Die Lektionen sind geografisch geordnet, damit Nachbarn zusammen gelernt werden (z. B. „Moskau & Goldener Ring“, „Isan: am Mekong“).
- Aufgaben: **Wo liegt …?** (Namen in Originalschrift lesen, Gebiet anklicken), **Welche/r … ist markiert?** (markierte Fläche, Auswahl aus vier Nachbarn in Originalschrift) und das Tippen des Namens.
- Tab **Karte** zum Erkunden mit Zoom (Mausrad, Ziehen, zwei Finger, +/−) und Beschriftung in Originalschrift, Latein oder aus. In Kartenaufgaben ist die Beschriftung standardmäßig aus; das gesuchte Gebiet ist nie beschriftet.
- Zielkarte auf der Übersicht („Ziel: alle 64 Distrikte“ usw.) und „… üben“ startet eine Übung nur mit Kartengebieten (`?layer=map`).
- Grenzen: [geoBoundaries](https://www.geoboundaries.org) gbOpen ADM1/ADM2 (CC BY 4.0), vereinfacht und vorprojiziert in `src/content/<kurs>/map.json` (je ≈ 100 KB, wird nur mit dem jeweiligen Kurs geladen). Russland nutzt eine flächentreue Kegelprojektion (Albers), Thailand und Bangladesch eine einfache Zylinderprojektion. Jede der 100 Städte jedes Kurses liegt geprüft innerhalb ihres Gebiets.

### Koordinaten und Quellen

Jeder Ort hat einen Kartenpunkt (`coords`, Breite/Länge) in `src/content/<kurs>/coords.ts`. Die Datei ist generiert: Städte stammen aus [GeoNames](https://www.geonames.org) (CC BY 4.0), Regionen sind die Label-Punkte aus [Natural Earth](https://www.naturalearthdata.com) (gemeinfrei). Jede Stadt wurde gegen das Polygon ihrer Region geprüft; einige kleinere Orte in Bangladesch und die griechischen Inseln sind von Hand gesetzt. Die Polygone aus Natural Earth sind die Grundlage für die geplante Karte.

## Lokal starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Logik- und Inhaltstests
npm run build      # statischer Build nach dist/
npm run preview    # Build lokal ansehen
```

## Deployment auf GitHub Pages

1. Neues Repository auf GitHub anlegen (öffentlich oder privat mit Pages-Freigabe), z. B. `sylareads`.
2. Projekt hochladen:
   ```bash
   git init
   git add .
   git commit -m "Sylareads M1"
   git branch -M main
   git remote add origin https://github.com/<dein-name>/sylareads.git
   git push -u origin main
   ```
3. Im Repository unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** wählen.
4. Der Workflow `.github/workflows/deploy.yml` startet bei jedem Push auf `main`: Typecheck, Tests, Build, Veröffentlichung. Nach etwa einer Minute ist die App unter `https://<dein-name>.github.io/sylareads/` erreichbar. Den Fortschritt siehst du unter **Actions**.
5. Den Link an ausgewählte Personen schicken. Es gibt keinen Login; wer den Link hat, kann die App nutzen.

Weitere Hinweise:

- Der Build verwendet relative Pfade und Hash-Routing (`#/russian/learn`). Der Repository-Name ist deshalb egal, und direkte Links funktionieren ohne Server-Konfiguration.
- Schlägt ein Test fehl, wird nicht veröffentlicht. Die Inhaltstests prüfen u. a., dass jeder Ort mit allen Namen erkannt wird und keine Antwort zwei Orte gleichzeitig trifft.
- Eigene Domain: unter **Settings → Pages → Custom domain** eintragen.

## Fortschritt und Datenschutz

Ohne Anmeldung bleibt alles im Browser des Nutzers (localStorage, ca. 200 KB im Vollausbau). Es gibt keine Tracker. Safari kann Website-Daten nach 7 Tagen ohne Besuch löschen; deshalb im Profil regelmäßig **Fortschritt exportieren** oder online speichern. Der Import zeigt vorher an, was ersetzt wird, und behält den alten Stand als Sicherung.

## Online-Speicherung (optional, Firebase)

Im Profil erscheint „Online speichern“, sobald eine Firebase-Konfiguration eingetragen ist. Nutzer melden sich mit Google an; der Fortschritt wird ein paar Sekunden nach jeder Änderung, beim Öffnen und beim Zurückkehren in die App abgeglichen. Fortschritt von mehreren Geräten wird **zusammengeführt** (pro Lernobjekt gilt die zuletzt beantwortete Version, Lektionen und Achievements werden vereinigt), nichts wird überschrieben. Nur „Fortschritt zurücksetzen“ und „Importieren“ ersetzen bewusst auch die Online-Kopie. Firebase wird erst geladen, wenn jemand die Online-Speicherung nutzt.

Einrichtung (einmalig, kostenloser Spark-Tarif reicht):

1. [Firebase Console](https://console.firebase.google.com) → **Projekt hinzufügen**, z. B. `sylareads` (Google Analytics wird nicht gebraucht). Ein eigenes Projekt hält die Daten getrennt von anderen Seiten.
2. **Build → Authentication → Jetzt starten → Sign-in method → Google** aktivieren, Support-E-Mail wählen, speichern.
3. **Authentication → Settings → Authorized domains → Domain hinzufügen:** `<dein-name>.github.io`.
4. **Build → Firestore Database → Datenbank erstellen**, Standort z. B. `eur3 (europe-west)`, Produktionsmodus. Dann im Tab **Regeln** einfügen und **Veröffentlichen**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sylareads/{uid} {
         allow read, delete: if request.auth != null && request.auth.uid == uid;
         allow create, update: if request.auth != null && request.auth.uid == uid
           && request.resource.data.data is string
           && request.resource.data.data.size() < 900000;
       }
     }
   }
   ```
   Jeder angemeldete Nutzer kann so nur sein eigenes Dokument lesen und schreiben.
5. **Projekteinstellungen (Zahnrad) → Allgemein → Meine Apps → Web-App hinzufügen (`</>`)**, Name `Sylareads`, kein Firebase Hosting. Die angezeigte `firebaseConfig` in `src/sync/firebaseConfig.ts` bei `FIREBASE_CONFIG` eintragen (statt `null`). Die Werte sind öffentlich und dürfen ins Repository; geschützt wird über die Regeln oben.

Gespeichert wird pro Nutzer ein Dokument `sylareads/<uid>` mit dem Fortschritt als JSON (wie beim Export) und dem Zeitpunkt der letzten Speicherung.

## Projektstruktur

```
src/
  domain/      reine Logik ohne React: Normalisierung, Matching, SRS, Session-Engine,
               Lektions- und Übungs-Builder, Statistik, XP/Level/Streak, Achievements
  content/     Inhalte pro Kurs (ru/, el/, th/, bn/: Leseeinheiten, Wörter, Begriffe,
               Orte, Lektionen, Transliterationsregeln) und das Kurs-Register
  store/       Zustand-Store, localStorage, Migrationen, Import/Export
  sync/        Online-Speicherung über Firebase (optional, lazy geladen)
  i18n/        Wörterbücher de/en und Übersetzungsfunktion
  features/    Seiten: home, dashboard, learn, practice, session, script, profile
  ui/          Bausteine: Buttons, Balken, Top-Bar, Modal
  styles/      Design-Tokens und Styles
```

## Einen Kurs ergänzen

1. Ordner `src/content/<kurs>/` anlegen. Für Alphabetschriften dient `ru/` oder `el/` als Muster (Segmentierungsregeln in `segments`), für Abugidas `th/` oder `bn/` (`segments: () => []`, explizite Antwortlisten, Leseeinheiten über `requiredLetters`).
2. Im Register `src/content/registry.ts` den Kurs auf `status: 'available'` setzen und `load` eintragen.
3. Den Kurs in `src/content/content.test.ts` zur Liste `courses` hinzufügen. Die Tests prüfen Eindeutigkeit, Decodierbarkeit, Antwortlisten und Übersetzungen.

## Antwortregeln

Eine Antwort ist richtig, wenn sie nach der Normalisierung exakt einer definierten Form entspricht. Normalisiert werden nur Groß-/Kleinschreibung, Leerzeichen am Rand, Akzente (ä → a), Strichvarianten und Apostrophe; Bindestrich und Leerzeichen gelten als gleich. Ein Tippfehler bleibt ein Fehler.
