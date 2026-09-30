(function () {
  'use strict';

  /*
   * Spielmodi erklären (v35)
   * ------------------------------------------------------------------
   * Eine Textquelle: Jeder Spielmodus (im Code „Fragetyp“, js/question-types/types/*.js)
   * hat ein Feld help = { group, short, steps[], scoring, moderator }. Dazu kommen die
   * beiden Show-Formate Themen-Brett und Einsatz-Finale (hier unten, SHOW_MODES).
   *
   * Dieses Modul bündelt alles für Oberflächen:
   *  - list() / get(id)            alle Spielmodi mit Erklärung (für Editor, spielmodi.html)
   *  - target(state, current)      welcher Spielmodus gerade dran ist (Brett-Wahl, Finale-Einsatz, Typ)
   *  - isNew(state, id)            kam der Spielmodus in dieser Sitzung schon dran? (aus scoredQuestionIds)
   *  - cardHTML / detailHTML       „Neu: … – so geht's“-Karte und ausführliche Erklärung
   *
   * Begriffe (überall gleich): Spielmodus = Fragetyp · Thema = inhaltliches Gebiet · Design = Aussehen.
   */
  const GROUPS = [
    { id: 'Wissen', icon: '🧠' },
    { id: 'Schätzen', icon: '📏' },
    { id: 'Musik & Audio', icon: '🎵' },
    { id: 'Bild', icon: '🖼️' },
    { id: 'Show-Formate & Spiele', icon: '🎪' }
  ];

  const SHOW_MODES = [
    {
      id: 'board', label: 'Themen-Brett', icon: '▦', kind: 'show',
      help: {
        group: 'Show-Formate & Spiele',
        short: 'Wähle reihum ein Feld auf dem Brett – je höher der Wert, desto schwerer die Frage.',
        steps: [
          'Wer dran ist, tippt am Handy ein Feld an (Thema + Punkte).',
          'Nur du antwortest – die anderen raten ohne Punkte mit.',
          'Dann ist der Nächste dran. Achtung: Hinter manchen Feldern steckt ein 💎 Doppel-Feld mit Einsatz.'
        ],
        scoring: 'Richtig = Feldwert, falsch = 0. Doppel-Feld: Du setzt vorher Punkte – richtig = +Einsatz, falsch = 0. Felder, die nicht mehr für eine ganze Runde reichen, spielen alle gemeinsam.',
        moderator: 'Der Show-Höhepunkt ab 3 Spielern. Vorbereiten: bei der Runde das Format „Themen-Brett“ wählen, Themen benennen und das Raster mit Multiple Choice, Schätzfragen, Song-Enthüllungen, Hinweis-Kaskaden oder Bild-Enthüllungen füllen. Du kannst für jemanden ein Feld wählen oder einen Zug überspringen.'
      }
    },
    {
      id: 'final', label: 'Einsatz-Finale', icon: '💰', kind: 'show',
      help: {
        group: 'Show-Formate & Spiele',
        short: 'Setz geheim Punkte auf die letzte Frage – alles oder nichts.',
        steps: [
          'Du siehst nur das Thema und setzt geheim 0 bis alle deine Punkte.',
          'Dann kommt die Frage.',
          'Die Auflösung läuft Spieler für Spieler, vom Letzten zum Ersten.'
        ],
        scoring: 'Richtig = +Einsatz, falsch = −Einsatz. Wer 0 oder weniger Punkte hat, darf bis 100 setzen.',
        moderator: 'Spannender Abschluss, bei dem noch alles kippen kann. Vorbereiten: im Quiz „Letzte Frage als Einsatz-Finale“ anhaken; die letzte Frage ist Multiple Choice, Schätzfrage, Song-Enthüllung, Hinweis-Kaskade oder Bild-Enthüllung. Tipp: eine mittelschwere Frage wählen – ist sie zu leicht, setzen alle alles.'
      }
    }
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const Types = () => window.SylasphereTypes;
  const Quiz = () => window.SchmobinQuiz;

  /** Alle Spielmodi (ohne versteckte, außer includeHidden) in Galerie-Reihenfolge */
  function list({ includeHidden = false } = {}) {
    const types = (Types()?.list() || [])
      .filter(def => def.help && (includeHidden || !def.hidden))
      .map(def => ({ id: def.type, label: def.label, icon: def.icon, kind: 'type', hidden: Boolean(def.hidden), help: def.help }));
    return types.concat(SHOW_MODES);
  }
  function get(id) {
    const show = SHOW_MODES.find(m => m.id === id);
    if (show) return show;
    const def = Types()?.get(id);
    return def ? { id: def.type, label: def.label, icon: def.icon, kind: 'type', hidden: Boolean(def.hidden), help: def.help || { group: 'Wissen', short: def.description || '', steps: [], scoring: '', moderator: '' } } : null;
  }
  const byGroup = modes => GROUPS.map(g => ({ group: g, modes: modes.filter(m => m.help.group === g.id) })).filter(x => x.modes.length);

  /** Spielmodi einer Frage: Show-Format (falls) + eigener Typ */
  function modesOf(quiz, ri, qi) {
    const q = quiz?.quiz || quiz;
    const round = q?.rounds?.[ri]; const question = round?.questions?.[qi];
    if (!question) return [];
    const out = [];
    if (Quiz()?.isBoardRound(round)) out.push('board');
    else if (Quiz()?.isFinalWager({ quiz: q }, ri, qi)) out.push('final');
    out.push(String(question.type));
    return out;
  }
  /** Spielmodi, die in dieser Sitzung schon dran waren (aufgelöste Fragen) */
  function seen(state) {
    const done = new Set(state?.scoredQuestionIds || []);
    const out = new Set();
    (state?.quiz?.quiz?.rounds || []).forEach((round, ri) => round.questions.forEach((question, qi) => {
      if (done.has(question.id)) modesOf(state.quiz, ri, qi).forEach(id => out.add(id));
    }));
    return out;
  }
  const isNew = (state, id) => Boolean(id) && !seen(state).has(id);
  const enabled = state => state?.quiz?.quiz?.settings?.explainModes !== false;

  /** Welcher Spielmodus ist gerade „dran“? Brett: beim Wählen das Brett, im Feld der Typ. Finale: beim Setzen das Finale. */
  function target(state, current) {
    const q = current?.question;
    if (!q || state?.status !== 'playing') return '';
    const ids = modesOf(state.quiz, state.currentRoundIndex, state.currentQuestionIndex);
    if (ids[0] === 'board') return state.show?.kind === 'board' && state.show.current?.qid === q.id ? q.type : 'board';
    if (ids[0] === 'final') return state.show?.kind === 'final' && state.show.qid === q.id && state.show.phase !== 'wager' ? q.type : 'final';
    return q.type;
  }
  /** Soll jetzt eine „Neu“-Karte erscheinen? (Einstellung an, Spielmodus neu, Frage noch nicht gestartet) */
  function newTarget(state, current) {
    if (!enabled(state)) return '';
    const id = target(state, current);
    return id && isNew(state, id) ? id : '';
  }
  /** Spielmodi eines Quiz (für „Heute im Quiz“ und Links auf spielmodi.html) */
  function inQuiz(quiz) {
    const q = quiz?.quiz || quiz;
    const ids = [];
    (q?.rounds || []).forEach((round, ri) => round.questions.forEach((question, qi) => modesOf(q, ri, qi).forEach(id => { if (!ids.includes(id)) ids.push(id); })));
    return ids;
  }

  const stepsHTML = help => help.steps?.length ? `<ol class="mode-steps">${help.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '';
  /** Karte für Beamer/Handy: „Neu: Dilemma – so geht's“ */
  function cardHTML(id, { isNew: fresh = true, variant = 'phone', dismiss = '' } = {}) {
    const mode = get(id);
    if (!mode) return '';
    const h = mode.help;
    return `<div class="mode-card mode-card--${esc(variant)}" data-mode="${esc(mode.id)}">
      <div class="mode-card-head"><span class="mode-card-icon" aria-hidden="true">${esc(mode.icon)}</span><div><span class="eyebrow">${fresh ? 'Neu' : 'Spielmodus'} · so geht's</span><strong>${esc(mode.label)}</strong></div></div>
      <p class="mode-short">${esc(h.short)}</p>${stepsHTML(h)}
      ${h.scoring ? `<p class="mode-scoring"><b>Punkte:</b> ${esc(h.scoring)}</p>` : ''}
      ${dismiss ? `<button type="button" class="btn btn--primary btn--small mode-dismiss" data-mode-dismiss>${esc(dismiss)}</button>` : ''}
    </div>`;
  }
  /** Ausführlich (Editor „Mehr erfahren“, spielmodi.html) – Moderator-Tipps einklappbar */
  function detailHTML(id, { open = false } = {}) {
    const mode = get(id);
    if (!mode) return '';
    const h = mode.help;
    return `<div class="mode-detail">
      <p class="mode-short">${esc(h.short)}</p>
      <h4>So geht's</h4>${stepsHTML(h)}
      <h4>Punkte</h4><p>${esc(h.scoring)}</p>
      <details class="mode-mod"${open ? ' open' : ''}><summary>🎙️ Für Moderatoren</summary><p>${esc(h.moderator)}</p></details>
    </div>`;
  }

  window.SylasphereModes = { GROUPS, SHOW_MODES, list, get, byGroup, modesOf, seen, isNew, enabled, target, newTarget, inQuiz, cardHTML, detailHTML };
})();
