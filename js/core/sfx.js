(function () {
  'use strict';

  /*
   * Soundeffekte und Vibration (v27)
   * ------------------------------------------------------------------
   * Alle Töne werden im Browser erzeugt (Web Audio, keine Dateien, keine Lizenzfragen).
   * Einstellungen pro Gerät in ⚙️:
   *  - Soundeffekte an/aus – getrennt für Spieler-, Zuschauer- und Moderator-Seite
   *    (Standard: Spieler und Zuschauer an, Moderator aus, damit es am selben Rechner nicht doppelt klingt)
   *  - Lautstärke der Soundeffekte (gemeinsam, Standard 70 %)
   *  - Vibration an/aus (nur Handys mit Vibrations-Unterstützung, z. B. Android; iPhones unterstützen das im Browser nicht)
   *
   * Aufruf: SylasphereSfx.play('correct'), SylasphereSfx.vibrate('turn').
   */
  const VOLUME_KEY = 'sylasphere:sfx-volume';
  const VIBRATE_KEY = 'sylasphere:vibrate';
  const role = () => document.body?.dataset.role || (/moderator/.test(location.pathname) ? 'moderator' : /zuschauer/.test(location.pathname) ? 'spectator' : 'player');
  const enabledKey = () => `sylasphere:sfx:${role()}`;
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) {} };

  function enabled() { return read(enabledKey(), role() === 'moderator' ? '0' : '1') === '1'; }
  function setEnabled(on) { write(enabledKey(), on ? '1' : '0'); if (on) unlock(); }
  function volume() { const v = Number(read(VOLUME_KEY, 70)); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 70; }
  function setVolume(v) { const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); write(VOLUME_KEY, n); if (master) master.gain.value = n / 100 * 0.6; return n; }
  const vibrationSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  function vibrationEnabled() { return read(VIBRATE_KEY, '1') === '1'; }
  function setVibration(on) { write(VIBRATE_KEY, on ? '1' : '0'); }

  // ---------------------------------------------------------------- Audio
  let ctx = null;
  let master = null;
  function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume() / 100 * 0.6;
    master.connect(ctx.destination);
    return ctx;
  }
  function unlock() { const c = audio(); if (c && c.state !== 'running') c.resume().catch(() => {}); }
  ['pointerdown', 'keydown', 'touchend'].forEach(type => document.addEventListener(type, () => { if (enabled()) unlock(); }, { capture: true, passive: true }));

  /** Ein Ton: Frequenz (Hz), Start (s), Dauer (s), Wellenform, Lautstärke, optional Tonhöhen-Gleiten */
  function tone(c, { f = 440, at = 0, d = 0.15, type = 'sine', v = 0.5, to = null }) {
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + d + 0.02);
  }
  function noise(c, { at = 0, d = 0.2, v = 0.3, hp = 800 }) {
    const t0 = c.currentTime + at;
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * d)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(); src.buffer = buffer;
    const filter = c.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = hp;
    const g = c.createGain(); g.gain.value = v;
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }
  const SOUNDS = {
    open: c => { tone(c, { f: 520, d: 0.12, type: 'triangle', v: 0.35 }); tone(c, { f: 780, at: 0.09, d: 0.16, type: 'triangle', v: 0.35 }); },
    tick: c => tone(c, { f: 1100, d: 0.05, type: 'square', v: 0.12 }),
    last: c => tone(c, { f: 1400, d: 0.09, type: 'square', v: 0.18 }),
    lock: c => { tone(c, { f: 660, d: 0.1, type: 'triangle', v: 0.3 }); tone(c, { f: 440, at: 0.08, d: 0.18, type: 'triangle', v: 0.3 }); },
    correct: c => { tone(c, { f: 660, d: 0.12, type: 'triangle', v: 0.4 }); tone(c, { f: 880, at: 0.1, d: 0.12, type: 'triangle', v: 0.4 }); tone(c, { f: 1320, at: 0.2, d: 0.28, type: 'triangle', v: 0.35 }); },
    wrong: c => { tone(c, { f: 220, d: 0.18, type: 'sawtooth', v: 0.18, to: 160 }); tone(c, { f: 180, at: 0.16, d: 0.3, type: 'sawtooth', v: 0.18, to: 110 }); },
    reveal: c => { [523, 659, 784].forEach((f, i) => tone(c, { f, at: i * 0.07, d: 0.5, type: 'triangle', v: 0.25 })); tone(c, { f: 1047, at: 0.24, d: 0.6, type: 'triangle', v: 0.3 }); noise(c, { at: 0.22, d: 0.35, v: 0.12, hp: 3000 }); },
    buzz: c => { tone(c, { f: 180, d: 0.35, type: 'square', v: 0.22 }); tone(c, { f: 185, d: 0.35, type: 'sawtooth', v: 0.12 }); },
    turn: c => { tone(c, { f: 880, d: 0.1, type: 'sine', v: 0.4 }); tone(c, { f: 1175, at: 0.12, d: 0.2, type: 'sine', v: 0.4 }); },
    join: c => tone(c, { f: 740, d: 0.12, type: 'sine', v: 0.3, to: 990 }),
    pop: c => tone(c, { f: 600, d: 0.08, type: 'sine', v: 0.2, to: 900 }),
    fanfare: c => { const notes = [523, 523, 523, 659, 784, 659, 784]; const times = [0, 0.12, 0.24, 0.36, 0.6, 0.78, 0.9]; notes.forEach((f, i) => tone(c, { f, at: times[i], d: i === notes.length - 1 ? 0.8 : 0.16, type: 'triangle', v: 0.35 })); noise(c, { at: 0.9, d: 0.6, v: 0.1, hp: 4000 }); }
  };
  const lastPlayed = new Map();
  function play(name) {
    if (!enabled() || !SOUNDS[name]) return false;
    const c = audio();
    if (!c) return false;
    if (c.state !== 'running') { c.resume().catch(() => {}); if (c.state !== 'running') return false; }
    const now = Date.now();
    if (now - (lastPlayed.get(name) || 0) < 80) return false; // doppelte Auslöser zusammenfassen
    lastPlayed.set(name, now);
    try { SOUNDS[name](c); return true; } catch (_) { return false; }
  }

  // ---------------------------------------------------------------- Vibration
  const PATTERNS = { buzz: 80, turn: [120, 60, 120], correct: 60, wrong: [70, 50, 70], lock: 40, last: 30, finish: [100, 80, 100, 80, 200] };
  function vibrate(name) {
    if (!vibrationEnabled() || !vibrationSupported()) return false;
    try { return navigator.vibrate(PATTERNS[name] ?? 50); } catch (_) { return false; }
  }

  /** Ton + Vibration zusammen */
  function cue(name) { play(name); vibrate(name); }

  // ---------------------------------------------------------------- Auslöser aus dem Spielstand
  /*
   * observe(state, { current, playerId }) wird bei jeder Zustandsänderung aufgerufen und
   * spielt passende Effekte, wenn sich etwas geändert hat (Frage offen, geschlossen, aufgelöst,
   * Buzzer, „Du bist dran“, Spielende …). Beim ersten Aufruf (Seite neu geladen) wird nichts gespielt.
   */
  let last = null;
  function observe(state, { current, playerId = '' } = {}) {
    if (!state) return;
    const q = current?.question || null;
    const qid = q?.id || '';
    const resolved = Boolean(qid && state.scoredQuestionIds?.includes(qid));
    const game = state.game && state.game.questionId === qid ? state.game : null;
    const buzz = q?.type === 'buzzer' ? state.questionResults?.[qid] : null;
    const snap = {
      status: state.status, qid, open: Boolean(state.questionOpen), started: Boolean(state.questionStartedAt), resolved,
      players: (state.players || []).length,
      contender: buzz?.contenderId || '',
      turn: game && game.phase === 'play' ? `${game.active}|${game.turn ?? game.pos}` : '',
      active: game?.active || '',
      reveal: game?.phase === 'reveal' && game.reveal ? `${game.reveal.by}|${game.reveal.until}` : '',
      revealReason: game?.reveal?.reason || '', revealBy: game?.reveal?.by || '',
      own: playerId && qid ? state.answers?.[qid]?.[playerId] : null
    };
    const prev = last;
    last = snap;
    if (!prev) return;
    if (snap.status === 'finished' && prev.status !== 'finished') { play('fanfare'); vibrate('finish'); return; }
    if (snap.status === 'lobby' && snap.players > prev.players) play('join');
    if (snap.qid && snap.started && snap.open && (!prev.open || prev.qid !== snap.qid)) play('open');
    if (snap.qid === prev.qid && prev.open && !snap.open && !snap.resolved && !game) cue('lock');
    if (snap.contender && snap.contender !== prev.contender) { play('buzz'); if (snap.contender === playerId) vibrate('buzz'); }
    if (snap.turn && snap.turn !== prev.turn && playerId && snap.active === playerId) cue('turn');
    if (snap.reveal && snap.reveal !== prev.reveal) {
      const good = snap.revealReason === 'correct';
      if (snap.revealReason !== 'skip') play(good ? 'correct' : 'wrong');
      if (playerId && snap.revealBy === playerId) vibrate(good ? 'correct' : 'wrong');
    }
    if (snap.resolved && !prev.resolved && snap.qid === prev.qid) {
      if (playerId && snap.own && !game) {
        const good = Number(snap.own.awardedPoints) > 0;
        cue(good ? 'correct' : 'wrong');
      } else play('reveal');
    }
  }
  /** Countdown der letzten Sekunden (vom Timer der Seite aufgerufen) */
  let lastTick = null;
  function countdown(seconds) {
    if (seconds == null || seconds === lastTick) return;
    lastTick = seconds;
    if (seconds > 0 && seconds <= 5) { play(seconds === 1 ? 'last' : 'tick'); if (seconds === 3) vibrate('last'); }
  }

  window.SylasphereSfx = { observe, countdown, play, vibrate, cue, enabled, setEnabled, volume, setVolume, vibrationEnabled, setVibration, vibrationSupported, role, SOUNDS: Object.keys(SOUNDS) };
})();
