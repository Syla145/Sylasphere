(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'fight-list',
    label: 'Fight List',
    icon: '✎',
    description: 'Mehrere freie Begriffe sammeln; jeder Treffer zählt.',

    defaults: () => ({ correctAnswers: ['Begriff 1', 'Begriff 2'], maxEntries: 4, pointsPerAnswer: 50 }),

    normalize(q) {
      const answers = q.correctAnswers || q.answers || q.solutions || [];
      q.correctAnswers = Array.isArray(answers) ? answers.map(String) : [];
      q.pointsPerAnswer = Kit.numberOr(q.pointsPerAnswer, q.correctAnswers.length ? q.points / q.correctAnswers.length : q.points);
      q.maxEntries = Math.max(1, Math.round(Kit.numberOr(q.maxEntries, q.correctAnswers.length || 5)));
    },

    validate(q, report) {
      if (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length) report.error('correctAnswers', 'Fight List benötigt mindestens eine richtige Lösung.');
      if (!Number.isFinite(Number(q.pointsPerAnswer)) || Number(q.pointsPerAnswer) < 0) report.error('pointsPerAnswer', 'Punkte je Treffer müssen ≥ 0 sein.');
    },

    // Jeder gültige Begriff zählt einmal; Groß-/Kleinschreibung und Leerzeichen sind egal
    score(q, answer, { base }) {
      const entries = Array.isArray(answer) ? answer : String(answer || '').split(/[\n,;]/);
      const submitted = Array.from(new Set(entries.map(Kit.normalizeTerm).filter(Boolean)));
      const correct = new Set((q.correctAnswers || []).map(Kit.normalizeTerm));
      const matches = submitted.filter(item => correct.has(item)).length;
      return { points: Math.min(base, Math.round(matches * Kit.numberOr(q.pointsPerAnswer, base))), detail: `${matches} Treffer` };
    },

    solutionText(q) { return (q.correctAnswers || []).join(', '); },
    answerLabel(q, answer) { return Array.isArray(answer) ? answer.join(' · ') : String(answer ?? ''); },

    render(q, container, ctx) {
      const { el } = Kit;
      const wrap = Kit.baseQuestion(q);
      const field = el('div', 'field-group');
      const label = el('label', 'field-label', `Begriffe eingeben (max. ${q.maxEntries || q.correctAnswers?.length || 5})`);
      const textarea = document.createElement('textarea'); textarea.className = 'input textarea'; textarea.rows = 6; textarea.placeholder = 'Ein Begriff pro Zeile oder durch Komma getrennt'; textarea.disabled = Boolean(ctx.readOnly);
      textarea.value = Array.isArray(ctx.currentAnswer) ? ctx.currentAnswer.join('\n') : (ctx.currentAnswer || '');
      const parse = () => String(textarea.value).split(/[\n,;]/).map(v => v.trim()).filter(Boolean).slice(0, q.maxEntries || 99);
      textarea.addEventListener('input', () => ctx.onAnswer?.(parse()));
      field.append(label, textarea); wrap.append(field);
      if (ctx.reveal) {
        const answers = el('div', 'solution-chips');
        (q.correctAnswers || []).forEach(answer => answers.append(el('span', 'chip chip--solution', answer)));
        wrap.append(el('p', 'question-hint', 'Gültige Lösungen:'), answers);
      }
      container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 6; area.value = (q.correctAnswers || []).join('\n');
      area.addEventListener('input', e => { q.correctAnswers = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); ui.queueSave(); });
      box.append(ui.labelField('Gültige Lösungen – ein Begriff pro Zeile', area));
      const grid = ui.div('dynamic-grid');
      const max = ui.input('number', q.maxEntries || 5, 'input'); max.min = '1'; max.addEventListener('input', e => { q.maxEntries = Math.max(1, Math.round(Number(e.target.value) || 1)); ui.queueSave(); });
      const ppa = ui.input('number', q.pointsPerAnswer || 0, 'input'); ppa.min = '0'; ppa.addEventListener('input', e => { q.pointsPerAnswer = ui.nonNegative(e.target.value, 0); ui.queueSave(); });
      grid.append(ui.labelField('Max. Eingaben', max), ui.labelField('Punkte je Treffer', ppa));
      box.append(grid);
    },

    stats: {
      aggregate(q, records) {
        const terms = new Map();
        records.flatMap(record => Array.isArray(record?.answer) ? record.answer : []).forEach(value => {
          const key = Kit.normalizeTerm(value);
          if (key) terms.set(key, (terms.get(key) || 0) + 1);
        });
        return { kind: 'fight-list', top: [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([term, count]) => ({ term, count })) };
      },
      render(stats) {
        return `<div class="chip-row large">${(stats.top || []).map(item => `<span class="chip">${Kit.escapeHTML(item.term)} <b>${item.count}×</b></span>`).join('')}</div>`;
      }
    }
  });
})();
