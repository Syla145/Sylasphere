(function () {
  'use strict';

  /*
   * Audio-Wiedergabe für Song-Fragen (v16)
   * ------------------------------------------------------------------
   * - Web Audio API: Ausschnitte starten und enden sekundengenau (auch 0,1 s).
   * - Jede Datei wird einmal geladen und dekodiert (preload), danach ohne Verzögerung abgespielt.
   * - Browser erlauben Ton erst nach einer Berührung/einem Klick auf der Seite.
   *   Jede Interaktion entsperrt automatisch; sonst zeigt die Oberfläche „🔊 Ton aktivieren“.
   * - Pro Gerät stummschaltbar (z. B. Moderator, der über Discord streamt).
   * - v24: Lautstärke wird pro Datei angeglichen (RMS → Ziel-Pegel), dazu ein
   *   Lautstärke-Regler pro Frage (clip.volume, Standard 70 %) und ein Limiter.
   *   Ausschnitte können Stille am Anfang überspringen (clip.skipSilence), damit
   *   auch 0,1-s-Stufen hörbar sind.
   * - sync(media, question): Der Moderator schreibt einen Abspiel-Befehl mit eindeutiger
   *   Nummer (nonce) in den Spielstand; jedes Gerät spielt ihn genau einmal ab.
   */
  const SOUND_KEY = 'sylasphere:sound';
  const MAX_COMMAND_AGE_MS = 8000; // ältere Befehle (z. B. nach Neuladen) nicht mehr abspielen

  let ctx = null;
  let master = null;
  let current = null;
  let lastNonce = null;
  const buffers = new Map();
  const listeners = new Set();

  function audioContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    // Limiter gegen Übersteuern (sehr laute Songs)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
    ctx.onstatechange = notify;
    return ctx;
  }
  function notify() { listeners.forEach(fn => { try { fn(status()); } catch (_) {} }); }
  function status() { return { enabled: enabled(), locked: !ctx || ctx.state !== 'running', supported: Boolean(window.AudioContext || window.webkitAudioContext) }; }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function enabled() { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (_) { return true; } }
  function setEnabled(value) {
    try { localStorage.setItem(SOUND_KEY, value ? '1' : '0'); } catch (_) {}
    if (!value) stop();
    else unlock();
    notify();
  }

  /** Muss aus einem Klick/Tipp heraus aufgerufen werden (oder passiert automatisch bei jeder Interaktion). */
  async function unlock() {
    const context = audioContext();
    if (!context) return false;
    try { if (context.state !== 'running') await context.resume(); } catch (_) {}
    notify();
    return context.state === 'running';
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(type => document.addEventListener(type, () => { if (!ctx || ctx.state !== 'running') unlock(); }, { capture: true, passive: true }));

  function resolveUrl(url) {
    const clean = window.SchmobinApp?.sanitizeURL ? window.SchmobinApp.sanitizeURL(url) : url;
    try { return new URL(clean, location.href).href; } catch (_) { return clean; }
  }
  function preload(url) {
    const href = resolveUrl(url);
    if (!href) return Promise.resolve(null);
    if (!buffers.has(href)) {
      const context = audioContext();
      if (!context) return Promise.resolve(null);
      const promise = fetch(href)
        .then(response => { if (!response.ok) throw new Error(`Audio nicht gefunden (${response.status})`); return response.arrayBuffer(); })
        .then(data => new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject)))
        .catch(error => { buffers.delete(href); console.warn('Audio konnte nicht geladen werden:', href, error); return null; });
      buffers.set(href, promise);
    }
    return buffers.get(href);
  }

  /* ---------- Pegel-Analyse (einmal pro Datei) ---------- */
  const TARGET_RMS = 0.12;     // ca. -18 dBFS
  const SILENCE = 0.02;        // alles darunter gilt als Stille
  const analysis = new WeakMap();
  function analyse(buffer) {
    if (analysis.has(buffer)) return analysis.get(buffer);
    let sum = 0, count = 0;
    const channels = Math.min(buffer.numberOfChannels, 2);
    for (let c = 0; c < channels; c += 1) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i += 16) { const v = data[i]; if (Math.abs(v) > 0.003) { sum += v * v; count += 1; } }
    }
    const rms = count ? Math.sqrt(sum / count) : TARGET_RMS;
    const result = { rms, gain: Math.max(0.2, Math.min(2, TARGET_RMS / (rms || TARGET_RMS))) };
    analysis.set(buffer, result);
    return result;
  }
  /** Erste hörbare Stelle ab offset (max. 6 s weiter), sonst offset selbst. */
  function firstSound(buffer, offset) {
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const from = Math.floor(offset * rate);
    const to = Math.min(data.length, from + Math.floor(6 * rate));
    for (let i = from; i < to; i += 1) if (Math.abs(data[i]) > SILENCE) return Math.max(offset, i / rate - 0.01);
    return offset;
  }

  function stop() {
    if (!current) return;
    try { current.source.stop(); } catch (_) {}
    current = null;
  }

  /**
   * Spielt einen Ausschnitt: offset (s ab Songanfang), duration (s), fade (s Ausblenden am Ende).
   * Liefert true, wenn abgespielt wurde.
   */
  async function play(url, { offset = 0, duration = 1, fade = 0, volume = 0.7, skipSilence = false } = {}) {
    if (!enabled()) return false;
    const context = audioContext();
    if (!context) return false;
    const buffer = await preload(url);
    if (!buffer) return false;
    if (context.state !== 'running') { await unlock(); if (context.state !== 'running') { notify(); return false; } }
    stop();
    let start = Math.max(0, Math.min(Number(offset) || 0, Math.max(0, buffer.duration - 0.05)));
    if (skipSilence) start = firstSound(buffer, start);
    const level = analyse(buffer).gain * Math.max(0, Math.min(1, Number(volume ?? 0.7)));
    const length = Math.max(0.02, Math.min(Number(duration) || 0.1, buffer.duration - start));
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const now = context.currentTime;
    const edge = Math.min(0.006, length / 4); // winzige Rampen verhindern Knacken
    const fadeOut = Math.max(edge, Math.min(Number(fade) || 0, length / 2));
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + edge);
    gain.gain.setValueAtTime(level, now + length - fadeOut);
    gain.gain.linearRampToValueAtTime(0, now + length);
    source.connect(gain).connect(master);
    source.start(now, start, length);
    const entry = { source, url };
    current = entry;
    source.onended = () => { if (current === entry) current = null; };
    return true;
  }

  /**
   * Spielt einen Befehl aus dem Spielstand genau einmal ab.
   * media: { nonce, kind: 'snippet'|'reveal', stage, questionId, at }
   * Den konkreten Ausschnitt liefert das Fragetyp-Modul (mediaClip).
   */
  function sync(media, question) {
    if (!media || !question || media.questionId !== question.id) return;
    if (media.nonce === lastNonce) return;
    const first = lastNonce === null;
    lastNonce = media.nonce;
    const age = Date.now() - (Number(media.at) || 0);
    if (first && age > MAX_COMMAND_AGE_MS) return; // Seite wurde neu geladen – alten Befehl nicht wiederholen
    if (age > MAX_COMMAND_AGE_MS * 4) return;
    const clip = window.SchmobinQuiz?.typeDef(question.type)?.mediaClip?.(question, media);
    if (clip?.url) play(clip.url, clip);
  }

  window.SylasphereMedia = { preload, play, stop, unlock, enabled, setEnabled, status, onChange, sync };
})();
