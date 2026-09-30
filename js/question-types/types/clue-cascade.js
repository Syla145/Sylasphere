(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;
  const S = Kit.Stages;

  /*
   * Hinweis-Kaskade (v37) – „Wer/Was bin ich?“
   * ------------------------------------------------------------------
   * 3–5 Hinweise von schwer nach leicht (Text, optional Bild). Der Moderator deckt sie nacheinander auf
   * („Nächster Schritt“/Leertaste oder automatisch). Jeder loggt EINMAL eine Antwort ein – je früher, desto mehr Punkte.
   * Online stehen die Hinweise NICHT in der Frage für die Spieler: das Moderator-Gerät veröffentlicht die bisher
   * aufgedeckten über state.stageReveal ({ qid, stage, clues }).
   */
  const MAX = 5, MIN = 3;
  const cleanClue = c => ({ text: String((c && typeof c === 'object' ? c.text : c) ?? '').trim().slice(0, 300), image: String((c && typeof c === 'object' ? c.image : '') ?? '').trim() });

  /** Aufgedeckte Hinweise: Auflösung = alle; sonst nur, was das Moderator-Gerät veröffentlicht hat (lokal/Moderator: aus der Frage) */
  function shownClues(q, ctx) {
    const stage = Math.max(0, Number(ctx.stage) || 0);
    if (ctx.reveal && Array.isArray(q.clues)) return q.clues;
    const sr = ctx.stageReveal;
    if (sr && sr.qid === q.id && Array.isArray(sr.clues)) return sr.clues.slice(0, stage + 1);
    return Array.isArray(q.clues) ? q.clues.slice(0, stage + 1) : [];
  }

  function clueList(q, ctx, { compact = false } = {}) {
    const clues = shownClues(q, ctx);
    const total = (q.percents || []).length || clues.length;
    const box = Kit.el('ol', `clue-list${compact ? ' is-compact' : ''}`);
    box.dataset.key = JSON.stringify([clues.length, ctx.reveal ? 1 : 0]);
    for (let i = 0; i < total; i++) {
      const clue = clues[i];
      const li = Kit.el('li', `clue-item${clue && i === clues.length - 1 && !ctx.reveal ? ' is-new' : ''}${clue ? '' : ' is-hidden'}`);
      li.append(Kit.el('span', 'clue-no', String(i + 1)));
      const body = Kit.el('div', 'clue-body');
      if (clue) {
        if (clue.text) body.append(Kit.el('span', 'clue-text', clue.text));
        const src = window.SchmobinApp.sanitizeURL(clue.image || '');
        if (src) { const img = document.createElement('img'); img.src = src; img.alt = `Bild zu Hinweis ${i + 1}`; img.loading = 'eager'; body.append(img); }
      } else if (!compact || i === clues.length) body.append(Kit.el('span', 'clue-text', '…'));
      li.append(body);
      if (clue || !compact || i === clues.length) box.append(li);
    }
    return box;
  }

  window.SylasphereTypes.register({
    type: 'clue-cascade',
    label: 'Hinweis-Kaskade',
    icon: '🕵️',
    help: {
      group: 'Wissen',
      short: 'Wer oder was ist gesucht? Hinweis für Hinweis wird es leichter – je früher du einloggst, desto mehr Punkte.',
      steps: [
        'Nacheinander erscheinen 3–5 Hinweise, vom schweren zum leichten.',
        'Tipp deine Antwort ein und logge sie bei einer Stufe ein. Eingeloggt ist fest – du kannst nichts mehr ändern.',
        'Wer bis zum letzten Hinweis nicht einloggt, bekommt keine Punkte.'
      ],
      scoring: 'Die Punkte hängen vom Hinweis ab, bei dem du eingeloggt hast (z. B. 100 % beim ersten, 20 % beim fünften). Falsch gibt 0, keine Minuspunkte. Kleine Tippfehler sind egal.',
      moderator: 'Gut als Einstieg oder Rätselrunde. Vorbereiten: Hinweise von schwer nach leicht ordnen, Lösung mit Schreibvarianten eintragen. Mit „Nächster Schritt“ (Leertaste) deckst du den nächsten Hinweis auf – oder er kommt automatisch alle paar Sekunden. Vor der Auflösung prüfst du die Liste (✓/≈/✗).'
    },
    solutionLabel: 'Lösung',
    noTimer: true,
    lockOnSubmit: true,
    review: 'manual',
    publishAnswers: true,
    stageFlow: 'step', // v37: „Nächster Schritt“ deckt die nächste Stufe auf, Einloggen mit Punkteanzeige

    defaults: () => ({
      text: 'Wer bin ich?',
      clues: [{ text: 'Ich wurde 1879 in Ulm geboren.', image: '' }, { text: 'Ich habe als Prüfer in einem Patentamt gearbeitet.', image: '' }, { text: '1921 bekam ich den Nobelpreis für Physik.', image: '' }, { text: 'E = mc²', image: '' }],
      solution: 'Albert Einstein', aliases: ['Einstein'], percents: [100, 80, 60, 40], autoAdvance: 0, timer: 0
    }),

    normalize(q) {
      const raw = Array.isArray(q.clues) ? q.clues : String(q.clues ?? '').split('\n');
      q.clues = raw.map(cleanClue).filter(c => c.text || c.image).slice(0, MAX);
      S.normalize(q, Math.max(1, q.clues.length || Number(q.clueCount) || (Array.isArray(q.percents) ? q.percents.length : 0) || 1));
    },
    validate(q, report) {
      if (q.clues.length < MIN) report.error('clues', `Mindestens ${MIN} Hinweise sind nötig.`);
      q.clues.forEach((c, i) => { if (!c.text && !c.image) report.error('clues', `Hinweis ${i + 1} ist leer.`); if (c.image) Kit.validateMedia(c, 'image', 'image', report); });
      S.validate(q, report, q.clues.length);
    },
    stages: q => (q.percents || []).map(percent => ({ duration: 0, percent })),
    // Online: Hinweise, Lösung und Varianten erst mit der Auflösung – die aufgedeckten kommen über stageReveal
    hideSolution(pq) { pq.clueCount = (pq.clues || []).length; delete pq.clues; delete pq.aliases; },
    /** v37: was bei Stufe n für alle sichtbar wird (vom Moderator-Gerät veröffentlicht) */
    stageReveal: (q, stage) => ({ qid: q.id, stage, clues: (q.clues || []).slice(0, stage + 1).map(c => ({ text: c.text, image: c.image })) }),

    autoCheck: (q, answer) => { const c = S.check(q, answer); return c === 'fuzzy' ? 'fuzzy' : c; },
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),
    score: (q, answer, opts) => S.score(q, answer, opts),
    judge: (q, answer, opts) => S.judge(q, answer, opts),
    answerLabel: (q, answer) => S.answerLabel(q, answer),
    mark: (q, answer) => S.mark(q, answer),
    solutionText: q => q.solution || '',
    moderatorSolution: q => ({ text: q.solution || '–', extra: (q.aliases || []).length ? `Auch gültig: ${q.aliases.join(', ')}` : '' }),

    presentLive: true,
    presentShowsSolution: true,
    present(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      const grid = Kit.el('div', 'stage-layout');
      const main = Kit.el('div', 'stage-main');
      main.append(clueList(q, ctx));
      const side = Kit.el('div', 'stage-side');
      side.append(Kit.el('div', 'stage-side-title', ctx.reveal ? 'Aufgelöst' : 'Eingeloggt'), S.rail(q, ctx, { vertical: true }));
      if (!ctx.reveal && q.autoAdvance > 0) side.append(Kit.el('div', 'stage-auto', `⏱ Automatisch weiter alle ${q.autoAdvance} s`));
      grid.append(main, side);
      wrap.append(grid);
      if (ctx.reveal) wrap.append(S.resultCard(q, ctx));
      container.replaceChildren(wrap);
    },
    render(q, container, ctx) {
      const wrap = Kit.baseQuestion(q);
      wrap.append(S.rail(q, ctx, { pins: false }), clueList(q, ctx, { compact: true }), S.loginArea(q, ctx));
      container.replaceChildren(wrap);
    },
    // Neuer Hinweis ohne Neuzeichnen (Eingabefeld behält Fokus und Text)
    update(q, container, ctx) {
      const stage = Math.max(0, Number(ctx.stage) || 0);
      container.querySelectorAll('.stage-rail').forEach(r => S.markRail(r, stage, ctx.reveal));
      const list = container.querySelector('.clue-list');
      if (!list) return;
      const fresh = clueList(q, ctx, { compact: list.classList.contains('is-compact') });
      if (fresh.dataset.key !== list.dataset.key) list.replaceWith(fresh);
    },

    editor(q, ui, box) {
      const { div, input, button, labelField } = ui;
      box.append(div('editor-help', `${MIN}–${MAX} Hinweise von schwer nach leicht. Reihenfolge per Ziehen (⠿) oder mit ↑/↓ ändern.`));
      const listBox = div('clue-editor');
      let dragFrom = -1;
      const move = (from, to) => {
        if (to < 0 || to >= q.clues.length || from === to) return;
        const [c] = q.clues.splice(from, 1); q.clues.splice(to, 0, c); ui.structuralChange();
      };
      q.clues.forEach((clue, i) => {
        const row = div('clue-editor-row');
        row.draggable = true;
        row.addEventListener('dragstart', e => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; row.classList.add('is-dragging'); });
        row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
        row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('is-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('is-over'));
        row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('is-over'); move(dragFrom, i); });
        const handle = div('clue-drag', '⠿'); handle.title = 'Ziehen zum Sortieren'; handle.setAttribute('aria-hidden', 'true');
        const text = input('text', clue.text, 'input'); text.maxLength = 300; text.placeholder = `Hinweis ${i + 1}`;
        text.addEventListener('input', e => { clue.text = e.target.value; ui.queueSave(); });
        const img = input('text', clue.image || '', 'input'); img.placeholder = 'Bild (optional)';
        img.addEventListener('input', e => { clue.image = e.target.value; ui.queueSave(); });
        window.SylasphereMediaLibrary?.enhance(img, 'image');
        const fields = div('clue-editor-fields'); fields.append(labelField(`Hinweis ${i + 1}`, text), labelField('Bild zum Hinweis (optional)', img));
        const up = button('↑', 'icon-btn', () => move(i, i - 1)); up.setAttribute('aria-label', `Hinweis ${i + 1} nach oben`); up.disabled = i === 0;
        const down = button('↓', 'icon-btn', () => move(i, i + 1)); down.setAttribute('aria-label', `Hinweis ${i + 1} nach unten`); down.disabled = i === q.clues.length - 1;
        const del = button('✕', 'icon-btn', () => { if (q.clues.length <= MIN) return window.SchmobinApp.toast(`Mindestens ${MIN} Hinweise.`, 'warning'); q.clues.splice(i, 1); q.percents.splice(i, 1); ui.structuralChange(); });
        del.setAttribute('aria-label', `Hinweis ${i + 1} löschen`);
        const actions = div('clue-editor-actions'); actions.append(up, down, del);
        row.append(handle, fields, actions);
        listBox.append(row);
      });
      box.append(listBox);
      if (q.clues.length < MAX) box.append(button('＋ Hinweis', 'btn btn--small', () => { q.clues.push({ text: '', image: '' }); q.percents.push(S.defaultPercents(q.clues.length)[q.clues.length - 1]); ui.structuralChange(); }));
      S.editorCommon(q, ui, box, 'Hinweis');
    }
  });
})();
