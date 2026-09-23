# JH-Quiz – Quiz Arena v8

Aktueller Stand: **v8 – Online Multiplayer Beta**.

JH-Quiz bleibt eine statische GitHub-Pages-Anwendung ohne npm, Bundler oder eigenen Server. Neu in v8 ist eine optionale Firebase-Realtime-Schicht für echte Spiele über verschiedene Geräte und Internetanschlüsse. Der bewährte lokale Testmodus aus v7 bleibt vollständig erhalten.

## Was v8 neu bringt

- **Online-Sitzungen über Firebase Realtime Database**
- Spieler treten weiterhin nur mit **6-stelligem Raumcode + Name + Avatar** bei
- **kein sichtbarer Login**, keine E-Mail, kein Passwort; Firebase Anonymous Auth läuft technisch im Hintergrund
- Moderator-PC, Spieler-Handys und Presenter können sich von unterschiedlichen Orten verbinden
- Reconnect im selben Spielertab mit derselben anonymen Spieleridentität
- Duplicate-Tab-Schutz: ein duplizierter Spielertab bekommt eine neue anonyme UID statt einen bestehenden Spieler zu überschreiben
- Moderator bleibt autoritativ für Spielstart, Fragen, Reveal, Punkte, Navigation und Spielende
- richtige Lösungen liegen vor dem Reveal **nicht im öffentlichen Raumzustand**
- Online-Antworten sind pro Spieler geschützt; der Moderator kann alle Antworten zur Auswertung lesen
- Firebase `onDisconnect()` markiert abgebrochene Spieler als offline
- sichtbarer Online-/Reconnect-Status
- **Live-Rangliste auf Desktop rechts neben der Spielerfrage**, auf Smartphone automatisch darunter
- lokaler `localStorage`/`BroadcastChannel`-Modus weiterhin verfügbar
- sichtbare Versionsmarke **Quiz Arena v8** und Cache-Buster `?v=8`

## Seiten

- `index.html` – Rollenwahl
- `moderator.html` – Quiz laden und lokale oder Online-Sitzung erstellen
- `spieler.html` – per Code beitreten; Online-Räume werden automatisch erkannt
- `zuschauer.html` – Presenter-/Beameransicht; Online-Räume werden automatisch erkannt
- `editor.html` – Quiz erstellen, bearbeiten, validieren, importieren und exportieren

## Online-Datenmodell

Unter `rooms/<CODE>/` werden die Daten bewusst getrennt:

- `meta` – Raum-Metadaten und Moderator-UID
- `outline` – sichere Quiz-Vorschau ohne Fragetext/Lösung
- `public` – aktueller öffentlicher Spielzustand
- `profiles` – Name, Avatar, Presence der Spieler
- `scores` – Punktestände
- `answers/<uid>` – Antworten des jeweiligen Spielers
- `host/quiz` – vollständiges Quiz **nur für den Moderator**
- `host/resolveLocks` – Schutz vor doppelter Punktevergabe

Vor der Auflösung veröffentlicht der Moderator nur die Informationen, die der aktuelle Fragetyp zum Spielen benötigt. Nach dem manuellen Reveal werden Lösung und aggregierte Statistik veröffentlicht.

## 10 Fragetypen

- `multiple-choice`
- `image-quiz`
- `audio-quiz`
- `estimate`
- `sort`
- `fight-list`
- `higher-lower`
- `survey`
- `consensus`
- `hotspot`

Alle bestehenden Kategorien und frei eingegebenen Kategorien bleiben kompatibel.

## Moderator-Reveal

Der Ablauf aus v6 bleibt auch online erhalten:

**Frage öffnen → Antworten → Timer/Schließen → Antworten geschlossen → Moderator klickt „Frage auflösen“ → Punkte/Lösung → nächste Frage.**

Der Timer löst eine Frage niemals automatisch auf.

## Exakte Punkte

In der Moderatoransicht stehen weiterhin pro Spieler zur Verfügung:

- `−10`
- `−1`
- exakter Gesamtpunktestand
- `+1`
- `+10`

Die Änderung wird im Online-Modus sofort über Firebase synchronisiert.

## Firebase einmalig einrichten

Siehe **`FIREBASE_SETUP.md`**. Kurzfassung:

1. Firebase Authentication → **Anonymous** aktivieren.
2. Realtime Database → **Rules** → Inhalt von `firebase-database.rules.json` einfügen und veröffentlichen.
3. v8 nach GitHub Pages hochladen.

Die Web-Konfiguration und die Datenbank-URL des Projekts `jh-quiz` sind bereits in `js/core/firebase-service.js` hinterlegt.

## GitHub Pages Deployment

1. Kompletten Inhalt dieses Ordners ins Repository-Root hochladen und vorhandene Dateien ersetzen.
2. `.nojekyll` im Root behalten.
3. GitHub Pages wie bisher über `main` + `/root` veröffentlichen.
4. Seite hart neu laden und prüfen, ob **Quiz Arena v8** angezeigt wird.
5. Für den Online-Test zuerst `FIREBASE_SETUP.md` abarbeiten.

Keine Firebase CLI, kein npm und kein Build-Schritt sind erforderlich.

## Beta-Hinweise

- Ein Online-Raum gehört zur anonymen Moderator-Identität des Browsers, in dem er erstellt wurde. Wird die Browser-Site-Storage komplett gelöscht, kann dieser bereits laufende Raum nicht als Moderator übernommen werden.
- Räume werden für die Go-Testphase noch nicht automatisch nach X Stunden gelöscht. Das kann in einer späteren Version als Cleanup-Funktion ergänzt werden.
- Der lokale Modus ist absichtlich weiterhin vorhanden und dient als Fallback sowie für schnelle Regressionstests.
