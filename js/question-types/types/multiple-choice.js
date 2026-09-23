(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'multiple-choice',
    label: 'Multiple Choice',
    icon: '◉',
    description: 'Klassische Auswahl mit einer richtigen Antwort.',

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
