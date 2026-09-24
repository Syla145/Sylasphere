# Sylasphere – Changelog

## v24 – Rückmeldungen vom Quizabend
- **Kein „Abschicken“ mehr:** Was beim Ende der Zeit eingetippt oder ausgewählt ist, zählt. Antworten werden automatisch gespeichert und lassen sich bis zum Schluss ändern. Ausnahme: Song-Enthüllung (dort sperrt das Abschicken die Stufe).
- **Schätzfrage:** neue Einstellung „Wertung“.
  - **Nächste/r gewinnt** (Standard ohne Toleranz): nur wer am nächsten dran ist, bekommt die Punkte, bei Gleichstand alle Nächsten.
  - **Nur innerhalb der Toleranz** (Standard mit Toleranz): volle Punkte im Bereich, sonst 0.
  - **Je näher, desto mehr:** das alte Verhalten, bei dem auch falsche Schätzungen Teilpunkte bekamen.
- **Hotspot:** Der Trefferkreis ist jetzt auf jedem Gerät gleich groß und rund. Das Bild wird ohne Rand angezeigt, und der Radius bezieht sich auf die Bildbreite.
- **Buzzer (mündlich):** „Ohne Gewinner auflösen“ funktioniert jetzt, auch wenn niemand gebuzzert hat.
- **Zuschauer sehen bei der Auflösung, wer was geantwortet hat**, bei allen Fragetypen (außer Buzzer und Zeitduell, die ihre eigene Anzeige haben).
- **Zwischenstand korrigiert:** Die Rangliste auf den Handys nutzt immer die aktuellen Punkte. Nachträglich geänderte Punkte erscheinen auch in der Runden-Zusammenfassung.
- **Musik:** Songs werden automatisch auf eine ähnliche Lautstärke gebracht, ein Limiter verhindert Übersteuern, dazu gibt es einen Lautstärke-Regler pro Song (Standard 70 %). Stille am Songanfang wird bei den Ausschnitten übersprungen, damit auch die 0,1-s-Stufe hörbar ist (abschaltbar).
- **Zeitduell:** Wer dran ist, hat auf dem Handy einen eigenen **⏭ Passen**-Knopf (mündlich und getippt).
- **Higher / Lower** aus der Auswahl im Editor und aus den Beispiel-Quizzen entfernt. Alte Fragen dieses Typs funktionieren weiter.
- Neuer Avatar: 🐐 (dazu 🐻 🐯 🐵 🦉 🐢).
- Keine Änderung an den Firebase-Regeln nötig, keine Dateien zu löschen.

## v23 – Feinschliff für den Quizabend
- **Fight List: Treffer prüfen.** Beim Auflösen zeigt das System pro Spieler jeden Begriff an:
  - ✓ erkannt (auch nur der Nachname, zum Beispiel „Obama“)
  - ≈ mit kleinem Tippfehler erkannt (zum Beispiel „Linkoln“ → Abraham Lincoln)
  - ✗ nicht erkannt, doppelte Begriffe zählen einmal
  - Die vorgeschlagene **Trefferzahl** passt du mit − und + an. Alternative Schreibweisen musst du nicht mehr pflegen.
  - Klarere Punkte im Editor: „Punkte“ ist die **Obergrenze**, „Punkte je Treffer“ gibt es pro Treffer. Mit „Punkte“ = 0 zählt jeder Treffer ohne Grenze. Ein Hinweistext rechnet das vor.
- **Editor:** Unter jeder Frage gibt es **„+ Frage hier einfügen“** (gleicher Typ und gleiches Thema), am Rundenende **„+ Neue Runde danach“**. Die neue Frage wird direkt angesprungen.
- **Editor:** Die linke Leiste scrollt nicht mehr horizontal. Bei Higher / Lower sind die Felder beschriftet (Begriff · Wert · Einheit optional).
- **Lange Themen-Namen** (zum Beispiel „Allgemeinwissen“ im Retro-Design) passen sich der Breite an und laufen nicht mehr über den Rand.
- **QR-Code zum Beitreten:** groß in der Lobby (Moderator und Beamer), klein im Moderator-Bereich „Mitspielen“. Die QR-Bibliothek ist selbst gehostet (MIT-Lizenz).
- **Bildschirm bleibt an** auf Spieler-Handys, Beamer und beim Moderator, solange die Seite offen ist (Browser mit Wake-Lock-Unterstützung).

