# JH-Quiz v8 – Go-Test Checkliste

## Vor dem ersten Test

- [ ] Firebase Authentication → Anonymous ist aktiviert
- [ ] `firebase-database.rules.json` wurde unter Realtime Database → Rules veröffentlicht
- [ ] GitHub Pages zeigt sichtbar **Quiz Arena v8**
- [ ] Moderator nutzt den Button **🌐 Online-Sitzung erstellen**

## Minimaler echter Mehrgeräte-Test

1. Moderator auf PC/Laptop öffnen.
2. Online-Sitzung erstellen und Raumcode notieren.
3. Spieler 1 auf einem Smartphone über Mobilfunk beitreten.
4. Spieler 2 auf einem anderen Gerät/WLAN beitreten.
5. Prüfen: beide Namen erscheinen gleichzeitig beim Moderator.
6. Spiel starten und eine Frage öffnen.
7. Beide Spieler antworten.
8. Timer ablaufen lassen: Antworten müssen geschlossen sein, Lösung bleibt verborgen.
9. Moderator klickt **Frage auflösen**.
10. Punkte und Lösung erscheinen auf allen Geräten.
11. Moderator vergibt einem Spieler `+1`; Ranglisten müssen sofort aktualisiert werden.
12. Spieler 1 lädt die Seite neu und tritt mit demselben Code wieder bei: kein Doppelspieler.
13. WLAN/Mobilfunk kurz trennen und wieder verbinden: Status darf kurz **Reconnect** zeigen und anschließend wieder **Online**.
14. Presenter-Link auf einem weiteren Gerät öffnen und Rangliste/Reveal prüfen.

## Besonders testen

- Sortieren auf Touch
- Hotspot auf Smartphone
- Audio-Quiz über Mobilfunk
- Consensus mit mindestens 3 Spielern
- Rundengrenze / nächste Runde
- Finale / Podium
- exakte Punktkorrektur
- duplizierter Spielertab im selben Browser

## Wenn Online nicht startet

- Meldung „Anonyme Anmeldung …“ → Anonymous Auth in Firebase aktivieren.
- Meldung „Zugriff verweigert …“ → Realtime-Database-Regeln veröffentlichen.
- `Quiz Arena v7` sichtbar → GitHub Pages/Browser liefert noch den alten Stand; Hard Refresh.
- Raumcode unbekannt → sicherstellen, dass der Moderator wirklich **Online-Sitzung** und nicht **Lokal testen** gewählt hat.
