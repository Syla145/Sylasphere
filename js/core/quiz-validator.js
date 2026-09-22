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

        if (q.type === 'multiple-choice' || q.type === 'image-quiz') {
          if (!Array.isArray(q.options) || q.options.length < 2) errors.push({ path: `${p}.options`, message: 'Mindestens zwei Antwortoptionen sind erforderlich.' });
          if (q.options.some(o => !String(o.text || '').trim())) errors.push({ path: `${p}.options`, message: 'Antwortoptionen dürfen nicht leer sein.' });
          const optionIds = q.options.map(o => String(o.id || '').trim()).filter(Boolean);
          if (new Set(optionIds).size !== optionIds.length) errors.push({ path: `${p}.options`, message: 'Antwortoptionen enthalten doppelte IDs.' });
          const ids = new Set(optionIds);
          const index = Number(q.correctAnswer);
          const valid = ids.has(String(q.correctAnswer)) || (Number.isInteger(index) && index >= 0 && index < q.options.length) || q.options.some(o => o.text === String(q.correctAnswer));
          if (!valid) errors.push({ path: `${p}.correctAnswer`, message: 'Korrekte Antwort passt zu keiner Option.' });
          if (q.type === 'image-quiz' && !String(q.image || q.imageUrl || '').trim()) warnings.push({ path: `${p}.image`, message: 'Bilderquiz hat keine Bildquelle.' });
        }
        if (q.type === 'estimate') {
          if (!(Number(q.max) > Number(q.min))) errors.push({ path: `${p}.max`, message: 'Max muss größer als Min sein.' });
          if (!Number.isFinite(Number(q.correctAnswer))) errors.push({ path: `${p}.correctAnswer`, message: 'Zielwert fehlt oder ist ungültig.' });
          if (Number(q.correctAnswer) < Number(q.min) || Number(q.correctAnswer) > Number(q.max)) warnings.push({ path: `${p}.correctAnswer`, message: 'Zielwert liegt außerhalb des Reglerbereichs.' });
        }
        if (q.type === 'sort') {
          if (!Array.isArray(q.correctOrder) || q.correctOrder.length < 2) errors.push({ path: `${p}.correctOrder`, message: 'Sortierquiz benötigt mindestens zwei Elemente.' });
        }
        if (q.type === 'fight-list') {
          if (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length) errors.push({ path: `${p}.correctAnswers`, message: 'Fight List benötigt mindestens eine richtige Lösung.' });
        }
        if (q.type === 'higher-lower') {
          if (!Array.isArray(q.cards) || q.cards.length < 2) errors.push({ path: `${p}.cards`, message: 'Higher / Lower benötigt mindestens zwei Karten.' });
          if ((q.cards || []).some(card => !Number.isFinite(Number(card.value)))) errors.push({ path: `${p}.cards`, message: 'Alle Kartenwerte müssen numerisch sein.' });
          const cardIds = (q.cards || []).map(card => String(card.id || '').trim()).filter(Boolean);
          if (new Set(cardIds).size !== cardIds.length) errors.push({ path: `${p}.cards`, message: 'Higher-/Lower-Karten enthalten doppelte IDs.' });
        }
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
