(function () {
  'use strict';

  const App = window.SchmobinApp;
  const SUPPORTED_TYPES = [
    'multiple-choice', 'image-quiz', 'audio-quiz', 'estimate', 'sort',
    'fight-list', 'higher-lower', 'survey', 'consensus', 'hotspot', 'buzzer'
  ];
  const TYPE_LABELS = {
    'multiple-choice': 'Multiple Choice',
    'image-quiz': 'Bilderquiz',
    'audio-quiz': 'Audio-Quiz',
    estimate: 'Schätzfrage',
    sort: 'Sortierquiz',
    'fight-list': 'Fight List',
    'higher-lower': 'Higher / Lower',
    survey: 'Publikums-Duell',
    consensus: 'Gleich gedacht',
    hotspot: 'Hotspot',
    buzzer: 'Buzzer'
  };
  const TYPE_ICONS = {
    'multiple-choice': '◉', 'image-quiz': '▣', 'audio-quiz': '♪', estimate: '≈',
    sort: '↕', 'fight-list': '✎', 'higher-lower': '↗', survey: '▥',
    consensus: '◎', hotspot: '⌖', buzzer: '⚡'
  };
  const TYPE_DESCRIPTIONS = {
    'multiple-choice': 'Klassische Auswahl mit einer richtigen Antwort.',
    'image-quiz': 'Bild plus Antwortoptionen – ideal für Orte, Logos oder Details.',
    'audio-quiz': 'Audio-Clip plus Antwortoptionen – für Songs, Sounds und Stimmen.',
    estimate: 'Wert auf einer Skala schätzen; Nähe zum Zielwert bringt Punkte.',
    sort: 'Elemente in die richtige Reihenfolge bringen.',
    'fight-list': 'Mehrere freie Begriffe sammeln; jeder Treffer zählt.',
    'higher-lower': 'Werte paarweise als höher oder niedriger einschätzen.',
    survey: 'Wie hat das Publikum abgestimmt? Die stärkste Umfrage-Antwort gewinnt.',
    consensus: 'Es gibt kein Vorwissen: Punkte gibt es für die Antwort der Mehrheit.',
    hotspot: 'Auf einem Bild möglichst genau die gesuchte Position treffen.',
    buzzer: 'Geschwindigkeit zählt: Der erste Spieler buzzert oder sendet eine Schnellantwort, der Moderator entscheidet.'
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function categoryKey(value) {
    return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE');
  }
  function cleanCategory(value) { return String(value || '').normalize('NFKC').trim(); }
  function categoryHue(value) {
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
  function normalizeOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => {
      if (option && typeof option === 'object') {
        return { id: String(option.id ?? String.fromCharCode(97 + index)), text: String(option.text ?? option.label ?? '') };
      }
      return { id: String.fromCharCode(97 + index), text: String(option ?? '') };
    });
  }
  function normalizeSurveyOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => {
      if (option && typeof option === 'object') {
        return {
          id: String(option.id ?? String.fromCharCode(97 + index)),
          text: String(option.text ?? option.label ?? ''),
          value: Math.max(0, numberOr(option.value ?? option.percent ?? option.percentage, 0))
        };
      }
      return { id: String.fromCharCode(97 + index), text: String(option ?? ''), value: 0 };
    });
  }
  function isChoiceType(type) {
    return ['multiple-choice', 'image-quiz', 'audio-quiz', 'survey', 'consensus'].includes(type);
  }
  function normalizeQuestion(question, index, settings) {
    const q = clone(question || {});
    q.id = String(q.id || `q_${index + 1}_${App.uid('x').slice(-6)}`);
    q.type = String(q.type || 'multiple-choice');
    q.category = cleanCategory(q.category);
    q.text = String(q.text || q.question || '');
    q.points = numberOr(q.points, numberOr(settings.defaultPoints, 100));
    q.timer = numberOr(q.timer, numberOr(settings.defaultTimer, 30));

    if (['multiple-choice', 'image-quiz', 'audio-quiz', 'consensus'].includes(q.type)) {
      q.options = normalizeOptions(q.options || q.answers);
      if (q.correctAnswer == null && q.correct != null) q.correctAnswer = q.correct;
    }
    if (q.type === 'survey') {
      q.options = normalizeSurveyOptions(q.options || q.answers);
    }
    if (q.type === 'image-quiz' || q.type === 'hotspot') {
      q.image = String(q.image ?? q.imageUrl ?? '');
      q.imageAlt = String(q.imageAlt ?? '');
    }
    if (q.type === 'audio-quiz') {
      q.audio = String(q.audio ?? q.audioUrl ?? q.sound ?? '');
      q.audioLabel = String(q.audioLabel ?? 'Audio-Hinweis');
    }
    if (q.type === 'estimate') {
      q.min = numberOr(q.min, 0);
      q.max = numberOr(q.max, 100);
      q.step = Math.max(0.000001, numberOr(q.step, 1));
      if (q.correctAnswer == null && q.answer != null) q.correctAnswer = q.answer;
      q.correctAnswer = numberOr(q.correctAnswer, q.min);
      if (q.unit == null) q.unit = '';
    }
    if (q.type === 'sort') {
      const items = q.items || q.correctOrder || q.options || [];
      q.items = Array.isArray(items) ? items.map(String) : [];
      q.correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder.map(String) : q.items.slice();
    }
    if (q.type === 'fight-list') {
      const answers = q.correctAnswers || q.answers || q.solutions || [];
      q.correctAnswers = Array.isArray(answers) ? answers.map(String) : [];
      q.pointsPerAnswer = numberOr(q.pointsPerAnswer, q.correctAnswers.length ? q.points / q.correctAnswers.length : q.points);
      q.maxEntries = Math.max(1, Math.round(numberOr(q.maxEntries, q.correctAnswers.length || 5)));
    }
    if (q.type === 'higher-lower') {
      const cards = Array.isArray(q.cards) ? q.cards : [];
      q.cards = cards.map((card, i) => ({
        id: String(card?.id || `card_${i + 1}`),
        label: String(card?.label ?? card?.title ?? card?.name ?? `Karte ${i + 1}`),
        value: numberOr(card?.value, 0),
        unit: String(card?.unit ?? q.unit ?? '')
      }));
    }
    if (q.type === 'hotspot') {
      q.targetX = Math.min(100, Math.max(0, numberOr(q.targetX ?? q.x, 50)));
      q.targetY = Math.min(100, Math.max(0, numberOr(q.targetY ?? q.y, 50)));
      q.radius = Math.min(50, Math.max(1, numberOr(q.radius ?? q.tolerance, 10)));
    }
    if (q.type === 'buzzer') {
      q.timer = 0;
      q.buzzerMode = String(q.buzzerMode || q.mode || 'spoken');
      q.solution = String(q.solution || q.correctAnswer || q.answer || '');
      q.penalty = numberOr(q.penalty, 0);
    }
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
    let rounds = Array.isArray(raw.rounds) ? raw.rounds : [];
    if (!rounds.length && Array.isArray(raw.questions)) {
      rounds = [{ id: 'round_001', title: raw.roundTitle || 'Runde 1', pointsMultiplier: 1, questions: raw.questions }];
    }
    const quiz = {
      id: String(raw.id || `quiz_${slug(raw.title || 'jh-quiz')}`),
      title: String(raw.title || 'Unbenanntes Quiz'),
      description: String(raw.description || ''),
      settings,
      categories: Array.isArray(raw.categories) ? clone(raw.categories) : [],
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
  function optionById(question, id) {
    return (question.options || []).find(option => String(option.id) === String(id));
  }
  function correctOption(question) {
    const options = question.options || [];
    const correct = String(question.correctAnswer ?? '');
    // Explicit option IDs/text take precedence. Numeric indexes remain supported for legacy quiz files.
    const direct = options.find(option => String(option.id) === correct) || options.find(option => option.text === correct);
    if (direct) return direct;
    const index = Number(correct);
    return Number.isInteger(index) && index >= 0 && index < options.length ? options[index] : null;
  }
  function answerMatches(question, answer) {
    const q = question;
    if (['multiple-choice', 'image-quiz', 'audio-quiz'].includes(q.type)) {
      const correct = correctOption(q);
      return Boolean(correct && String(answer ?? '') === String(correct.id));
    }
    return false;
  }
  function normalizeTerm(value) {
    return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  }
  function surveyWinnerIds(question) {
    const options = question.options || [];
    if (!options.length) return [];
    const max = Math.max(...options.map(option => Number(option.value) || 0));
    return options.filter(option => (Number(option.value) || 0) === max).map(option => String(option.id));
  }
  function computeConsensusResult(question, submissions) {
    const counts = {};
    (question.options || []).forEach(option => { counts[String(option.id)] = 0; });
    Object.values(submissions || {}).forEach(record => {
      const id = String(record?.answer ?? '');
      if (Object.prototype.hasOwnProperty.call(counts, id)) counts[id] += 1;
    });
    const values = Object.values(counts);
    const maxVotes = values.length ? Math.max(...values) : 0;
    const winningOptionIds = maxVotes > 0 ? Object.keys(counts).filter(id => counts[id] === maxVotes) : [];
    return { counts, maxVotes, totalVotes: values.reduce((sum, value) => sum + value, 0), winningOptionIds };
  }
  function scoreAnswer(question, answer, multiplier = 1) {
    const q = question;
    const base = Math.max(0, numberOr(q.points, 0));
    const mult = Math.max(0, numberOr(multiplier, 1));
    let raw = 0;
    let detail = '';

    if (['multiple-choice', 'image-quiz', 'audio-quiz'].includes(q.type)) {
      raw = answerMatches(q, answer) ? base : 0;
      detail = raw ? 'Richtig' : 'Falsch';
    } else if (q.type === 'survey') {
      const winners = surveyWinnerIds(q);
      raw = winners.includes(String(answer)) ? base : 0;
      const option = optionById(q, answer);
      detail = raw ? `Publikums-Favorit${option ? ` · ${option.value}%` : ''}` : (option ? `${option.value}% der Befragten` : 'Keine gültige Auswahl');
    } else if (q.type === 'estimate') {
      const value = Number(answer);
      if (Number.isFinite(value)) {
        const target = Number(q.correctAnswer);
        const range = Math.max(Math.abs(q.max - q.min), q.step || 1);
        const distance = Math.abs(value - target);
        const ratio = Math.max(0, 1 - distance / range);
        raw = Math.round(base * ratio);
        if (q.tolerance != null && distance <= Number(q.tolerance)) raw = base;
        detail = `Abweichung: ${Number(distance.toFixed(3))}${q.unit ? ` ${q.unit}` : ''}`;
      }
    } else if (q.type === 'sort') {
      const correct = q.correctOrder || q.items || [];
      const submitted = Array.isArray(answer) ? answer : [];
      const matched = correct.reduce((sum, item, i) => sum + (normalizeTerm(item) === normalizeTerm(submitted[i]) ? 1 : 0), 0);
      raw = correct.length ? Math.round(base * matched / correct.length) : 0;
      detail = `${matched}/${correct.length} Positionen richtig`;
    } else if (q.type === 'fight-list') {
      const entries = Array.isArray(answer) ? answer : String(answer || '').split(/[\n,;]/);
      const submitted = Array.from(new Set(entries.map(normalizeTerm).filter(Boolean)));
      const correct = new Set((q.correctAnswers || []).map(normalizeTerm));
      const matches = submitted.filter(item => correct.has(item)).length;
      raw = Math.min(base, Math.round(matches * numberOr(q.pointsPerAnswer, base)));
      detail = `${matches} Treffer`;
    } else if (q.type === 'higher-lower') {
      const guesses = Array.isArray(answer) ? answer : [];
      const cards = q.cards || [];
      let correctCount = 0;
      for (let i = 0; i < cards.length - 1; i++) {
        const expected = cards[i + 1].value >= cards[i].value ? 'higher' : 'lower';
        if (guesses[i] === expected) correctCount++;
      }
      const total = Math.max(0, cards.length - 1);
      raw = total ? Math.round(base * correctCount / total) : 0;
      detail = `${correctCount}/${total} richtig`;
    } else if (q.type === 'hotspot') {
      const x = Number(answer?.x);
      const y = Number(answer?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const distance = Math.hypot(x - Number(q.targetX), y - Number(q.targetY));
        raw = distance <= Number(q.radius) ? base : 0;
        detail = `${raw ? 'Treffer' : 'Daneben'} · Abstand ${Number(distance.toFixed(1))}%`;
      }
    }
    return { points: Math.round(raw * mult), basePoints: raw, detail };
  }
  function correctAnswerText(question, result = null) {
    const q = question;
    if (['multiple-choice', 'image-quiz', 'audio-quiz'].includes(q.type)) {
      const option = correctOption(q);
      return option ? option.text : String(q.correctAnswer ?? '');
    }
    if (q.type === 'survey') {
      return surveyWinnerIds(q).map(id => {
        const option = optionById(q, id);
        return option ? `${option.text} (${option.value}%)` : id;
      }).join(' · ');
    }
    if (q.type === 'consensus') {
      const ids = result?.winningOptionIds || [];
      return ids.length ? ids.map(id => optionById(q, id)?.text || id).join(' · ') : 'Mehrheit entscheidet';
    }
    if (q.type === 'estimate') return `${q.correctAnswer}${q.unit ? ` ${q.unit}` : ''}`;
    if (q.type === 'sort') return (q.correctOrder || q.items || []).join(' → ');
    if (q.type === 'fight-list') return (q.correctAnswers || []).join(', ');
    if (q.type === 'higher-lower') return (q.cards || []).map(c => `${c.label}: ${c.value}${c.unit ? ` ${c.unit}` : ''}`).join(' · ');
    if (q.type === 'hotspot') return 'Markierter Zielbereich';
    if (q.type === 'buzzer') return q.solution || 'Moderatorentscheidung';
    return '';
  }
  function answerLabel(question, answer) {
    const q = question;
    if (isChoiceType(q.type)) return optionById(q, answer)?.text || String(answer ?? '');
    if (q.type === 'estimate') return `${answer ?? '–'}${q.unit ? ` ${q.unit}` : ''}`;
    if (q.type === 'sort' || q.type === 'fight-list') return Array.isArray(answer) ? answer.join(' · ') : String(answer ?? '');
    if (q.type === 'higher-lower') return (Array.isArray(answer) ? answer : []).map(value => value === 'higher' ? 'Höher' : value === 'lower' ? 'Niedriger' : '–').join(' · ');
    if (q.type === 'hotspot') {
      const x = Number(answer?.x), y = Number(answer?.y);
      return Number.isFinite(x) && Number.isFinite(y) ? `X ${x.toFixed(1)}% · Y ${y.toFixed(1)}%` : 'Kein Punkt gewählt';
    }
    if (q.type === 'buzzer') return q.buzzerMode === 'spoken' ? 'Mündliche Antwort' : String(answer ?? '');
    return String(answer ?? '');
  }

  window.SchmobinQuiz = {
    SUPPORTED_TYPES, TYPE_LABELS, TYPE_ICONS, TYPE_DESCRIPTIONS, clone, numberOr, categoryKey, cleanCategory, slug,
    normalizeQuiz, extractCategories, allQuestions, categoryHue, scoreAnswer, correctAnswerText, answerLabel, normalizeTerm,
    isChoiceType, optionById, correctOption, surveyWinnerIds, computeConsensusResult
  };
})();
