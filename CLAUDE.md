# Sylasphere – Hinweise für Claude

Multiplayer-Quiz-Website (Moderator am PC, Spieler am Handy, Zuschauer/Beamer). Betreiber: Josef (GitHub `Syla145`).
Alle Texte, Commits und Antworten auf **Deutsch**.

## Technik
- Reines **HTML/CSS/JavaScript**, keine Frameworks, kein Build-Schritt. Läuft über **GitHub Pages** vom Branch `main`.
- Seiten: `index.html` (Start/Beitritt), `moderator.html`, `spieler.html`, `zuschauer.html`, `editor.html`, `admin.html`, `profil.html` (ab v28).
- Module hängen sich an `window` (z. B. `window.SchmobinApp`, `window.SylasphereSfx`) und werden per `<script defer>` geladen.
  Neue Datei → in **allen** HTML-Seiten eintragen, die sie brauchen.
- **Firebase** (Projekt `jh-quiz`, Blaze-Tarif): Realtime Database (Räume, Spielstand), Auth (Google-Login),
  Storage (Uploads `media/<uid>/…`, Bucket `jh-quiz.firebasestorage.app`), Firestore nur für `uploaders/<uid>`.
  Regeln: `firebase-database.rules.json`, `storage.rules`, `firestore.rules` – Josef trägt sie in der Firebase-Konsole ein;
  bei Regeländerungen immer in `FIREBASE_SETUP.md` beschreiben, was er wo einfügen muss.
- Zwei Spiel-Engines mit gleicher Schnittstelle: `js/core/session-engine.js` (lokal, localStorage + BroadcastChannel)
  und `js/core/online-session-engine.js` (Firebase). Neue Funktionen immer in **beiden** umsetzen.

## Aufbau
- `js/core/` – App-Grundlagen (app.js mit `APP_VERSION`, Themes `themes.js` (Katalog, Bühne, Übergang, Siegerehrung, Animationen reduzieren), Timer, Sounds `sfx.js`, Reaktionen, Highlights, Einstellungen ⚙️, Konto, Uploads `cloud-media.js`)
- `js/views/` – Logik der Seiten (moderator-, player-, spectator-, admin-, home-, profile-, preview-view)
- **Themes (ab v29):** Eintrag in `THEMES` (`js/core/themes.js`) + Aussehen `css/themes/<id>.css` (in `css/themes/index.css` importieren) + optional Effekte `js/themes/<id>.js` (`decor`, `transition`, `ceremony`, `sounds`). Theme pro Quiz (`settings.theme`) und pro Runde (`round.theme`). Neue Themes: alle Farb-Variablen setzen, Kontrast wird in `tests/v29-themes.js` geprüft; Deko nur am Rand/unten, nie unter freiem Text. Vorschau: `vorschau.html?theme=<id>`.
- `js/editor/` – Quiz-Editor, Medienbibliothek
- `js/question-types/` – **Fragetyp-Registry**: jeder Typ ist eine Datei in `types/` (Editor, Spieleransicht, Auswertung, optional `game` für rundenbasierte Spiele wie `ranking`, `time-duel`). Liste in `registry.js` (`TYPE_FILES`). Gemeinsame Helfer in `kit.js` (u. a. unscharfer Textvergleich `Kit.matchTerm`). Siehe `js/question-types/README.md`.
- `data/` – Beispiel-Quizze (JSON), `data/quiz-list.json` listet sie.
- `tests/` – Node-Tests ohne Abhängigkeiten: `node tests/<datei>.js` (alle sollten „0 failed“ melden).

## Arbeitsweise
- Versionen in Schritten (zuletzt **v29**). Pro Version: `APP_VERSION` in `js/core/app.js` hochzählen, Eintrag in `CHANGELOG.md`, README bei Bedarf, einen Test `tests/v<NN>-<thema>.js` ergänzen, alle Tests laufen lassen.
- Einfach, robust, gut erweiterbar; Darstellung, Daten und Spiellogik getrennt halten. Muss auf Handy **und** Desktop gut bedienbar sein.
- UI im Browser prüfen (Playwright/Chromium ist in der Cloud-Umgebung vorhanden): lokalen Server starten (`python3 -m http.server`), Handy-Breite 390 px und Desktop ansehen. Namen dürfen nie von Avataren/Emojis verdeckt werden.
- **Themes dürfen den Originalnamen ihres Vorbilds tragen** (z. B. „Mario Kart“), weil die Seite nur im privaten Kreis genutzt wird.
  **Wird die Seite öffentlich, müssen diese Themes umbenannt werden** (eigene Namen „im Stil von“).
  Weiterhin verboten (das Repo ist öffentlich): Logos, Figuren, Original-Grafiken, Original-Schriften und Original-Sounds der Vorbilder.
  Erlaubt: Farbwelt, Formen, Muster, Animationen und selbst erzeugte Sounds im Stil davon.
- Schriften nur frei lizenziert (z. B. OFL) und lokal in `assets/fonts/` (mit Lizenzdatei), keine externen Ressourcen (kein Google-Fonts-Link, kein CDN).
- Spielmodi weiterhin mit eigenen Namen (keine geschützten Namen).
- Kosten: kostenlos bzw. nahe null halten (Firebase-Freikontingente).
- Einstellungen pro Gerät in localStorage mit Präfix `sylasphere:`; alles, was stört (Sound, Vibration, Reaktionen), muss in ⚙️ abschaltbar sein.
- **Kein Pull Request mehr:** Fertige Versionen direkt auf `main` committen und pushen (Commit-Titel „vNN: …“) und Josef danach eine kurze Testanleitung (mit Screenshots) schicken.
  **Ausnahme Firebase-Regeln:** Ändert eine Version `firebase-database.rules.json`, `storage.rules` oder `firestore.rules`, Josef **vor dem Push** Bescheid geben und warten, bis er die Regeln veröffentlicht hat.

## Roadmap
Die ausführliche Roadmap liegt im claude.ai-Projekt „Sylasphere“ (`claude/ideen-roadmap.md`). Kurz:
1. Infotexte überarbeiten – wartet auf Josef (Doc „Sylasphere – Infotexte überarbeiten“).
2. **Erledigt in v28: Statistiken + XP & Stufen** (Logik `js/core/progress.js`, Firebase `js/core/progress-store.js`, Seite `profil.html`; Entscheidungen: XP-Formel 20/5/50-30-15/10, max. 250 pro Spiel, 600 pro Tag, ab 3 Spielern + 5 Fragen, Stufe n→n+1 = 50·n XP, Bestenliste nur mit Opt-in) – Spieler-Statistiken (Spiele, Siege, Trefferquote pro Fragetyp/Thema), Moderator-Statistiken (schwerste Fragen), Ergebnisse beim Spielende pro Konto sichern, alte Räume aufräumen. XP fürs Mitspielen/richtige Antworten/Siege/Highlights; höhere Stufe schaltet **Emotes** frei (`SylasphereReactions.EMOJIS` = Grundausstattung, Gäste nur diese). 
3. **v29 erledigt:** Theme-Technik + Mario Kart, League of Legends, GeoGuessr, Valorant (IDs `kart`, `legends`, `geo`, `tactical`). **Als Nächstes:** weitere Themes (z. B. Stadion, Party …) oder was Josef vorgibt.