## v22 – Neuer Spielmodus „Zeitduell“
- **Zeitduell** (inspiriert von Bilder-Duell-Shows): Jeder Spieler hat ein eigenes Zeitkonto (Standard 30 s, wie eine Schachuhr). Der Zufall bestimmt die Reihenfolge, dann geht es reihum.
  - ✓ **Richtig:** Uhr stoppt, die Lösung ist kurz für alle sichtbar, der nächste Spieler bekommt ein neues Bild.
  - ⏭ **Passen:** −3 s, die Lösung wird 3 s gezeigt, der nächste Spieler bekommt ein neues Bild.
  - ⏰ Wer auf 0 fällt, **scheidet aus**. Ende, wenn nur noch einer übrig ist oder die Bilder ausgehen.
  - **Punkte nach Platzierung**, im Editor einstellbar (Standard 100 % / 60 % / 30 %).
- **Zwei Antwort-Modi** (im Editor wählbar):
  - **Mündlich:** Der Moderator drückt ✓ oder Passen.
  - **Tippen:** Das System erkennt die richtige Antwort automatisch. Groß- und Kleinschreibung sowie Leerzeichen am Rand sind egal, falsche Versuche sehen alle.
- **Alle Geräte:** Alle sehen das Bild und alle Uhren. Der Beamer zeigt alles auf einen Blick, auf dem Handy sieht man „Du bist dran!“.
- **Moderator:** Große Knöpfe ✓ Richtig / ⏭ Passen, Pause, „Duell beenden“, die aktuelle Lösung nur für dich. Tastatur: Enter = richtig, P = passen, Leertaste = Pause/Weiter bzw. Start.
- **Editor:** Bilder mit Lösung, Zeit pro Spieler, Strafzeit, Modus, Mischen. **„📁 Alle Bilder übernehmen“** holt einen ganzen Ordner aus `assets/` und schlägt die Lösung aus dem Dateinamen vor (`hund.webp` → „Hund“).
- **Demo:** Neues Quiz „Zeitduell – Demo“ (mündlich und getippt, 16 Bilder in `assets/duell/`). „Showtime“ enthält jetzt alle 16 Fragetypen.
- Editor: Das Feld „Timer (s)“ wird bei Typen ohne gemeinsamen Timer (Buzzer, Zeitduell) ausgeblendet.
- Keine Änderung an den Firebase-Regeln nötig.

## v21 – Neue Startseite: Anmelden oder Gast
- **Startseite fragt zuerst: „Anmelden“ oder „Als Gast fortfahren“.** Danach erscheinen nur die passenden Bereiche:
  - Moderator/Admin: Moderieren, Mitspielen, Zuschauen, Quiz-Editor (Admins zusätzlich: Verwaltung)
  - Angemeldet ohne Moderator-Rechte: Mitspielen, Zuschauen, dazu „Moderator-Zugang anfragen“ bzw. der Status der Anfrage
  - Gast: Mitspielen, Zuschauen
- Die Gast-Wahl wird gemerkt. Oben rechts gibt es jederzeit „Anmelden“. Nach dem Abmelden erscheint wieder die Auswahl.
- **Einladungslinks** (`spieler.html?code=…`) funktionieren weiter direkt, ohne Auswahl.
- **Editor nur noch für Moderatoren** (mit Anmeldung bzw. „Zugang anfragen“, wie beim Moderator).
- **Moderator-Code abgeschafft:** Moderieren geht nur noch mit freigeschaltetem Konto. Die Firebase-Regeln akzeptieren den alten Code nicht mehr.
- Angemeldete Spieler: Der Name wird beim Beitreten vorausgefüllt. Statistiken für Konten folgen im nächsten Schritt.
- **Nach dem Hochladen:** Firebase-Regeln neu veröffentlichen und `tools/moderator-code.html` auf GitHub löschen. Optional in der Datenbank `config` und `moderatorGrants` löschen (siehe `FIREBASE_SETUP.md`).

