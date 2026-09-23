(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  function reorderItem(list, item, delta, ctx) {
    const items = Array.from(list.children); const index = items.indexOf(item); const target = index + delta;
    if (target < 0 || target >= items.length) return;
    if (delta < 0) list.insertBefore(item, items[target]); else list.insertBefore(items[target], item);
    ctx.onAnswer?.(Array.from(list.children).map(li => li.dataset.value));
  }
  /*
   * Drag & Drop für Sortierfragen auf Basis von Pointer Events (Maus, Touch, Stift).
   * - Maus/Stift: ganze Karte ziehen.
   * - Touch: sofort über den Griff (⠿) oder per kurzem Gedrückthalten auf der Karte,
   *   damit normales Scrollen der Seite weiterhin funktioniert.
   * - Während des Ziehens trägt die Liste die Klasse `is-sorting`; die Spieleransicht
   *   verschiebt eingehende Neu-Renderings bis zum Event `quiz:interaction-end`.
   */
  function enableSortDrag(list, ctx) {
    const LONG_PRESS_MS = 220;
    const EDGE = 72;
    let drag = null;
    let pending = null;
    const order = () => Array.from(list.children).map(li => li.dataset.value);
    const listY = clientY => clientY - list.getBoundingClientRect().top;
    const numberItems = () => Array.from(list.children).forEach((li, i) => { li.dataset.pos = String(i + 1); });

    function flipMove(mutate) {
      const siblings = Array.from(list.children).filter(li => li !== drag.item);
      const before = new Map(siblings.map(li => [li, li.offsetTop]));
      mutate();
      siblings.forEach(li => {
        const delta = before.get(li) - li.offsetTop;
        if (!delta) return;
        li.style.transition = 'none';
        li.style.transform = `translateY(${delta}px)`;
        void li.offsetHeight;
        li.style.transition = '';
        li.style.transform = '';
      });
      numberItems();
    }

    function position(clientY) {
      const item = drag.item;
      const top = listY(clientY) - drag.grab;
      const bottom = top + item.offsetHeight;
      let prev = item.previousElementSibling;
      while (prev && top < prev.offsetTop + prev.offsetHeight / 2) { const target = prev; flipMove(() => list.insertBefore(item, target)); prev = item.previousElementSibling; }
      let next = item.nextElementSibling;
      while (next && bottom > next.offsetTop + next.offsetHeight / 2) { const target = next; flipMove(() => list.insertBefore(item, target.nextElementSibling)); next = item.nextElementSibling; }
      const min = -item.offsetTop - 8;
      const max = list.clientHeight - item.offsetTop - item.offsetHeight + 8;
      item.style.transform = `translateY(${Kit.clamp(top - item.offsetTop, min, max)}px) scale(1.02)`;
    }

    function autoScroll() {
      if (!drag) return;
      const y = drag.lastY;
      const speed = y < EDGE ? -Math.ceil((EDGE - y) / 6) : y > window.innerHeight - EDGE ? Math.ceil((y - (window.innerHeight - EDGE)) / 6) : 0;
      if (speed) { window.scrollBy(0, speed); position(y); }
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function start(item, e) {
      cancelPending();
      if (ctx.readOnly || item.querySelector('button:disabled')) return;
      drag = { item, pointerId: e.pointerId, grab: listY(e.clientY) - item.offsetTop, lastY: e.clientY, startOrder: order().join('\u0000'), raf: 0 };
      // Hinweis: Kein setPointerCapture – das Verschieben im DOM würde die Capture lösen.
      // Stattdessen während des Ziehens global auf Pointer-Events hören.
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      list.classList.add('is-sorting');
      item.classList.add('is-dragging');
      numberItems();
      navigator.vibrate?.(8);
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function finish() {
      if (!drag) return;
      const { item, raf, startOrder } = drag;
      cancelAnimationFrame(raf);
      drag = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      item.style.transform = '';
      item.classList.remove('is-dragging');
      list.classList.remove('is-sorting');
      item.classList.add('is-dropped');
      setTimeout(() => item.classList.remove('is-dropped'), 260);
      if (order().join('\u0000') !== startOrder) ctx.onAnswer?.(order());
      list.dispatchEvent(new CustomEvent('quiz:interaction-end', { bubbles: true }));
    }

    function cancelPending() { if (pending) { clearTimeout(pending.timer); pending = null; } }

    list.addEventListener('pointerdown', e => {
      const item = e.target.closest('.sort-item');
      if (!item || drag || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const onHandle = Boolean(e.target.closest('.sort-handle'));
      if (e.pointerType !== 'touch' || onHandle) { e.preventDefault(); start(item, e); return; }
      pending = { item, pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer: setTimeout(() => { const p = pending; if (p) start(p.item, { pointerId: p.pointerId, clientY: p.y }); }, LONG_PRESS_MS) };
    });
    function onMove(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      e.preventDefault();
      drag.lastY = e.clientY;
      position(e.clientY);
    }
    function onEnd(e) { if (drag && e.pointerId === drag.pointerId) finish(); }
    // Long-Press abbrechen, sobald der Finger sich bewegt (= Scrollen) oder losgelassen wird.
    list.addEventListener('pointermove', e => {
      if (pending && e.pointerId === pending.pointerId && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 8) cancelPending();
    });
    ['pointerup', 'pointercancel'].forEach(type => list.addEventListener(type, e => { if (pending && e.pointerId === pending.pointerId) cancelPending(); }));
    // Verhindert, dass der Browser nach Aktivierung per Long-Press doch noch scrollt.
    list.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
    list.addEventListener('contextmenu', e => { if (drag || pending) e.preventDefault(); });
  }

  function renderSort(question, container, ctx) {
    const { el } = Kit;
    const wrap = Kit.baseQuestion(question);
    const list = el('ol', 'sort-list');
    let values = Array.isArray(ctx.currentAnswer) && ctx.currentAnswer.length ? ctx.currentAnswer.slice() : (question.items || []).slice();
    if (!ctx.currentAnswer && !ctx.readOnly) values = values.slice().sort(() => Math.random() - 0.5);
    const correct = question.correctOrder || question.items || [];
    if (!ctx.readOnly) { list.classList.add('is-interactive'); wrap.append(el('p', 'question-hint sort-hint', '↕ Ziehe die Karten in die richtige Reihenfolge.')); }
    values.forEach((value, index) => {
      const item = el('li', 'sort-item'); item.dataset.value = value; item.dataset.pos = String(index + 1);
      if (ctx.reveal) item.classList.add(Kit.normalizeTerm(value) === Kit.normalizeTerm(correct[index]) ? 'is-correct' : 'is-wrong');
      const label = el('span', 'sort-label', value);
      const controls = el('span', 'sort-controls');
      const up = el('button', 'icon-btn', '↑'); up.type = 'button'; up.title = 'Nach oben'; up.setAttribute('aria-label', `${value} nach oben`); up.disabled = Boolean(ctx.readOnly);
      const down = el('button', 'icon-btn', '↓'); down.type = 'button'; down.title = 'Nach unten'; down.setAttribute('aria-label', `${value} nach unten`); down.disabled = Boolean(ctx.readOnly);
      up.addEventListener('click', () => reorderItem(list, item, -1, ctx)); down.addEventListener('click', () => reorderItem(list, item, 1, ctx));
      controls.append(up, down);
      if (!ctx.readOnly) { const handle = el('span', 'sort-handle', '⠿'); handle.setAttribute('aria-hidden', 'true'); item.append(handle); }
      item.append(label, controls);
      list.append(item);
    });
    if (!ctx.readOnly) enableSortDrag(list, ctx);
    wrap.append(list); container.replaceChildren(wrap);
    if (!ctx.currentAnswer && !ctx.readOnly) ctx.onAnswer?.(Array.from(list.children).map(li => li.dataset.value));
  }

  window.SylasphereTypes.register({
    type: 'sort',
    label: 'Sortierquiz',
    icon: '↕',
    description: 'Elemente in die richtige Reihenfolge bringen.',

    defaults: () => ({ items: ['Element 1', 'Element 2', 'Element 3'], correctOrder: ['Element 1', 'Element 2', 'Element 3'] }),

    normalize(q) {
      const items = q.items || q.correctOrder || q.options || [];
      q.items = Array.isArray(items) ? items.map(String) : [];
      q.correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder.map(String) : q.items.slice();
    },

    validate(q, report) {
      if (!Array.isArray(q.correctOrder) || q.correctOrder.length < 2) report.error('correctOrder', 'Sortierquiz benötigt mindestens zwei Elemente.');
      const terms = (q.correctOrder || []).map(Kit.normalizeTerm);
      if (new Set(terms).size !== terms.length) report.warn('correctOrder', 'Sortierquiz enthält doppelte Elemente; die Auswertung kann dadurch unklar werden.');
    },

    // Jede richtige Position zählt anteilig
    score(q, answer, { base }) {
      const correct = q.correctOrder || q.items || [];
      const submitted = Array.isArray(answer) ? answer : [];
      const matched = correct.reduce((sum, item, i) => sum + (Kit.normalizeTerm(item) === Kit.normalizeTerm(submitted[i]) ? 1 : 0), 0);
      return { points: correct.length ? Math.round(base * matched / correct.length) : 0, detail: `${matched}/${correct.length} Positionen richtig` };
    },

    solutionText(q) { return (q.correctOrder || q.items || []).join(' → '); },
    answerLabel(q, answer) { return Array.isArray(answer) ? answer.join(' · ') : String(answer ?? ''); },
    // Spieler bekommen die Elemente gemischt; die richtige Reihenfolge (correctOrder) wird vom Kern entfernt
    hideSolution(pq) { if (Array.isArray(pq.items)) pq.items = pq.items.slice().sort(() => Math.random() - 0.5); },

    render: renderSort,

    editor(q, ui, box) {
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 6; area.value = (q.correctOrder || q.items || []).join('\n');
      area.addEventListener('input', e => { const values = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); q.correctOrder = values; q.items = values.slice(); ui.queueSave(); });
      box.append(ui.labelField('Korrekte Reihenfolge – ein Element pro Zeile', area));
    }
  });
})();
