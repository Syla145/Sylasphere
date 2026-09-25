(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  // ---- Treffer zählen: exakt, Nachname/Einzelwort (z. B. „Obama“) oder mit kleinem Tippfehler (Vergleich in kit.js)
  function entriesOf(answer) { return (Array.isArray(answer) ? answer : String(answer || '').split(/[\n,;]/)).map(v => String(v).trim()).filter(Boolean); }
  /** { count, items: [{ term, kind: 'exact'|'fuzzy'|'none'|'double', solution }] } */
  function countMatches(q, answer) {
    const solutions = (q.correctAnswers || []).map(String);
    const used = new Set();
    const seen = new Set();
    const items = entriesOf(answer).map(term => {
      const t = Kit.cleanTerm(term);
      if (!t) return { term, kind: 'none' };
      if (seen.has(t)) return { term, kind: 'double' };
      seen.add(t);
      const match = Kit.matchTerm(term, solutions, used);
      if (match.kind === 'none') return { term, kind: 'none' };
      used.add(match.index);
      return { term, kind: match.kind, solution: match.solution };
    });
    return { count: items.filter(i => i.kind === 'exact' || i.kind === 'fuzzy').length, items };
  }

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

    // v23: Das System zählt die Treffer (auch mit kleinen Tippfehlern), der Moderator kann die Zahl anpassen.
    review: 'count',
    countMatches,
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),

    // Punkte = Treffer × Punkte je Treffer, höchstens „Punkte“ der Frage (Obergrenze)
    score(q, answer, { base, result, playerId }) {
      const reviewed = result?.verdicts?.[playerId];
      const matches = Number.isFinite(Number(reviewed)) && reviewed !== null && reviewed !== '' ? Math.max(0, Math.round(Number(reviewed))) : countMatches(q, answer).count;
      const perHit = Kit.numberOr(q.pointsPerAnswer, base);
      const points = base > 0 ? Math.min(base, Math.round(matches * perHit)) : Math.round(matches * perHit);
      return { points, detail: `${matches} Treffer` };
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
      grid.append(ui.labelField('Max. Eingaben der Spieler', max), ui.labelField('Punkte je Treffer', ppa));
      box.append(grid);
      const help = ui.div('editor-help');
      const updateHelp = () => {
        const per = Number(q.pointsPerAnswer) || 0; const cap = Number(q.points) || 0;
        help.textContent = cap > 0 && per > 0
          ? `Jeder Treffer bringt ${per} Punkte. „Punkte“ oben (${cap}) ist die Obergrenze – ab ${Math.ceil(cap / per)} Treffern gibt es keine weiteren Punkte. Soll jeder Treffer zählen, „Punkte“ oben auf 0 setzen. Beim Auflösen schlägt das System die Trefferzahl vor (auch mit kleinen Tippfehlern), du kannst sie pro Spieler anpassen.`
          : 'Jeder Treffer bringt die „Punkte je Treffer“ – ohne Obergrenze. Beim Auflösen schlägt das System die Trefferzahl vor, du kannst sie pro Spieler anpassen.';
      };
      updateHelp();
      ppa.addEventListener('input', updateHelp);
      box.append(help);
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