## v20 – Medien-Auswahl, Datei-Prüfung und neue README
- **📁 Dateiauswahl im Editor:** Neben jedem Bild- und Audiofeld (Bilderquiz, Hotspot, Audio-Quiz, Song-Enthüllung inkl. Albumbild).
  - Zeigt alle Dateien aus `assets/` im GitHub-Repo mit Vorschau, Größe und Ordner. Audio lässt sich dort probehören.
  - Suche und Ordnerfilter. Ein Klick trägt den Pfad ein.
  - „⬆ Neue Datei auf GitHub hochladen“ führt direkt zur Upload-Seite.
- **Live-Prüfung unter dem Feld:** ✓ gefunden (mit Größe), ⚠ Hinweise, ✗ Fehler.
  - Erkennt: ungeeignete Formate (HEIC, WAV, OGG …), falschen Dateityp im Feld, zu große Dateien, Leerzeichen und Umlaute im Namen, Google-Drive-, Dropbox- und YouTube-Links, Pfade vom eigenen Computer, Dateien, die noch nicht online sind.
  - Bei falscher **Groß- und Kleinschreibung**: „Meintest du …? Übernehmen“.
- **„Quiz prüfen“** meldet Formatprobleme jetzt ebenfalls.
- **Demo-Audio als MP3** statt WAV. Die Dateien sind viel kleiner und dienen als gutes Beispiel.
- **README komplett neu:** Seiten und Rollen, Ablauf eines Quizabends, Konten, Speichern, **Anleitung für Bilder und Musik mit Formattabelle**, alle Fragetypen, Designs, Update, Kosten und Grenzen, Projektstruktur.
- Beispiel-Quiz heißt jetzt „Showtime · alle 15 Fragetypen“. Am Handy ist das Audiofeld im Editor volle Breite.
- **Aufräumen (optional):** `assets/demo-song.wav` und `assets/demo-tone.wav` werden nicht mehr gebraucht und können gelöscht werden.

## v19 – Konten, Moderator-Freigabe und „Meine Quizze“
- **Anmeldung für Moderatoren** mit Google oder E-Mail + Passwort, inklusive „Passwort vergessen“. Spieler treten weiterhin ohne Konto als Gast bei.
- **Moderator-Rechte vergibt der Admin:** Eine Anmeldung allein reicht nicht. Neue Konten fragen den Zugang an; auf der neuen Seite **`admin.html`** bestätigst du Anfragen, lehnst sie ab oder entziehst Rechte. Freigaben greifen sofort, ohne Neuladen. Die Firebase-Regeln setzen das serverseitig durch.
- **Meine Quizze:** Im Editor online speichern. Danach wird automatisch gespeichert, auf jedem Gerät mit deinem Konto verfügbar. Dazu gibt es öffnen, duplizieren, löschen, „▶ Moderieren“ und Strg+S. Beim Moderator stehen die eigenen Quizze oben in der Auswahl. Nur der Besitzer kann sie lesen.
- **Konto-Menü** oben rechts (Moderator, Editor, Verwaltung): Name, Rolle, Abmelden, Link zur Verwaltung für Admins.
- Online-Räume gehören jetzt dem Konto. Nach Neuladen oder auf einem anderen Gerät bleibt man Besitzer des Raums.
- Der **Gastmodus mit Moderator-Code** bleibt als Alternative erhalten (ohne Online-Speicher).
- Alles im kostenlosen Firebase-Tarif. **Einrichtung nötig:** siehe `FIREBASE_SETUP.md` → „Neu in v19“.
- Neue Dateien: `admin.html`, `js/core/account.js`, `js/core/account-ui.js`, `js/core/cloud-quizzes.js`, `js/views/admin-view.js`, `tests/v19-accounts.js`.

