(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function baseQuestion(question) {
    const wrap = el('div', 'question-shell');
    const meta = el('div', 'question-meta');
    meta.append(el('span', 'pill pill--category', question.category || 'Ohne Kategorie'));
    meta.append(el('span', 'pill', `${question.points} Punkte`));
    if (question.timer > 0) meta.append(el('span', 'pill', `${question.timer}s`));
    wrap.append(meta, el('h2', 'question-title', question.text));
    return wrap;
  }
  function renderChoice(question, container, ctx, withImage) {
    const wrap = baseQuestion(question);
    if (withImage) {
      const src = App.sanitizeURL(question.image || question.imageUrl || '');
      if (src) {
        const figure = el('figure', 'question-image');
        const img = document.createElement('img');
        img.src = src; img.alt = question.imageAlt || 'Bild zur Quizfrage'; img.loading = 'eager';
        figure.append(img); wrap.append(figure);
      }
    }
    const grid = el('div', 'answer-grid');
    let selected = ctx.currentAnswer ?? null;
    (question.options || []).forEach((option, index) => {
      const button = el('button', 'answer-btn');
      button.type = 'button';
      button.dataset.answerId = option.id;
      button.innerHTML = `<span class="answer-index">${String.fromCharCode(65 + index)}</span><span>${App.escapeHTML(option.text)}</span>`;
      if (String(selected) === String(option.id)) button.classList.add('is-selected');
      if (ctx.readOnly) button.disabled = true;
      button.addEventListener('click', () => {
        selected = option.id;
        grid.querySelectorAll('.answer-btn').forEach(b => b.classList.toggle('is-selected', b === button));
        ctx.onAnswer?.(selected);
      });
      grid.append(button);
    });
    wrap.append(grid); container.replaceChildren(wrap);
  }
  function renderEstimate(question, container, ctx) {
    const wrap = baseQuestion(question);
    const block = el('div', 'estimate-block');
    const min = Number(question.min); const max = Number(question.max); const step = Number(question.step || 1);
    let value = Number(ctx.currentAnswer);
    if (!Number.isFinite(value)) value = min + (max - min) / 2;
    const output = el('output', 'estimate-value', `${value}${question.unit ? ` ${question.unit}` : ''}`);
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; input.disabled = Boolean(ctx.readOnly);
    input.className = 'estimate-range';
    const labels = el('div', 'range-labels'); labels.innerHTML = `<span>${App.escapeHTML(min)}${question.unit ? ` ${App.escapeHTML(question.unit)}` : ''}</span><span>${App.escapeHTML(max)}${question.unit ? ` ${App.escapeHTML(question.unit)}` : ''}</span>`;
    input.addEventListener('input', () => { value = Number(input.value); output.textContent = `${value}${question.unit ? ` ${question.unit}` : ''}`; ctx.onAnswer?.(value); });
    block.append(output, input, labels); wrap.append(block); container.replaceChildren(wrap);
    if (ctx.currentAnswer == null && !ctx.readOnly) ctx.onAnswer?.(value);
  }
  function reorderItem(list, item, delta, ctx) {
    const items = Array.from(list.children); const index = items.indexOf(item); const target = index + delta;
    if (target < 0 || target >= items.length) return;
    if (delta < 0) list.insertBefore(item, items[target]); else list.insertBefore(items[target], item);
    ctx.onAnswer?.(Array.from(list.children).map(li => li.dataset.value));
  }
  function renderSort(question, container, ctx) {
    const wrap = baseQuestion(question);
    const list = el('ol', 'sort-list');
    let values = Array.isArray(ctx.currentAnswer) && ctx.currentAnswer.length ? ctx.currentAnswer.slice() : (question.items || []).slice();
    if (!ctx.currentAnswer && !ctx.readOnly) values = values.slice().sort(() => Math.random() - 0.5);
    values.forEach(value => {
      const item = el('li', 'sort-item'); item.dataset.value = value; item.draggable = !ctx.readOnly;
      const label = el('span', 'sort-label', value);
      const controls = el('span', 'sort-controls');
      const up = el('button', 'icon-btn', '↑'); up.type = 'button'; up.title = 'Nach oben'; up.disabled = Boolean(ctx.readOnly);
      const down = el('button', 'icon-btn', '↓'); down.type = 'button'; down.title = 'Nach unten'; down.disabled = Boolean(ctx.readOnly);
      up.addEventListener('click', () => reorderItem(list, item, -1, ctx)); down.addEventListener('click', () => reorderItem(list, item, 1, ctx));
      controls.append(up, down); item.append(label, controls);
      item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', value); item.classList.add('is-dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
      item.addEventListener('dragover', e => {
        if (ctx.readOnly) return; e.preventDefault(); const dragging = list.querySelector('.is-dragging'); if (!dragging || dragging === item) return;
        const rect = item.getBoundingClientRect(); list.insertBefore(dragging, e.clientY < rect.top + rect.height / 2 ? item : item.nextSibling);
      });
      item.addEventListener('drop', e => { e.preventDefault(); ctx.onAnswer?.(Array.from(list.children).map(li => li.dataset.value)); });
      list.append(item);
    });
    wrap.append(list); container.replaceChildren(wrap);
    if (!ctx.currentAnswer && !ctx.readOnly) ctx.onAnswer?.(Array.from(list.children).map(li => li.dataset.value));
  }
  function renderFightList(question, container, ctx) {
    const wrap = baseQuestion(question);
    const field = el('div', 'field-group');
    const label = el('label', 'field-label', `Begriffe eingeben (max. ${question.maxEntries || question.correctAnswers?.length || 5})`);
    const textarea = document.createElement('textarea'); textarea.className = 'input textarea'; textarea.rows = 6; textarea.placeholder = 'Ein Begriff pro Zeile oder durch Komma getrennt'; textarea.disabled = Boolean(ctx.readOnly);
    if (Array.isArray(ctx.currentAnswer)) textarea.value = ctx.currentAnswer.join('\n'); else textarea.value = ctx.currentAnswer || '';
    const parse = () => String(textarea.value).split(/[\n,;]/).map(v => v.trim()).filter(Boolean).slice(0, question.maxEntries || 99);
    textarea.addEventListener('input', () => ctx.onAnswer?.(parse()));
    field.append(label, textarea); wrap.append(field); container.replaceChildren(wrap);
  }
  function renderHigherLower(question, container, ctx) {
    const wrap = baseQuestion(question);
    const cards = question.cards || [];
    const guesses = Array.isArray(ctx.currentAnswer) ? ctx.currentAnswer.slice() : Array(Math.max(0, cards.length - 1)).fill(null);
    const stack = el('div', 'hl-stack');
    for (let i = 0; i < cards.length - 1; i++) {
      const row = el('div', 'hl-row');
      const left = el('div', 'hl-card'); left.innerHTML = `<strong>${App.escapeHTML(cards[i].label)}</strong><span>${App.escapeHTML(cards[i].value)}${cards[i].unit ? ` ${App.escapeHTML(cards[i].unit)}` : ''}</span>`;
      const compare = el('div', 'hl-compare');
      const higher = el('button', 'btn btn--small', 'Höher'); const lower = el('button', 'btn btn--small', 'Niedriger');
      higher.type = lower.type = 'button'; higher.disabled = lower.disabled = Boolean(ctx.readOnly);
      const right = el('div', 'hl-card hl-card--mystery');
      right.innerHTML = `<strong>${App.escapeHTML(cards[i + 1].label)}</strong><span>${ctx.reveal ? `${App.escapeHTML(cards[i + 1].value)}${cards[i + 1].unit ? ` ${App.escapeHTML(cards[i + 1].unit)}` : ''}` : '?'}</span>`;
      const update = value => {
        guesses[i] = value;
        higher.classList.toggle('is-selected', value === 'higher'); lower.classList.toggle('is-selected', value === 'lower');
        ctx.onAnswer?.(guesses.slice());
      };
      higher.addEventListener('click', () => update('higher')); lower.addEventListener('click', () => update('lower'));
      higher.classList.toggle('is-selected', guesses[i] === 'higher'); lower.classList.toggle('is-selected', guesses[i] === 'lower');
      compare.append(higher, lower); row.append(left, compare, right); stack.append(row);
    }
    wrap.append(stack); container.replaceChildren(wrap);
  }

  const renderers = {
    'multiple-choice': { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx, false) },
    estimate: { renderPlayer: renderEstimate },
    'image-quiz': { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx, true) },
    sort: { renderPlayer: renderSort },
    'fight-list': { renderPlayer: renderFightList },
    'higher-lower': { renderPlayer: renderHigherLower }
  };
  Object.values(renderers).forEach(renderer => { renderer.renderModerator = renderer.renderPlayer; });

  function renderPlayer(question, container, context = {}) {
    const renderer = renderers[question?.type];
    if (!renderer) {
      const box = el('div', 'empty-state'); box.textContent = `Fragetyp „${question?.type || '?'}“ wird nicht unterstützt.`; container.replaceChildren(box); return;
    }
    renderer.renderPlayer(question, container, Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: false, reveal: false }, context));
  }
  function renderModerator(question, container, context = {}) {
    const renderer = renderers[question?.type];
    if (!renderer) return renderPlayer(question, container, { readOnly: true });
    renderer.renderModerator(question, container, Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: true, reveal: true }, context));
  }

  window.SchmobinRenderers = { renderers, renderPlayer, renderModerator };
})();
