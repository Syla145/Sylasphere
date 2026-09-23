(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  const OPTIONS = [{ id: 'true', text: 'Wahr' }, { id: 'false', text: 'Falsch' }];
  // Akzeptiert true/false, "wahr"/"falsch", "richtig", "ja"/"nein", 1/0
  function toId(value) {
    const v = String(value ?? '').trim().toLocaleLowerCase('de-DE');
    if (['true', 'wahr', 'richtig', 'ja', '1'].includes(v)) return 'true';
    if (['false', 'falsch', 'nein', '0'].includes(v)) return 'false';
    return '';
  }

  window.SylasphereTypes.register({
    type: 'true-false',
    label: 'Wahr oder falsch',
    icon: '⚖',
    description: 'Eine Aussage ist wahr oder falsch – schnell und ideal zum Auflockern.',

    defaults: () => ({ text: 'Der Eiffelturm steht in Paris.', correctAnswer: 'true' }),

    normalize(q) {
      q.options = OPTIONS.map(option => Object.assign({}, option));
      q.correctAnswer = toId(q.correctAnswer ?? q.correct ?? q.answer);
    },

    validate(q, report) {
      if (!['true', 'false'].includes(q.correctAnswer)) report.error('correctAnswer', 'Bitte festlegen, ob die Aussage wahr oder falsch ist.');
    },

    score(q, answer, { base }) {
      const hit = Boolean(q.correctAnswer) && toId(answer) === q.correctAnswer;
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    solutionText: q => (q.correctAnswer === 'true' ? 'Wahr' : q.correctAnswer === 'false' ? 'Falsch' : ''),
    answerLabel: (q, answer) => ({ true: 'Wahr', false: 'Falsch' })[toId(answer)] || '–',

    render(q, container, ctx) {
      const options = q.options?.length ? q.options : OPTIONS;
      Kit.renderChoice(Object.assign({}, q, { options }), container, ctx, { winners: q.correctAnswer ? [q.correctAnswer] : [] });
      container.querySelector('.answer-grid')?.classList.add('answer-grid--tf');
    },

    editor(q, ui, box) {
      const row = ui.div('tf-editor');
      OPTIONS.forEach(option => {
        const label = document.createElement('label');
        label.className = `tf-choice${q.correctAnswer === option.id ? ' is-selected' : ''}`;
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = `tf_${q.id}`; radio.value = option.id; radio.checked = q.correctAnswer === option.id;
        radio.addEventListener('change', () => { q.correctAnswer = option.id; ui.structuralChange(); });
        label.append(radio, document.createTextNode(option.id === 'true' ? '✓ Aussage ist wahr' : '✗ Aussage ist falsch'));
        row.append(label);
      });
      box.append(ui.div('editor-help', 'Formuliere die Frage als Aussage und lege fest, ob sie stimmt.'), row);
    },

    stats: Kit.choiceStats
  });
})();
