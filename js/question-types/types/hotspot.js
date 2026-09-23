(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'hotspot',
    label: 'Hotspot',
    icon: '⌖',
    description: 'Auf einem Bild möglichst genau die gesuchte Position treffen.',
    solutionLabel: 'Zielbereich',
    // Der Moderator sieht den Zielbereich immer auf dem Bild
    moderatorAlwaysReveal: true,

    defaults: () => ({ image: './assets/demo-landmark.svg', targetX: 50, targetY: 50, radius: 10 }),

    normalize(q) {
      q.image = String(q.image ?? q.imageUrl ?? '');
      q.imageAlt = String(q.imageAlt ?? '');
      q.targetX = Math.min(100, Math.max(0, Kit.numberOr(q.targetX ?? q.x, 50)));
      q.targetY = Math.min(100, Math.max(0, Kit.numberOr(q.targetY ?? q.y, 50)));
      q.radius = Math.min(50, Math.max(1, Kit.numberOr(q.radius ?? q.tolerance, 10)));
    },

    validate(q, report) {
      if (!String(q.image || '').trim()) report.error('image', 'Hotspot benötigt eine Bildquelle.');
      if (!Number.isFinite(Number(q.targetX)) || Number(q.targetX) < 0 || Number(q.targetX) > 100) report.error('targetX', 'Ziel-X muss zwischen 0 und 100 liegen.');
      if (!Number.isFinite(Number(q.targetY)) || Number(q.targetY) < 0 || Number(q.targetY) > 100) report.error('targetY', 'Ziel-Y muss zwischen 0 und 100 liegen.');
      if (!Number.isFinite(Number(q.radius)) || Number(q.radius) <= 0 || Number(q.radius) > 50) report.error('radius', 'Trefferradius muss > 0 und ≤ 50 sein.');
    },

    score(q, answer, { base }) {
      const x = Number(answer?.x); const y = Number(answer?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { points: 0, detail: '' };
      const distance = Math.hypot(x - Number(q.targetX), y - Number(q.targetY));
      const hit = distance <= Number(q.radius);
      return { points: hit ? base : 0, detail: `${hit ? 'Treffer' : 'Daneben'} · Abstand ${Number(distance.toFixed(1))}%` };
    },

    solutionText: () => 'Markierter Zielbereich',
    moderatorSolution: () => ({ text: 'Grün markiert auf dem Bild' }),
    answerLabel(q, answer) {
      const x = Number(answer?.x), y = Number(answer?.y);
      return Number.isFinite(x) && Number.isFinite(y) ? `X ${x.toFixed(1)}% · Y ${y.toFixed(1)}%` : 'Kein Punkt gewählt';
    },
    // Zielposition vor der Auflösung verstecken
    hideSolution(pq) { delete pq.targetX; delete pq.targetY; delete pq.radius; },

    render(q, container, ctx) {
      const { el } = Kit;
      const App = window.SchmobinApp;
      const wrap = Kit.baseQuestion(q);
      const src = App.sanitizeURL(q.image || q.imageUrl || '');
      if (!src) {
        wrap.append(el('div', 'empty-state compact', 'Keine Bildquelle für diese Hotspot-Frage.'));
        container.replaceChildren(wrap); return;
      }
      const stage = el('div', `hotspot-stage${ctx.readOnly ? ' is-readonly' : ''}`);
      const img = document.createElement('img'); img.src = src; img.alt = q.imageAlt || 'Hotspot-Bild'; img.draggable = false;
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
        zone.style.left = `${q.targetX}%`; zone.style.top = `${q.targetY}%`;
        zone.style.width = `${q.radius * 2}%`; zone.style.height = `${q.radius * 2}%`;
        const target = el('span', 'hotspot-marker hotspot-marker--target');
        target.style.left = `${q.targetX}%`; target.style.top = `${q.targetY}%`;
        stage.append(zone, target);
      }
      if (!ctx.readOnly) {
        stage.tabIndex = 0; stage.setAttribute('role', 'button'); stage.setAttribute('aria-label', 'Zielpunkt im Bild auswählen');
        stage.addEventListener('pointerup', event => {
          const rect = stage.getBoundingClientRect();
          const point = {
            x: Number(Kit.clamp((event.clientX - rect.left) / rect.width * 100, 0, 100).toFixed(2)),
            y: Number(Kit.clamp((event.clientY - rect.top) / rect.height * 100, 0, 100).toFixed(2))
          };
          placeAnswer(point); ctx.onAnswer?.(point);
        });
      }
      wrap.append(stage, el('p', 'question-hint', ctx.reveal ? '⌖ Der Zielbereich ist eingeblendet.' : '⌖ Tippe oder klicke auf die gesuchte Stelle im Bild.'));
      container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      const { div, input, labelField } = ui;
      const App = window.SchmobinApp;
      const image = input('text', q.image || '', 'input'); image.placeholder = './assets/bild.jpg oder https://…';
      box.append(labelField('Bildquelle', image));

      const grid = div('dynamic-grid');
      const xInput = input('number', q.targetX ?? 50, 'input'); xInput.min = '0'; xInput.max = '100'; xInput.step = '0.1';
      const yInput = input('number', q.targetY ?? 50, 'input'); yInput.min = '0'; yInput.max = '100'; yInput.step = '0.1';
      const radiusInput = input('number', q.radius ?? 10, 'input'); radiusInput.min = '1'; radiusInput.max = '50'; radiusInput.step = '0.1';
      grid.append(labelField('Ziel X (%)', xInput), labelField('Ziel Y (%)', yInput), labelField('Trefferradius (%)', radiusInput));
      box.append(grid);

      const stage = div('hotspot-stage hotspot-editor-stage');
      const previewImage = document.createElement('img');
      previewImage.alt = 'Hotspot-Zielbereich im Editor'; previewImage.draggable = false;
      const zone = div('hotspot-zone');
      const target = div('hotspot-marker hotspot-marker--target');
      stage.append(previewImage, zone, target);

      const syncPreview = () => {
        const x = Kit.clamp(Number(q.targetX) || 0, 0, 100);
        const y = Kit.clamp(Number(q.targetY) || 0, 0, 100);
        const radius = Kit.clamp(Number(q.radius) || 1, 1, 50);
        zone.style.left = `${x}%`; zone.style.top = `${y}%`; zone.style.width = `${radius * 2}%`; zone.style.height = `${radius * 2}%`;
        target.style.left = `${x}%`; target.style.top = `${y}%`;
        const src = App.sanitizeURL(q.image || '');
        zone.hidden = target.hidden = !src;
        if (src && previewImage.getAttribute('src') !== src) previewImage.src = src;
        if (!src) previewImage.removeAttribute('src');
      };
      const updateNumber = (key, control, min, max) => {
        control.addEventListener('input', e => { q[key] = Kit.clamp(Number(e.target.value) || min, min, max); syncPreview(); ui.queueSave(); });
      };
      updateNumber('targetX', xInput, 0, 100);
      updateNumber('targetY', yInput, 0, 100);
      updateNumber('radius', radiusInput, 1, 50);
      image.addEventListener('input', e => { q.image = e.target.value; syncPreview(); ui.queueSave(); });
      stage.addEventListener('pointerup', event => {
        if (!previewImage.getAttribute('src')) return;
        const rect = stage.getBoundingClientRect();
        q.targetX = Number(Kit.clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100).toFixed(1));
        q.targetY = Number(Kit.clamp((event.clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100).toFixed(1));
        xInput.value = q.targetX; yInput.value = q.targetY; syncPreview(); ui.queueSave();
      });
      syncPreview();
      box.append(div('editor-help', 'Zielpunkt direkt im Bild setzen: Klicke oder tippe auf die gesuchte Position. Den Radius kannst du darunter feinjustieren.'), stage);
    },

    stats: {
      aggregate(q, records) { return { kind: 'hotspot', hits: records.filter(record => Number(record?.awardedPoints) > 0).length, total: records.length }; },
      render(stats) {
        return Kit.statCards([['Treffer', `${stats.hits || 0}/${stats.total || 0}`], ['Trefferquote', `${stats.total ? Math.round((stats.hits || 0) / stats.total * 100) : 0}%`]]);
      }
    }
  });
})();