## v18 – Layout-Feinschliff (Handy & PC)
Komplette Prüfung aller Seiten und Fragetypen in 5 Bildschirmbreiten (360, 390, 768, 1280, 1920 px) und allen 4 Designs – ohne Befund.
- **Moderator am Handy/Tablet (bis 900 px):** neue Reihenfolge – Frage & Antwortstatus → Steuerung → Spieler + kleinerer Timer → Links teilen. Kopfzeile läuft nicht mehr über (Vollbild-Knopf am Handy ausgeblendet), Raumcode-Leiste bricht sauber um.
- **„Alle Antworten“:** zweizeilig (Name + Punkte, darunter die Antwort). Lange Namen quetschen die Antwort nicht mehr zu senkrechten Buchstaben.
- **Schätzfrage:** Ohne Antwort stand dort „0 …“ und der Regler lag ganz links. Jetzt startet er in der Mitte; Moderator/Zuschauer zeigen „–“.
- **Song-Enthüllung:** Stufen immer in einer Reihe; kürzere Knopftexte („Abschicken · 100 %“, „▶ Stufe 1 · 0,1 s“, „⏭ Weiter · 1 s“).
- **Themenauswahl im Editor:** größere Tippflächen am Handy.

## v17 – Designs (Templates)
- **4 Designs:** Neon Arena (bisheriger Look), Retro-Show (70er-Spielshow mit Gold, Rot und Sonnenstrahlen), Clean Light (hell, gut für Beamer und Tageslicht) und Pub Quiz (Kreidetafel, Holz, Bernstein).
- **Auswahl:** im Editor pro Quiz (mit Live-Vorschau) und beim Moderator in „Sitzung starten“ für die jeweilige Sitzung überschreibbar. Spieler und Zuschauer übernehmen das Design automatisch, auch online. Jedes Gerät merkt sich das zuletzt genutzte Design, damit beim Laden nichts aufblitzt.
- **CSS umgebaut:** Alle Farben laufen jetzt über Design-Variablen (keine festen Farben mehr in den Bausteinen). Ein neues Design ist ein Variablen-Block in `css/main.css` plus ein Eintrag in `js/core/themes.js`. Neon Arena sieht unverändert aus (per Pixelvergleich geprüft).
- **Schriften** selbst gehostet (keine Google-Server, datenschutzfreundlich): Bungee (Retro), Patrick Hand (Pub), Nunito (Clean Light) – alle unter SIL Open Font License, Lizenzen in `assets/fonts/`.
- Zum Ausprobieren: `?theme=retro` / `light` / `pub` an eine Adresse anhängen.
- Kleinigkeiten: Beim Moderator erscheint die Stufenleiste der Song-Frage nur noch einmal; veraltete Texte („elf Fragetypen“) aktualisiert.

## v16 – Song-Enthüllung
- **Neuer Fragetyp „Song-Enthüllung“:** Der Moderator spielt den Song in Stufen an (Standard 0,1 s → 1 s → 3 s → 10 s). Jede Stufe lässt sich beliebig oft abspielen, „Nächste Stufe“ schaltet weiter.
- **Ton auf allen Geräten:** Die Ausschnitte laufen gleichzeitig beim Moderator, bei den Zuschauern und bei allen Spielern (sekundengenau über Web Audio). Pro Gerät stummschaltbar; wenn der Browser noch keinen Ton erlaubt, erscheint „🔊 Ton aktivieren“.
- **Antworten:** Spieler tippen den Songtitel (optional auch den Interpreten) und schicken einmal ab. Die Antwort wird mit der aktuellen Stufe gesperrt. Punkte = Fragenpunkte × Prozent der Stufe; bei „Titel + Interpret“ zählt jeder Teil zur Hälfte.
- **Moderator-Prüfung:** Titel und Interpret werden getrennt per ✓/✗ geprüft, exakte Treffer (inkl. erlaubter Schreibweisen) sind vorausgewählt.
- **Auflösung:** Titel, Interpret und Albumbild erscheinen, dazu läuft die festgelegte Stelle (z. B. Refrain) auf allen Geräten. Alle sehen die Antworten der anderen samt Stufe.
- **Editor:** Audiodatei, Startsekunde, Stufen (Länge + Prozent, 1–6 Stufen), Modus Titel / Titel + Interpret, Lösungen mit alternativen Schreibweisen, Albumbild, Auflösungs-Stelle. Jeder Ausschnitt lässt sich mit ▶ direkt testen. Warnung, wenn der Dateiname die Lösung verrät.
- **Firebase-Regeln:** Sperre und Stufe werden serverseitig geprüft → Regeln einmal neu veröffentlichen (siehe `FIREBASE_SETUP.md`).
- Demo: „Showtime“ enthält eine Beispielfrage mit eigens erzeugtem Demo-Song (`assets/demo-song.wav`) und Cover.
- Allgemein nutzbar für künftige Typen: Stufen, gesperrte Antworten, Abspiel-Befehle für alle Geräte und getrennte Prüf-Teile.

