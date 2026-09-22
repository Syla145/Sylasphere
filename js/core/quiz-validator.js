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
    const validateOptions = (q, p, { needsCorrect = false, survey = false } = {}) => {
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push({ path: `${p}.options`, message: 'Mindestens zwei Antwortoptionen sind erforderlich.' });
      if ((q.options || []).some(o => !String(o.text || '').trim())) errors.push({ path: `${p}.options`, message: 'Antwortoptionen dürfen nicht leer sein.' });
      const optionIds = (q.options || []).map(o => String(o.id || '').trim()).filter(Boolean);
      if (new Set(optionIds).size !== optionIds.length) errors.push({ path: `${p}.options`, message: 'Antwortoptionen enthalten doppelte IDs.' });
      if (needsCorrect) {
        const idSet = new Set(optionIds);
        const index = Number(q.correctAnswer);
        const valid = idSet.has(String(q.correctAnswer)) || (Number.isInteger(index) && index >= 0 && index < q.options.length) || q.options.some(o => o.text === String(q.correctAnswer));
        if (!valid) errors.push({ path: `${p}.correctAnswer`, message: 'Korrekte Antwort passt zu keiner Option.' });
      }
      if (survey) {
        if ((q.options || []).some(o => !Number.isFinite(Number(o.value)) || Number(o.value) < 0 || Number(o.value) > 100)) {
          errors.push({ path: `${p}.options`, message: 'Umfragewerte müssen Zahlen zwischen 0 und 100 sein.' });
        }
        const values = (q.options || []).map(option => Number(option.value) || 0);
        const sum = values.reduce((total, value) => total + value, 0);
        if (values.length && Math.max(...values) <= 0) errors.push({ path: `${p}.options`, message: 'Mindestens eine Umfrage-Antwort benötigt einen Wert größer als 0.' });
        if (q.options?.length && (sum < 99 || sum > 101)) warnings.push({ path: `${p}.options`, message: `Umfragewerte ergeben ${Number(sum.toFixed(1))} %. Für eine saubere Auflösung sollten sie ungefähr 100 % ergeben.` });
      }
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

        if (q.type === 'multiple-choice') validateOptions(q, p, { needsCorrect: true });
        if (q.type === 'image-quiz') {
          validateOptions(q, p, { needsCorrect: true });
          if (!String(q.image || '').trim()) errors.push({ path: `${p}.image`, message: 'Bilderquiz benötigt eine Bildquelle.' });
        }
        if (q.type === 'audio-quiz') {
          validateOptions(q, p, { needsCorrect: true });
          if (!String(q.audio || '').trim()) errors.push({ path: `${p}.audio`, message: 'Audio-Quiz benötigt eine Audioquelle.' });
        }
        if (q.type === 'survey') validateOptions(q, p, { survey: true });
        if (q.type === 'consensus') validateOptions(q, p);
        if (q.type === 'estimate') {
          if (!(Number(q.max) > Number(q.min))) errors.push({ path: `${p}.max`, message: 'Max muss größer als Min sein.' });
          if (!Number.isFinite(Number(q.correctAnswer))) errors.push({ path: `${p}.correctAnswer`, message: 'Zielwert fehlt oder ist ungültig.' });
          if (Number(q.correctAnswer) < Number(q.min) || Number(q.correctAnswer) > Number(q.max)) warnings.push({ path: `${p}.correctAnswer`, message: 'Zielwert liegt außerhalb des Reglerbereichs.' });
          if (q.tolerance != null && (!Number.isFinite(Number(q.tolerance)) || Number(q.tolerance) < 0)) errors.push({ path: `${p}.tolerance`, message: 'Toleranz muss leer oder eine Zahl ≥ 0 sein.' });
        }
        if (q.type === 'sort') {
          if (!Array.isArray(q.correctOrder) || q.correctOrder.length < 2) errors.push({ path: `${p}.correctOrder`, message: 'Sortierquiz benötigt mindestens zwei Elemente.' });
          const terms = (q.correctOrder || []).map(Quiz.normalizeTerm);
          if (new Set(terms).size !== terms.length) warnings.push({ path: `${p}.correctOrder`, message: 'Sortierquiz enthält doppelte Elemente; die Auswertung kann dadurch unklar werden.' });
        }
        if (q.type === 'fight-list') {
          if (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length) errors.push({ path: `${p}.correctAnswers`, message: 'Fight List benötigt mindestens eine richtige Lösung.' });
          if (!Number.isFinite(Number(q.pointsPerAnswer)) || Number(q.pointsPerAnswer) < 0) errors.push({ path: `${p}.pointsPerAnswer`, message: 'Punkte je Treffer müssen ≥ 0 sein.' });
        }
        if (q.type === 'higher-lower') {
          if (!Array.isArray(q.cards) || q.cards.length < 2) errors.push({ path: `${p}.cards`, message: 'Higher / Lower benötigt mindestens zwei Karten.' });
          if ((q.cards || []).some(card => !String(card.label || '').trim())) errors.push({ path: `${p}.cards`, message: 'Alle Karten benötigen eine Bezeichnung.' });
          if ((q.cards || []).some(card => !Number.isFinite(Number(card.value)))) errors.push({ path: `${p}.cards`, message: 'Alle Kartenwerte müssen numerisch sein.' });
          const cardIds = (q.cards || []).map(card => String(card.id || '').trim()).filter(Boolean);
          if (new Set(cardIds).size !== cardIds.length) errors.push({ path: `${p}.cards`, message: 'Higher-/Lower-Karten enthalten doppelte IDs.' });
          if ((q.cards || []).some((card, index, cards) => index > 0 && Number(card.value) === Number(cards[index - 1].value))) warnings.push({ path: `${p}.cards`, message: 'Zwei aufeinanderfolgende Higher-/Lower-Karten haben denselben Wert; „höher oder niedriger“ wäre dadurch uneindeutig.' });
        }
        if (q.type === 'hotspot') {
          if (!String(q.image || '').trim()) errors.push({ path: `${p}.image`, message: 'Hotspot benötigt eine Bildquelle.' });
          if (!Number.isFinite(Number(q.targetX)) || Number(q.targetX) < 0 || Number(q.targetX) > 100) errors.push({ path: `${p}.targetX`, message: 'Ziel-X muss zwischen 0 und 100 liegen.' });
          if (!Number.isFinite(Number(q.targetY)) || Number(q.targetY) < 0 || Number(q.targetY) > 100) errors.push({ path: `${p}.targetY`, message: 'Ziel-Y muss zwischen 0 und 100 liegen.' });
          if (!Number.isFinite(Number(q.radius)) || Number(q.radius) <= 0 || Number(q.radius) > 50) errors.push({ path: `${p}.radius`, message: 'Trefferradius muss > 0 und ≤ 50 sein.' });
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
