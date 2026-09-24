(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  const expectedFor = (cards, i) => cards[i + 1].value >= cards[i].value ? 'higher' : 'lower';
  const cardValue = card => `${card.value}${card.unit ? ` ${card.unit}` : ''}`;

  window.SylasphereTypes.register({
    type: 'higher-lower',
    label: 'Higher / Lower',
    icon: '↗',
    hidden: true, // v24: aus der Auswahl entfernt (Feedback Quizabend), bestehende Fragen laufen weiter
    description: 'Werte paarweise als höher oder niedriger einschätzen.',

    defaults: () => {
      const uid = window.SchmobinApp.uid;
      return { cards: [{ id: uid('card'), label: 'Karte A', value: 10, unit: '' }, { id: uid('card'), label: 'Karte B', value: 20, unit: '' }] };
    },

    normalize(q) {
      const cards = Array.isArray(q.cards) ? q.cards : [];
      q.cards = cards.map((card, i) => ({
        id: String(card?.id || `card_${i + 1}`),
        label: String(card?.label ?? card?.title ?? card?.name ?? `Karte ${i + 1}`),
        value: Kit.numberOr(card?.value, 0),
        unit: String(card?.unit ?? q.unit ?? '')
      }));
    },

    validate(q, report) {
      if (!Array.isArray(q.cards) || q.cards.length < 2) report.error('cards', 'Higher / Lower benötigt mindestens zwei Karten.');
      if ((q.cards || []).some(card => !String(card.label || '').trim())) report.error('cards', 'Alle Karten benötigen eine Bezeichnung.');
      if ((q.cards || []).some(card => !Number.isFinite(Number(card.value)))) report.error('cards', 'Alle Kartenwerte müssen numerisch sein.');
      const cardIds = (q.cards || []).map(card => String(card.id || '').trim()).filter(Boolean);
      if (new Set(cardIds).size !== cardIds.length) report.error('cards', 'Higher-/Lower-Karten enthalten doppelte IDs.');
      if ((q.cards || []).some((card, index, cards) => index > 0 && Number(card.value) === Number(cards[index - 1].value))) report.warn('cards', 'Zwei aufeinanderfolgende Higher-/Lower-Karten haben denselben Wert; „höher oder niedriger“ wäre dadurch uneindeutig.');
    },

    score(q, answer, { base }) {
      const guesses = Array.isArray(answer) ? answer : [];
      const cards = q.cards || [];
      let correctCount = 0;
      for (let i = 0; i < cards.length - 1; i++) if (guesses[i] === expectedFor(cards, i)) correctCount++;
      const total = Math.max(0, cards.length - 1);
      return { points: total ? Math.round(base * correctCount / total) : 0, detail: `${correctCount}/${total} richtig` };
    },

    solutionText(q) { return (q.cards || []).map(c => `${c.label}: ${cardValue(c)}`).join(' · '); },
    answerLabel(q, answer) { return (Array.isArray(answer) ? answer : []).map(value => value === 'higher' ? 'Höher' : value === 'lower' ? 'Niedriger' : '–').join(' · '); },

    render(q, container, ctx) {
      const { el, escapeHTML } = Kit;
      const wrap = Kit.baseQuestion(q);
      const cards = q.cards || [];
      const guesses = Array.isArray(ctx.currentAnswer) ? ctx.currentAnswer.slice() : Array(Math.max(0, cards.length - 1)).fill(null);
      const stack = el('div', 'hl-stack');
      for (let i = 0; i < cards.length - 1; i++) {
        const row = el('div', 'hl-row');
        const left = el('div', 'hl-card'); left.innerHTML = `<strong>${escapeHTML(cards[i].label)}</strong><span>${escapeHTML(cardValue(cards[i]))}</span>`;
        const compare = el('div', 'hl-compare');
        const higher = el('button', 'btn btn--small', 'Höher'); const lower = el('button', 'btn btn--small', 'Niedriger');
        higher.type = lower.type = 'button'; higher.disabled = lower.disabled = Boolean(ctx.readOnly);
        const right = el('div', 'hl-card hl-card--mystery');
        right.innerHTML = `<strong>${escapeHTML(cards[i + 1].label)}</strong><span>${ctx.reveal ? escapeHTML(cardValue(cards[i + 1])) : '?'}</span>`;
        const expected = expectedFor(cards, i);
        const update = value => {
          guesses[i] = value;
          higher.classList.toggle('is-selected', value === 'higher'); lower.classList.toggle('is-selected', value === 'lower');
          ctx.onAnswer?.(guesses.slice());
        };
        higher.addEventListener('click', () => update('higher')); lower.addEventListener('click', () => update('lower'));
        higher.classList.toggle('is-selected', guesses[i] === 'higher'); lower.classList.toggle('is-selected', guesses[i] === 'lower');
        if (ctx.reveal) {
          (expected === 'higher' ? higher : lower).classList.add('is-correct');
          if (guesses[i] && guesses[i] !== expected) (guesses[i] === 'higher' ? higher : lower).classList.add('is-wrong');
        }
        compare.append(higher, lower); row.append(left, compare, right); stack.append(row);
      }
      wrap.append(stack); container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      const { div, input, button } = ui;
      const list = div('');
      list.append(div('card-row card-row--head', ''));
      list.lastChild.innerHTML = '<span>Begriff</span><span>Wert</span><span>Einheit (optional)</span><span></span>';
      (q.cards || []).forEach((card, i) => {
        const row = div('card-row');
        const label = input('text', card.label, 'input'); label.placeholder = 'Begriff, z. B. Schloss Einstein'; label.title = 'Begriff'; label.addEventListener('input', e => { card.label = e.target.value; ui.queueSave(); });
        const value = input('number', card.value, 'input'); value.step = 'any'; value.placeholder = 'Wert'; value.title = 'Wert, der verglichen wird'; value.addEventListener('input', e => { card.value = Number(e.target.value); ui.queueSave(); });
        const unit = input('text', card.unit || '', 'input'); unit.placeholder = 'Einheit (optional)'; unit.title = 'Einheit, z. B. m, km, € – bleibt leer bei Jahreszahlen'; unit.addEventListener('input', e => { card.unit = e.target.value; ui.queueSave(); });
        row.append(label, value, unit, button('✕', 'icon-btn', () => { q.cards.splice(i, 1); ui.structuralChange(); }));
        list.append(row);
      });
      box.append(list, button('+ Karte', 'btn btn--small', () => {
        q.cards = q.cards || [];
        q.cards.push({ id: window.SchmobinApp.uid('card'), label: `Karte ${q.cards.length + 1}`, value: 0, unit: '' });
        ui.structuralChange();
      }));
    }
  });
})();
