(function () {
  'use strict';

  /*
   * Designs / Themes (v17, ausgebaut in v29)
   * ------------------------------------------------------------------
   * Ein Theme besteht aus bis zu drei Teilen:
   *   1. Eintrag in THEMES unten (Name, Beschreibung, Vorschaufarben) – Pflicht
   *   2. Aussehen: CSS-Variablen + Formen/Animationen
   *      – alte Designs direkt in css/main.css (html[data-theme="…"])
   *      – ab v29 eine eigene Datei css/themes/<id>.css (in css/themes/index.css eintragen)
   *   3. Effekte (optional): js/themes/<id>.js mit SylasphereThemes.register({ … })
   *      decor       – Deko-Elemente im Hintergrund (Klassennamen, gestaltet im CSS)
   *      transition  – Übergang zwischen Fragen { duration, html(ctx, esc) }
   *      ceremony    – Siegerehrung { effect: 'confetti'|'rays'|'none', title(ctx), before(ctx), extra(ctx) }
   *                    before = über dem Titel, extra = zwischen Titel und Podest
   *      sounds      – Sound-Paket { open, tick, last, lock, correct, wrong, reveal, buzz, turn, fanfare, transition }
   *                    jede Funktion bekommt s = { tone(o), noise(o) } (siehe js/core/sfx.js)
   *
   * Das Theme eines Quiz steht in quiz.settings.theme, optional pro Runde in round.theme.
   * Moderator, Spieler und Zuschauer übernehmen es automatisch (online über die Quiz-Übersicht).
   *
   * „Animationen reduzieren“ (⚙️, pro Gerät): html[data-motion="reduced"] – ohne eigene Wahl
   * folgt es der Systemeinstellung (prefers-reduced-motion).
   *
   * Diese Datei wird OHNE defer im <head> geladen, damit beim Seitenaufbau
   * sofort das zuletzt genutzte Design aktiv ist (kein Aufblitzen).
   * Die Theme-IDs sind bewusst neutral (kart, legends, geo, tactical): Wird die Seite öffentlich,
   * ändert man nur die Namen, gespeicherte Quizze funktionieren weiter.
   */
  const THEMES = [
    { id: 'neon', name: 'Neon Arena', description: 'Dunkel, Lila & Türkis – der Klassiker.', meta: '#0a1020', swatch: ['#0c1327', '#7c5cff', '#28d7d0', '#f7f8fb'] },
    { id: 'retro', name: 'Retro-Show', description: '70er-Spielshow mit Gold, Rot und Sonnenstrahlen.', meta: '#1c0c09', swatch: ['#2a0f0a', '#f5a800', '#ff6a3d', '#fff4e0'] },
    { id: 'light', name: 'Clean Light', description: 'Hell und ruhig – ideal für Beamer und Tageslicht.', meta: '#f3f5fb', swatch: ['#f3f5fb', '#4f46e5', '#0d9488', '#152033'] },
    { id: 'pub', name: 'Pub Quiz', description: 'Kreidetafel, Holz und Bernstein.', meta: '#18251d', swatch: ['#1b2a21', '#e8a33a', '#8cc8f0', '#f3f0e6'] },
    // v29 – mit Hintergrund, Deko, Sound-Paket, Übergang und Siegerehrung (js/themes/<id>.js + css/themes/<id>.css)
    { id: 'kart', name: 'Mario Kart', description: 'Rennstrecke: Zielflagge, Startampel, knallige Farben.', meta: '#0f1a44', swatch: ['#13205a', '#ffd21f', '#e8302a', '#2bb34a'], fx: true },
    { id: 'legends', name: 'League of Legends', description: 'Dunkles Blau, Gold und magisches Türkis.', meta: '#070d18', swatch: ['#0a1322', '#c8aa6e', '#0bc4e3', '#f0e6d2'], fx: true },
    { id: 'geo', name: 'GeoGuessr', description: 'Landkarte mit Höhenlinien, Nadeln und Kompass.', meta: '#160f33', swatch: ['#1c1440', '#7ee36b', '#ffd23f', '#f4f1ff'], fx: true },
    { id: 'tactical', name: 'Valorant', description: 'Taktik-Shooter: Signalrot, Creme, kantige Formen.', meta: '#0f1419', swatch: ['#111820', '#ff4655', '#ece8e1', '#1f2933'], fx: true }
  ];
  const DEFAULT = 'neon';
  const LAST_KEY = 'sylasphere:last-theme';
  const PREVIEW_KEY = 'sylasphere:theme-preview';
  const DEVICE_KEY = 'sylasphere:device-theme'; // v26: Einstellung „Design auf diesem Gerät“
  const MOTION_KEY = 'sylasphere:motion';       // v29: '' = wie System, 'reduced', 'full'
  const byId = id => THEMES.find(theme => theme.id === id);
  const hasDocument = () => typeof document !== 'undefined' && document && typeof document.createElement === 'function';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

  function storage(fn) { try { return fn(window.localStorage); } catch (_) { return null; } }
  function valid(id) { return byId(id) ? id : DEFAULT; }

  // Vorschau-Override: ?theme=retro in der Adresse (zum Ausprobieren) oder im Editor gesetzt
  function override() {
    let fromUrl = '';
    try { fromUrl = new URLSearchParams(location.search).get('theme') || ''; } catch (_) {}
    if (byId(fromUrl)) return fromUrl;
    const preview = storage(s => s.getItem(PREVIEW_KEY));
    if (byId(preview)) return preview;
    const device = storage(s => s.getItem(DEVICE_KEY));
    return byId(device) ? device : '';
  }
  let quizTheme = DEFAULT;
  /** v26: eigenes Design für dieses Gerät ('' = wie im Quiz) */
  function setDeviceTheme(id) {
    storage(s => (byId(id) ? s.setItem(DEVICE_KEY, id) : s.removeItem(DEVICE_KEY)));
    active = '';
    return apply(quizTheme, { remember: false });
  }
  const deviceTheme = () => { const id = storage(s => s.getItem(DEVICE_KEY)); return byId(id) ? id : ''; };

  // ---------------------------------------------------------------- Effekte pro Theme (v29)
  const defs = new Map();
  const DEFAULT_FX = Object.freeze({ decor: [], transition: null, ceremony: null, sounds: null });
  function register(def) {
    if (!def?.id) throw new Error('Theme-Effekte brauchen eine id.');
    defs.set(def.id, Object.assign({}, DEFAULT_FX, def));
    if (def.id === active) renderStage();
    return defs.get(def.id);
  }
  const fx = (id = active) => defs.get(id) || DEFAULT_FX;

  let active = '';
  function apply(id, { remember = true } = {}) {
    const theme = byId(override() || valid(id));
    if (active === theme.id) return theme.id;
    active = theme.id;
    const root = document.documentElement;
    if (theme.id === DEFAULT) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.meta);
    if (remember) storage(s => s.setItem(LAST_KEY, theme.id));
    renderStage();
    return theme.id;
  }
  /** Design aus einem Quiz übernehmen (Moderator, Spieler, Zuschauer); v29: optional Theme der Runde */
  function applyQuiz(quizLike, roundIndex) {
    const quiz = quizLike?.quiz || quizLike;
    const roundTheme = Number.isInteger(roundIndex) ? quiz?.rounds?.[roundIndex]?.theme : '';
    quizTheme = byId(roundTheme) ? roundTheme : valid(quiz?.settings?.theme || DEFAULT);
    return apply(quizTheme);
  }

  // ---------------------------------------------------------------- Animationen reduzieren (v29)
  function motionSetting() { const v = storage(s => s.getItem(MOTION_KEY)); return v === 'reduced' || v === 'full' ? v : ''; }
  function systemReduced() { try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } }
  function reducedMotion() { const v = motionSetting(); return v === 'reduced' || (v === '' && systemReduced()); }
  function applyMotion() { document.documentElement?.setAttribute?.('data-motion', reducedMotion() ? 'reduced' : 'full'); }
  function setMotion(value) {
    storage(s => (value === 'reduced' || value === 'full' ? s.setItem(MOTION_KEY, value) : s.removeItem(MOTION_KEY)));
    applyMotion();
    return motionSetting();
  }
  try { window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyMotion); } catch (_) {}

  // ---------------------------------------------------------------- Hintergrund + Deko (v29)
  /*
   * <div class="theme-stage"> liegt fest hinter allem (z-index −1, nicht anklickbar):
   * drei Ebenen für Muster/Animationen und die Deko-Elemente des Themes.
   * Inhalte (Fragen, Ranglisten) liegen auf Flächen darüber – die Deko kann nichts verdecken.
   */
  function renderStage() {
    if (!hasDocument() || !document.body) return;
    let stage = document.querySelector('.theme-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'theme-stage';
      stage.setAttribute('aria-hidden', 'true');
      document.body.prepend(stage);
      document.documentElement.classList.add('has-theme-stage');
    }
    const decor = (fx().decor || []).map(name => `<i class="theme-deco theme-deco--${esc(name)}"></i>`).join('');
    const html = `<div class="theme-layer theme-layer--1"></div><div class="theme-layer theme-layer--2"></div><div class="theme-layer theme-layer--3"></div>${decor}`;
    if (stage.dataset.theme !== active || stage.innerHTML !== html) { stage.innerHTML = html; stage.dataset.theme = active; }
  }

  // ---------------------------------------------------------------- Übergang zwischen Fragen (v29)
  let transitionTimer = null;
  function transition(ctx = {}) {
    if (!hasDocument() || !document.body) return false;
    document.querySelector('.theme-transition')?.remove();
    clearTimeout(transitionTimer);
    const def = fx().transition;
    const el = document.createElement('div');
    el.className = `theme-transition theme-transition--${active}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = def?.html ? def.html(ctx, esc) : `<div class="tt-card">${ctx.kicker ? `<small>${esc(ctx.kicker)}</small>` : ''}<strong>${esc(ctx.title || '')}</strong>${ctx.sub ? `<span>${esc(ctx.sub)}</span>` : ''}</div>`;
    document.body.append(el);
    window.SylasphereSfx?.play('transition');
    const duration = reducedMotion() ? 700 : Math.max(600, Number(def?.duration) || 1200);
    el.style.setProperty('--tt-duration', `${duration}ms`);
    transitionTimer = setTimeout(() => el.remove(), duration + 60);
    return true;
  }

  /*
   * Wird von Spieler-, Zuschauer- und Moderator-Seite bei jeder Zustandsänderung aufgerufen.
   * Wechselt der Moderator zur nächsten Frage (oder startet das Spiel), läuft der Übergang.
   * Beim ersten Aufruf (Seite neu geladen) passiert nichts.
   */
  let lastPosition = null;
  function observe(state) {
    if (!state) return null;
    const key = `${state.status}|${state.currentRoundIndex}|${state.currentQuestionIndex}`;
    const prev = lastPosition;
    lastPosition = { key, status: state.status, round: state.currentRoundIndex, code: state.code };
    if (!prev || prev.code !== state.code || prev.key === key || state.status !== 'playing' || state.questionOpen) return null;
    const quiz = state.quiz?.quiz || state.quiz || {};
    const rounds = quiz.rounds || [];
    const round = rounds[state.currentRoundIndex] || {};
    const question = round.questions?.[state.currentQuestionIndex] || {};
    let n = state.currentQuestionIndex + 1;
    for (let i = 0; i < state.currentRoundIndex; i++) n += rounds[i]?.questions?.length || 0;
    const total = rounds.reduce((sum, r) => sum + (r.questions?.length || 0), 0);
    const newRound = prev.status !== 'playing' || prev.round !== state.currentRoundIndex;
    const ctx = newRound
      ? { kind: 'round', kicker: rounds.length > 1 ? `Runde ${state.currentRoundIndex + 1} von ${rounds.length}` : 'Los geht’s', title: round.title || `Runde ${state.currentRoundIndex + 1}`, sub: `Frage ${n} von ${total}`, round: state.currentRoundIndex + 1, question: n, total }
      : { kind: 'question', kicker: round.title || '', title: `Frage ${n} / ${total}`, sub: question.category || '', round: state.currentRoundIndex + 1, question: n, total };
    transition(ctx);
    return ctx; // für Tests
  }

  // ---------------------------------------------------------------- Siegerehrung (v29)
  /**
   * Siegerehrung für alle drei Seiten. ranked = sortierte Spieler; role = player|spectator|moderator.
   * → HTML des kompletten Final-Bildschirms. options: { eyebrow, title, after, className }
   */
  function ceremony(ranked, options = {}) {
    const def = fx().ceremony || {};
    const App = window.SchmobinApp;
    const avatar = value => esc(App?.avatar ? App.avatar(value) : value);
    const points = value => esc(App?.formatPoints ? App.formatPoints(value) : `${Math.round(Number(value) || 0)} P`);
    const ctx = { ranked, role: options.role || 'player', place: options.place || 0, winner: ranked[0] || null, esc, avatar, points };
    const top = ranked.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const podium = order.map(player => {
      const rank = ranked.findIndex(p => p.id === player.id) + 1;
      return `<div class="podium-place podium-place--${rank}"><div class="podium-avatar">${avatar(player.avatar)}</div><strong>${esc(player.name)}</strong><span>${points(player.score)}</span><b>${rank}</b></div>`;
    }).join('');
    const effect = reducedMotion() ? 'none' : (def.effect || 'none');
    const pieces = effect === 'confetti' ? Array.from({ length: 28 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.18}s"></i>`).join('') : effect === 'rays' ? '<i></i>' : '';
    const title = def.title ? def.title(ctx) : null;
    const extra = def.extra ? def.extra(ctx) : '';
    const before = def.before ? def.before(ctx) : '';
    const Tag = options.role === 'spectator' ? 'h1' : 'h2';
    return `<div class="final-screen ceremony ceremony--${active} ${options.className || ''}">${pieces ? `<div class="ceremony-fx ceremony-fx--${effect}" aria-hidden="true">${pieces}</div>` : ''}<span class="eyebrow">${esc(options.eyebrow || 'Finale')}</span>${before}<${Tag}>${title != null ? title : (options.title || '')}</${Tag}>${extra}<div class="podium">${podium}</div>${options.after || ''}</div>`;
  }

  /** Sound-Paket des aktiven Themes (oder null = Standard-Töne) */
  const sounds = () => fx().sounds || null;

  // ---------------------------------------------------------------- Laden
  // Sofort beim Laden: zuletzt genutztes Design (Spieler sehen so direkt den richtigen Look)
  apply(storage(s => s.getItem(LAST_KEY)) || DEFAULT, { remember: false });
  applyMotion();
  if (hasDocument()) {
    // Effekt-Dateien der Themes nachladen (js/themes/<id>.js), wie bei den Fragetypen
    const self = document.currentScript?.src || '';
    const baseUrl = self ? new URL('../themes/', self) : null;
    const version = self ? new URL(self).search : '';
    if (baseUrl && document.head) THEMES.filter(t => t.fx).forEach(t => {
      const script = document.createElement('script');
      script.src = new URL(`${t.id}.js`, baseUrl).href + version;
      script.async = false;
      script.onerror = () => console.warn(`Theme-Effekte fehlen: js/themes/${t.id}.js`);
      document.head.append(script);
    });
    document.addEventListener?.('DOMContentLoaded', renderStage);
  }

  /** Auswahl mit Farbvorschau (Editor, Moderator). onChange(id) */
  function picker(current, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'theme-picker';
    wrap.setAttribute('role', 'radiogroup');
    THEMES.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `theme-option${theme.id === valid(current) ? ' is-selected' : ''}`;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(theme.id === valid(current)));
      button.dataset.themeId = theme.id;
      button.title = theme.description;
      const swatch = document.createElement('span');
      swatch.className = 'theme-swatch';
      swatch.style.background = theme.swatch[0];
      theme.swatch.slice(1).forEach(color => { const dot = document.createElement('i'); dot.style.background = color; swatch.append(dot); });
      const name = document.createElement('strong'); name.textContent = theme.name;
      button.append(swatch, name);
      button.addEventListener('click', () => {
        wrap.querySelectorAll('.theme-option').forEach(b => { b.classList.toggle('is-selected', b === button); b.setAttribute('aria-checked', String(b === button)); });
        onChange(theme.id);
      });
      wrap.append(button);
    });
    return wrap;
  }

  window.SylasphereThemes = {
    list: () => THEMES.map(t => Object.assign({}, t)), get: byId, apply, applyQuiz, picker, current: () => active, DEFAULT,
    isValid: id => Boolean(byId(id)), setDeviceTheme, deviceTheme,
    // v29
    register, fx, observe, transition, ceremony, sounds, motionSetting, setMotion, reducedMotion
  };
})();
