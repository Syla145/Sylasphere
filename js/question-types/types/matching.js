(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * Zuordnen: Links feste Begriffe, rechts gemischte Gegenstücke.
   * Spieler wählen pro Zeile das passende Gegenstück. Jede richtige Zuordnung zählt anteilig.
   * Antwortformat: Array der gewählten rechten Texte in der Reihenfolge der linken Begriffe.
   */
  function pairsOf(q) { return (q.pairs || []).filter(p => String(p.left || '').trim() && String(p.right || '').trim()); }
  function leftsOf(q) { return q.pairs ? pairsOf(q).map(p => p.left) : (q.lefts || []); }
  function rightsOf(q) { return q.rights || Kit.seededShuffle(pairsOf(q).map(p => p.right), q.id); }

  window.SylasphereTypes.register({
    type: 'matching',
    label: 'Zuordnen',
    icon: '⇄',
    description: 'Begriffe richtig zuordnen, z. B. Land ↔ Hauptstadt. Jede richtige Zuordnung zählt.',

    defaults: () => ({
      text: 'Ordne jedem Land seine Hauptstadt zu.',
      pairs: [{ left: 'Frankreich', right: 'Paris' }, { left: 'Italien', right: 'Rom' }, { left: 'Spanien', right: 'Madrid' }]
    }),

    normalize(q) {
      const source = Array.isArray(q.pairs) ? q.pairs : [];
      q.pairs = source.map(pair => Array.isArray(pair)
        ? { left: String(pair[0] ?? ''), right: String(pair[1] ?? '') }
        : { left: String(pair?.left ?? pair?.a ?? ''), right: String(pair?.right ?? pair?.b ?? '') });
    },

    validate(q, report) {
      const pairs = q.pairs || [];
      if (pairs.length < 2) report.error('pairs', 'Zuordnen benötigt mindestens zwei Paare.');
      if (pairs.some(p => !String(p.left).trim() || !String(p.right).trim())) report.error('pairs', 'Alle Paare brauchen einen Begriff links und rechts.');
      const lefts = pairs.map(p => Kit.normalizeTerm(p.left));
      const rights = pairs.map(p => Kit.normalizeTerm(p.right));
      if (new Set(lefts).size !== lefts.length) report.error('pairs', 'Linke Begriffe müssen eindeutig sein.');
      if (new Set(rights).size !== rights.length) report.error('pairs', 'Rechte Begriffe müssen eindeutig sein – sonst wäre die Zuordnung mehrdeutig.');
    },

    score(q, answer, { base }) {
      const pairs = pairsOf(q);
      const given = Array.isArray(answer) ? answer : [];
      const hits = pairs.reduce((sum, pair, i) => sum + (Kit.normalizeTerm(given[i]) === Kit.normalizeTerm(pair.right) ? 1 : 0), 0);
      return { points: pairs.length ? Math.round(base * hits / pairs.length) : 0, detail: `${hits}/${pairs.length} richtig zugeordnet` };
    },

    solutionText: q => pairsOf(q).map(p => `${p.left} → ${p.right}`).join(' · '),
    answerLabel(q, answer) {
      const given = Array.isArray(answer) ? answer : [];
      return leftsOf(q).map((left, i) => `${left} → ${given[i] || '–'}`).join(' · ');
    },
    // Spieler bekommen nur linke Begriffe + gemischte rechte, nicht die Paare
    hideSolution(pq) {
      const pairs = pairsOf(pq);
      pq.lefts = pairs.map(p => p.left);
      pq.rights = Kit.seededShuffle(pairs.map(p => p.right), pq.id);
      delete pq.pairs;
    },

    render(q, container, ctx) {
      const { el } = Kit;
      const wrap = Kit.baseQuestion(q);
      const lefts = leftsOf(q);
      const rights = rightsOf(q);
      const correct = q.pairs ? pairsOf(q).map(p => p.right) : [];
      const given = Array.isArray(ctx.currentAnswer) ? ctx.currentAnswer.slice() : lefts.map(() => '');
      const list = el('div', 'match-list');
      const selects = [];
      const refreshUsed = () => {
        const used = new Set(given.filter(Boolean).map(Kit.normalizeTerm));
        selects.forEach((select, i) => Array.from(select.options).forEach(option => {
          if (!option.value) return;
          const taken = used.has(Kit.normalizeTerm(option.value)) && Kit.normalizeTerm(given[i]) !== Kit.normalizeTerm(option.value);
          option.textContent = taken ? `${option.value} (vergeben)` : option.value;
        }));
      };
      lefts.forEach((left, i) => {
        const row = el('div', 'match-row');
        row.append(el('div', 'match-left', left), el('div', 'match-arrow', '→'));
        const select = document.createElement('select');
        select.className = 'select match-select';
        select.disabled = Boolean(ctx.readOnly);
        select.setAttribute('aria-label', `Gegenstück zu ${left}`);
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '— wählen —';
        select.append(placeholder);
        rights.forEach(right => { const option = document.createElement('option'); option.value = right; option.textContent = right; select.append(option); });
        select.value = given[i] || '';
        select.addEventListener('change', () => {
          given[i] = select.value;
          refreshUsed();
          ctx.onAnswer?.(given.some(Boolean) ? given.slice() : null);
        });
        selects.push(select);
        const cell = el('div', 'match-right');
        cell.append(select);
        if (ctx.reveal && correct.length) {
          const ok = Kit.normalizeTerm(given[i]) === Kit.normalizeTerm(correct[i]);
          row.classList.add(ok ? 'is-correct' : 'is-wrong');
          if (!ok) cell.append(el('div', 'match-solution', `✓ ${correct[i]}`));
        }
        row.append(cell);
        list.append(row);
      });
      refreshUsed();
      wrap.append(list);
      if (!ctx.reveal && !ctx.readOnly) wrap.append(el('p', 'question-hint', '⇄ Wähle für jeden Begriff das passende Gegenstück.'));
      container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      const { div, input, button } = ui;
      box.append(div('editor-help', 'Links steht der Begriff, rechts das richtige Gegenstück. Spieler sehen die rechte Seite gemischt.'));
      const list = div('match-editor');
      (q.pairs || []).forEach((pair, i) => {
        const row = div('match-editor-row');
        const left = input('text', pair.left, 'input'); left.placeholder = 'Begriff';
        left.addEventListener('input', e => { pair.left = e.target.value; ui.queueSave(); });
        const right = input('text', pair.right, 'input'); right.placeholder = 'Gegenstück';
        right.addEventListener('input', e => { pair.right = e.target.value; ui.queueSave(); });
        row.append(left, div('match-arrow', '→'), right, button('✕', 'icon-btn', () => { q.pairs.splice(i, 1); ui.structuralChange(); }));
        list.append(row);
      });
      box.append(list, button('+ Paar', 'btn btn--small', () => { q.pairs = q.pairs || []; q.pairs.push({ left: '', right: '' }); ui.structuralChange(); }));
    }
  });
})();
