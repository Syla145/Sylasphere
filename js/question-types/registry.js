(function () {
  'use strict';

  /*
   * Fragetyp-Registry (v14)
   * ------------------------------------------------------------------
   * Jeder Fragetyp liegt als eigene Datei in js/question-types/types/
   * und meldet sich mit SylasphereTypes.register({...}) an.
   *
   * NEUEN FRAGETYP HINZUFÜGEN:
   *   1. Datei js/question-types/types/<typ>.js anlegen (Vorlage: README.md im selben Ordner)
   *   2. Den Dateinamen (ohne .js) unten in TYPE_FILES eintragen.
   * Mehr ist nicht nötig – Editor, Moderator, Spieler, Zuschauer, Prüfung,
   * Punktewertung und Online-Modus holen sich alles aus dem Modul.
   *
   * Die Reihenfolge in TYPE_FILES bestimmt die Reihenfolge in Auswahllisten.
   */
  const TYPE_FILES = [
    'multiple-choice',
    'true-false',
    'image-quiz',
    'audio-quiz',
    'song-reveal',
    'estimate',
    'sort',
    'matching',
    'gap-text',
    'fight-list',
    'higher-lower',
    'survey',
    'consensus',
    'hotspot',
    'buzzer',
    'time-duel',
    'ranking'
  ];

  const REQUIRED = ['type', 'label', 'icon', 'normalize', 'score', 'solutionText', 'render'];
  const types = new Map();

  function register(definition) {
    const missing = REQUIRED.filter(key => definition?.[key] == null);
    if (missing.length) throw new Error(`Fragetyp „${definition?.type || '?'}“ unvollständig – fehlt: ${missing.join(', ')}`);
    const def = Object.assign({
      description: '',
      solutionLabel: 'Lösung',
      defaults: () => ({}),
      validate: () => {},
      answerLabel: (q, answer) => String(answer ?? ''),
      hideSolution: () => {},
      editor: null,
      stats: null,
      resolve: null,
      moderatorSolution: null,
      moderatorAlwaysReveal: false,
      noTimer: false,
      review: null,          // 'manual' = Moderator prüft jede Antwort (✓/✗)
      autoCheck: null,       // Vorschlag für die Prüfung: (q, answer) => true | false | null
      publishAnswers: true,  // nach der Auflösung sehen alle die Antworten der anderen (v24: Standard; false = aus)
      reviewParts: null,     // (q) => [{ key, label }] – getrennte Prüfung, z. B. Titel/Interpret
      stages: null,          // (q) => [{ duration, percent }] – Stufen-Fragen (Song-Enthüllung)
      lockOnSubmit: false,   // Antwort nach Abgabe gesperrt
      mediaClip: null,       // (q, media) => { url, offset, duration, fade } – was bei einem Abspiel-Befehl läuft
      revealMedia: false,    // beim Auflösen automatisch mediaClip('reveal') abspielen
      update: null,          // (q, container, ctx) – Anzeige aktualisieren ohne Neuzeichnen
      game: null,            // Mini-Spiel mit eigenem Spielstand (state.game), z. B. Zeitduell – vom Moderator-Gerät gesteuert
      hidden: false,         // v24: im Editor nicht mehr neu auswählbar (alte Quizze funktionieren weiter)
      scoresAllPlayers: false, // Punkte für alle Spieler vergeben, auch ohne eigene Antwort (z. B. Platzierung im Zeitduell)
      interaction: 'answer'
    }, definition);
    types.set(def.type, Object.freeze(def));
    return def;
  }

  function get(type) { return types.get(String(type || '')) || null; }
  function has(type) { return types.has(String(type || '')); }
  // Reihenfolge wie in TYPE_FILES, danach eventuell zusätzlich registrierte Typen
  function list() {
    const ordered = TYPE_FILES.map(get).filter(Boolean);
    types.forEach(def => { if (!ordered.includes(def)) ordered.push(def); });
    return ordered;
  }

  // Im Browser: Kit + Typ-Dateien nachladen. Views warten mit `await SylasphereTypes.ready`.
  function loadInBrowser() {
    const doc = window.document;
    if (!doc || typeof doc.createElement !== 'function' || !doc.head) return Promise.resolve();
    const self = doc.currentScript?.src || Array.from(doc.scripts || []).map(s => s.src).find(src => /question-types\/registry\.js/.test(src)) || '';
    const baseUrl = self ? new URL('.', self) : new URL('./js/question-types/', location.href);
    const version = self ? new URL(self).search : '';
    const loadScript = file => new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = new URL(file, baseUrl).href + version;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Fragetyp-Datei konnte nicht geladen werden: ${file}`));
      doc.head.append(script);
    });
    return Promise.all(['kit.js', ...TYPE_FILES.map(file => `types/${file}.js`)].map(loadScript)).then(() => {
      const missing = TYPE_FILES.filter(file => !types.has(file));
      if (missing.length) console.warn('Fragetypen nicht registriert (Dateiname ≠ type?):', missing.join(', '));
    });
  }

  const ready = loadInBrowser().catch(error => {
    console.error(error);
    window.SchmobinApp?.toast?.(error.message, 'error');
  });

  window.SylasphereTypes = { register, get, has, list, files: TYPE_FILES.slice(), ready };
})();
