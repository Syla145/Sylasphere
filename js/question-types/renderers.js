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
    const wrap = el('div', `question-shell question-type-${question.type}`);
    wrap.style.setProperty('--cat-hue', String(Quiz.categoryHue(question.category)));
    const meta = el('div', 'question-meta');
    meta.append(el('span', 'pill pill--category', question.category || 'Ohne Kategorie'));
    meta.append(el('span', 'pill pill--type', `${Quiz.TYPE_ICONS[question.type] || '•'} ${Quiz.TYPE_LABELS[question.type] || question.type}`));
    meta.append(el('span', 'pill', `${question.points} Punkte`));
    if (question.timer > 0) meta.append(el('span', 'pill', `${question.timer}s`));
    wrap.append(meta, el('h2', 'question-title', question.text));
    return wrap;
  }
  function correctChoiceIds(question, ctx) {
    if (question.type === 'consensus') return (ctx.result?.winningOptionIds || []).map(String);
    if (question.type === 'survey') return Quiz.surveyWinnerIds(question);
    const direct = Quiz.correctOption(question);
    return direct ? [String(direct.id)] : [];
  }
  function addImage(question, wrap) {
    const src = App.sanitizeURL(question.image || question.imageUrl || '');
    if (!src) return;
    const figure = el('figure', 'question-image');
    const img = document.createElement('img');
    img.src = src;
    img.alt = question.imageAlt || 'Bild zur Quizfrage';
    img.loading = 'eager';
    figure.append(img);
    wrap.append(figure);
  }
  function addAudio(question, wrap) {
    const src = App.sanitizeURL(question.audio || question.audioUrl || '');
    const card = el('div', 'audio-card');
    card.append(el('div', 'audio-icon', '♪'));
    const body = el('div', 'audio-body');
    body.append(el('strong', '', question.audioLabel || 'Audio-Hinweis'));
    if (src) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = src;
      audio.setAttribute('playsinline', '');
      body.append(audio);
    } else {
      body.append(el('span', 'microcopy', 'Keine Audioquelle hinterlegt.'));
    }
    card.append(body);
    wrap.append(card);
  }
  function renderChoice(question, container, ctx, media = '') {
    const wrap = baseQuestion(question);
    if (media === 'image') addImage(question, wrap);
    if (media === 'audio') addAudio(question, wrap);
    const grid = el('div', 'answer-grid');
    let selected = ctx.currentAnswer ?? null;
    const winners = new Set(correctChoiceIds(question, ctx));
    const voteCounts = ctx.result?.counts || {};
    const maxSurvey = Math.max(1, ...(question.options || []).map(option => Number(option.value) || 0));

    (question.options || []).forEach((option, index) => {
      const button = el('button', 'answer-btn');
      button.type = 'button';
      button.dataset.answerId = option.id;
      const detail = question.type === 'survey' && ctx.reveal
        ? `<small>${App.escapeHTML(option.value)}%</small>`
        : question.type === 'consensus' && ctx.reveal
          ? `<small>${Math.round(Number(voteCounts[option.id]) || 0)} Stimme${Number(voteCounts[option.id]) === 1 ? '' : 'n'}</small>`
          : '';
      button.innerHTML = `<span class="answer-index">${String.fromCharCode(65 + index)}</span><span class="answer-copy"><b>${App.escapeHTML(option.text)}</b>${detail}</span>`;
      if (String(selected) === String(option.id)) button.classList.add('is-selected');
      if (ctx.reveal && winners.size) {
        if (winners.has(String(option.id))) button.classList.add('is-correct');
        else if (String(selected) === String(option.id)) button.classList.add('is-wrong');
      }
      if (question.type === 'survey' && ctx.reveal) {
        button.style.setProperty('--answer-strength', `${Math.max(4, Math.round((Number(option.value) || 0) / maxSurvey * 100))}%`);
        button.classList.add('has-strength');
      }
      if (ctx.readOnly) button.disabled = true;
      button.addEventListener('click', () => {
        selected = option.id;
        grid.querySelectorAll('.answer-btn').forEach(b => b.classList.toggle('is-selected', b === button));
        ctx.onAnswer?.(selected);
      });
      grid.append(button);
    });
    if (question.type === 'consensus' && !ctx.reveal) wrap.append(el('p', 'question-hint', '🎯 Ziel: Wähle die Antwort, von der du glaubst, dass die meisten anderen sie ebenfalls wählen.'));
    if (question.type === 'survey' && !ctx.reveal) wrap.append(el('p', 'question-hint', '📊 Gesucht ist die häufigste Antwort aus der hinterlegten Publikums-Umfrage.'));
    wrap.append(grid);
    container.replaceChildren(wrap);
  }
  function renderEstimate(question, container, ctx) {
    const wrap = baseQuestion(question);
    const block = el('div', 'estimate-block');
    const min = Number(question.min); const max = Number(question.max); const step = Number(question.step || 1);
    let value = Number(ctx.currentAnswer);
    if (!Number.isFinite(value)) value = min + (max - min) / 2;
    const output = el('output', 'estimate-value', `${value}${question.unit ? ` ${question.unit}` : ''}`);
    const rangeWrap = el('div', 'range-wrap');
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; input.disabled = Boolean(ctx.readOnly);
    input.className = 'estimate-range';
    if (ctx.reveal) {
      const target = App.clamp((Number(question.correctAnswer) - min) / Math.max(0.000001, max - min) * 100, 0, 100);
      const marker = el('span', 'range-target'); marker.style.left = `${target}%`; marker.title = `Lösung: ${question.correctAnswer}${question.unit ? ` ${question.unit}` : ''}`;
      rangeWrap.append(marker);
    }
    rangeWrap.append(input);
    const labels = el('div', 'range-labels'); labels.innerHTML = `<span>${App.escapeHTML(min)}${question.unit ? ` ${App.escapeHTML(question.unit)}` : ''}</span><span>${App.escapeHTML(max)}${question.unit ? ` ${App.escapeHTML(question.unit)}` : ''}</span>`;
    input.addEventListener('input', () => { value = Number(input.value); output.textContent = `${value}${question.unit ? ` ${question.unit}` : ''}`; ctx.onAnswer?.(value); });
    block.append(output, rangeWrap, labels); wrap.append(block); container.replaceChildren(wrap);
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
    const correct = question.correctOrder || question.items || [];
    values.forEach((value, index) => {
      const item = el('li', 'sort-item'); item.dataset.value = value; item.draggable = !ctx.readOnly;
      if (ctx.reveal) item.classList.add(Quiz.normalizeTerm(value) === Quiz.normalizeTerm(correct[index]) ? 'is-correct' : 'is-wrong');
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
    field.append(label, textarea); wrap.append(field);
    if (ctx.reveal) {
      const answers = el('div', 'solution-chips');
      (question.correctAnswers || []).forEach(answer => answers.append(el('span', 'chip chip--solution', answer)));
      wrap.append(el('p', 'question-hint', 'Gültige Lösungen:'), answers);
    }
    container.replaceChildren(wrap);
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
      const expected = cards[i + 1].value >= cards[i].value ? 'higher' : 'lower';
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
  }
  function renderHotspot(question, container, ctx) {
    const wrap = baseQuestion(question);
    const src = App.sanitizeURL(question.image || question.imageUrl || '');
    if (!src) {
      wrap.append(el('div', 'empty-state compact', 'Keine Bildquelle für diese Hotspot-Frage.'));
      container.replaceChildren(wrap); return;
    }
    const stage = el('div', `hotspot-stage${ctx.readOnly ? ' is-readonly' : ''}`);
    const img = document.createElement('img'); img.src = src; img.alt = question.imageAlt || 'Hotspot-Bild'; img.draggable = false;
    stage.append(img);
    let answer = ctx.currentAnswer && typeof ctx.currentAnswer === 'object' ? { x: Number(ctx.currentAnswer.x), y: Number(ctx.currentAnswer.y) } : null;
    const answerMarker = el('span', 'hotspot-marker hotspot-marker--answer');
    const placeAnswer = point => {
      answer = point;
      answerMarker.style.left = `${point.x}%`; answerMarker.style.top = `${point.y}%`; answerMarker.hidden = false;
    };
    if (answer && Number.isFinite(answer.x) && Number.isFinite(answer.y)) placeAnswer(answer); else answerMarker.hidden = true;
    stage.append(answerMarker);
    if (ctx.reveal) {
      const zone = el('span', 'hotspot-zone');
      zone.style.left = `${question.targetX}%`; zone.style.top = `${question.targetY}%`;
      zone.style.width = `${question.radius * 2}%`; zone.style.height = `${question.radius * 2}%`;
      const target = el('span', 'hotspot-marker hotspot-marker--target');
      target.style.left = `${question.targetX}%`; target.style.top = `${question.targetY}%`;
      stage.append(zone, target);
    }
    if (!ctx.readOnly) {
      stage.tabIndex = 0; stage.setAttribute('role', 'button'); stage.setAttribute('aria-label', 'Zielpunkt im Bild auswählen');
      stage.addEventListener('pointerup', event => {
        const rect = stage.getBoundingClientRect();
        const point = {
          x: Number(App.clamp((event.clientX - rect.left) / rect.width * 100, 0, 100).toFixed(2)),
          y: Number(App.clamp((event.clientY - rect.top) / rect.height * 100, 0, 100).toFixed(2))
        };
        placeAnswer(point); ctx.onAnswer?.(point);
      });
    }
    wrap.append(stage, el('p', 'question-hint', ctx.reveal ? '⌖ Der Zielbereich ist eingeblendet.' : '⌖ Tippe oder klicke auf die gesuchte Stelle im Bild.'));
    container.replaceChildren(wrap);
  }

  const renderers = {
    'multiple-choice': { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx) },
    'image-quiz': { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx, 'image') },
    'audio-quiz': { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx, 'audio') },
    estimate: { renderPlayer: renderEstimate },
    sort: { renderPlayer: renderSort },
    'fight-list': { renderPlayer: renderFightList },
    'higher-lower': { renderPlayer: renderHigherLower },
    survey: { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx) },
    consensus: { renderPlayer: (q, c, ctx) => renderChoice(q, c, ctx) },
    hotspot: { renderPlayer: renderHotspot }
  };
  Object.values(renderers).forEach(renderer => { renderer.renderModerator = renderer.renderPlayer; });

  function renderPlayer(question, container, context = {}) {
    const renderer = renderers[question?.type];
    if (!renderer) {
      const box = el('div', 'empty-state'); box.textContent = `Fragetyp „${question?.type || '?'}“ wird nicht unterstützt.`; container.replaceChildren(box); return;
    }
    renderer.renderPlayer(question, container, Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: false, reveal: false, result: null }, context));
  }
  function renderModerator(question, container, context = {}) {
    const renderer = renderers[question?.type];
    if (!renderer) return renderPlayer(question, container, { readOnly: true });
    renderer.renderModerator(question, container, Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: true, reveal: true, result: null }, context));
  }

  window.SchmobinRenderers = { renderers, renderPlayer, renderModerator };
})();
