(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'image-quiz',
    label: 'Bilderquiz',
    icon: '▣',
    description: 'Bild plus Antwortoptionen – ideal für Orte, Logos oder Details.',

    defaults: () => ({ options: Kit.defaultOptions(), correctAnswer: 'a', image: './assets/demo-landmark.svg' }),

    normalize(q) {
      q.options = Kit.normalizeOptions(q.options || q.answers);
      if (q.correctAnswer == null && q.correct != null) q.correctAnswer = q.correct;
      q.image = String(q.image ?? q.imageUrl ?? '');
      q.imageAlt = String(q.imageAlt ?? '');
    },

    validate(q, report) {
      Kit.validateOptions(q, report, { needsCorrect: true });
      if (!String(q.image || '').trim()) report.error('image', 'Bilderquiz benötigt eine Bildquelle.');
    },

    score(q, answer, { base }) {
      const correct = Kit.correctOption(q);
      const hit = Boolean(correct && String(answer ?? '') === String(correct.id));
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    solutionText(q) { const option = Kit.correctOption(q); return option ? option.text : String(q.correctAnswer ?? ''); },
    answerLabel(q, answer) { return Kit.optionById(q, answer)?.text || String(answer ?? ''); },

    render(q, container, ctx) {
      const correct = Kit.correctOption(q);
      Kit.renderChoice(q, container, ctx, { media: 'image', winners: correct ? [correct.id] : [] });
    },

    editor(q, ui, box) {
      box.append(Kit.textField(q, ui, 'image', 'Bildquelle', './assets/bild.jpg oder https://…'));
      Kit.choiceEditor(q, ui, box, 'correct');
    },
    stats: Kit.choiceStats
  });
})();
