(function () {
  'use strict';

  const App = window.SchmobinApp;
  // Fragetyp-Metadaten kommen aus den Modulen in js/question-types/types/
  const Types = () => window.SylasphereTypes;
  const typeDef = type => Types()?.get(type) || null;
  const typeMap = pick => Object.fromEntries((Types()?.list() || []).map(def => [def.type, pick(def)]));
  // Felder, die bei jedem Typ als Lösung gelten und vor der Auflösung nie an Spieler gehen
  const SOLUTION_FIELDS = ['correctAnswer', 'correctAnswers', 'correctOrder', 'solution', 'tolerance'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function categoryKey(value) {
    return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE');
  }
  function cleanCategory(value) { return String(value || '').normalize('NFKC').trim(); }
  const Topics = () => window.SylasphereTopics;
  /** Thema (Icon, Farbe) zu einem Kategorienamen – siehe js/core/topics.js */
  function topic(value, customList) {
    return Topics()?.resolve(value, customList) || { name: cleanCategory(value) || 'Ohne Thema', icon: '🏷️', hue: categoryHueFallback(value), source: 'auto' };
  }
  function categoryHue(value) { return topic(value).hue; }
  function categoryHueFallback(value) {
    const text = categoryKey(value) || 'kategorie'; let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash) % 360;
  }
  function slug(value, fallback = 'quiz') {
    const result = String(value || '')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return result || fallback;
  }
  // Auswahl-Typen erkennt man daran, dass sie die gemeinsame Auswahl-Statistik nutzen
  function isChoiceType(type) { return Boolean(typeDef(type)) && typeDef(type).stats === window.SylasphereTypeKit?.choiceStats; }
  function normalizeQuestion(question, index, settings) {
    const q = clone(question || {});
    q.id = String(q.id || `q_${index + 1}_${App.uid('x').slice(-6)}`);
    q.type = String(q.type || 'multiple-choice');
    q.category = cleanCategory(q.category);
    q.text = String(q.text || q.question || '');
    q.points = numberOr(q.points, numberOr(settings.defaultPoints, 100));
    q.timer = numberOr(q.timer, numberOr(settings.defaultTimer, 30));

    typeDef(q.type)?.normalize(q, settings);
    return q;
  }
  function normalizeRound(round, index, settings) {
    const r = clone(round || {});
    r.id = String(r.id || `round_${index + 1}`);
    r.title = String(r.title || `Runde ${index + 1}`);
    r.pointsMultiplier = numberOr(r.pointsMultiplier, 1);
    r.questions = Array.isArray(r.questions) ? r.questions.map((q, qIndex) => normalizeQuestion(q, qIndex, settings)) : [];
    return r;
  }
  function normalizeQuiz(input) {
    const source = clone(input || {});
    const raw = source.quiz && typeof source.quiz === 'object' ? source.quiz : source;
    const settings = Object.assign({ defaultTimer: 30, defaultPoints: 100, buzzerEnabled: true }, raw.settings || {});
    settings.defaultTimer = numberOr(settings.defaultTimer, 30);
    settings.defaultPoints = numberOr(settings.defaultPoints, 100);
    settings.buzzerEnabled = Boolean(settings.buzzerEnabled);
    settings.theme = String(settings.theme || 'neon'); // Design (siehe js/core/themes.js)
    let rounds = Array.isArray(raw.rounds) ? raw.rounds : [];
    if (!rounds.length && Array.isArray(raw.questions)) {
      rounds = [{ id: 'round_001', title: raw.roundTitle || 'Runde 1', pointsMultiplier: 1, questions: raw.questions }];
    }
    const quiz = {
      id: String(raw.id || `quiz_${slug(raw.title || 'sylasphere')}`),
      title: String(raw.title || 'Unbenanntes Quiz'),
      description: String(raw.description || ''),
      settings,
      // Eigene Themen des Quiz: [{ name, icon?, color? }]
      categories: Topics() ? Topics().normalizeCustom(raw.categories) : (Array.isArray(raw.categories) ? clone(raw.categories) : []),
      rounds: rounds.map((round, index) => normalizeRound(round, index, settings))
    };
    Object.keys(raw).forEach(key => {
      if (!(key in quiz) && key !== 'questions') quiz[key] = clone(raw[key]);
    });
    return { quiz };
  }
  function extractCategories(input) {
    const normalized = normalizeQuiz(input).quiz;
    const seen = new Map();
    const add = value => {
      const display = typeof value === 'object' && value ? cleanCategory(value.name ?? value.title ?? value.id) : cleanCategory(value);
      const key = categoryKey(display);
      if (key && !seen.has(key)) seen.set(key, display);
    };
    normalized.categories.forEach(add);
    normalized.rounds.forEach(round => round.questions.forEach(q => add(q.category)));
    return Array.from(seen.values());
  }
  function allQuestions(input) {
    const quiz = normalizeQuiz(input).quiz;
    return quiz.rounds.flatMap((round, roundIndex) => round.questions.map((question, questionIndex) => ({ question, round, roundIndex, questionIndex })));
  }
  function optionById(question, id) { return window.SylasphereTypeKit.optionById(question, id); }
  function correctOption(question) { return window.SylasphereTypeKit.correctOption(question); }
  function normalizeTerm(value) {
    return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  }
  function surveyWinnerIds(question) { return typeDef('survey')?.winnerIds(question) || []; }
  function computeConsensusResult(question, submissions) { return typeDef('consensus')?.computeResult(question, submissions); }

  /** Ergebnis, das erst mit allen Antworten feststeht (z. B. Mehrheit bei „Gleich gedacht“). */
  function resolveResult(question, submissions, options = {}) {
    const def = typeDef(question?.type);
    return def?.resolve ? def.resolve(question, submissions || {}, options || {}) : null;
  }
  /** Muss der Moderator die Antworten dieses Typs von Hand prüfen? */
  function needsReview(question) { const mode = typeDef(question?.type)?.review; return mode === 'manual' || mode === 'count'; }
  /** 'manual' = ✓/✗ je Antwort, 'count' = Trefferzahl je Spieler (Fight List), sonst '' */
  function reviewMode(question) { return typeDef(question?.type)?.review || ''; }
  /** Vorschlag für die Trefferzahl (review: 'count') */
  function countMatches(question, answer) { const fn = typeDef(question?.type)?.countMatches; return fn ? fn(question, answer) : { count: 0, items: [] }; }
  /** Vorschlag für die Moderator-Prüfung (true/false/null = unklar) */
  function autoCheck(question, answer, part = '') {
    const fn = typeDef(question?.type)?.autoCheck;
    return fn ? fn(question, answer, part) : null;
  }
  /** Nach der Auflösung sehen alle Spieler die Antworten der anderen */
  function publishesAnswers(question) { return Boolean(typeDef(question?.type)?.publishAnswers); }
  /** Mini-Spiel des Typs (z. B. Zeitduell) oder null */
  function gameOf(question) { return typeDef(question?.type)?.game || null; }
  /** Punkte für alle Spieler vergeben, auch ohne eigene Antwort */
  function scoresAllPlayers(question) { return Boolean(typeDef(question?.type)?.scoresAllPlayers); }
  function answerEntries(question, answers, nameOf) {
    return Object.entries(answers || {}).map(([playerId, record]) => ({
      playerId, name: String(nameOf(playerId) || 'Spieler'),
      answer: answerLabel(question, record?.answer),
      points: Math.round(Number(record?.awardedPoints) || 0),
      correct: Number(record?.awardedPoints) > 0
    })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'de'));
  }
  /** Punkte für eine Antwort. result = Ergebnis aus resolveResult (falls der Typ eins hat). */
  function scoreAnswer(question, answer, multiplier = 1, result = null, playerId = '') {
    const def = typeDef(question?.type);
    const base = Math.max(0, numberOr(question?.points, 0));
    const mult = Math.max(0, numberOr(multiplier, 1));
    const scored = def ? def.score(question, answer, { base, result, playerId, kit: window.SylasphereTypeKit }) : { points: 0, detail: '' };
    const raw = Number(scored?.points) || 0;
    return { points: Math.round(raw * mult), basePoints: raw, detail: String(scored?.detail ?? '') };
  }
  function correctAnswerText(question, result = null) { return typeDef(question?.type)?.solutionText(question, result) ?? ''; }
  function answerLabel(question, answer) {
    const def = typeDef(question?.type);
    return def ? def.answerLabel(question, answer) : String(answer ?? '');
  }
  function solutionLabel(question) { return typeDef(question?.type)?.solutionLabel || 'Lösung'; }
  /** Lösung für die Moderator-Box: { text, extra } */
  function moderatorSolution(question, result = null) {
    const custom = typeDef(question?.type)?.moderatorSolution?.(question, result) || {};
    return { text: custom.text ?? (correctAnswerText(question, result) || '–'), extra: custom.extra || '' };
  }
  /** Kopie der Frage für Spieler (online), Lösungsfelder entfernt solange nicht aufgelöst. */
  function publicQuestion(question, reveal = false) {
    const q = clone(question);
    if (reveal) return q;
    SOLUTION_FIELDS.forEach(field => { delete q[field]; });
    typeDef(q.type)?.hideSolution(q);
    return q;
  }
  /** Zusammenfassung der Antworten für Zuschauer/Statistik */
  function aggregateStats(question, answers, result = null) {
    const records = Object.values(answers || {});
    const def = typeDef(question?.type);
    return def?.stats?.aggregate ? def.stats.aggregate(question, records, result) : { kind: question?.type, count: records.length };
  }
  function statsHTML(question, stats) {
    const def = typeDef(question?.type);
    return stats && def?.stats?.render ? def.stats.render(stats, question) : '';
  }
  /** Stufen-Fragen (z. B. Song-Enthüllung): Liste der Stufen oder null */
  function stagesOf(question) { return typeDef(question?.type)?.stages?.(question) || null; }
  /** Antwort kann nach dem Abschicken nicht mehr geändert werden */
  function locksOnSubmit(question) { return Boolean(typeDef(question?.type)?.lockOnSubmit); }
  /** Beim Auflösen automatisch einen Ausschnitt auf allen Geräten abspielen */
  function revealsMedia(question) { return Boolean(typeDef(question?.type)?.mediaClip) && Boolean(typeDef(question?.type)?.revealMedia); }
  /** Teile, die der Moderator getrennt prüft (z. B. Titel/Interpret) – sonst eine einzige Prüfung */
  function reviewParts(question) { return typeDef(question?.type)?.reviewParts?.(question) || null; }
  function hasTimer(question) { return !typeDef(question?.type)?.noTimer; }
  function isBuzzer(question) { return typeDef(question?.type)?.interaction === 'buzzer'; }

  const api = {
    clone, numberOr, categoryKey, cleanCategory, slug,
    normalizeQuiz, extractCategories, allQuestions, categoryHue, topic, scoreAnswer, correctAnswerText, answerLabel, normalizeTerm,
    isChoiceType, optionById, correctOption, surveyWinnerIds, computeConsensusResult,
    typeDef, resolveResult, stagesOf, locksOnSubmit, revealsMedia, reviewParts, needsReview, autoCheck, publishesAnswers, reviewMode, countMatches, gameOf, scoresAllPlayers, answerEntries, solutionLabel, moderatorSolution, publicQuestion, aggregateStats, statsHTML, hasTimer, isBuzzer
  };
  // Live aus der Registry, damit neu registrierte Typen sofort überall auftauchen
  Object.defineProperties(api, {
    SUPPORTED_TYPES: { enumerable: true, get: () => (Types()?.list() || []).map(def => def.type) },
    TYPE_LABELS: { enumerable: true, get: () => typeMap(def => def.label) },
    TYPE_ICONS: { enumerable: true, get: () => typeMap(def => def.icon) },
    TYPE_DESCRIPTIONS: { enumerable: true, get: () => typeMap(def => def.description) }
  });
  window.SchmobinQuiz = api;

})();
