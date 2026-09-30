(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'multiple-choice',
    label: 'Multiple Choice',
    icon: '◉',
    // v35: Erklärung für Spieler und Moderatoren (Neu-Karte, ?, Editor, spielmodi.html)
    help: {
      group: 'Wissen',
      short: 'Eine Frage, mehrere Antworten – genau eine ist richtig.',
      steps: [
        'Lies die Frage auf dem Beamer oder auf deinem Handy.',
        'Tippe auf die Antwort, die du für richtig hältst. Bis die Zeit abläuft, kannst du noch wechseln.'
      ],
      scoring: 'Richtig = volle Punkte, falsch oder keine Antwort = 0.',
      moderator: 'Der Klassiker für jede Runde und ideal zum Aufwärmen. Vorbereiten: Frage, 2–6 Antworten, eine davon als richtig markieren. Tipp: Die falschen Antworten sollten plausibel klingen, sonst wird es zu leicht.'
    },

    defaults: () => ({ options: Kit.defaultOptions(), correctAnswer: 'a' }),

    normalize(q) {
      q.options = Kit.normalizeOptions(q.options || q.answers);
      if (q.correctAnswer == null && q.correct != null) q.correctAnswer = q.correct;
    },

    validate(q, report) { Kit.validateOptions(q, report, { needsCorrect: true }); },

    score(q, answer, { base }) {
      const correct = Kit.correctOption(q);
      const hit = Boolean(correct && String(answer ?? '') === String(correct.id));
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    // v34: Themen-Brett / Einsatz-Finale – nur richtig oder falsch
    judge(q, answer) { const correct = Kit.correctOption(q); return Boolean(correct && String(answer ?? '') === String(correct.id)); },

    solutionText(q) { const option = Kit.correctOption(q); return option ? option.text : String(q.correctAnswer ?? ''); },
    answerLabel(q, answer) { return Kit.optionById(q, answer)?.text || String(answer ?? ''); },

    render(q, container, ctx) {
      const correct = Kit.correctOption(q);
      Kit.renderChoice(q, container, ctx, { winners: correct ? [correct.id] : [] });
    },

    editor(q, ui, box) { Kit.choiceEditor(q, ui, box, 'correct'); },
    stats: Kit.choiceStats
  });
})();
