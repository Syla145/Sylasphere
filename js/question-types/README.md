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
    type: 'true-false',                 // = Dateiname
    label: 'Wahr oder falsch',          // Anzeige in Editor und Frage
    icon: '✓',
    description: 'Eine Aussage ist wahr oder falsch.',
    solutionLabel: 'Lösung',            // optional, z. B. 'Top-Antwort'

    // Startwerte für eine neue Frage im Editor
    defaults: () => ({ correctAnswer: true }),

    // Eingelesene Daten aufräumen (Pflichtfelder, alte Feldnamen …)
    normalize(q) { q.correctAnswer = q.correctAnswer === true || q.correctAnswer === 'true'; },

    // Fehler/Hinweise für „Quiz prüfen“
    validate(q, report) { if (typeof q.correctAnswer !== 'boolean') report.error('correctAnswer', 'Lösung fehlt.'); },

    // Punkte ohne Runden-Multiplikator (den rechnet der Kern drauf). base = Punkte der Frage
    score(q, answer, { base }) {
      const hit = answer === q.correctAnswer;
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    solutionText: q => (q.correctAnswer ? 'Wahr' : 'Falsch'),
    answerLabel: (q, answer) => (answer === true ? 'Wahr' : answer === false ? 'Falsch' : '–'),

    // Anzeige für Spieler, Moderator und Zuschauer
    // ctx: { currentAnswer, readOnly, reveal, result, onAnswer(value), playerId }
    render(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      const grid = Kit.el('div', 'answer-grid');
      [[true, 'Wahr'], [false, 'Falsch']].forEach(([value, text]) => {
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
      select.innerHTML = '<option value="true">Wahr</option><option value="false">Falsch</option>';
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
| `interaction: 'buzzer'` | Sonderablauf „erster gewinnt“ (nur der Buzzer). |
