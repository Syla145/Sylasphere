(function () {
  'use strict';

  /*
   * Designs / Templates (v17)
   * ------------------------------------------------------------------
   * Ein Design ist ein Satz CSS-Variablen in css/main.css (html[data-theme="…"]).
   * Das Design eines Quiz steht in quiz.settings.theme und wird von Moderator,
   * Spielern und Zuschauern automatisch übernommen (online über die Quiz-Übersicht).
   *
   * Neues Design: in css/main.css einen Block html[data-theme="id"] { … } anlegen
   * und hier in THEMES eintragen (swatch = Vorschaufarben für die Auswahl).
   *
   * Diese Datei wird OHNE defer im <head> geladen, damit beim Seitenaufbau
   * sofort das zuletzt genutzte Design aktiv ist (kein Aufblitzen).
   */
  const THEMES = [
    { id: 'neon', name: 'Neon Arena', description: 'Dunkel, Lila & Türkis – der Klassiker.', meta: '#0a1020', swatch: ['#0c1327', '#7c5cff', '#28d7d0', '#f7f8fb'] },
    { id: 'retro', name: 'Retro-Show', description: '70er-Spielshow mit Gold, Rot und Sonnenstrahlen.', meta: '#1c0c09', swatch: ['#2a0f0a', '#f5a800', '#ff6a3d', '#fff4e0'] },
    { id: 'light', name: 'Clean Light', description: 'Hell und ruhig – ideal für Beamer und Tageslicht.', meta: '#f3f5fb', swatch: ['#f3f5fb', '#4f46e5', '#0d9488', '#152033'] },
    { id: 'pub', name: 'Pub Quiz', description: 'Kreidetafel, Holz und Bernstein.', meta: '#18251d', swatch: ['#1b2a21', '#e8a33a', '#8cc8f0', '#f3f0e6'] }
  ];
  const DEFAULT = 'neon';
  const LAST_KEY = 'sylasphere:last-theme';
  const PREVIEW_KEY = 'sylasphere:theme-preview';
  const DEVICE_KEY = 'sylasphere:device-theme'; // v26: Einstellung „Design auf diesem Gerät“
  const byId = id => THEMES.find(theme => theme.id === id);

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
    return theme.id;
  }
  /** Design aus einem Quiz übernehmen (Moderator, Spieler, Zuschauer) */
  function applyQuiz(quizLike) {
    const quiz = quizLike?.quiz || quizLike;
    quizTheme = valid(quiz?.settings?.theme || DEFAULT);
    return apply(quizTheme);
  }

  // Sofort beim Laden: zuletzt genutztes Design (Spieler sehen so direkt den richtigen Look)
  apply(storage(s => s.getItem(LAST_KEY)) || DEFAULT, { remember: false });

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

  window.SylasphereThemes = { list: () => THEMES.map(t => Object.assign({}, t)), get: byId, apply, applyQuiz, picker, current: () => active, DEFAULT, isValid: id => Boolean(byId(id)), setDeviceTheme, deviceTheme };
})();
