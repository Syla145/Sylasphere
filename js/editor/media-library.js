(function () {
  'use strict';

  /*
   * Medien-Bibliothek im Editor (v20)
   * ------------------------------------------------------------------
   * 1. Dateiauswahl 📁: zeigt alle Bilder/Audiodateien aus dem Ordner assets/
   *    des GitHub-Repos (über die öffentliche GitHub-API, ohne Anmeldung).
   *    Ein Klick trägt den Pfad ins Feld ein – nichts mehr abtippen.
   * 2. Live-Prüfung unter dem Feld: Format, Dateiname, Größe und ob die Datei
   *    auf der Website wirklich gefunden wird (inkl. „Meintest du …?“ bei
   *    falscher Groß-/Kleinschreibung).
   *
   * Hochladen passiert weiterhin auf GitHub (Link im Auswahlfenster).
   * Die GitHub-API erlaubt ohne Anmeldung 60 Abrufe pro Stunde – die Liste
   * wird deshalb ein paar Minuten zwischengespeichert.
   */
  const FALLBACK_REPO = { owner: 'Syla145', repo: 'quiz-chatgpt', branch: 'main' };
  const CACHE_KEY = 'sylasphere:media-list:v1';
  const CACHE_MS = 3 * 60 * 1000;
  const LIMITS = {
    image: { hint: 600 * 1024, warn: 1.5 * 1024 * 1024 },
    audio: { hint: 8 * 1024 * 1024, warn: 15 * 1024 * 1024 },
    video: { hint: 20 * 1024 * 1024, warn: 24 * 1024 * 1024 }
  };
  const GITHUB_UPLOAD_MAX = 25 * 1024 * 1024;
  const Kit = () => window.SylasphereTypeKit;
  const Cloud = () => window.SylasphereCloudMedia; // v25.1: eigene Uploads (Firebase Storage)
  const App = () => window.SchmobinApp;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

  /** Repo aus der Adresse ableiten (name.github.io/repo), sonst Standard */
  function repo() {
    const host = location.hostname;
    if (/\.github\.io$/i.test(host)) {
      const owner = host.split('.')[0];
      const name = location.pathname.split('/').filter(Boolean)[0];
      if (owner && name && !/\.html?$/i.test(name)) return { owner, repo: name, branch: FALLBACK_REPO.branch };
      return { owner, repo: `${owner}.github.io`, branch: FALLBACK_REPO.branch };
    }
    return Object.assign({}, FALLBACK_REPO);
  }
  const uploadUrl = (folder = 'assets') => { const r = repo(); return `https://github.com/${r.owner}/${r.repo}/upload/${r.branch}/${folder}`; };

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  // ---------------------------------------------------------------- Dateiliste
  let memory = null;
  let pending = null;
  function readCache() {
    try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (c && Date.now() - c.at < CACHE_MS) return c.files; } catch (_) {}
    return null;
  }
  async function list({ force = false } = {}) {
    if (!force && memory) return memory;
    if (!force) { const cached = readCache(); if (cached) { memory = cached; return memory; } }
    if (pending) return pending;
    const r = repo();
    pending = fetch(`https://api.github.com/repos/${r.owner}/${r.repo}/git/trees/${r.branch}?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } })
      .then(async response => {
        if (response.status === 403 || response.status === 429) throw new Error('GitHub lässt gerade keine weiteren Abrufe zu (Limit: 60 pro Stunde). Bitte in ein paar Minuten erneut versuchen.');
        if (response.status === 404) throw new Error(`Repo ${r.owner}/${r.repo} nicht gefunden (oder privat).`);
        if (!response.ok) throw new Error(`GitHub antwortet mit Fehler ${response.status}.`);
        const data = await response.json();
        const files = (data.tree || [])
          .filter(item => item.type === 'blob' && /^assets\//.test(item.path) && !/^assets\/fonts\//.test(item.path))
          .map(item => ({ path: `./${item.path}`, name: item.path.split('/').pop(), folder: item.path.split('/').slice(1, -1).join('/'), size: item.size, kind: Kit()?.mediaKindOf(item.path) || '' }))
          .filter(file => file.kind)
          .sort((a, b) => a.path.localeCompare(b.path, 'de'));
        memory = files;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), files })); } catch (_) {}
        return files;
      })
      .finally(() => { pending = null; });
    return pending;
  }
  const normalizePath = path => String(path || '').trim().replace(/^\.?\//, './').replace(/^(?!\.\/|https?:|data:)/i, './');

  // ---------------------------------------------------------------- Prüfung
  const probeCache = new Map();
  /** Existenz + Größe einer Datei auf der Website (HEAD-Abruf, zwischengespeichert) */
  function probe(path) {
    if (probeCache.has(path)) return probeCache.get(path);
    const promise = fetch(path, { method: 'HEAD', cache: 'no-store' })
      .then(response => ({ ok: response.ok, status: response.status, size: Number(response.headers.get('content-length')) || null }))
      .catch(() => ({ ok: null, status: 0, size: null }));
    probeCache.set(path, promise);
    setTimeout(() => probeCache.delete(path), 20000);
    return promise;
  }
  function probeImage(url) {
    return new Promise(resolve => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = url; setTimeout(() => resolve(null), 8000); });
  }

  /** Vollständige Prüfung: [{ level: 'error'|'warn'|'info'|'ok', text, fix? }] */
  async function check(path, kind, options = {}) {
    const raw = String(path || '').trim();
    if (!raw) return [];
    const items = (Kit()?.mediaAdvice(raw, kind, options) || []).slice();
    if (items.some(item => item.level === 'error')) return items;
    if (/^data:/i.test(raw)) return items;
    if (Cloud()?.isStorageUrl(raw)) {
      const own = Cloud().available() ? (await Cloud().list().catch(() => [])).find(file => file.url === raw) : null;
      if (kind === 'image' && (await probeImage(raw)) === false) items.push({ level: 'error', text: 'Diese Datei ist im Online-Speicher nicht mehr vorhanden (gelöscht?).' });
      else items.push({ level: 'ok', text: `Im Online-Speicher${own ? ` · ${own.name} · ${formatSize(own.size)}` : ''}` });
      return items;
    }
    if (/^https?:\/\//i.test(raw)) {
      if (kind === 'image') {
        const loaded = await probeImage(raw);
        if (loaded === false) items.push({ level: 'error', text: 'Das Bild unter diesem Link lässt sich nicht laden.' });
        else if (loaded) items.push({ level: 'ok', text: 'Bild wird geladen (fremder Link – kann jederzeit verschwinden).' });
      }
      return items;
    }
    const url = normalizePath(raw);
    const result = await probe(url);
    // GitHub-Liste nur bei Bedarf abrufen (Limit 60/Stunde): wenn die Datei fehlt oder die Größe unbekannt ist
    const files = result.ok === false || !result.size ? await list().catch(() => null) : null;
    const listed = files?.find(file => file.path === url);
    if (result.ok === false) {
      const similar = files?.find(file => file.path.toLowerCase() === url.toLowerCase())
        || files?.find(file => file.name.toLowerCase() === url.split('/').pop().toLowerCase());
      if (listed) items.push({ level: 'warn', text: 'Datei ist auf GitHub, aber noch nicht auf der Website. Nach dem Hochladen braucht GitHub Pages ca. 1–2 Minuten.' });
      else if (similar) items.push({ level: 'error', text: `Datei nicht gefunden. Meintest du ${similar.path}?`, fix: similar.path });
      else items.push({ level: 'error', text: 'Datei nicht gefunden. Pfad und Groß-/Kleinschreibung prüfen – oder zuerst auf GitHub in assets/ hochladen.' });
      return items;
    }
    const size = listed?.size ?? result.size;
    const limit = LIMITS[kind];
    if (size && size > GITHUB_UPLOAD_MAX) items.push({ level: 'error', text: `Datei ist ${formatSize(size)} groß – GitHub erlaubt beim Hochladen höchstens 25 MB.` });
    else if (size && limit && size > limit.warn) items.push({ level: 'warn', text: `Datei ist ${formatSize(size)} groß und lädt auf Handys langsam. ${kind === 'image' ? 'Tipp: auf ca. 1600 px Breite verkleinern und als WebP/JPG speichern (z. B. squoosh.app).' : 'Tipp: als MP3 mit 128–192 kbit/s speichern.'}` });
    else if (size && limit && size > limit.hint) items.push({ level: 'info', text: `${formatSize(size)} – geht, kleiner lädt aber schneller.` });
    if (result.ok) items.push({ level: 'ok', text: `Gefunden${size ? ` · ${formatSize(size)}` : ''}` });
    else if (result.ok === null && listed) items.push({ level: 'ok', text: `Im Repo vorhanden · ${formatSize(listed.size)}` });
    return items;
  }

  // ---------------------------------------------------------------- Feld erweitern
  /**
   * Macht aus einem Texteingabefeld ein Medienfeld: 📁-Knopf + Prüfung darunter.
   * Beim Auswählen wird ein input-Event ausgelöst, damit das Quiz gespeichert wird.
   */
  function enhance(input, kind, options = {}) {
    if (!input || input.dataset.mediaEnhanced) return;
    input.dataset.mediaEnhanced = '1';
    const row = document.createElement('div');
    row.className = 'media-input-row';
    input.replaceWith(row);
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn btn--small media-pick-btn';
    pick.innerHTML = '📁 <span>Auswählen</span>';
    pick.title = kind === 'image' ? 'Bild aus assets/ auswählen' : 'Audiodatei aus assets/ auswählen';
    row.append(input, pick);
    // v25.1: direkt hochladen (nur für freigeschaltete Moderatoren)
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'btn btn--small media-upload-btn';
    up.innerHTML = '⬆ <span>Hochladen</span>';
    up.title = kind === 'image' ? 'Bild von deinem Gerät hochladen (wird automatisch verkleinert)' : 'Audiodatei von deinem Gerät hochladen';
    up.hidden = !Cloud()?.available();
    row.append(up);
    const status = document.createElement('div');
    status.className = 'media-status';
    status.setAttribute('aria-live', 'polite');
    row.after(status);

    let timer = null;
    let token = 0;
    const set = value => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
    async function run() {
      const mine = ++token;
      const value = input.value;
      if (!value.trim()) { status.replaceChildren(); return; }
      status.innerHTML = '<span class="media-note is-info">Prüfe …</span>';
      const items = await check(value, kind, options);
      if (mine !== token) return;
      status.replaceChildren(...items.map(item => {
        const line = document.createElement('span');
        line.className = `media-note is-${item.level}`;
        line.textContent = `${{ error: '✗', warn: '⚠', info: 'ℹ', ok: '✓' }[item.level] || ''} ${item.text}`;
        if (item.fix) {
          const fix = document.createElement('button');
          fix.type = 'button'; fix.className = 'link-btn'; fix.textContent = 'Übernehmen';
          fix.addEventListener('click', () => set(item.fix));
          line.append(' ', fix);
        }
        return line;
      }));
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 650); });
    pick.addEventListener('click', () => openPicker(kind, { current: input.value, onPick: set }));
    up.addEventListener('click', async () => {
      if (!Cloud()?.available()) { App()?.toast('Hochladen geht nur mit freigeschaltetem Moderator-Konto.', 'error'); return; }
      up.disabled = true;
      const done = await Cloud().pickAndUpload({ kind, folder: options.folder || (kind === 'audio' ? 'audio' : 'bilder'), onProgress: text => { status.innerHTML = text ? `<span class="media-note is-info">⬆ ${esc(text)}</span>` : ''; } });
      up.disabled = false;
      if (done[0]) set(done[0].url); else run();
    });

    if (input.value.trim()) setTimeout(run, 150);
  }

  // ---------------------------------------------------------------- Auswahlfenster
  let audioPreview = null;
  function stopPreview() { if (audioPreview) { audioPreview.pause(); audioPreview = null; } }

  function openPicker(kind, { current = '', onPick } = {}) {
    let filterKind = kind;
    let search = '';
    let folder = '';
    const cloudOk = Boolean(Cloud()?.available());
    let source = cloudOk ? 'cloud' : 'github'; // v25.1: eigene Uploads zuerst
    const backdrop = document.createElement('div');
    backdrop.className = 'preview-backdrop media-backdrop';
    const box = document.createElement('div');
    box.className = 'panel media-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Datei auswählen');
    box.innerHTML = `
      <div class="media-modal-head"><div><span class="eyebrow" data-eyebrow></span><h2>${kind === 'image' ? 'Bild auswählen' : 'Audiodatei auswählen'}</h2></div><button type="button" class="icon-btn" data-close title="Schließen">✕</button></div>
      <div class="media-source-tabs"${cloudOk ? '' : ' hidden'}><button type="button" class="btn btn--small" data-source="cloud">☁️ Meine Uploads</button><button type="button" class="btn btn--small" data-source="github">📁 GitHub (assets/)</button></div>
      <div class="media-drop" data-drop hidden><div><strong>Dateien hierher ziehen</strong><span>oder</span></div><button type="button" class="btn btn--primary btn--small" data-upload-files>⬆ ${kind === 'image' ? 'Bilder' : 'Audio'} hochladen</button><div class="media-usage" data-usage></div><div class="media-progress" data-progress hidden></div></div>
      <div class="media-toolbar"><input class="input" type="search" placeholder="Suchen …" data-search><select class="select" data-folder><option value="">Alle Ordner</option></select><button type="button" class="btn btn--small" data-refresh title="Liste neu laden">↻</button></div>
      <div class="media-kind-tabs" role="tablist"><button type="button" class="chip" data-kind="${kind}">${kind === 'image' ? '🖼️ Bilder' : '🎵 Audio'}</button><button type="button" class="chip" data-kind="">Alle Dateien</button></div>
      <div class="media-grid${kind === 'audio' ? ' is-list' : ''}" data-grid><p class="microcopy">Lade Dateiliste …</p></div>
      <div class="media-modal-foot" data-github-foot><a class="btn btn--primary btn--small" data-upload target="_blank" rel="noopener">⬆ Neue Datei auf GitHub hochladen ↗</a><p class="microcopy">Nach dem Hochladen: ↻ tippen. Formate: Bilder als <b>WebP/JPG</b> (ca. 1600 px, unter 500 KB), Audio als <b>MP3</b>. Dateinamen ohne Leerzeichen und Umlaute.</p></div>
      <p class="microcopy media-cloud-foot" data-cloud-foot hidden>Bilder werden beim Hochladen automatisch auf höchstens 1600 px verkleinert. Audio bitte als <b>MP3</b> (max. 20 MB). Die Dateien bekommen neutrale Namen – Spieler sehen darin keine Lösung.</p>`;
    backdrop.append(box);
    document.body.append(backdrop);
    const $ = sel => box.querySelector(sel);
    const grid = $('[data-grid]');
    $('[data-upload]').href = uploadUrl(kind === 'audio' ? 'assets/musik' : 'assets/bilder');

    function close() { stopPreview(); backdrop.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(event) { if (event.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    $('[data-close]').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });

    function choose(file) { stopPreview(); onPick?.(file.path); close(); App()?.toast(`${file.name} übernommen.`, 'success'); }

    let files = [];
    function render() {
      box.querySelectorAll('[data-kind]').forEach(tab => tab.classList.toggle('is-active', tab.dataset.kind === filterKind));
      box.querySelectorAll('[data-source]').forEach(tab => tab.classList.toggle('btn--primary', tab.dataset.source === source));
      $('[data-eyebrow]').textContent = source === 'cloud' ? '☁️ Online-Speicher' : '📁 assets/';
      $('[data-drop]').hidden = source !== 'cloud';
      $('[data-cloud-foot]').hidden = source !== 'cloud';
      $('[data-github-foot]').hidden = source !== 'github';
      grid.classList.toggle('is-list', (filterKind || 'audio') !== 'image');
      const term = search.toLowerCase();
      const shown = files.filter(file => (!filterKind || file.kind === filterKind) && (!folder || file.folder === folder) && (!term || `${file.path} ${file.name}`.toLowerCase().includes(term)));
      if (!shown.length) {
        grid.innerHTML = `<p class="microcopy">${source === 'cloud'
          ? (files.length ? 'Keine passenden Dateien.' : 'Noch nichts hochgeladen. Zieh Dateien in das Feld oben oder tippe auf „Hochladen“.')
          : `${files.length ? 'Keine passenden Dateien.' : 'Noch keine Dateien in assets/.'} Lade neue Dateien über den Knopf unten auf GitHub hoch.`}</p>`;
        return;
      }
      grid.replaceChildren(...shown.map(file => {
        const advice = file.cloud ? [] : (Kit()?.mediaAdvice(file.path, file.kind) || []);
        const bad = advice.find(item => item.level === 'error' || item.level === 'warn');
        const card = document.createElement('div');
        card.className = `media-item${file.path === (file.cloud ? String(current).trim() : normalizePath(current)) ? ' is-current' : ''}`;
        const thumb = file.kind === 'image'
          ? `<img src="${esc(file.path)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'media-thumb-missing',textContent:'Vorschau nicht verfügbar'}))">`
          : `<button type="button" class="icon-btn media-play" data-play title="Anhören">▶</button>`;
        card.innerHTML = `${file.kind === 'image' ? `<button type="button" class="media-thumb" data-choose>${thumb}</button>` : thumb}
          <div class="media-meta"><strong title="${esc(file.name)}">${esc(file.name)}</strong><span>${esc(file.folder || 'assets')} · ${esc(formatSize(file.size))}${bad ? ` · <em class="is-${bad.level}">${esc(bad.level === 'error' ? 'Format ungeeignet' : 'Hinweis')}</em>` : ''}</span></div>
          <div class="media-item-actions"><button type="button" class="btn btn--small${file.kind === 'image' ? '' : ' btn--primary'}" data-choose>Übernehmen</button>${file.cloud ? '<button type="button" class="icon-btn" data-delete title="Aus dem Speicher löschen">🗑</button>' : ''}</div>`;
        if (bad) card.title = bad.text;
        card.querySelectorAll('[data-choose]').forEach(button => button.addEventListener('click', () => choose(file)));
        card.querySelector('[data-delete]')?.addEventListener('click', async event => {
          if (!confirm(`„${file.name}“ endgültig löschen?\nWird die Datei noch in einem Quiz verwendet, fehlt sie dort danach.`)) return;
          event.currentTarget.disabled = true;
          try { await Cloud().remove(file.id); App()?.toast('Datei gelöscht.', 'success'); await load(true); }
          catch (error) { App()?.toast(error.message, 'error'); event.currentTarget.disabled = false; }
        });
        card.querySelector('[data-play]')?.addEventListener('click', event => {
          const button = event.currentTarget;
          if (audioPreview && button.classList.contains('is-playing')) { stopPreview(); button.classList.remove('is-playing'); button.textContent = '▶'; return; }
          stopPreview();
          grid.querySelectorAll('.is-playing').forEach(b => { b.classList.remove('is-playing'); b.textContent = '▶'; });
          audioPreview = new Audio(file.path);
          audioPreview.play().catch(() => App()?.toast('Abspielen nicht möglich (Datei evtl. noch nicht online).', 'error'));
          button.classList.add('is-playing'); button.textContent = '■';
          audioPreview.addEventListener('ended', () => { button.classList.remove('is-playing'); button.textContent = '▶'; });
        });
        return card;
      }));
    }

    function usage() {
      const used = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      const quota = Cloud()?.QUOTA_BYTES || 1;
      const pct = Math.min(100, Math.round(used / quota * 100));
      $('[data-usage]').innerHTML = `<div class="meter"><span style="width:${pct}%"></span></div><small>${esc(formatSize(used))} von ${esc(formatSize(quota))} belegt · ${files.length} ${files.length === 1 ? 'Datei' : 'Dateien'}</small>`;
    }

    async function load(force) {
      grid.innerHTML = `<p class="microcopy">Lade Dateiliste ${source === 'cloud' ? 'aus deinem Speicher' : 'von GitHub'} …</p>`;
      try {
        files = source === 'cloud'
          ? (await Cloud().list({ force })).map(f => ({ id: f.id, path: f.url, name: f.name, folder: f.folder, size: f.size, kind: f.kind, cloud: true }))
          : await list({ force });
        const folders = [...new Set(files.map(file => file.folder))].sort();
        $('[data-folder]').innerHTML = '<option value="">Alle Ordner</option>' + folders.map(f => `<option value="${esc(f)}">${esc(f || 'assets (Hauptordner)')}</option>`).join('');
        $('[data-folder]').value = folders.includes(folder) ? folder : '';
        if (source === 'cloud') usage();
        render();
      } catch (error) {
        grid.innerHTML = `<div class="notice notice--error">${esc(error.message)}</div><p class="microcopy">Du kannst den Pfad auch direkt ins Feld schreiben, z. B. ./assets/bilder/bild.webp</p>`;
      }
    }

    // Hochladen: Knopf oder Dateien ins Fenster ziehen
    const progress = $('[data-progress]');
    async function uploadFiles(fileList) {
      const accepted = fileList.filter(f => Cloud().kindOf(f));
      if (!accepted.length) { App()?.toast('Nur Bilder und Audiodateien können hochgeladen werden.', 'error'); return; }
      const done = await Cloud().uploadMany(accepted, { folder: folder || (kind === 'audio' ? 'audio' : 'bilder'), onProgress: text => { progress.hidden = !text; progress.textContent = text ? `⬆ ${text}` : ''; } });
      await load(true);
      if (done.length === 1 && done[0].kind === kind) choose({ path: done[0].url, name: done[0].name });
    }
    $('[data-upload-files]').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true;
      input.accept = kind === 'audio' ? 'audio/*,.mp3,.m4a' : 'image/*';
      input.addEventListener('change', () => uploadFiles([...input.files]), { once: true });
      input.click();
    });
    box.addEventListener('dragover', event => { if (source !== 'cloud') return; event.preventDefault(); $('[data-drop]').classList.add('is-over'); });
    box.addEventListener('dragleave', event => { if (!box.contains(event.relatedTarget)) $('[data-drop]').classList.remove('is-over'); });
    box.addEventListener('drop', event => {
      if (source !== 'cloud') return;
      event.preventDefault(); $('[data-drop]').classList.remove('is-over');
      uploadFiles([...(event.dataTransfer?.files || [])]);
    });

    $('[data-search]').addEventListener('input', event => { search = event.target.value; render(); });
    $('[data-folder]').addEventListener('change', event => { folder = event.target.value; render(); });
    $('[data-refresh]').addEventListener('click', () => load(true));
    box.querySelectorAll('[data-kind]').forEach(tab => tab.addEventListener('click', () => { filterKind = tab.dataset.kind; render(); }));
    box.querySelectorAll('[data-source]').forEach(tab => tab.addEventListener('click', () => { if (source === tab.dataset.source) return; source = tab.dataset.source; folder = ''; files = []; load(false); }));
    load(false);
    if (window.matchMedia?.('(pointer: fine)').matches) setTimeout(() => $('[data-search]').focus(), 50); // am Handy keine Tastatur aufklappen
    return { close };
  }

  // Anmeldung wird oft erst nach dem Aufbau fertig → Hochladen-Knöpfe dann einblenden
  let accountWatch = false;
  function watchAccount() {
    if (accountWatch || !window.SylasphereAccount?.onChange) return;
    accountWatch = true;
    window.SylasphereAccount.onChange(() => document.querySelectorAll('.media-upload-btn').forEach(b => { b.hidden = !Cloud()?.available(); }));
  }
  document.addEventListener('DOMContentLoaded', watchAccount);
  watchAccount();

  window.SylasphereMediaLibrary = { enhance, openPicker, list, check, repo, uploadUrl, formatSize, LIMITS };
})();
