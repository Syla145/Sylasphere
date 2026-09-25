(function () {
  'use strict';

  /*
   * Eigene Dateien hochladen (v25.1) – Firebase Storage
   * ------------------------------------------------------------------
   * Freigeschaltete Moderatoren laden Bilder und Audio direkt im Editor hoch.
   *   Datei:  Storage   media/<uid>/<ordner>/<id>.<endung>   (neutraler Name – verrät keine Lösung)
   *   Liste:  Datenbank userMedia/<uid>/<id>                  (Name, Größe, Link … – eine Abfrage statt vieler)
   * Im Quiz steht der Download-Link. Spieler brauchen dafür keine Anmeldung.
   *
   * Bilder werden vor dem Hochladen im Browser verkleinert (max. 1600 px, WebP bzw. JPG).
   * Audio wird unverändert hochgeladen (MP3 empfohlen).
   *
   * Wer hochladen darf, entscheiden die Storage-Regeln über die Firestore-Liste
   * uploaders/<uid>. Die Verwaltungsseite hält diese Liste automatisch aktuell
   * (Admin + alle freigeschalteten Moderatoren) – siehe syncUploaders().
   */
  const QUOTA_BYTES = 500 * 1024 * 1024;       // Richtwert pro Moderator (Anzeige/Warnung)
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;    // nach dem Verkleinern
  const MAX_AUDIO_BYTES = 20 * 1024 * 1024;    // wie in storage.rules
  const MAX_EDGE = 1600;
  const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac' };
  const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp' };

  const Account = () => window.SylasphereAccount;
  let storageModule = null;
  let firestoreModule = null;
  let cache = null; // Liste der eigenen Dateien (aus der Datenbank)

  const extOf = name => (/\.([a-z0-9]{2,5})$/i.exec(String(name || '')) || [])[1]?.toLowerCase() || '';
  function kindOf(file) {
    const type = String(file?.type || '');
    const ext = extOf(file?.name);
    if (type.startsWith('image/') || IMAGE_TYPES[ext]) return 'image';
    if (type.startsWith('audio/') || AUDIO_TYPES[ext]) return 'audio';
    return '';
  }
  function slug(value) {
    return String(value || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  /** „katze_2.webp“ → „Katze 2“ (Vorschlag für Lösungen/Namen) */
  function labelFromName(name) {
    const base = String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return base ? base.charAt(0).toLocaleUpperCase('de-DE') + base.slice(1) : '';
  }

  function ctx() {
    const account = Account();
    if (!account?.canModerate()) throw new Error('Zum Hochladen bitte mit einem freigeschalteten Moderator-Konto anmelden.');
    const context = account.context();
    return { context, uid: account.state().user.uid, dbm: context.modules.database, ref: path => context.modules.database.ref(context.db, path) };
  }
  async function storage() {
    const { context } = ctx();
    if (!storageModule) storageModule = await import(`https://www.gstatic.com/firebasejs/${window.JHQuizFirebase.version}/firebase-storage.js`);
    return { mod: storageModule, st: storageModule.getStorage(context.app) };
  }

  // ---------------------------------------------------------------- Bilder verkleinern
  function loadBitmap(file) {
    if (window.createImageBitmap) return createImageBitmap(file).catch(() => loadViaImg(file));
    return loadViaImg(file);
  }
  function loadViaImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Dieses Bildformat kann der Browser nicht lesen (z. B. HEIC vom iPhone). Bitte als JPG oder PNG speichern.')); };
      img.src = url;
    });
  }
  const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
  /** Liefert { blob, type, ext, width, height } – bei SVG/GIF unverändert */
  async function prepareImage(file) {
    const ext = extOf(file.name);
    if (ext === 'svg' || ext === 'gif' || file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return { blob: file, type: file.type || IMAGE_TYPES[ext], ext: ext || (file.type === 'image/gif' ? 'gif' : 'svg') };
    }
    const bitmap = await loadBitmap(file);
    const w = bitmap.width || bitmap.naturalWidth, h = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    const g = canvas.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    let blob = await toBlob(canvas, 'image/webp', 0.82);
    let type = 'image/webp', outExt = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob(canvas, 'image/jpeg', 0.85); type = 'image/jpeg'; outExt = 'jpg'; } // ältere Safari
    // War das Original schon kleiner (und nicht zu groß)? Dann Original behalten.
    if (scale === 1 && file.size <= blob.size && IMAGE_TYPES[ext] && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { blob: file, type: IMAGE_TYPES[ext], ext: ext === 'jpeg' ? 'jpg' : ext, width: w, height: h };
    return { blob, type, ext: outExt, width: canvas.width, height: canvas.height };
  }

  // ---------------------------------------------------------------- Hochladen / Liste / Löschen
  /**
   * Lädt eine Datei hoch. options: { folder, onProgress(0..1) }
   * Ergebnis: { id, url, path, name, kind, size, folder }
   */
  async function upload(file, options = {}) {
    const kind = kindOf(file);
    if (!kind) throw new Error(`${file.name}: nur Bilder und Audiodateien können hochgeladen werden.`);
    const { uid, dbm, ref } = ctx();
    let blob = file, type = file.type, ext = extOf(file.name), width = null, height = null;
    if (kind === 'image') {
      ({ blob, type, ext, width = null, height = null } = await prepareImage(file));
      if (blob.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} ist auch verkleinert noch zu groß.`);
    } else {
      type = type || AUDIO_TYPES[ext] || 'audio/mpeg';
      if (!ext) ext = 'mp3';
      if (file.size > MAX_AUDIO_BYTES) throw new Error(`${file.name} ist ${formatSize(file.size)} groß – höchstens 20 MB. Tipp: als MP3 mit 128–192 kbit/s speichern.`);
    }
    const used = (await list().catch(() => [])).reduce((sum, f) => sum + (Number(f.size) || 0), 0);
    if (used + blob.size > QUOTA_BYTES) throw new Error(`Dein Speicher ist fast voll (${formatSize(used)} von ${formatSize(QUOTA_BYTES)}). Bitte alte Dateien löschen.`);
    const id = newId();
    const folder = slug(options.folder) || (kind === 'audio' ? 'audio' : 'bilder');
    const path = `media/${uid}/${folder}/${id}.${ext}`;
    const { mod, st } = await storage();
    const target = mod.ref(st, path);
    const task = mod.uploadBytesResumable(target, blob, { contentType: type, cacheControl: 'public, max-age=31536000' });
    await new Promise((resolve, reject) => task.on('state_changed',
      snap => options.onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      error => reject(friendly(error)), resolve));
    const url = await mod.getDownloadURL(target);
    const entry = { path, url, name: String(file.name || id).slice(0, 120), kind, size: blob.size, folder, type: String(type).slice(0, 60), createdAt: dbm.serverTimestamp() };
    if (width) Object.assign(entry, { width, height });
    await dbm.set(ref(`userMedia/${uid}/${id}`), entry);
    cache = null;
    return Object.assign({ id }, entry, { createdAt: Date.now() });
  }

  async function list({ force = false } = {}) {
    if (cache && !force) return cache;
    const { uid, dbm, ref } = ctx();
    const value = (await dbm.get(ref(`userMedia/${uid}`))).val() || {};
    cache = Object.entries(value).map(([id, entry]) => Object.assign({ id }, entry)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return cache;
  }

  async function remove(id) {
    const { uid, dbm, ref } = ctx();
    const entry = (await dbm.get(ref(`userMedia/${uid}/${id}`))).val();
    if (entry?.path) {
      const { mod, st } = await storage();
      try { await mod.deleteObject(mod.ref(st, entry.path)); }
      catch (error) { if (!/object-not-found/.test(String(error?.code))) throw friendly(error); }
    }
    await dbm.remove(ref(`userMedia/${uid}/${id}`));
    cache = null;
  }

  function friendly(error) {
    const code = String(error?.code || '');
    if (/unauthorized|permission/i.test(code)) return new Error('Hochladen nicht erlaubt. Ist dein Konto freigeschaltet und hat der Admin die Verwaltungsseite einmal geöffnet (Speicher-Freigabe)? Sind die Storage-Regeln veröffentlicht?');
    if (/quota|retry-limit/i.test(code)) return new Error('Der Speicher ist gerade nicht erreichbar. Bitte später erneut versuchen.');
    if (/canceled/i.test(code)) return new Error('Hochladen abgebrochen.');
    if (/no-default-bucket|bucket-not-found|project-not-found/i.test(code)) return new Error('Der Dateispeicher ist in Firebase noch nicht eingerichtet (Build → Storage → Get started).');
    return error instanceof Error ? error : new Error(String(error?.message || error));
  }

  function formatSize(bytes) {
    if (!Number.isFinite(Number(bytes))) return '';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
    return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  /** Link aus dem eigenen Speicher? (dann ohne Warnungen zu fremden Links) */
  function isStorageUrl(url) {
    const bucket = window.JHQuizFirebase?.config?.storageBucket || '';
    return /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i.test(String(url || '')) && (!bucket || String(url).includes(`/b/${bucket}/`));
  }

  /**
   * Dateiauswahl öffnen und hochladen (auch mehrere). options: { kind, multiple, folder, onEach(result), onProgress(text) }
   * Liefert die Liste der hochgeladenen Dateien.
   */
  function pickAndUpload(options = {}) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.kind === 'audio' ? 'audio/*,.mp3,.m4a' : options.kind === 'image' ? 'image/*' : 'image/*,audio/*';
      input.multiple = Boolean(options.multiple);
      input.addEventListener('change', async () => resolve(await uploadMany([...input.files], options)), { once: true });
      input.click();
    });
  }
  async function uploadMany(files, options = {}) {
    const App = window.SchmobinApp;
    const done = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const prefix = files.length > 1 ? `${i + 1}/${files.length} · ` : '';
      try {
        options.onProgress?.(`${prefix}${file.name} wird vorbereitet …`, i / files.length);
        const result = await upload(file, { folder: options.folder, onProgress: p => options.onProgress?.(`${prefix}${file.name} · ${Math.round(p * 100)} %`, (i + p) / files.length) });
        done.push(result);
        options.onEach?.(result);
      } catch (error) { App?.toast(error.message, 'error'); }
    }
    options.onProgress?.('', 1);
    if (done.length) App?.toast(done.length === 1 ? `${done[0].name} hochgeladen.` : `${done.length} Dateien hochgeladen.`, 'success');
    return done;
  }

  // ---------------------------------------------------------------- Admin: Upload-Freigaben (Firestore)
  async function firestore() {
    const { context } = ctx();
    if (!firestoreModule) firestoreModule = await import(`https://www.gstatic.com/firebasejs/${window.JHQuizFirebase.version}/firebase-firestore-lite.js`);
    return { mod: firestoreModule, fs: firestoreModule.getFirestore(context.app) };
  }
  /** Firestore-Liste uploaders/<uid> an die gewünschten Konten angleichen. Liefert { added, removed }. */
  async function syncUploaders(uids) {
    const wanted = new Set(uids.filter(Boolean).map(String));
    const { mod, fs } = await firestore();
    const current = new Set((await mod.getDocs(mod.collection(fs, 'uploaders'))).docs.map(d => d.id));
    const added = [...wanted].filter(uid => !current.has(uid));
    const removed = [...current].filter(uid => !wanted.has(uid));
    for (const uid of added) await mod.setDoc(mod.doc(fs, 'uploaders', uid), { grantedAt: Date.now() });
    for (const uid of removed) await mod.deleteDoc(mod.doc(fs, 'uploaders', uid));
    return { added, removed, total: wanted.size };
  }

  window.SylasphereCloudMedia = {
    available: () => Boolean(Account()?.canModerate()),
    upload, uploadMany, pickAndUpload, list, remove, syncUploaders,
    isStorageUrl, formatSize, labelFromName, kindOf, prepareImage, slug,
    QUOTA_BYTES, MAX_AUDIO_BYTES
  };
})();