## v15 – Themenbibliothek & neue Fragetypen
- **Themenbibliothek:** 29 Themen mit Icon und Farbe (z. B. 🏛️ Geschichte, ⚽ Sport, 🎵 Musik). Bekannte Namen und Varianten wie „Musik & Sounds“ oder „Wortwissen“ werden automatisch erkannt, bestehende Quizze bekommen ihre Icons also ohne Anpassung.
- **Editor:** Das Thema wählst du jetzt aus einer durchsuchbaren Liste (Themen dieses Quiz + Bibliothek) oder legst direkt ein neues an. In der Seitenleiste „Themen im Quiz“ lassen sich Name, Icon (Emoji) und Farbe ändern, Umbenennen ändert alle betroffenen Fragen mit.
- **Anzeige:** Themen erscheinen überall mit Icon und fester Farbe; Rundenintros zeigen das Themen-Icon groß.
- **Neuer Fragetyp „Wahr oder falsch“.**
- **Neuer Fragetyp „Lückentext“:** Lücke im Fragetext mit ___ markieren. Der Moderator prüft jede Antwort per ✓/✗ (exakte Treffer sind vorausgewählt), Rechtschreibung spielt also keine Rolle. Nach der Auflösung sehen alle, was die anderen geschrieben haben.
- **Neuer Fragetyp „Zuordnen“:** Paare wie Land ↔ Hauptstadt; jede richtige Zuordnung zählt anteilig. Die rechte Seite ist gemischt, auf allen Geräten gleich.
- **Moderator-Prüfung und „Alle Antworten“** sind allgemein gebaut und stehen künftigen Fragetypen (z. B. Song-Enthüllung) zur Verfügung.
- Das Quiz „Showtime“ hat eine neue Runde „Neue Formate“ mit Beispielen der drei Typen.

## v14 – Fragetypen als Module
- **Jeder Fragetyp ist jetzt ein eigenes Modul** in `js/question-types/types/` (11 Dateien). Ein Modul enthält alles zu seinem Typ: Anzeige, Editor-Felder, Prüfung, Punktewertung, Lösungstexte, Statistik und was online vor Spielern verborgen wird.
- **Neuer Fragetyp = eine Datei + eine Zeile** in `js/question-types/registry.js`. Anleitung und Vorlage: `js/question-types/README.md`.
- Gemeinsame Bausteine (Antwort-Kacheln, Options-Editor, Statistik) liegen in `js/question-types/kit.js`.
- „Gleich gedacht“ nutzt einen allgemeinen Auswertungsschritt (`resolve`) statt Sonderlogik in den Spiel-Engines.
- Verhalten unverändert: Normalisierung, Prüfung, Punkte, Lösungstexte, Online-Filter und Statistik wurden für alle Beispiel-Quizze gegen v13 verglichen und sind identisch.
- Kleine Korrektur: Bei „Gleich gedacht“ und Buzzer führte ein Runden-Multiplikator von 0 bisher trotzdem zu vollen Punkten. Jetzt gilt 0 wie bei allen anderen Typen.
- Fix: „🔒 Sperren“ funktioniert jetzt auch, wenn die Moderatorseite mit gespeichertem Code automatisch freigeschaltet wurde.
- Neuer Test `tests/v14-type-modules.js`: prüft alle Module und spielt einen neuen Test-Fragetyp komplett durch.

