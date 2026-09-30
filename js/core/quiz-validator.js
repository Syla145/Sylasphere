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
    if (window.SylasphereThemes && !window.SylasphereThemes.isValid(quiz.settings.theme)) warnings.push({ path: 'quiz.settings.theme', message: `Unbekanntes Design „${quiz.settings.theme}“ – es wird Neon Arena verwendet.` });
    if (!Number.isFinite(Number(quiz.settings.defaultPoints)) || Number(quiz.settings.defaultPoints) < 0) errors.push({ path: 'quiz.settings.defaultPoints', message: 'Standard-Punkte müssen eine Zahl ≥ 0 sein.' });
    addId(quiz.id, 'quiz.id');

    quiz.rounds.forEach((round, ri) => {
      const rp = `quiz.rounds[${ri}]`;
      addId(round.id, `${rp}.id`);
      if (!round.title.trim()) warnings.push({ path: `${rp}.title`, message: 'Rundentitel ist leer.' });
      if (!Number.isFinite(Number(round.pointsMultiplier)) || Number(round.pointsMultiplier) < 0) errors.push({ path: `${rp}.pointsMultiplier`, message: 'Punkte-Multiplikator muss eine Zahl ≥ 0 sein.' });
      if (!round.questions.length) warnings.push({ path: `${rp}.questions`, message: 'Runde enthält keine Fragen.' });
      if (round.theme && window.SylasphereThemes && !window.SylasphereThemes.isValid(round.theme)) warnings.push({ path: `${rp}.theme`, message: `Unbekanntes Design „${round.theme}“ – die Runde nutzt das Design des Quiz.` });

      // v34: Themen-Brett
      if (Quiz.isBoardRound(round)) {
        const cells = round.board.topics.length * round.board.values.length;
        if (round.questions.length < cells) warnings.push({ path: `${rp}.board`, message: `Brett: ${cells - round.questions.length} von ${cells} Feldern sind noch leer (sie werden übersprungen).` });
        if (round.questions.length > cells) errors.push({ path: `${rp}.board`, message: `Brett: ${round.questions.length - cells} Fragen haben kein Feld – mehr Themen oder Fragen pro Thema einstellen.` });
        const allowed = Quiz.BOARD_TYPES;
        round.questions.forEach((q, qi) => {
          if (!allowed.includes(q.type)) errors.push({ path: `${rp}.questions[${qi}].type`, message: `Im Themen-Brett sind nur Multiple Choice, Schätzfrage und Song-Enthüllung erlaubt („${Quiz.TYPE_LABELS[q.type] || q.type}“ geht nicht).` });
          if (q.type === 'estimate' && q.tolerance == null) warnings.push({ path: `${rp}.questions[${qi}].tolerance`, message: 'Schätzfrage im Brett ohne Toleranz: nur der genaue Wert zählt als richtig.' });
        });
        if (round.board.doubles >= cells) warnings.push({ path: `${rp}.board.doubles`, message: 'Mehr Doppel-Felder als Felder.' });
      }
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

    // v34: Einsatz-Finale – letzte Frage des Quiz
    if (quiz.settings.finalWager) {
      const last = quiz.rounds[quiz.rounds.length - 1];
      const q = last?.questions?.[last.questions.length - 1];
      if (!q) errors.push({ path: 'quiz.settings.finalWager', message: 'Einsatz-Finale: Es gibt keine letzte Frage.' });
      else if (Quiz.isBoardRound(last)) errors.push({ path: 'quiz.settings.finalWager', message: 'Einsatz-Finale: Die letzte Runde ist ein Brett – das Finale braucht danach eine eigene Runde mit einer Frage.' });
      else if (!Quiz.BOARD_TYPES.includes(q.type)) errors.push({ path: 'quiz.settings.finalWager', message: `Einsatz-Finale: Die letzte Frage muss Multiple Choice, Schätzfrage oder Song-Enthüllung sein („${Quiz.TYPE_LABELS[q.type] || q.type}“).` });
    }
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
