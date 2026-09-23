(function () {
  'use strict';
  const Quiz = window.SchmobinQuiz;

  function validate(input) {
    const normalized = Quiz.normalizeQuiz(input);
    const quiz = normalized.quiz;
    const errors = [];
    const warnings = [];
    const ids = new Map();
    const addId = (id, path) => {
      if (!id) return;
      if (ids.has(id)) errors.push({ path, message: `Doppelte ID „${id}“ (bereits in ${ids.get(id)}).` });
      else ids.set(id, path);
    };
    if (!quiz.title.trim()) errors.push({ path: 'quiz.title', message: 'Quiz-Titel fehlt.' });
    if (!Array.isArray(quiz.rounds) || !quiz.rounds.length) errors.push({ path: 'quiz.rounds', message: 'Mindestens eine Runde ist erforderlich.' });
    if (Array.isArray(quiz.rounds) && quiz.rounds.length && Quiz.allQuestions(normalized).length === 0) errors.push({ path: 'quiz.rounds', message: 'Das Quiz enthält noch keine Frage.' });
    if (!Number.isFinite(Number(quiz.settings.defaultTimer)) || Number(quiz.settings.defaultTimer) < 0) errors.push({ path: 'quiz.settings.defaultTimer', message: 'Standard-Timer muss eine Zahl ≥ 0 sein.' });
    if (!Number.isFinite(Number(quiz.settings.defaultPoints)) || Number(quiz.settings.defaultPoints) < 0) errors.push({ path: 'quiz.settings.defaultPoints', message: 'Standard-Punkte müssen eine Zahl ≥ 0 sein.' });
    addId(quiz.id, 'quiz.id');

    quiz.rounds.forEach((round, ri) => {
      const rp = `quiz.rounds[${ri}]`;
      addId(round.id, `${rp}.id`);
      if (!round.title.trim()) warnings.push({ path: `${rp}.title`, message: 'Rundentitel ist leer.' });
      if (!Number.isFinite(Number(round.pointsMultiplier)) || Number(round.pointsMultiplier) < 0) errors.push({ path: `${rp}.pointsMultiplier`, message: 'Punkte-Multiplikator muss eine Zahl ≥ 0 sein.' });
      if (!round.questions.length) warnings.push({ path: `${rp}.questions`, message: 'Runde enthält keine Fragen.' });

      round.questions.forEach((q, qi) => {
        const p = `${rp}.questions[${qi}]`;
        addId(q.id, `${p}.id`);
        if (!Quiz.SUPPORTED_TYPES.includes(q.type)) errors.push({ path: `${p}.type`, message: `Unbekannter Fragetyp „${q.type}“.` });
        if (!q.text.trim()) errors.push({ path: `${p}.text`, message: 'Fragetext fehlt.' });
        if (!q.category.trim()) warnings.push({ path: `${p}.category`, message: 'Kategorie fehlt; Anzeige erfolgt als „Ohne Kategorie“.' });
        if (!Number.isFinite(Number(q.timer)) || Number(q.timer) < 0) errors.push({ path: `${p}.timer`, message: 'Timer muss eine Zahl ≥ 0 sein.' });
        if (!Number.isFinite(Number(q.points)) || Number(q.points) < 0) errors.push({ path: `${p}.points`, message: 'Punkte müssen eine Zahl ≥ 0 sein.' });

        // Typ-spezifische Prüfung aus dem Fragetyp-Modul
        Quiz.typeDef(q.type)?.validate(q, {
          error: (field, message) => errors.push({ path: `${p}.${field}`, message }),
          warn: (field, message) => warnings.push({ path: `${p}.${field}`, message })
        });
      });
    });

    const categoryMap = new Map();
    Quiz.allQuestions(normalized).forEach(({ question }) => {
      const key = Quiz.categoryKey(question.category);
      if (!key) return;
      const previous = categoryMap.get(key);
      if (previous && previous !== question.category) {
        warnings.push({ path: `category:${question.category}`, message: `Kategorie unterscheidet sich nur durch Schreibweise/Leerzeichen von „${previous}“. Sie wird in Übersichten zusammengeführt.` });
      } else categoryMap.set(key, question.category);
    });

    return { valid: errors.length === 0, errors, warnings, normalized };
  }

  window.SchmobinValidator = { validate };
})();
