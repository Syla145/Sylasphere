(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;
  const S = Kit.Stages;

  /*
   * Bild-Enthüllung (v37)
   * ------------------------------------------------------------------
   * Ein Bild wird in 4–5 Stufen enthüllt: verpixelt (wird schärfer), Zoom (starker Ausschnitt → ganzes Bild)
   * oder Kacheln (Raster verdeckt, pro Stufe verschwinden zufällig Kacheln). Einloggen wie bei der Hinweis-Kaskade.
   *
   * Schutz vor Spicken: Das Moderator-Gerät zeichnet jede Stufe selbst (Canvas) und veröffentlicht nur das fertige,
   * verfremdete Bild als data-URL (state.stageReveal). Die Adresse des scharfen Bildes geht erst mit der Auflösung raus.
   * Grenze: Lässt der Bildserver das Zeichnen nicht zu (CORS), wird ersatzweise die Adresse verschickt und im
   * Browser verfremdet – dann könnte ein Spieler mit Entwicklerwerkzeugen das scharfe Bild finden (Editor warnt).
   */
  const MODES = [['pixel', '🟪 Verpixelt'], ['zoom', '🔍 Zoom'], ['tiles', '🧩 Kacheln']];
  const COLS = 6, ROWS = 4, OUT_MAX = 1280;
  const clamp = Kit.clamp;
  const count = q => (q.percents || []).length || 5;

  // ---------- Stufen-Geometrie (ohne DOM, auch in Node getestet) ----------
  /** Blöcke über die Breite beim Verpixeln: 6 → 64 */
  const pixelBlocks = (i, n) => Math.round(6 * Math.pow(64 / 6, n > 1 ? i / (n - 1) : 1));
  /** Zoom-Faktor: zoomMax → 1 (letzte Stufe = ganzes Bild) */
  const zoomFactor = (q, i, n) => Math.pow(Math.max(1, Number(q.zoomMax) || 6), n > 1 ? 1 - i / (n - 1) : 0);
  /** Sichtbarer Ausschnitt (Anteile 0..1) um den Startpunkt, im Bild gehalten */
  function zoomRect(q, i, n) {
    const f = zoomFactor(q, i, n); const w = 1 / f, h = 1 / f;
    const x = clamp((Number(q.zoomX) || 0.5) - w / 2, 0, 1 - w), y = clamp((Number(q.zoomY) || 0.5) - h / 2, 0, 1 - h);
    return { x, y, w, h };
  }
  /** Kacheln, die bei Stufe i offen sind (feste, pro Frage ausgeloste Reihenfolge) */
  function openTiles(q, i, n) {
    const order = Kit.seededShuffle(Array.from({ length: COLS * ROWS }, (_, k) => k), q.seed || q.id || 'bild');
    return new Set(order.slice(0, Math.round(COLS * ROWS * (i + 1) / (n + 1))));
  }

  // ---------- Zeichnen (Browser) ----------
  const images = new Map();
  function loadImage(url) {
    if (!images.has(url)) images.set(url, new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
      img.onload = () => resolve(img); img.onerror = () => { images.delete(url); reject(new Error('Bild konnte nicht geladen werden.')); };
      img.src = url;
    }));
    return images.get(url);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function tileColor() { return getComputedStyle(document.documentElement).getPropertyValue('--surface-hi').trim() || '#2a3558'; }
  /** Zeichnet Stufe i und liefert { img: dataURL, w, h, pixel } (wirft bei CORS-Sperre) */
  async function drawStage(q, i) {
    const n = count(q); const url = window.SchmobinApp.sanitizeURL(q.image || '');
    const img = await loadImage(url);
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const scale = Math.min(1, OUT_MAX / W); const ow = W * scale, oh = H * scale;
    if (q.mode === 'pixel') {
      const bw = pixelBlocks(i, n), bh = Math.max(1, Math.round(bw * H / W));
      const c = canvas(bw, bh); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { img: c.toDataURL('image/png'), w: ow, h: oh, pixel: 1 };
    }
    const c = canvas(ow, oh); const x = c.getContext('2d');
    if (q.mode === 'zoom') {
      const r = zoomRect(q, i, n);
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, r.x * W, r.y * H, r.w * W, r.h * H, 0, 0, c.width, c.height);
    } else {
      x.drawImage(img, 0, 0, c.width, c.height);
      const open = openTiles(q, i, n); const tw = c.width / COLS, th = c.height / ROWS;
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.round(th * 0.38)}px system-ui, sans-serif`;
      for (let k = 0; k < COLS * ROWS; k++) {
        if (open.has(k)) continue;
        const tx = Math.floor((k % COLS) * tw), ty = Math.floor(Math.floor(k / COLS) * th);
        x.fillStyle = tileColor(); x.fillRect(tx, ty, Math.ceil(tw) + 1, Math.ceil(th) + 1);
        x.fillStyle = 'rgba(255,255,255,.22)'; x.fillText('?', tx + tw / 2, ty + th / 2);
      }
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2;
      for (let k = 1; k < COLS; k++) { x.beginPath(); x.moveTo(k * tw, 0); x.lineTo(k * tw, c.height); x.stroke(); }
      for (let k = 1; k < ROWS; k++) { x.beginPath(); x.moveTo(0, k * th); x.lineTo(c.width, k * th); x.stroke(); }
    }
    return { img: c.toDataURL('image/jpeg', 0.82), w: ow, h: oh, pixel: 0 };
  }
  const drawn = new Map();
  function drawCached(q, i) {
    const key = JSON.stringify([q.image, q.mode, count(q), i, q.zoomX, q.zoomY, q.zoomMax, q.seed || q.id]);
    if (!drawn.has(key)) { drawn.set(key, drawStage(q, i)); drawn.get(key).catch(() => drawn.delete(key)); }
    return drawn.get(key);
  }

  // ---------- Anzeige ----------
  /** Ersatz ohne Canvas (CORS gesperrt): Bild per CSS verfremdet – nicht spicksicher */
  function fallbackFigure(fig, q, url, i) {
    const n = count(q); const img = document.createElement('img'); img.src = url; img.alt = 'Bild (noch verfremdet)';
    const box = Kit.el('div', 'reveal-fallback'); box.append(img);
    if (q.mode === 'pixel') img.style.filter = `blur(${Math.round(24 * (1 - i / Math.max(1, n - 1)) + 2)}px)`;
    else if (q.mode === 'zoom') { const r = zoomRect(q, i, n); img.style.transformOrigin = '0 0'; img.style.transform = `scale(${1 / r.w}) translate(${-r.x * 100}%, ${-r.y * 100}%)`; }
    else { const open = openTiles(q, i, n); const grid = Kit.el('div', 'reveal-tiles'); for (let k = 0; k < COLS * ROWS; k++) grid.append(Kit.el('i', open.has(k) ? 'is-open' : '')); box.append(grid); }
    fig.append(box);
  }
  function figure(q, ctx) {
    const fig = Kit.el('figure', `reveal-figure is-${q.mode || 'pixel'}`);
    const sr = ctx.stageReveal && ctx.stageReveal.qid === q.id ? ctx.stageReveal : null;
    const localStage = Math.max(0, Number(ctx.stage) || 0);
    const setImg = (src, pixel, alt) => { const img = document.createElement('img'); img.src = src; img.alt = alt; if (pixel) img.classList.add('is-pixel'); fig.replaceChildren(img); };
    const sharp = window.SchmobinApp.sanitizeURL(q.image || '');
    if (ctx.reveal && sharp) { fig.dataset.key = `reveal:${sharp}`; setImg(sharp, 0, q.imageAlt || 'Aufgelöstes Bild'); return fig; }
    if (sr?.img) { fig.dataset.key = `sr:${sr.stage}:${sr.img.length}`; setImg(sr.img, sr.pixel, `Bild in Stufe ${sr.stage + 1}`); return fig; }
    if (sr?.url) { fig.dataset.key = `fb:${sr.stage}`; fallbackFigure(fig, q, window.SchmobinApp.sanitizeURL(sr.url), sr.stage); return fig; }
    if (sharp) {
      // Moderator, lokaler Modus, Editor-Vorschau: selbst zeichnen
      fig.dataset.key = `local:${localStage}`;
      fig.append(Kit.el('div', 'reveal-wait', 'Bild wird vorbereitet …'));
      drawCached(q, localStage).then(r => setImg(r.img, r.pixel, `Bild in Stufe ${localStage + 1}`)).catch(() => { fig.replaceChildren(); fallbackFigure(fig, q, sharp, localStage); });
      return fig;
    }
    fig.dataset.key = 'wait';
    fig.append(Kit.el('div', 'reveal-wait', '🖼️ Bild kommt gleich …'));
    return fig;
  }

  window.SylasphereTypes.register({
    type: 'image-reveal',
    label: 'Bild-Enthüllung',
    icon: '🖼️',
    help: {
      group: 'Bild',
      short: 'Was zeigt das Bild? Es wird Stufe für Stufe deutlicher – je früher du einloggst, desto mehr Punkte.',
      steps: [
        'Das Bild startet verpixelt, stark herangezoomt oder unter Kacheln versteckt.',
        'Mit jeder Stufe erkennst du mehr. Tipp deine Antwort ein und logge sie ein – eingeloggt ist fest.',
        'Wer bis zur letzten Stufe nicht einloggt, bekommt keine Punkte. Zum Schluss kommt das ganze Bild.'
      ],
      scoring: 'Die Punkte hängen von der Stufe ab, bei der du eingeloggt hast (z. B. 100 % bei der ersten, 20 % bei der fünften). Falsch gibt 0, keine Minuspunkte. Kleine Tippfehler sind egal.',
      moderator: 'Vorbereiten: ein gutes Foto (am besten hochgeladen) und eine eindeutige Lösung mit Schreibvarianten eintragen, Enthüllungsart wählen, beim Zoom den Startausschnitt aufs Bild tippen. Mit „Nächster Schritt“ (Leertaste) kommt die nächste Stufe – oder automatisch. Dein Gerät zeichnet die Stufen, die Spieler bekommen das scharfe Bild erst bei der Auflösung.'
    },
    solutionLabel: 'Lösung',
    noTimer: true,
    lockOnSubmit: true,
    review: 'manual',
    publishAnswers: true,
    stageFlow: 'step',

    defaults: () => ({
      text: 'Was ist auf dem Bild?', image: './assets/demo-landmark.svg', imageAlt: '', mode: 'pixel',
      zoomX: 0.5, zoomY: 0.5, zoomMax: 6, seed: '', solution: 'Eiffelturm', aliases: ['Eifelturm'], percents: [100, 80, 60, 40, 20], autoAdvance: 0, timer: 0
    }),

    normalize(q) {
      q.image = String(q.image ?? q.imageUrl ?? '').trim();
      q.imageAlt = String(q.imageAlt ?? '').slice(0, 200);
      q.mode = MODES.some(([id]) => id === q.mode) ? q.mode : 'pixel';
      q.zoomX = clamp(Kit.numberOr(q.zoomX, 0.5), 0, 1); q.zoomY = clamp(Kit.numberOr(q.zoomY, 0.5), 0, 1);
      q.zoomMax = clamp(Kit.numberOr(q.zoomMax, 6), 2, 12);
      q.seed = String(q.seed ?? '').slice(0, 40);
      const n = clamp(Math.round(Kit.numberOr(q.stageCount, Array.isArray(q.percents) && q.percents.length ? q.percents.length : 5)), 4, 5);
      if (Array.isArray(q.percents)) q.percents = q.percents.slice(0, n);
      delete q.stageCount;
      S.normalize(q, n);
    },
    validate(q, report) {
      if (!q.image) report.error('image', 'Bild-Enthüllung benötigt ein Bild.');
      else Kit.validateMedia(q, 'image', 'image', report, { needsCors: true });
      S.validate(q, report, count(q));
    },
    stages: q => (q.percents || []).map(percent => ({ duration: 0, percent })),
    // Online: Bildadresse, Startausschnitt und Lösung erst mit der Auflösung – Stufenbilder kommen über stageReveal
    hideSolution(pq) { ['image', 'imageAlt', 'aliases', 'zoomX', 'zoomY', 'seed'].forEach(key => { delete pq[key]; }); },
    /** v37: Stufenbild zeichnen (Moderator-Gerät); bei CORS-Sperre Ersatz mit Adresse */
    async stageReveal(q, stage) {
      try { const r = await drawCached(q, stage); return { qid: q.id, stage, img: r.img, pixel: r.pixel }; }
      catch (_) { return { qid: q.id, stage, url: q.image, fallback: 1 }; }
    },

    autoCheck: (q, answer) => { const c = S.check(q, answer); return c === 'fuzzy' ? 'fuzzy' : c; },
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),
    score: (q, answer, opts) => S.score(q, answer, opts),
    judge: (q, answer, opts) => S.judge(q, answer, opts),
    answerLabel: (q, answer) => S.answerLabel(q, answer),
    mark: (q, answer) => S.mark(q, answer),
    solutionText: q => q.solution || '',
    moderatorSolution: q => ({ text: q.solution || '–', extra: `${(MODES.find(([id]) => id === q.mode) || MODES[0])[1]} · ${count(q)} Stufen${(q.aliases || []).length ? ` · auch gültig: ${q.aliases.join(', ')}` : ''}` }),

    presentLive: true,
    presentShowsSolution: true,
    present(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      const grid = Kit.el('div', 'stage-layout is-image');
      const main = Kit.el('div', 'stage-main');
      main.append(figure(q, ctx));
      const side = Kit.el('div', 'stage-side');
      // Auflösung: statt der Stufen-Leiste Lösung + Stufe/Antwort/Punkte je Spieler (spart Höhe – der Beamer scrollt nie)
      if (ctx.reveal) side.append(S.resultCard(q, ctx));
      else side.append(Kit.el('div', 'stage-side-title', 'Eingeloggt'), S.rail(q, ctx, { vertical: true }));
      if (!ctx.reveal && q.autoAdvance > 0) side.append(Kit.el('div', 'stage-auto', `⏱ Automatisch weiter alle ${q.autoAdvance} s`));
      grid.append(main, side);
      wrap.append(grid);
      container.replaceChildren(wrap);
    },
    render(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      wrap.append(S.rail(q, ctx, { pins: false }), figure(q, ctx), S.loginArea(q, ctx));
      container.replaceChildren(wrap);
    },
    update(q, container, ctx) {
      const stage = Math.max(0, Number(ctx.stage) || 0);
      container.querySelectorAll('.stage-rail').forEach(r => S.markRail(r, stage, ctx.reveal));
      const fig = container.querySelector('.reveal-figure');
      if (!fig) return;
      const fresh = figure(q, ctx);
      if (fresh.dataset.key !== fig.dataset.key) fig.replaceWith(fresh);
    },

    editor(q, ui, box) {
      const { div, input, button, labelField } = ui;
      let refresh = 0, zoomImg = null, place = () => {};
      const imageChanged = () => { clearTimeout(refresh); refresh = setTimeout(() => { if (zoomImg) zoomImg.src = window.SchmobinApp.sanitizeURL(q.image || ''); renderThumbs(); }, 600); };
      box.append(Kit.mediaField(q, ui, 'image', 'Bild (am besten hochladen)', 'image', './assets/bilder/bild.jpg', imageChanged, { needsCors: true }));
      box.append(div('editor-help', 'Dein Gerät zeichnet die Stufen im Browser; die Spieler bekommen das scharfe Bild erst bei der Auflösung. Das klappt mit hochgeladenen Bildern und Bildern aus dem Repo. Bei Bildern von fremden Seiten kann es sein, dass der Server das Zeichnen verbietet – dann wird das Bild ersatzweise im Browser der Spieler verfremdet und wäre mit Entwicklerwerkzeugen einsehbar.'));
      const seg = div('stage-mode-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Enthüllungsart');
      MODES.forEach(([id, label]) => {
        const b = button(label, `chip${q.mode === id ? ' is-active' : ''}`, () => { q.mode = id; ui.structuralChange(); });
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(q.mode === id)); seg.append(b);
      });
      const n = document.createElement('select'); n.className = 'select';
      [4, 5].forEach(v => { const o = document.createElement('option'); o.value = String(v); o.textContent = `${v} Stufen`; o.selected = count(q) === v; n.append(o); });
      n.addEventListener('change', e => { const v = Number(e.target.value); q.percents = S.defaultPercents(v); ui.structuralChange(); });
      const g = div('dynamic-grid'); g.append(labelField('Enthüllungsart', seg), labelField('Anzahl Stufen', n));
      box.append(g);

      if (q.mode === 'zoom') {
        const pick = div('reveal-zoom-pick');
        {
          const img = document.createElement('img'); img.src = window.SchmobinApp.sanitizeURL(q.image || ''); img.alt = 'Startausschnitt festlegen'; zoomImg = img;
          const dot = div('reveal-zoom-dot'); const frame = div('reveal-zoom-frame');
          place = () => { const r = zoomRect(q, 0, count(q)); dot.style.left = `${q.zoomX * 100}%`; dot.style.top = `${q.zoomY * 100}%`; Object.assign(frame.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }); };
          pick.addEventListener('click', e => { const b = img.getBoundingClientRect(); q.zoomX = clamp((e.clientX - b.left) / b.width, 0, 1); q.zoomY = clamp((e.clientY - b.top) / b.height, 0, 1); place(); ui.queueSave(); renderThumbs(); });
          pick.append(img, frame, dot); place();
        }
        const zm = input('range', q.zoomMax, 'range'); zm.min = '2'; zm.max = '12'; zm.step = '1';
        zm.addEventListener('input', e => { q.zoomMax = Number(e.target.value) || 6; ui.queueSave(); place(); clearTimeout(refresh); refresh = setTimeout(renderThumbs, 300); });
        box.append(labelField('Startausschnitt: aufs Bild tippen (Rahmen = Stufe 1)', pick), labelField('Wie stark am Anfang gezoomt?', zm));
      }
      if (q.mode === 'tiles') box.append(button('🎲 Kacheln neu mischen', 'btn btn--small', () => { q.seed = Math.random().toString(36).slice(2, 8); ui.queueSave(); renderThumbs(); }));

      const thumbs = div('reveal-thumbs'); thumbs.setAttribute('aria-label', 'Vorschau der Stufen');
      function renderThumbs() {
        thumbs.replaceChildren();
        if (!q.image) return;
        for (let i = 0; i < count(q); i++) {
          const cell = div('reveal-thumb'); cell.append(div('reveal-thumb-no', `${i + 1} · ${q.percents[i]} %`));
          thumbs.append(cell);
          drawCached(q, i).then(r => { const img = document.createElement('img'); img.src = r.img; img.alt = `Stufe ${i + 1}`; if (r.pixel) img.classList.add('is-pixel'); cell.prepend(img); })
            .catch(() => { if (!i) thumbs.replaceChildren(div('notice notice--warning', 'Dieses Bild darf der Browser nicht zeichnen (CORS). Es funktioniert trotzdem, ist aber nicht spicksicher – besser hochladen.')); });
        }
      }
      box.append(labelField('Vorschau der Stufen', thumbs)); renderThumbs();
      S.editorCommon(q, ui, box, 'Stufe');
    }
  });

  // Für Tests (Node): Geometrie ohne DOM
  window.SylasphereImageReveal = { pixelBlocks, zoomFactor, zoomRect, openTiles, COLS, ROWS };
})();
