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
- `js/core/` – App-Grundlagen (app.js mit `APP_VERSION`, Themes, Timer, Sounds `sfx.js`, Reaktionen, Highlights, Einstellungen ⚙️, Konto, Uploads `cloud-media.js`)
- `js/views/` – Logik der Seiten (moderator-, player-, spectator-, admin-, home-view)
- `js/editor/` – Quiz-Editor, Medienbibliothek
- `js/question-types/` – **Fragetyp-Registry**: jeder Typ ist eine Datei in `types/` (Editor, Spieleransicht, Auswertung, optional `game` für rundenbasierte Spiele wie `ranking`, `time-duel`). Liste in `registry.js` (`TYPE_FILES`). Gemeinsame Helfer in `kit.js` (u. a. unscharfer Textvergleich `Kit.matchTerm`). Siehe `js/question-types/README.md`.
- `data/` – Beispiel-Quizze (JSON), `data/quiz-list.json` listet sie.
- `tests/` – Node-Tests ohne Abhängigkeiten: `node tests/<datei>.js` (alle sollten „0 failed“ melden).

## Arbeitsweise
- Versionen in Schritten (zuletzt **v28**). Pro Version: `APP_VERSION` in `js/core/app.js` hochzählen, Eintrag in `CHANGELOG.md`, README bei Bedarf, einen Test `tests/v<NN>-<thema>.js` ergänzen, alle Tests laufen lassen.
- Einfach, robust, gut erweiterbar; Darstellung, Daten und Spiellogik getrennt halten. Muss auf Handy **und** Desktop gut bedienbar sein.
- UI im Browser prüfen (Playwright/Chromium ist in der Cloud-Umgebung vorhanden): lokalen Server starten (`python3 -m http.server`), Handy-Breite 390 px und Desktop ansehen. Namen dürfen nie von Avataren/Emojis verdeckt werden.
- **Keine geschützten Marken**, Namen, Logos, Figuren oder Grafiken. Themes/Spielmodi nur „im Stil von“ mit eigenen Namen.
- Kosten: kostenlos bzw. nahe null halten (Firebase-Freikontingente).
- Einstellungen pro Gerät in localStorage mit Präfix `sylasphere:`; alles, was stört (Sound, Vibration, Reaktionen), muss in ⚙️ abschaltbar sein.
- Änderungen als **Pull Request nach `main`** (Titel „vNN: …“, kurze deutsche Beschreibung, was Josef testen soll). Josef merged selbst.

## Roadmap
Die ausführliche Roadmap liegt im claude.ai-Projekt „Sylasphere“ (`claude/ideen-roadmap.md`). Kurz:
1. Infotexte überarbeiten – wartet auf Josef (Doc „Sylasphere – Infotexte überarbeiten“).
2. **Erledigt in v28: Statistiken + XP & Stufen** (Logik `js/core/progress.js`, Firebase `js/core/progress-store.js`, Seite `profil.html`; Entscheidungen: XP-Formel 20/5/50-30-15/10, max. 250 pro Spiel, 600 pro Tag, ab 3 Spielern + 5 Fragen, Stufe n→n+1 = 50·n XP, Bestenliste nur mit Opt-in) – Spieler-Statistiken (Spiele, Siege, Trefferquote pro Fragetyp/Thema), Moderator-Statistiken (schwerste Fragen), Ergebnisse beim Spielende pro Konto sichern, alte Räume aufräumen. XP fürs Mitspielen/richtige Antworten/Siege/Highlights; höhere Stufe schaltet **Emotes** frei (`SylasphereReactions.EMOJIS` = Grundausstattung, Gäste nur diese). 
3. **Als Nächstes:** Themes „im Stil von“ (Kart-Rennen, Stadion, Taktik-Shooter, Party …).
