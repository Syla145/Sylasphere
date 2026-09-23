(function () {
  'use strict';

  /*
   * Themenbibliothek (v15)
   * ------------------------------------------------------------------
   * Jede Frage hat ein Thema (Feld `category`, Klartext wie „Geschichte“).
   * Hier wird dem Namen ein Icon und eine Farbe zugeordnet:
   *   1. eigene Themen des Quiz (quiz.categories: { name, icon, color })
   *   2. diese Bibliothek (inkl. Alias-Namen)
   *   3. sonst automatisch: 🏷️ + Farbe aus dem Namen berechnet
   *
   * Neues Bibliotheks-Thema: einfach unten in LIBRARY ergänzen.
   * hue = Farbton 0–360 (0 rot, 120 grün, 210 blau, 280 lila …)
   */
  const LIBRARY = [
    { name: 'Allgemeinwissen', icon: '🧠', hue: 262, aliases: ['Wissen', 'Quiz'] },
    { name: 'Geschichte', icon: '🏛️', hue: 32, aliases: ['Historie'] },
    { name: 'Geografie', icon: '🌍', hue: 168, aliases: ['Erdkunde', 'Länder', 'Länder & Städte'] },
    { name: 'Wissenschaft', icon: '🔬', hue: 196, aliases: ['Naturwissenschaft', 'Physik', 'Chemie', 'Biologie'] },
    { name: 'Technik', icon: '💻', hue: 214, aliases: ['Computer', 'IT', 'Technologie'] },
    { name: 'Weltraum', icon: '🚀', hue: 244, aliases: ['Astronomie', 'Space'] },
    { name: 'Natur & Tiere', icon: '🦊', hue: 104, aliases: ['Tiere', 'Natur', 'Pflanzen'] },
    { name: 'Sport', icon: '⚽', hue: 136, aliases: ['Fußball', 'Olympia'] },
    { name: 'Musik', icon: '🎵', hue: 318, aliases: ['Musik & Sounds', 'Songs', 'Hits'] },
    { name: 'Filme & Serien', icon: '🎬', hue: 350, aliases: ['Film', 'Filme', 'Serien', 'Kino', 'TV'] },
    { name: 'Gaming', icon: '🎮', hue: 282, aliases: ['Videospiele', 'Games'] },
    { name: 'Internet & Popkultur', icon: '📱', hue: 296, aliases: ['Popkultur', 'Community & Popkultur', 'Social Media', 'Memes'] },
    { name: 'Promis', icon: '🌟', hue: 46, aliases: ['Stars', 'Prominente'] },
    { name: 'Essen & Trinken', icon: '🍕', hue: 18, aliases: ['Essen', 'Kochen', 'Getränke'] },
    { name: 'Reisen', icon: '✈️', hue: 186, aliases: ['Urlaub'] },
    { name: 'Kunst & Kultur', icon: '🎨', hue: 330, aliases: ['Kunst', 'Kultur', 'Café & Kultur'] },
    { name: 'Literatur', icon: '📚', hue: 24, aliases: ['Bücher'] },
    { name: 'Sprache & Wörter', icon: '🔤', hue: 228, aliases: ['Sprache', 'Wortwissen', 'Wörter', 'Deutsch'] },
    { name: 'Mathe & Logik', icon: '🧮', hue: 200, aliases: ['Mathe', 'Logik', 'Rätsel'] },
    { name: 'Politik & Gesellschaft', icon: '🗳️', hue: 6, aliases: ['Politik', 'Gesellschaft'] },
    { name: 'Wirtschaft', icon: '💶', hue: 150, aliases: ['Geld', 'Marken'] },
    { name: 'Autos & Verkehr', icon: '🚗', hue: 0, aliases: ['Autos', 'Verkehr'] },
    { name: 'Mode & Lifestyle', icon: '👗', hue: 312, aliases: ['Mode', 'Lifestyle'] },
    { name: 'Kindheit & Nostalgie', icon: '🧸', hue: 38, aliases: ['Kindheit', 'Nostalgie', '90er', '2000er'] },
    { name: 'Feiertage', icon: '🎄', hue: 128, aliases: ['Weihnachten', 'Ostern', 'Halloween'] },
    { name: 'Rekorde', icon: '🏆', hue: 48, aliases: ['Weltrekorde'] },
    { name: 'Bilderrätsel', icon: '🖼️', hue: 176, aliases: ['Bilder', 'Bildquiz'] },
    { name: 'Schätzfragen', icon: '📏', hue: 58, aliases: ['Schätzen'] },
    { name: 'Dilemma', icon: '🤔', hue: 272, aliases: ['Meinung', 'Würdest du eher'] }
  ];
  const FALLBACK_ICON = '🏷️';

  function key(value) { return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE'); }
  function hashHue(value) {
    const text = key(value) || 'kategorie'; let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash) % 360;
  }
  function hexToHue(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }
  function hueToHex(hue) {
    const s = 0.7, l = 0.58, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  }

  const libraryIndex = new Map();
  LIBRARY.forEach(topic => [topic.name, ...(topic.aliases || [])].forEach(name => libraryIndex.set(key(name), topic)));

  /** Eigene Themen eines Quiz in eine saubere Form bringen: [{ name, icon?, color? }] */
  function normalizeCustom(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map(item => {
      const raw = item && typeof item === 'object' ? item : { name: item };
      const topic = { name: String(raw.name ?? raw.title ?? raw.id ?? '').normalize('NFKC').trim() };
      const icon = String(raw.icon || '').trim();
      const color = String(raw.color || '').trim();
      if (icon) topic.icon = icon.slice(0, 8);
      if (hexToHue(color) != null) topic.color = color.startsWith('#') ? color.toLowerCase() : `#${color.toLowerCase()}`;
      return topic;
    }).filter(topic => topic.name && !seen.has(key(topic.name)) && seen.add(key(topic.name)));
  }

  // Aktive eigene Themen (das gerade geladene Quiz). Views setzen sie über use().
  let active = new Map();
  function use(customList) {
    active = new Map(normalizeCustom(customList).map(topic => [key(topic.name), topic]));
  }
  function customListOf(quizLike) {
    const q = quizLike?.quiz || quizLike;
    return q?.categories || [];
  }

  /** Icon/Farbe für einen Themennamen. customList optional (sonst aktives Quiz). */
  function resolve(name, customList) {
    const clean = String(name || '').normalize('NFKC').trim();
    const map = customList ? new Map(normalizeCustom(customList).map(topic => [key(topic.name), topic])) : active;
    const custom = map.get(key(clean));
    const lib = libraryIndex.get(key(clean));
    const hue = custom?.color != null ? hexToHue(custom.color) : lib ? lib.hue : hashHue(clean);
    return {
      name: clean || 'Ohne Thema',
      icon: custom?.icon || lib?.icon || FALLBACK_ICON,
      hue,
      color: custom?.color || hueToHex(hue),
      source: custom ? 'custom' : lib ? 'library' : 'auto',
      libraryName: lib?.name || ''
    };
  }

  function library() { return LIBRARY.map(topic => ({ name: topic.name, icon: topic.icon, hue: topic.hue, color: hueToHex(topic.hue) })); }
  function isLibrary(name) { return libraryIndex.has(key(name)); }

  window.SylasphereTopics = { library, resolve, use, normalizeCustom, customListOf, isLibrary, key, hexToHue, hueToHex, FALLBACK_ICON };
})();
