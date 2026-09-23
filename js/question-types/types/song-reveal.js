(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;
  const Media = () => window.SylasphereMedia;

  /*
   * Song-Enthüllung (v16)
   * ------------------------------------------------------------------
   * Der Moderator spielt den Song in Stufen an (Standard: 0,1 s → 1 s → 3 s → 10 s).
   * Jede Stufe kann er beliebig oft abspielen; „Nächste Stufe“ schaltet weiter.
   * Spieler geben EINMAL ab – die Antwort wird mit der aktuellen Stufe gesperrt.
   * Punkte = Fragenpunkte × Prozent der Stufe (× ½ je Teil bei „Titel + Interpret“).
   * Der Moderator prüft jede Antwort (✓/✗), Rechtschreibung ist egal.
   * Beim Auflösen: Titel, Interpret, Albumbild + festgelegter Ausschnitt (z. B. Refrain) auf allen Geräten.
   */
  const DEFAULT_STAGES = [{ duration: 0.1, percent: 100 }, { duration: 1, percent: 75 }, { duration: 3, percent: 50 }, { duration: 10, percent: 25 }];
  const fmtSeconds = s => `${Number(s).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s`;
  const list = value => (Array.isArray(value) ? value : String(value ?? '').split(/\n|\|/)).map(v => String(v).trim()).filter(Boolean);
  const stagesOf = q => (Array.isArray(q.stages) && q.stages.length ? q.stages : DEFAULT_STAGES);
  const stageInfo = (q, index) => { const stages = stagesOf(q); const i = Math.max(0, Math.min(stages.length - 1, Number(index) || 0)); return Object.assign({ index: i, count: stages.length }, stages[i]); };
  const stageText = (q, index) => { const s = stageInfo(q, index); return `Stufe ${s.index + 1} · ${fmtSeconds(s.duration)} · ${s.percent} %`; };

  function matches(accepted, value) {
    const given = Kit.normalizeTerm(value);
    return Boolean(given) && accepted.some(option => Kit.normalizeTerm(option) === given);
  }
  const titleOptions = q => [q.songTitle, ...(q.titleAliases || [])].filter(Boolean);
  const artistOptions = q => [q.artist, ...(q.artistAliases || [])].filter(Boolean);

  // Ton-Schalter auf allen Song-Karten aktuell halten
  function refreshSoundButtons() {
    const status = Media()?.status() || { enabled: false, locked: true, supported: false };
    document.querySelectorAll('[data-sound-toggle]').forEach(button => {
      button.classList.toggle('is-off', !status.enabled);
      button.classList.toggle('needs-unlock', status.enabled && status.locked);
      button.textContent = !status.supported ? '🔇 Kein Ton verfügbar' : !status.enabled ? '🔇 Ton aus' : status.locked ? '🔊 Ton aktivieren' : '🔊 Ton an';
    });
  }
  let listening = false;
  function soundButton() {
    if (!listening && Media()) { Media().onChange(refreshSoundButtons); listening = true; }
    const button = Kit.el('button', 'btn btn--small sound-toggle');
    button.type = 'button';
    button.dataset.soundToggle = '1';
    button.addEventListener('click', async () => {
      const media = Media(); if (!media) return;
      const status = media.status();
      if (status.enabled && status.locked) await media.unlock();
      else media.setEnabled(!status.enabled);
      refreshSoundButtons();
    });
    setTimeout(refreshSoundButtons, 0);
    return button;
  }

  function stageBar(q, current, reveal) {
    const bar = Kit.el('div', 'song-stages');
    stagesOf(q).forEach((stage, i) => {
      const chip = Kit.el('div', 'song-stage');
      chip.dataset.stage = String(i);
      chip.innerHTML = `<b>${i + 1}</b><span>${Kit.escapeHTML(fmtSeconds(stage.duration))}</span><small>${Kit.escapeHTML(stage.percent)} %</small>`;
      bar.append(chip);
    });
    markStages(bar, current, reveal);
    return bar;
  }
  function markStages(root, current, reveal) {
    root.querySelectorAll('.song-stage').forEach(chip => {
      const i = Number(chip.dataset.stage);
      chip.classList.toggle('is-current', !reveal && i === current);
      chip.classList.toggle('is-past', !reveal && i < current);
    });
  }

  function answerLabel(q, answer) {
    if (!answer || typeof answer !== 'object') return '–';
    const text = [answer.title, q.guessArtist ? answer.artist : ''].map(v => String(v || '').trim()).filter(Boolean).join(' – ') || '–';
    return `${text} · Stufe ${stageInfo(q, answer.stage).index + 1}`;
  }

  window.SylasphereTypes.register({
    type: 'song-reveal',
    label: 'Song-Enthüllung',
    icon: '🎧',
    description: 'Song in Stufen anspielen (0,1 s → 10 s). Wer früher richtig liegt, bekommt mehr Punkte – der Moderator prüft.',
    solutionLabel: 'Song',
    noTimer: true,
    lockOnSubmit: true,
    review: 'manual',
    publishAnswers: true,
    revealMedia: true,

    defaults: () => ({
      text: 'Welcher Song ist das?', audio: './assets/demo-song.mp3', clipStart: 0,
      stages: DEFAULT_STAGES.map(s => Object.assign({}, s)),
      songTitle: 'Sylasphere Theme', artist: 'Demo-Band', titleAliases: [], artistAliases: [], guessArtist: false,
      cover: './assets/demo-cover.svg', revealStart: 8, revealDuration: 12, timer: 0
    }),

    normalize(q) {
      q.timer = 0;
      q.audio = String(q.audio ?? q.audioUrl ?? '');
      q.clipStart = Math.max(0, Kit.numberOr(q.clipStart, 0));
      const stages = Array.isArray(q.stages) && q.stages.length ? q.stages : DEFAULT_STAGES;
      q.stages = stages.slice(0, 6).map(stage => ({
        duration: Math.max(0.05, Kit.numberOr(stage?.duration ?? stage?.seconds, 1)),
        percent: Math.max(0, Math.min(100, Kit.numberOr(stage?.percent ?? stage?.points, 100)))
      }));
      q.songTitle = String(q.songTitle ?? q.title ?? q.solution ?? '').trim();
      q.artist = String(q.artist ?? q.interpret ?? '').trim();
      q.titleAliases = list(q.titleAliases);
      q.artistAliases = list(q.artistAliases);
      q.guessArtist = q.guessArtist === true || q.guessArtist === 'true';
      q.cover = String(q.cover ?? q.coverImage ?? '');
      q.revealStart = Math.max(0, Kit.numberOr(q.revealStart, q.clipStart));
      q.revealDuration = Math.max(1, Math.min(60, Kit.numberOr(q.revealDuration, 12)));
    },

    validate(q, report) {
      if (!String(q.audio || '').trim()) report.error('audio', 'Song-Enthüllung benötigt eine Audiodatei.');
      else Kit.validateMedia(q, 'audio', 'audio', report, { needsCors: true });
      if (String(q.cover || '').trim()) Kit.validateMedia(q, 'cover', 'image', report);
      if (!q.songTitle) report.error('songTitle', 'Songtitel fehlt.');
      if (q.guessArtist && !q.artist) report.error('artist', 'Interpret fehlt (Modus „Titel + Interpret“).');
      if (!q.stages.length) report.error('stages', 'Mindestens eine Stufe ist erforderlich.');
      q.stages.forEach((stage, i) => { if (i && stage.duration <= q.stages[i - 1].duration) report.warn('stages', `Stufe ${i + 1} ist nicht länger als Stufe ${i} – normalerweise werden die Ausschnitte länger.`); });
      q.stages.forEach((stage, i) => { if (i && stage.percent > q.stages[i - 1].percent) report.warn('stages', `Stufe ${i + 1} gibt mehr Punkte als Stufe ${i}.`); });
      // Verrät der Dateiname die Lösung? (Spielergeräte sehen die Adresse der Audiodatei)
      const file = Kit.normalizeTerm(String(q.audio).split('/').pop()).replace(/[^a-z0-9äöüß]+/g, ' ');
      const words = [q.songTitle, q.guessArtist ? q.artist : ''].join(' ').split(/\s+/).map(w => Kit.normalizeTerm(w).replace(/[^a-z0-9äöüß]/g, '')).filter(w => w.length >= 4);
      if (words.some(w => file.includes(w))) report.warn('audio', 'Der Dateiname der Audiodatei enthält Teile der Lösung – Spieler könnten sie sehen. Tipp: neutral benennen, z. B. song-01.mp3.');
    },

    stages: q => stagesOf(q).map(s => Object.assign({}, s)),

    mediaClip(q, media) {
      if (media.kind === 'reveal') return { url: q.audio, offset: q.revealStart, duration: q.revealDuration, fade: 1.5 };
      const stage = stageInfo(q, media.stage);
      return { url: q.audio, offset: q.clipStart, duration: stage.duration, fade: 0 };
    },

    reviewParts: q => (q.guessArtist ? [{ key: 'title', label: 'Titel' }, { key: 'artist', label: 'Interpret' }] : null),
    autoCheck(q, answer, part) {
      if (!answer || typeof answer !== 'object') return null;
      if (part === 'artist') return matches(artistOptions(q), answer.artist) ? true : null;
      return matches(titleOptions(q), answer.title) ? true : null;
    },
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),

    score(q, answer, { base, result, playerId }) {
      if (!answer || typeof answer !== 'object' || !String(answer.title || answer.artist || '').trim()) return { points: 0, detail: 'Keine Antwort' };
      const stage = stageInfo(q, answer.stage);
      const verdict = result?.verdicts ? result.verdicts[playerId] : undefined;
      const titleOk = verdict === undefined ? matches(titleOptions(q), answer.title) : (typeof verdict === 'object' ? verdict?.title === true : verdict === true);
      const artistOk = verdict === undefined ? matches(artistOptions(q), answer.artist) : (typeof verdict === 'object' && verdict?.artist === true);
      const factor = q.guessArtist ? (titleOk ? 0.5 : 0) + (artistOk ? 0.5 : 0) : (titleOk ? 1 : 0);
      const parts = q.guessArtist ? ` · Titel ${titleOk ? '✓' : '✗'} · Interpret ${artistOk ? '✓' : '✗'}` : ` · ${titleOk ? 'richtig' : 'falsch'}`;
      return { points: Math.round(base * stage.percent / 100 * factor), detail: `${stageText(q, stage.index)}${parts}` };
    },

    solutionText: q => [q.songTitle, q.artist].filter(Boolean).join(' – '),
    moderatorSolution: q => ({ text: [q.songTitle, q.artist].filter(Boolean).join(' – ') || '–', extra: `Stufen ab ${fmtSeconds(q.clipStart)} · Auflösung ab ${fmtSeconds(q.revealStart)} für ${fmtSeconds(q.revealDuration)}` }),
    answerLabel,
    // Lösung, Albumbild und Auflösungs-Stelle erst mit der Auflösung an Spieler senden
    hideSolution(pq) { ['songTitle', 'artist', 'titleAliases', 'artistAliases', 'cover', 'revealStart', 'revealDuration'].forEach(key => { delete pq[key]; }); },

    render(q, container, ctx) {
      const { el } = Kit;
      const wrap = Kit.baseQuestion(q);
      if (q.audio) Media()?.preload(q.audio);
      const current = Math.max(0, Number(ctx.stage) || 0);
      const head = el('div', 'song-head');
      head.append(el('div', 'song-status', ctx.reveal ? 'Aufgelöst' : stageText(q, current)), soundButton());
      wrap.append(head, stageBar(q, current, ctx.reveal));
      const answer = ctx.currentAnswer && typeof ctx.currentAnswer === 'object' ? ctx.currentAnswer : null;

      if (ctx.reveal) {
        const card = el('div', 'song-reveal-card');
        const src = window.SchmobinApp.sanitizeURL(q.cover || '');
        if (src) { const img = document.createElement('img'); img.src = src; img.alt = 'Albumcover'; card.append(img); }
        const info = el('div', 'song-reveal-info');
        info.append(el('strong', '', q.songTitle || '–'));
        if (q.artist) info.append(el('span', '', q.artist));
        card.append(info);
        wrap.append(card);
        if (answer) wrap.append(el('div', 'song-own-answer', `Deine Antwort: ${answerLabel(q, answer)}`));
      } else if (ctx.readOnly) {
        if (answer) wrap.append(el('div', 'song-own-answer is-locked', `🔒 ${answerLabel(q, answer)}`));
      } else {
        const fields = el('div', 'song-inputs');
        const value = answer || { title: '', artist: '' };
        const makeInput = (key, label) => {
          const field = el('label', 'field-group');
          const input = document.createElement('input');
          input.className = 'input'; input.type = 'text'; input.maxLength = 120; input.autocomplete = 'off'; input.spellcheck = false;
          input.placeholder = label; input.value = value[key] || '';
          input.addEventListener('input', () => { value[key] = input.value; ctx.onAnswer?.(String(value.title || '').trim() || String(value.artist || '').trim() ? { title: value.title || '', artist: value.artist || '' } : null); });
          field.append(el('span', 'field-label', label), input);
          return field;
        };
        fields.append(makeInput('title', 'Songtitel'));
        if (q.guessArtist) fields.append(makeInput('artist', 'Interpret'));
        wrap.append(fields, el('p', 'question-hint song-hint', q.guessArtist ? '🎧 Titel und Interpret zählen je zur Hälfte. Nach dem Abschicken ist deine Antwort gesperrt.' : '🎧 Je früher du abschickst, desto mehr Punkte. Nach dem Abschicken ist deine Antwort gesperrt.'));
      }
      container.replaceChildren(wrap);
    },

    // Stufenwechsel ohne Neuzeichnen (Eingaben behalten den Fokus)
    update(q, container, ctx) {
      const current = Math.max(0, Number(ctx.stage) || 0);
      const status = container.querySelector('.song-status');
      if (status && !ctx.reveal) status.textContent = stageText(q, current);
      markStages(container, current, ctx.reveal);
    },

    editor(q, ui, box) {
      const { div, input, button, labelField } = ui;
      const test = (offset, duration, fade = 0) => { Media()?.unlock(); Media()?.play(q.audio, { offset, duration, fade }); };
      box.append(div('editor-help', 'Die Audiodatei liegt im Repo, z. B. ./assets/songs/song-01.mp3. Benenne sie neutral – Spielergeräte sehen den Dateinamen. Mit ▶ kannst du jeden Ausschnitt hier direkt testen.'));
      const audio = input('text', q.audio || '', 'input'); audio.placeholder = './assets/songs/song-01.mp3';
      audio.addEventListener('input', e => { q.audio = e.target.value; ui.queueSave(); });
      const clip = input('number', q.clipStart ?? 0, 'input'); clip.min = '0'; clip.step = '0.1';
      clip.addEventListener('input', e => { q.clipStart = Math.max(0, Number(e.target.value) || 0); ui.queueSave(); });
      const g1 = div('dynamic-grid'); g1.append(labelField('Audiodatei', audio), labelField('Ausschnitte starten bei (Sekunde)', clip));
      window.SylasphereMediaLibrary?.enhance(audio, 'audio', { needsCors: true });
      box.append(g1);

      const stageBox = div('song-stage-editor');
      stageBox.append(div('field-label', 'Stufen – Länge und Punkte'));
      (q.stages || []).forEach((stage, i) => {
        const row = div('song-stage-row');
        const dur = input('number', stage.duration, 'input'); dur.min = '0.05'; dur.step = '0.1'; dur.title = 'Länge in Sekunden';
        dur.addEventListener('input', e => { stage.duration = Math.max(0.05, Number(e.target.value) || 0.1); ui.queueSave(); });
        const pct = input('number', stage.percent, 'input'); pct.min = '0'; pct.max = '100'; pct.step = '5'; pct.title = 'Prozent der Fragenpunkte';
        pct.addEventListener('input', e => { stage.percent = Math.max(0, Math.min(100, Number(e.target.value) || 0)); ui.queueSave(); });
        row.append(div('song-stage-no', String(i + 1)), labelField('Sekunden', dur), labelField('% Punkte', pct),
          button('▶', 'icon-btn', () => test(q.clipStart, stage.duration)),
          button('✕', 'icon-btn', () => { if (q.stages.length > 1) { q.stages.splice(i, 1); ui.structuralChange(); } }));
        stageBox.append(row);
      });
      if ((q.stages || []).length < 6) stageBox.append(button('+ Stufe', 'btn btn--small', () => { const last = q.stages[q.stages.length - 1] || { duration: 5, percent: 25 }; q.stages.push({ duration: Math.round(last.duration * 2 * 10) / 10, percent: Math.max(0, last.percent - 10) }); ui.structuralChange(); }));
      box.append(stageBox);

      const mode = document.createElement('select'); mode.className = 'select';
      [['false', 'Nur Songtitel gesucht'], ['true', 'Titel + Interpret gesucht (je ½ Punkte)']].forEach(([value, label]) => { const o = document.createElement('option'); o.value = value; o.textContent = label; o.selected = String(Boolean(q.guessArtist)) === value; mode.append(o); });
      mode.addEventListener('change', e => { q.guessArtist = e.target.value === 'true'; ui.structuralChange(); });
      box.append(labelField('Was ist gesucht?', mode));

      const title = input('text', q.songTitle || '', 'input'); title.addEventListener('input', e => { q.songTitle = e.target.value; ui.queueSave(); });
      const artist = input('text', q.artist || '', 'input'); artist.addEventListener('input', e => { q.artist = e.target.value; ui.queueSave(); });
      const g2 = div('dynamic-grid'); g2.append(labelField('Songtitel (Lösung)', title), labelField(q.guessArtist ? 'Interpret (Lösung)' : 'Interpret (wird bei der Auflösung gezeigt)', artist));
      box.append(g2);
      const aliasArea = (key, label) => {
        const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 2; area.value = (q[key] || []).join('\n');
        area.addEventListener('input', e => { q[key] = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); ui.queueSave(); });
        return labelField(label, area);
      };
      const g3 = div('dynamic-grid'); g3.append(aliasArea('titleAliases', 'Weitere erlaubte Titel (je Zeile)'));
      if (q.guessArtist) g3.append(aliasArea('artistAliases', 'Weitere erlaubte Interpreten (je Zeile)'));
      box.append(g3);

      const cover = input('text', q.cover || '', 'input'); cover.placeholder = './assets/covers/song-01.jpg';
      const coverPreview = document.createElement('img'); coverPreview.className = 'song-cover-preview'; coverPreview.alt = 'Albumbild';
      const syncCover = () => { const src = window.SchmobinApp.sanitizeURL(q.cover || ''); coverPreview.hidden = !src; if (src) coverPreview.src = src; };
      cover.addEventListener('input', e => { q.cover = e.target.value; syncCover(); ui.queueSave(); });
      const coverRow = div('song-cover-row'); coverRow.append(labelField('Albumbild (bei der Auflösung)', cover), coverPreview); syncCover();
      window.SylasphereMediaLibrary?.enhance(cover, 'image');
      box.append(coverRow);

      const rs = input('number', q.revealStart ?? 0, 'input'); rs.min = '0'; rs.step = '0.5';
      rs.addEventListener('input', e => { q.revealStart = Math.max(0, Number(e.target.value) || 0); ui.queueSave(); });
      const rd = input('number', q.revealDuration ?? 12, 'input'); rd.min = '1'; rd.max = '60'; rd.step = '1';
      rd.addEventListener('input', e => { q.revealDuration = Math.max(1, Math.min(60, Number(e.target.value) || 12)); ui.queueSave(); });
      const g4 = div('dynamic-grid song-reveal-grid');
      g4.append(labelField('Auflösung spielt ab (Sekunde, z. B. Refrain)', rs), labelField('Länge der Auflösung (s)', rd), button('▶ Auflösung testen', 'btn btn--small', () => test(q.revealStart, q.revealDuration, 1.5)));
      box.append(g4);
    }
  });
})();
