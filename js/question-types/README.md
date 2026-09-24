# Fragetypen

Jeder Fragetyp ist ein eigenes Modul in `types/`. Das Modul enthält **alles**, was zu diesem Typ gehört:
Anzeige, Editor-Felder, Prüfung, Punktewertung, Lösungstext, Statistik und was online vor den Spielern versteckt wird.

```
js/question-types/
├── registry.js      ← Liste aller Typen (TYPE_FILES) + Laden
├── kit.js           ← gemeinsame Bausteine (Antwort-Kacheln, Options-Editor, Statistik …)
├── renderers.js     ← Verteiler: ruft render() des passenden Moduls auf
└── types/
    ├── multiple-choice.js
    ├── estimate.js
    └── …
```

## Neuen Fragetyp hinzufügen

1. Datei `types/<typ>.js` anlegen (Vorlage unten). Der Dateiname muss dem `type` entsprechen.
2. In `registry.js` den Namen in `TYPE_FILES` eintragen.

Fertig. Editor-Auswahl, Moderator, Spieler, Zuschauer, Prüfung, Punkte und Online-Modus nutzen den neuen Typ automatisch.
`tests/v14-type-modules.js` prüft neue Module mit: Die Startwerte aus `defaults()` müssen eine gültige Frage ergeben, und online dürfen keine Lösungsfelder bei den Spielern ankommen.

## Vorlage

```js
(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'ja-nein',                    // = Dateiname (types/ja-nein.js)
    label: 'Ja oder nein',              // Anzeige in Editor und Frage
    icon: '✓',
    description: 'Beispiel-Vorlage: Ja/Nein-Frage.',
    solutionLabel: 'Lösung',            // optional, z. B. 'Top-Antwort'

    // Startwerte für eine neue Frage im Editor
    defaults: () => ({ correctAnswer: true }),

    // Eingelesene Daten aufräumen (Pflichtfelder, alte Feldnamen …)
    normalize(q) { q.correctAnswer = q.correctAnswer === true || q.correctAnswer === 'true'; },

    // Fehler/Hinweise für „Quiz prüfen“
    validate(q, report) { if (typeof q.correctAnswer !== 'boolean') report.error('correctAnswer', 'Lösung fehlt.'); },

    // Punkte ohne Runden-Multiplikator (den rechnet der Kern drauf). base = Punkte der Frage, playerId = Spieler, result = Ergebnis aus resolve()
    score(q, answer, { base }) {
      const hit = answer === q.correctAnswer;
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    solutionText: q => (q.correctAnswer ? 'Ja' : 'Nein'),
    answerLabel: (q, answer) => (answer === true ? 'Ja' : answer === false ? 'Nein' : '–'),

    // Anzeige für Spieler, Moderator und Zuschauer
    // ctx: { currentAnswer, readOnly, reveal, result, onAnswer(value), playerId }
    render(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      const grid = Kit.el('div', 'answer-grid');
      [[true, 'Ja'], [false, 'Nein']].forEach(([value, text]) => {
        const button = Kit.el('button', 'answer-btn', text);
        button.type = 'button';
        button.disabled = Boolean(ctx.readOnly);
        button.classList.toggle('is-selected', ctx.currentAnswer === value);
        if (ctx.reveal && value === q.correctAnswer) button.classList.add('is-correct');
        button.addEventListener('click', () => {
          grid.querySelectorAll('.answer-btn').forEach(b => b.classList.toggle('is-selected', b === button));
          ctx.onAnswer(value);
        });
        grid.append(button);
      });
      wrap.append(grid);
      container.replaceChildren(wrap);
    },

    // Eingabefelder im Editor. ui: { div, input, button, labelField, queueSave, structuralChange, nonNegative }
    editor(q, ui, box) {
      const select = document.createElement('select'); select.className = 'select';
      select.innerHTML = '<option value="true">Ja</option><option value="false">Nein</option>';
      select.value = String(q.correctAnswer);
      select.addEventListener('change', e => { q.correctAnswer = e.target.value === 'true'; ui.queueSave(); });
      box.append(ui.labelField('Richtige Antwort', select));
    }
  });
})();
```

## Optionale Felder

| Feld | Wofür |
| --- | --- |
| `hideSolution(publicQuestion)` | Zusätzliche Felder vor den Spielern verstecken. `correctAnswer`, `correctAnswers`, `correctOrder`, `solution` und `tolerance` versteckt der Kern immer automatisch. |
| `stats: { aggregate(q, records, result), render(stats, q) }` | Statistik für die Zuschaueransicht. Auswahl-Typen nutzen `Kit.choiceStats`. |
| `resolve(q, answers)` | Ergebnis, das erst mit allen Antworten feststeht (Beispiel: `consensus.js`). Es wird an `score()` als `result` übergeben. |
| `moderatorSolution(q, result)` | Eigener Text `{ text, extra }` für die Lösungsbox des Moderators. |
| `moderatorAlwaysReveal: true` | Der Moderator sieht die Frage immer aufgelöst (Beispiel: Hotspot-Zielbereich). |
| `noTimer: true` | Die Frage läuft ohne Timer. |
| `review: 'manual'` | Der Moderator prüft jede Antwort per ✓/✗ (Beispiel: `gap-text.js`). Die Entscheidungen kommen über `resolve(q, answers, { verdicts })` an und werden in `score()` über `result.verdicts[playerId]` gelesen. |
| `autoCheck(q, answer)` | Vorschlag für die Moderator-Prüfung: `true`, `false` oder `null` (unklar). |
| `publishAnswers: true` | Nach der Auflösung sehen alle Spieler und Zuschauer die Antworten der anderen. |
| `reviewParts(q)` | Getrennte Prüfung mehrerer Teile, z. B. `[{ key: 'title', label: 'Titel' }, { key: 'artist', label: 'Interpret' }]`. Die Entscheidung kommt dann als Objekt `verdicts[playerId] = { title: true, artist: false }`. |
| `stages(q)` | Stufen-Frage: `[{ duration, percent }]`. Der Moderator schaltet die Stufen weiter, die Antwort bekommt automatisch `answer.stage` (Beispiel: `song-reveal.js`). |
| `lockOnSubmit: true` | Antwort kann nach dem Abschicken nicht mehr geändert werden (online von den Firebase-Regeln geprüft). |
| `mediaClip(q, media)` / `revealMedia: true` | Was bei einem Abspiel-Befehl auf allen Geräten läuft: `{ url, offset, duration, fade }`; mit `revealMedia` automatisch beim Auflösen. |
| `update(q, container, ctx)` | Anzeige aktualisieren ohne Neuzeichnen (z. B. neue Stufe), damit Eingabefelder den Fokus behalten. |
| `interaction: 'buzzer'` | Sonderablauf „erster gewinnt“ (nur der Buzzer). |
| `game: { start, tick, … }` | Mini-Spiel mit eigenem Spielstand (`state.game`), den das Moderator-Gerät führt und über `engine.setGame()` an alle verteilt (Beispiel: `time-duel.js`). `render` bekommt `ctx.game`, `ctx.players`, `ctx.role`. |
| `scoresAllPlayers: true` | Punkte für alle Spieler, auch ohne eigene Antwort (z. B. nach Platzierung). |