## v13 – Moderator-Code & flüssigere Spieleransicht
- **Moderator-Code:** Die Moderatorseite ist jetzt mit einem Code geschützt. Online prüft Firebase den Code selbst (`config/moderatorKeys`, für niemanden lesbar). Nur freigeschaltete Moderatoren können Online-Räume anlegen. Einrichtung siehe `FIREBASE_SETUP.md`, Code erzeugen mit `tools/moderator-code.html`. Der Code bleibt auf dem Gerät gespeichert, „🔒 Sperren“ in der Kopfzeile meldet ab.
- **Spieleransicht:** Die Frage wird nur noch neu gezeichnet, wenn sich für den Spieler etwas ändert (neue Frage, Phase, Buzzer-Status). Antworten anderer Spieler unterbrechen das Tippen in Textfeldern (Aufzählfrage, Text-Buzzer) und das Ziehen am Schätz-Regler nicht mehr.
- **Tests:** `tests/v13-rules-eval.js` wertet die echten Firebase-Regeln gegen Testfälle aus (Code-Prüfung, Raum anlegen, Buzzer).
- **Aufräumen:** Die alten Dateien im Hauptordner werden nicht mehr mitgeliefert.

## v12.2 – Lösung für den Moderator
- Der Moderator sieht die Lösung jetzt dauerhaft in einer gelb gestrichelten Box „🔒 Lösung · nur für dich sichtbar“: schon vor dem Öffnen der Frage (inkl. Fragetext), während der Antwortphase und beim Buzzer während der Prüfung.
- Schätzfragen zeigen zusätzlich die Toleranz, Hotspot-Fragen markieren den Zielbereich direkt auf dem Bild. Bei Konsens-Fragen gibt es naturgemäß keine feste Lösung.
- Spieler und Zuschaueransicht sehen die Lösung weiterhin erst bei der Auflösung. Online liegt die Lösung ohnehin nur im Moderator-Bereich der Datenbank.

## v12.1 – Online-Buzzer-Fix
- Mündlicher Buzzer: Die Antwort des Spielers wurde als `null` gesendet, von Firebase verworfen und scheiterte an der Regelprüfung. Dadurch fehlte der Antwort-Datensatz („0/2 Buzzer-Versuche“). Wird jetzt korrekt gespeichert.
- Auflösen einer Buzzer-Frage: Fehlerhafte Firebase-Meldung „values argument contains a path … ancestor of another path“ behoben. Der Datensatz des Gewinners wird nun in einem Schritt inklusive Wertung geschrieben.
- Neuer Test `tests/v12-online-buzzer.js` spielt den Ablauf Buzzern → Falsch → Zweiter Spieler buzzert → Auflösen online durch.

## v12 – Feinschliff Editor, Spieler-UX & Buzzer-Fix
- **Editor:** Fragetyp-Auswahl im Rundenkopf entfernt – der Typ wird direkt in der Frage gewählt. „+ Frage“ übernimmt den Typ der letzten Frage der Runde (sonst Multiple Choice). Titel und Multiplikator stehen jetzt bündig nebeneinander.
- **Spieler:** Infotexte unter den Antworten („Antwort gespeichert …“, „Antworten sind geschlossen“, Auflösung, Buzzer-Hinweise) haben einheitlich mehr Abstand; ebenso in der Zuschaueransicht.
- **Sortierquiz:** Echtes Drag & Drop für Maus und Touch (Griff ⠿ oder kurz gedrückt halten), mit Animation, Auto-Scroll am Bildschirmrand und Live-Nummerierung. ↑/↓-Buttons bleiben als Alternative. Eingehende Updates anderer Spieler unterbrechen das Ziehen nicht mehr.
- **Online-Buzzer:** `PERMISSION_DENIED` beim Starten einer Buzzer-Frage durch den Moderator behoben. Gesperrte Spieler werden jetzt einzeln zurückgesetzt, was mit den bestehenden v10-Regeln funktioniert. Die Regeln erlauben dem Moderator zusätzlich das Zurücksetzen auf Fragenebene (erneutes Veröffentlichen optional).

## v10 – Editor Upgrade
- Editor-Einstieg trennt **Quiz editieren** und **Neues Quiz erstellen**.
- Bestehende Quizze aus `data/` können direkt im Editor geladen werden.
- Fragen-IDs werden automatisch erzeugt und nur noch unter **Erweiterte Einstellungen** angezeigt.
- Schätzfragen: Toleranz-Presets 5 %, 10 %, 20 % sowie benutzerdefinierte prozentuale oder feste Werte.
- Alte `tolerance`-Werte bleiben als feste ±-Toleranz kompatibel.
- Online-Buzzer auf atomare, regelkonforme Firebase-Claims gehärtet; v10-Regeln müssen neu veröffentlicht werden.


