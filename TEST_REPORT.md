# Sylasphere – Testbericht v10

## Automatisierte Tests

- Legacy-/Datenvalidierung: **36/36**
- Online-Multiplayer-Simulation inkl. Buzzer: **66/66**
- Regressionstest bestehender Spiellogik: **33/33**
- v10 Editor-/Toleranztests: **13/13**
- v10 lokaler Buzzer-Ablauf inkl. Sperre/Penalty: **12/12**
- v10 Firebase-Regelstruktur für Buzzer: **6/6**

Gesamt: **166/166** explizite Checks bestanden.

## Zusätzlich geprüft

- JavaScript-Syntax aller Core-, View-, Renderer- und Editor-Dateien
- JSON-Parsing aller Quizdateien und Firebase-Regeln
- alle elf Fragetypen in den gebündelten Quizdaten
- fehlende Fragen-ID wird automatisch erzeugt
- alte feste Toleranz bleibt kompatibel
- prozentuale Toleranz 5/10/20 %
- benutzerdefinierte feste Toleranz
- Online-Buzzer: erster Claim gewinnt; zweiter gleichzeitiger Claim wird abgewiesen; falscher Spieler wird gesperrt; Buzzer wird für verbleibende Spieler wieder geöffnet

## Hinweis

Für den echten Online-Buzzer müssen die mitgelieferten v10 Firebase-Regeln veröffentlicht sein. Die lokale Simulation kann Firebase Security Rules selbst nicht serverseitig ausführen; deshalb ist ein kurzer echter Go-Test nach dem Deployment weiterhin sinnvoll.
