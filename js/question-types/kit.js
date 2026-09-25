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
    meta.append(el('span', 'pill', `${question.points} Punkte`));
    if (question.timer > 0) meta.append(el('span', 'pill', `${question.timer}s`));
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
      const id = input('text', opt.id, 'input'); id.maxLength = 12;
      id.addEventListener('change', e => {
        const old = opt.id; opt.id = e.target.value.trim() || String.fromCharCode(97 + i);
        if (String(q.correctAnswer) === String(old)) q.correctAnswer = opt.id;
        ui.structuralChange();
      });
      const txt = input('text', opt.text, 'input'); txt.addEventListener('input', e => { opt.text = e.target.value; ui.queueSave(); });
      row.append(id, txt);
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
      const id = String.fromCharCode(97 + (q.options?.length || 0)); q.options = q.options || [];
      const option = { id, text: `Antwort ${id.toUpperCase()}` };
      if (mode === 'survey') option.value = 0;
      q.options.push(option);
      if (mode === 'correct') q.correctAnswer ||= id;
      ui.structuralChange();
    }));
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

  window.SylasphereTypeKit = {
    clone, numberOr, clamp, normalizeTerm, escapeHTML,
    MEDIA_FORMATS, mediaExt, mediaKindOf, mediaAdvice, validateMedia, mediaField,
    normalizeOptions, optionById, correctOption, defaultOptions, validateOptions, seededShuffle,
    el, baseQuestion, addImage, addAudio, renderChoice,
    choiceEditor, textField,
    choiceStats, statCards,
    app: App
  };
})();
