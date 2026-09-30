(function () {
  'use strict';

  /*
   * Gemeinsames Werkzeugkit für Fragetyp-Module.
   * Enthält Hilfsfunktionen, die mehrere Typen teilen (Antwortoptionen,
   * Grundgerüst einer Frage, Bild/Audio, Options-Editor, Statistik-Bausteine).
   * Wird von der Registry vor den Typ-Dateien geladen.
   */
  const App = () => window.SchmobinApp;

  // ---------- Daten-Helfer ----------
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function numberOr(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function normalizeTerm(value) { return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' '); }
  function escapeHTML(value) { return App().escapeHTML(value); }

  function normalizeOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => {
      if (option && typeof option === 'object') return { id: String(option.id ?? String.fromCharCode(97 + index)), text: String(option.text ?? option.label ?? '') };
      return { id: String.fromCharCode(97 + index), text: String(option ?? '') };
    });
  }
  function optionById(question, id) { return (question.options || []).find(option => String(option.id) === String(id)); }
  function correctOption(question) {
    const options = question.options || [];
    const correct = String(question.correctAnswer ?? '');
    // Explizite Options-IDs/-Texte haben Vorrang; numerische Indizes bleiben für alte Quizdateien gültig.
    const direct = options.find(option => String(option.id) === correct) || options.find(option => option.text === correct);
    if (direct) return direct;
    const index = Number(correct);
    return Number.isInteger(index) && index >= 0 && index < options.length ? options[index] : null;
  }
  /** Immer gleich gemischt für denselben seed (z. B. Fragen-ID) – alle Geräte sehen dieselbe Reihenfolge */
  function seededShuffle(list, seed) {
    let h = 2166136261;
    for (const ch of String(seed || 'seed')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function defaultOptions() { return [{ id: 'a', text: 'Antwort A' }, { id: 'b', text: 'Antwort B' }, { id: 'c', text: 'Antwort C' }, { id: 'd', text: 'Antwort D' }]; }

  // Gemeinsame Prüfung für Auswahl-Fragen
  function validateOptions(q, report, { needsCorrect = false } = {}) {
    if (!Array.isArray(q.options) || q.options.length < 2) report.error('options', 'Mindestens zwei Antwortoptionen sind erforderlich.');
    if ((q.options || []).some(o => !String(o.text || '').trim())) report.error('options', 'Antwortoptionen dürfen nicht leer sein.');
    const optionIds = (q.options || []).map(o => String(o.id || '').trim()).filter(Boolean);
    if (new Set(optionIds).size !== optionIds.length) report.error('options', 'Antwortoptionen enthalten doppelte IDs.');
    if (needsCorrect) {
      const index = Number(q.correctAnswer);
      const valid = new Set(optionIds).has(String(q.correctAnswer)) || (Number.isInteger(index) && index >= 0 && index < q.options.length) || q.options.some(o => o.text === String(q.correctAnswer));
      if (!valid) report.error('correctAnswer', 'Korrekte Antwort passt zu keiner Option.');
    }
  }

  // ---------- Darstellung ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function typeMeta(type) { return window.SylasphereTypes?.get(type) || { label: type, icon: '•' }; }

  function baseQuestion(question) {
    const wrap = el('div', `question-shell question-type-${question.type}`);
    const topic = window.SchmobinQuiz.topic(question.category);
    wrap.style.setProperty('--cat-hue', String(topic.hue));
    const meta = el('div', 'question-meta');
    const def = typeMeta(question.type);
    meta.append(el('span', 'pill pill--category', `${topic.icon} ${question.category || 'Ohne Thema'}`));
    meta.append(el('span', 'pill pill--type', `${def.icon || '•'} ${def.label || question.type}`));
    meta.append(el('span', 'pill pill--points', `${question.points} Punkte`));
    if (question.timer > 0) meta.append(el('span', 'pill pill--timer', `${question.timer}s`)); // v31: Spieler/Beamer blenden Typ + Zeit aus (Timer läuft als Balken/Ring)
    wrap.append(meta, el('h2', 'question-title', question.text));
    return wrap;
  }
  function addImage(question, wrap) {
    const src = App().sanitizeURL(question.image || question.imageUrl || '');
    if (!src) return;
    const figure = el('figure', 'question-image');
    const img = document.createElement('img');
    img.src = src; img.alt = question.imageAlt || 'Bild zur Quizfrage'; img.loading = 'eager';
    figure.append(img); wrap.append(figure);
  }
  function addAudio(question, wrap) {
    const src = App().sanitizeURL(question.audio || question.audioUrl || '');
    const card = el('div', 'audio-card');
    card.append(el('div', 'audio-icon', '♪'));
    const body = el('div', 'audio-body');
    body.append(el('strong', '', question.audioLabel || 'Audio-Hinweis'));
    if (src) {
      const audio = document.createElement('audio');
      audio.controls = true; audio.preload = 'metadata'; audio.src = src; audio.setAttribute('playsinline', '');
      body.append(audio);
    } else body.append(el('span', 'microcopy', 'Keine Audioquelle hinterlegt.'));
    card.append(body); wrap.append(card);
  }

  /**
   * Antwort-Kacheln für alle Auswahl-Typen.
   * options: { media: 'image'|'audio', winners: [ids], detail(option) -> html, strength(option) -> 0..100, hint }
   */
  function renderChoice(question, container, ctx, options = {}) {
    const wrap = baseQuestion(question);
    if (options.media === 'image') addImage(question, wrap);
    if (options.media === 'audio') addAudio(question, wrap);
    const grid = el('div', 'answer-grid');
    let selected = ctx.currentAnswer ?? null;
    const winners = new Set((options.winners || []).map(String));
    (question.options || []).forEach((option, index) => {
      const button = el('button', 'answer-btn');
      button.type = 'button';
      button.dataset.answerId = option.id;
      const detail = ctx.reveal && options.detail ? options.detail(option) : '';
      button.innerHTML = `<span class="answer-index">${String.fromCharCode(65 + index)}</span><span class="answer-copy"><b>${escapeHTML(option.text)}</b>${detail}</span>`;
      if (String(selected) === String(option.id)) button.classList.add('is-selected');
      if (ctx.reveal && winners.size) {
        if (winners.has(String(option.id))) button.classList.add('is-correct');
        else if (String(selected) === String(option.id)) button.classList.add('is-wrong');
      }
      if (ctx.reveal && options.strength) {
        button.style.setProperty('--answer-strength', `${Math.max(4, Math.round(options.strength(option)))}%`);
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
    if (options.hint && !ctx.reveal) wrap.append(el('p', 'question-hint', options.hint));
    wrap.append(grid);
    container.replaceChildren(wrap);
  }

  // ---------- Editor ----------
  /**
   * Options-Editor für Auswahl-Typen.
   * mode: 'correct' (Radio für richtige Antwort) | 'survey' (Prozentwerte) | 'consensus' (ohne Lösung)
   */
  function choiceEditor(q, ui, box, mode) {
    const { div, input, button } = ui;
    const list = div('');
    (q.options || []).forEach((opt, i) => {
      const row = div(`option-row option-row--${mode}`);
      if (mode === 'correct') {
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = `correct_${q.id}`; radio.checked = String(correctOption(q)?.id || '') === String(opt.id); radio.title = 'Richtige Antwort';
        radio.addEventListener('change', () => { q.correctAnswer = opt.id; ui.queueSave(); });
        row.append(radio);
      } else row.append(div('option-kind', mode === 'survey' ? `${i + 1}.` : '•'));
      // v30: Kennung (a, b, c …) wird automatisch vergeben – hier nur der Buchstabe zur Orientierung
      const badge = div('option-letter', String.fromCharCode(65 + (i % 26)));
      badge.title = 'Antwort ' + String.fromCharCode(65 + (i % 26));
      const txt = input('text', opt.text, 'input'); txt.addEventListener('input', e => { opt.text = e.target.value; ui.queueSave(); });
      txt.setAttribute('aria-label', `Antwort ${String.fromCharCode(65 + (i % 26))}`);
      row.append(badge, txt);
      if (mode === 'survey') {
        const value = input('number', opt.value ?? 0, 'input'); value.min = '0'; value.max = '100'; value.step = '0.1'; value.title = 'Anteil in Prozent';
        value.addEventListener('input', e => { opt.value = Number(e.target.value) || 0; ui.queueSave(); });
        row.append(value);
      }
      row.append(button('✕', 'icon-btn', () => {
        q.options.splice(i, 1);
        if (mode === 'correct' && !q.options.some(o => String(o.id) === String(q.correctAnswer))) q.correctAnswer = q.options[0]?.id || '';
        ui.structuralChange();
      }));
      list.append(row);
    });
    box.append(list, button('+ Antwort', 'btn btn--small', () => {
      q.options = q.options || [];
      const id = nextOptionId(q.options); // v30: freie Kennung, auch nach dem Löschen einzelner Antworten
      const option = { id, text: `Antwort ${String.fromCharCode(65 + (q.options.length % 26))}` };
      if (mode === 'survey') option.value = 0;
      q.options.push(option);
      if (mode === 'correct') q.correctAnswer ||= id;
      ui.structuralChange();
    }));
  }
  /** Nächste freie Antwort-Kennung (a, b, c … z, a2 …) */
  function nextOptionId(options) {
    const used = new Set((options || []).map(o => String(o.id)));
    for (let n = 1; n < 50; n++) for (let i = 0; i < 26; i++) { const id = String.fromCharCode(97 + i) + (n > 1 ? n : ''); if (!used.has(id)) return id; }
    return `o${Date.now().toString(36)}`;
  }
  function textField(q, ui, key, label, placeholder, onChange) {
    const control = ui.input('text', q[key] ?? '', 'input');
    if (placeholder) control.placeholder = placeholder;
    control.addEventListener('input', e => { q[key] = e.target.value; onChange?.(); ui.queueSave(); });
    return ui.labelField(label, control);
  }

  // ---------- Mediendateien (v20) ----------
  // Formate, die auf allen Geräten (auch älteren iPhones) zuverlässig laufen
  const MEDIA_FORMATS = {
    image: { good: ['webp', 'jpg', 'jpeg', 'png', 'svg', 'gif', 'avif'], label: 'Bild' },
    audio: { good: ['mp3', 'm4a', 'aac'], label: 'Audio' },
    video: { good: ['mp4', 'webm'], label: 'Video' }
  };
  const FORMAT_HINTS = {
    heic: 'HEIC (iPhone-Fotoformat) läuft in vielen Browsern nicht – bitte als JPG oder WebP speichern.',
    heif: 'HEIF läuft in vielen Browsern nicht – bitte als JPG oder WebP speichern.',
    tif: 'TIFF zeigt kein Browser an – bitte als JPG oder WebP speichern.',
    tiff: 'TIFF zeigt kein Browser an – bitte als JPG oder WebP speichern.',
    bmp: 'BMP ist sehr groß – besser als JPG oder WebP speichern.',
    wav: 'WAV ist etwa zehnmal so groß wie MP3 – für schnelles Laden besser als MP3 speichern.',
    flac: 'FLAC ist sehr groß und läuft nicht überall – besser als MP3 speichern.',
    ogg: 'OGG läuft auf älteren iPhones nicht – besser als MP3 speichern.',
    oga: 'OGG läuft auf älteren iPhones nicht – besser als MP3 speichern.',
    opus: 'Opus läuft auf älteren iPhones nicht – besser als MP3 speichern.',
    wma: 'WMA läuft in Browsern nicht – bitte als MP3 speichern.',
    mov: 'MOV läuft nicht in allen Browsern – besser als MP4 (H.264) speichern.',
    avi: 'AVI läuft in Browsern nicht – bitte als MP4 (H.264) speichern.',
    mkv: 'MKV läuft nicht in allen Browsern – besser als MP4 (H.264) speichern.'
  };
  function mediaKindOf(path) {
    const ext = mediaExt(path);
    return Object.keys(MEDIA_FORMATS).find(kind => MEDIA_FORMATS[kind].good.includes(ext))
      || (['heic', 'heif', 'tif', 'tiff', 'bmp'].includes(ext) ? 'image' : ['wav', 'flac', 'ogg', 'oga', 'opus', 'wma'].includes(ext) ? 'audio' : ['mov', 'avi', 'mkv'].includes(ext) ? 'video' : '');
  }
  function mediaExt(path) {
    const clean = String(path || '').split(/[?#]/)[0];
    const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
    return match ? match[1].toLowerCase() : '';
  }
  /**
   * Hinweise zu einer Medienangabe (ohne Netzwerk): Format, Dateiname, fremde Links.
   * kind: 'image' | 'audio' | 'video'; options.needsCors: Datei wird per Web Audio geladen (Song-Enthüllung)
   * Rückgabe: [{ level: 'error' | 'warn' | 'info', text }]
   */
  function mediaAdvice(path, kind, options = {}) {
    const raw = String(path || '').trim();
    const out = [];
    if (!raw) return out;
    if (/^data:/i.test(raw)) {
      if (raw.length > 300000) out.push({ level: 'warn', text: 'Die Datei ist direkt ins Quiz eingebettet und sehr groß. Besser ins Repo (assets/) hochladen und den Pfad eintragen.' });
      return out;
    }
    const external = /^https?:\/\//i.test(raw);
    if (/^http:\/\//i.test(raw)) out.push({ level: 'warn', text: 'Unsichere Adresse (http://) – wird auf der https-Website oft blockiert. Mit https:// oder als Datei im Repo verwenden.' });
    if (/drive\.google\.|docs\.google\.|dropbox\.com|1drv\.ms|onedrive\.live|icloud\.com/i.test(raw)) out.push({ level: 'warn', text: 'Links zu Google Drive, Dropbox, OneDrive oder iCloud funktionieren fast nie. Datei lieber ins Repo (assets/) hochladen.' });
    else if (/youtube\.com|youtu\.be|spotify\.com|open\.spotify/i.test(raw)) out.push({ level: 'error', text: 'YouTube- und Spotify-Links sind keine Mediendateien und funktionieren hier nicht.' });
    if (!external && /^[a-z]:\\|^\/(users|home)\//i.test(raw)) out.push({ level: 'error', text: 'Das ist ein Pfad auf deinem Computer. Datei ins Repo (assets/) hochladen und z. B. ./assets/bild.jpg eintragen.' });
    const ext = mediaExt(raw);
    const actual = mediaKindOf(raw);
    if (ext && actual && actual !== kind) out.push({ level: 'error', text: `Das ist eine ${MEDIA_FORMATS[actual].label}-Datei (.${ext}), hier wird ${kind === 'image' ? 'ein Bild' : kind === 'audio' ? 'eine Audiodatei' : 'ein Video'} erwartet.` });
    else if (FORMAT_HINTS[ext]) out.push({ level: ext === 'wav' || ext === 'bmp' ? 'warn' : 'error', text: FORMAT_HINTS[ext] });
    else if (!ext && !external) out.push({ level: 'warn', text: 'Keine Dateiendung erkennbar (z. B. .jpg oder .mp3).' });
    if (!external) {
      const name = raw.split('/').pop();
      if (/\s/.test(raw)) out.push({ level: 'warn', text: 'Leerzeichen im Dateinamen machen oft Ärger – besser Bindestriche verwenden (z. B. eiffel-turm.jpg).' });
      else if (/[äöüßÄÖÜ]|[^\x00-\x7f]/.test(name)) out.push({ level: 'warn', text: 'Umlaute/Sonderzeichen im Dateinamen machen oft Ärger – besser nur a–z, 0–9 und Bindestriche.' });
      if (!out.some(item => item.level === 'error') && !/^(\.\/|\.\.\/)?assets\//.test(raw) && !/^\.?\/?data\//.test(raw)) out.push({ level: 'info', text: 'Tipp: Mediendateien gehören in den Ordner assets/, z. B. ./assets/bilder/…' });
    } else if (options.needsCors && !window.SylasphereCloudMedia?.isStorageUrl(raw) && !/^https:\/\/firebasestorage\.googleapis\.com\//i.test(raw)) {
      out.push({ level: 'warn', text: 'Fremde Links funktionieren bei der Song-Enthüllung meist nicht (der sekundengenaue Ausschnitt braucht eine Freigabe der fremden Seite). Datei lieber ins Repo hochladen.' });
    }
    return out;
  }
  /** Für validate(): Hinweise als Fehler/Warnungen im Prüfbericht */
  function validateMedia(q, key, kind, report, options) {
    mediaAdvice(q[key], kind, options).forEach(item => {
      if (item.level === 'error') report.error(key, item.text);
      else if (item.level === 'warn') report.warn(key, item.text);
    });
  }
  /** Textfeld für eine Mediendatei: im Editor mit Dateiauswahl (📁) und Live-Prüfung */
  function mediaField(q, ui, key, label, kind, placeholder, onChange, options) {
    const field = textField(q, ui, key, label, placeholder, onChange);
    const control = field.querySelector('input');
    window.SylasphereMediaLibrary?.enhance(control, kind, options);
    return field;
  }

  // ---------- Statistik ----------
  function choiceAggregate(question, records, result) {
    const counts = result?.counts ? clone(result.counts) : Object.fromEntries((question.options || []).map(option => [String(option.id), 0]));
    if (!result?.counts) records.forEach(record => {
      const key = String(record?.answer ?? '');
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });
    return { kind: 'choice', counts };
  }
  function choiceStatsHTML(stats, question) {
    const counts = stats.counts || {};
    const max = Math.max(1, ...Object.values(counts).map(Number));
    return `<div class="stat-bars">${(question.options || []).map(o => `<div><span>${escapeHTML(o.text)}</span><div class="bar"><i style="width:${Math.round((Number(counts[o.id]) || 0) / max * 100)}%"></i></div><b>${Number(counts[o.id]) || 0}</b></div>`).join('')}</div>`;
  }
  const choiceStats = { aggregate: choiceAggregate, render: choiceStatsHTML };
  function statCards(cards) {
    return `<div class="stat-cards">${cards.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div>`;
  }

  // ---- Freitext mit Lösungen vergleichen (v26, aus Fight List übernommen):
  // exakt, einzelnes Wort ab 4 Buchstaben (z. B. Nachname „Obama“) oder mit kleinem Tippfehler
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      let best = row[0];
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, row[j]);
      }
      if (best > limit) return limit + 1;
      prev = row;
    }
    return prev[b.length];
  }
  const typoTolerance = term => (term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0);
  const cleanTerm = value => normalizeTerm(value).replace(/[.,'’"!?()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  /** Bewertung 0 (exakt) … 3 (Tippfehler in einem Wort) oder null (kein Treffer) */
  function termScore(term, solution) {
    const t = cleanTerm(term), full = cleanTerm(solution);
    if (!t || !full) return null;
    const words = full.split(' ').filter(w => w.length >= 4);
    if (full === t) return 0;
    if (words.includes(t)) return 1;
    if (editDistance(t, full, typoTolerance(full)) <= typoTolerance(full)) return 2;
    if (t.length >= 4 && words.some(w => editDistance(t, w, typoTolerance(w)) <= typoTolerance(w))) return 3;
    return null;
  }
  /** Bester Treffer eines Begriffs in einer Lösungsliste: { kind: 'exact'|'fuzzy'|'none', solution, index } */
  function matchTerm(term, solutions, skip = null) {
    let best = null;
    (solutions || []).forEach((solution, index) => {
      if (skip?.has(index)) return;
      const score = termScore(term, solution);
      if (score !== null && (!best || score < best.score)) best = { index, score };
    });
    if (!best) return { kind: 'none' };
    return { kind: best.score <= 1 ? 'exact' : 'fuzzy', solution: String(solutions[best.index]), index: best.index };
  }

  /** v32: Spieler zu einer ID (für Avatare in Präsentationen) */
  function playerOf(players, id) {
    const p = (players || []).find(x => String(x.id) === String(id));
    return { name: p?.name || 'Spieler', avatar: App()?.avatar ? App().avatar(p?.avatar) : (p?.avatar || '🙂') };
  }
  /** Avatar-Pin mit kleinem Namen (Name auch als Tooltip) */
  function pinHTML(player, extraClass = '', extra = '') {
    return `<span class="present-pin ${extraClass}" title="${escapeHTML(player.name)}${extra ? ` · ${escapeHTML(extra)}` : ''}"><i>${escapeHTML(player.avatar)}</i><small>${escapeHTML(player.name)}</small></span>`;
  }

  /** v35: Hinweistext aus der Erklärung des Spielmodus (eine Textquelle: help in types/<typ>.js) */
  function modeText(type, key = 'short', index = null) {
    const help = window.SylasphereTypes?.get(type)?.help;
    const value = help?.[key];
    return String((Array.isArray(value) ? value[index ?? 0] : value) || '');
  }

  // ---------- v37: Stufen-Spielmodi mit Einloggen (Hinweis-Kaskade, Bild-Enthüllung) ----------
  /*
   * Gemeinsame Logik: Stufen werden nacheinander aufgedeckt, jeder loggt EINMAL eine Freitext-Antwort ein
   * (gesperrt, Stufe stempelt die Engine). Punkte = Fragenpunkte × Prozent der Stufe, falsch = 0.
   * Prüfung: exakt/Variante = ✓, Tippfehler (matchTerm „fuzzy“) = ≈ (zählt als richtig), sonst ✗ – der Moderator kann umdrehen.
   * Aufgedeckte Inhalte kommen online nur über state.stageReveal (schreibt das Moderator-Gerät), nie über die Frage selbst.
   */
  const Stages = (() => {
    const defaultPercents = n => Array.from({ length: n }, (_, i) => Math.max(0, 100 - 20 * i));
    const list = value => (Array.isArray(value) ? value : String(value ?? '').split(/\n|\|/)).map(v => String(v).trim()).filter(Boolean);
    function normalize(q, count) {
      q.timer = 0;
      q.solution = String(q.solution ?? q.correctAnswer ?? '').trim().slice(0, 120);
      q.aliases = list(q.aliases).map(v => v.slice(0, 120)).slice(0, 20);
      const given = Array.isArray(q.percents) ? q.percents : [];
      const defaults = defaultPercents(count);
      q.percents = defaults.map((d, i) => clamp(Math.round(numberOr(given[i], d)), 0, 100));
      q.autoAdvance = clamp(Math.round(numberOr(q.autoAdvance, 0)), 0, 600); // 0 = Moderator schaltet weiter
    }
    function validate(q, report, count) {
      if (!q.solution) report.error('solution', 'Lösung fehlt.');
      q.percents.forEach((pct, i) => { if (i && pct > q.percents[i - 1]) report.warn('percents', `Stufe ${i + 1} gibt mehr Punkte als Stufe ${i}.`); });
      if (q.autoAdvance > 0 && q.autoAdvance < 5) report.warn('autoAdvance', 'Automatisch weiter unter 5 Sekunden ist sehr knapp.');
      if (count < 2) report.error('stages', 'Mindestens zwei Stufen sind nötig.');
    }
    const solutions = q => [q.solution, ...(q.aliases || [])].filter(Boolean);
    const textOf = answer => (answer && typeof answer === 'object' ? String(answer.text || '').trim() : '');
    const count = q => (Array.isArray(q.percents) && q.percents.length) || 1;
    const stageOf = (q, answer) => clamp(Math.round(numberOr(answer?.stage, 0)), 0, count(q) - 1);
    /** true (✓ exakt/Variante), 'fuzzy' (≈ Tippfehler), false (✗) */
    function check(q, answer) {
      const text = textOf(answer);
      if (!text) return false;
      const m = matchTerm(text, solutions(q));
      return m.kind === 'exact' ? true : m.kind === 'fuzzy' ? 'fuzzy' : false;
    }
    function isRight(q, answer, result, playerId) {
      const v = result?.verdicts ? result.verdicts[playerId] : undefined;
      if (typeof v === 'boolean') return v && Boolean(textOf(answer));
      return check(q, answer) !== false;
    }
    function score(q, answer, { base, result, playerId }) {
      if (!textOf(answer)) return { points: 0, detail: 'Nicht eingeloggt' };
      const s = stageOf(q, answer); const pct = q.percents[s] ?? 0;
      const ok = isRight(q, answer, result, playerId);
      return { points: ok ? Math.round(base * pct / 100) : 0, detail: `Stufe ${s + 1} · ${pct} % · ${ok ? 'richtig' : 'falsch'}` };
    }
    const judge = (q, answer, { result, playerId } = {}) => Boolean(textOf(answer)) && isRight(q, answer, result, playerId);
    const answerLabel = (q, answer) => (textOf(answer) ? `${textOf(answer)} · Stufe ${stageOf(q, answer) + 1}` : '–');
    const mark = (q, answer) => (textOf(answer) ? { s: stageOf(q, answer), f: check(q, answer) === 'fuzzy' ? 1 : 0 } : null);
    const recordStage = r => { const v = r?.answer?.stage ?? r?.stage; return v == null ? NaN : Number(v); };

    /** Stufen-Leiste; mit ctx.answers + players: Avatare derer, die bei der Stufe eingeloggt haben */
    function rail(q, ctx, { vertical = false, pins = true } = {}) {
      const box = el('div', `stage-rail${vertical ? ' is-vertical' : ''}`);
      const current = clamp(Math.round(numberOr(ctx.stage, 0)), 0, count(q) - 1);
      const records = Object.entries(ctx.answers || {});
      q.percents.forEach((pct, i) => {
        const chip = el('div', 'stage-chip');
        chip.dataset.stage = String(i);
        chip.innerHTML = `<b>${vertical ? `Stufe ${i + 1}` : i + 1}</b><small>${pct} %</small>`;
        if (pins) {
          const who = records.filter(([, r]) => Number.isFinite(recordStage(r)) && clamp(recordStage(r), 0, count(q) - 1) === i);
          if (who.length) { const p = el('div', 'stage-pins'); p.innerHTML = who.map(([id]) => pinHTML(playerOf(ctx.players, id))).join(''); chip.append(p); }
        }
        box.append(chip);
      });
      markRail(box, current, ctx.reveal);
      return box;
    }
    function markRail(root, current, reveal) {
      root.querySelectorAll('.stage-chip').forEach(chip => {
        const i = Number(chip.dataset.stage);
        chip.classList.toggle('is-current', !reveal && i === current);
        chip.classList.toggle('is-past', !reveal && i < current);
        chip.classList.toggle('is-future', !reveal && i > current);
      });
    }
    /** Auflösung: Lösung groß, dann pro Spieler Stufe + Antwort + Punkte */
    function resultCard(q, ctx) {
      const card = el('div', 'stage-result');
      const head = el('div', 'stage-solution');
      head.append(el('span', 'eyebrow', 'Lösung'), el('strong', '', q.solution || '–'));
      card.append(head);
      const entries = Array.isArray(ctx.result?.entries) ? ctx.result.entries : [];
      if (ctx.players?.length) {
        const byId = new Map(entries.map(e => [String(e.playerId), e]));
        const rows = ctx.players.map(p => ({ p, e: byId.get(String(p.id)) }))
          .sort((a, b) => (b.e?.points || 0) - (a.e?.points || 0) || (numberOr(a.e?.mark?.s, 99) - numberOr(b.e?.mark?.s, 99)));
        const listBox = el('div', 'stage-result-list');
        listBox.innerHTML = rows.map(({ p, e }) => {
          const who = playerOf(ctx.players, p.id);
          if (!e) return `<div class="stage-result-row is-missing"><span class="stage-who"><i>${escapeHTML(who.avatar)}</i><strong>${escapeHTML(who.name)}</strong></span><span>–</span><span>nicht eingeloggt</span><b>0</b></div>`;
          const text = String(e.answer || '').replace(/ · Stufe \d+$/, '');
          const sign = e.correct ? (e.mark?.f ? '≈✓' : '✓') : '✗';
          return `<div class="stage-result-row ${e.correct ? 'is-right' : 'is-wrong'}"><span class="stage-who"><i>${escapeHTML(who.avatar)}</i><strong>${escapeHTML(who.name)}</strong></span><span>${e.mark ? `Stufe ${numberOr(e.mark.s, 0) + 1}` : ''}</span><span>„${escapeHTML(text)}“ ${sign}</span><b>+${Math.round(e.points || 0)}</b></div>`;
        }).join('');
        card.append(listBox);
      }
      return card;
    }
    /** Handy: Eingabe + Hinweis; eingeloggt = gesperrt */
    function loginArea(q, ctx) {
      const box = el('div', 'stage-login');
      const answer = ctx.currentAnswer && typeof ctx.currentAnswer === 'object' ? ctx.currentAnswer : null;
      if (ctx.reveal) {
        if (textOf(answer)) box.append(el('div', 'song-own-answer', `Deine Antwort: ${answerLabel(q, answer)}`));
        return box;
      }
      if (ctx.readOnly) {
        if (textOf(answer)) box.append(el('div', 'song-own-answer is-locked', `🔒 Deine Antwort: „${textOf(answer)}“`));
        return box;
      }
      const input = document.createElement('input');
      input.className = 'input stage-input'; input.type = 'text'; input.maxLength = 120; input.autocomplete = 'off'; input.spellcheck = false;
      input.placeholder = 'Deine Antwort …'; input.value = textOf(answer); input.setAttribute('aria-label', 'Deine Antwort');
      input.addEventListener('input', () => { const t = input.value.trim(); ctx.onAnswer?.(t ? { text: input.value.slice(0, 120) } : null); });
      box.append(input, el('p', 'question-hint', 'Einloggen ist fest – danach kannst du nichts mehr ändern. Wer bis zur letzten Stufe nicht einloggt, bekommt 0.'));
      return box;
    }
    /** Editor: Lösung + Varianten, Punkte je Stufe, Weiterschalten (gemeinsam für beide Stufen-Modi) */
    function editorCommon(q, ui, box, stageLabel = 'Stufe') {
      const { div, input, labelField } = ui;
      const sol = input('text', q.solution || '', 'input'); sol.maxLength = 120; sol.placeholder = 'z. B. Tokio';
      sol.addEventListener('input', e => { q.solution = e.target.value; ui.queueSave(); });
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 2; area.value = (q.aliases || []).join('\n'); area.placeholder = 'z. B. Tokyo';
      area.addEventListener('input', e => { q.aliases = list(e.target.value); ui.queueSave(); });
      const g = div('dynamic-grid'); g.append(labelField('Lösung', sol), labelField('Weitere gültige Lösungen / Schreibweisen (je Zeile)', area));
      box.append(g, div('editor-help', 'Tippfehler erkennt das System selbst (≈) – du kannst vor der Auflösung jede Antwort umdrehen.'));
      const pctBox = div('stage-percent-editor');
      pctBox.append(div('field-label', `Punkte je ${stageLabel} (% der Fragenpunkte)`));
      const row = div('stage-percent-row');
      q.percents.forEach((pct, i) => {
        const f = input('number', pct, 'input'); f.min = '0'; f.max = '100'; f.step = '5'; f.setAttribute('aria-label', `${stageLabel} ${i + 1} in Prozent`);
        f.addEventListener('input', e => { q.percents[i] = clamp(Math.round(Number(e.target.value) || 0), 0, 100); ui.queueSave(); });
        row.append(labelField(`${i + 1}`, f));
      });
      pctBox.append(row);
      const auto = input('number', q.autoAdvance || 0, 'input'); auto.min = '0'; auto.max = '600'; auto.step = '5';
      auto.addEventListener('input', e => { q.autoAdvance = clamp(Math.round(Number(e.target.value) || 0), 0, 600); ui.queueSave(); });
      const ga = div('dynamic-grid'); ga.append(labelField('Automatisch weiter alle … Sekunden (0 = Moderator mit „Nächster Schritt“/Leertaste)', auto));
      box.append(pctBox, ga);
    }
    return { defaultPercents, normalize, validate, solutions, textOf, stageOf, check, isRight, score, judge, answerLabel, mark, rail, markRail, resultCard, loginArea, list, editorCommon };
  })();

  window.SylasphereTypeKit = {
    modeText, Stages,
    playerOf, pinHTML,
    clone, numberOr, clamp, normalizeTerm, escapeHTML, cleanTerm, matchTerm, editDistance,
    nextOptionId, MEDIA_FORMATS, mediaExt, mediaKindOf, mediaAdvice, validateMedia, mediaField,
    normalizeOptions, optionById, correctOption, defaultOptions, validateOptions, seededShuffle,
    el, baseQuestion, addImage, addAudio, renderChoice,
    choiceEditor, textField,
    choiceStats, statCards,
    app: App
  };
})();