## v8 – Online Multiplayer Beta · 23.09.2026

### Online Multiplayer
- Firebase Realtime Database als zweite Session-Schicht ergänzt
- Firebase Anonymous Authentication ohne sichtbaren Nutzer-Login
- 6-stelliger Raumcode funktioniert geräte- und standortübergreifend
- Online-Räume werden bei manueller Code-Eingabe automatisch erkannt
- lokaler Testmodus aus v7 bleibt vollständig erhalten
- Reconnect mit derselben anonymen Spieleridentität
- Duplicate-Tab-Schutz erzeugt bei Bedarf eine neue anonyme Spieler-UID
- `onDisconnect()` markiert verlorene Verbindungen als offline
- sichtbarer Online-/Reconnect-Status in Moderator, Spieler und Presenter

### Sicherheit / Datenmodell
- vollständiges Quiz liegt in `host/quiz` und ist nur für die Moderator-UID lesbar
- öffentliche Quiz-Vorschau enthält vor Start keinen Fragetext
- Lösungen, Schätzwerte, Sortierreihenfolge, Fight-List-Lösungen, Survey-Prozente und Hotspot-Ziel werden vor Reveal nicht öffentlich übertragen
- Spieler können über Security Rules nur das eigene Profil und eigene Antworten verändern
- Punkte, Spielstatus, Reveal und Navigation sind Moderator-Schreibrechte
- serverseitiger Resolve-Lock schützt vor doppelter Punktevergabe
- Antworten werden serverzeitbasiert nach Timerende abgewiesen
- Produktionsregeln in `firebase-database.rules.json`

### Spieler-UX
- Live-Rangliste auf Desktop rechts neben dem Quiz
- unter 900 px automatisch einspaltig; auf Smartphone Rangliste unter der Frage
- Online-Verbindungsstatus und Reconnect-Anzeige
- bei lokal abgelaufenem Timer wird die Eingabe auch dann sofort gesperrt, wenn der Moderator-Status kurz verzögert ankommt

### Bestehende Funktionen erhalten
- 10 Fragetypen
- frei definierbare Kategorien
- manueller Reveal nach Timer
- exakte Punktkorrektur `−10 / −1 / Direktwert / +1 / +10`
- Editor, Import/Export, Presenter und lokale Mehrspieler-Simulation
- sichtbare Versionsmarke **Quiz Arena v8** und `?v=8` Cache-Buster

## v7 – Precise Score Update · 22.09.2026
- Exakte manuelle Punktkorrektur inklusive ±1 und direktem Gesamtwert.

## v6 – Moderator Reveal Update · 22.09.2026
- Timer schließt nur die Antwortphase; Auflösung erfolgt manuell durch den Moderator.

## v5 – Showtime Update · 22.09.2026
- Vier neue Fragetypen, Game-Show-UX, Podium, Rundeneinstiege und Editor-Upgrades.

## v9
- Rebranding auf **Sylasphere** inkl. angepasster Startseite, neuem Logo-Text und Hinweis „Erstellt von JH“.
- Landingpage vereinfacht: vier kleine Infoblöcke entfernt.
- Neuer Fragetyp **Buzzer** im Editor mit zwei Modi:
  - mündliche Antwort nach dem Buzzer
  - erste Textantwort gewinnt
- Moderator-Workflow für Buzzer-Fragen:
  - erster Spieler sperrt den Buzzer
  - Moderator kann **richtig werten & auflösen** oder **falsch werten, Spieler sperren und Buzzer neu freigeben**
- Spieleransicht für Buzzer-Fragen mit Live-Status, Sperrhinweis und schneller Button-/Text-Eingabe.

## v11
- Editor-Einstieg visuell an die Startseiten-Karten angepasst.
- „Quiz editieren“ und „Neues Quiz erstellen“ verwenden jetzt dieselben hochwertigen Role-Cards wie die Landingpage.
- Versionsanzeige robuster gemacht: sichtbare Versionsnummer steht statisch in jeder HTML-Seite und kann nicht mehr durch eine veraltete `app.js` zurückgesetzt werden.
- Alle HTML-/CSS-/JS-Cache-Buster auf `v11` gesetzt.
