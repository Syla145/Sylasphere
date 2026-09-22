(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Validator = window.SchmobinValidator;
  const Session = window.SchmobinSession;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;

  let activeQuiz = null;
  let engine = null;
  let state = null;
  let timer = null;

  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    ['quiz-select','quiz-summary','quiz-import','create-session','setup-panel','session-panel','session-code','session-status','players-list','player-count','question-area','answer-status','round-progress','timer-number','timer-ring','btn-start-game','btn-start-question','btn-close-question','btn-prev','btn-next','btn-finish','btn-new-session','btn-fullscreen','validation-box'].forEach(id => els[id] = document.getElementById(id));
    bind();
    await loadQuizList();
    const requested = (App.getParam('code') || '').toUpperCase();
    const resume = requested || Session.lastCode();
    if (resume && Session.exists(resume)) connectSession(resume);
  }

  function bind() {
    els['quiz-select']?.addEventListener('change', () => loadSelectedQuiz());
    els['quiz-import']?.addEventListener('change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { setQuiz(await App.readJSONFile(file), file.name); }
      catch (error) { App.toast(error.message, 'error'); }
      event.target.value = '';
    });
    els['create-session']?.addEventListener('click', () => {
      if (!activeQuiz) return App.toast('Bitte zuerst ein gültiges Quiz laden.', 'error');
      const validation = Validator.validate(activeQuiz);
      if (!validation.valid) return showValidation(validation);
      connectEngine(Session.create(validation.normalized));
      history.replaceState(null, '', `?code=${engine.code}`);
      App.toast(`Sitzung ${engine.code} erstellt.`, 'success');
    });
    els['btn-start-game']?.addEventListener('click', () => safe(() => engine.startGame()));
    els['btn-start-question']?.addEventListener('click', () => safe(() => engine.startQuestion()));
    els['btn-close-question']?.addEventListener('click', () => safe(() => engine.closeQuestion()));
    els['btn-prev']?.addEventListener('click', () => safe(() => engine.move(-1)));
    els['btn-next']?.addEventListener('click', () => safe(() => engine.move(1)));
    els['btn-finish']?.addEventListener('click', () => { if (confirm('Quiz wirklich beenden?')) safe(() => engine.finish()); });
    els['btn-new-session']?.addEventListener('click', () => {
      engine?.destroy(); engine = null; state = null; timer?.stop();
      els['session-panel'].hidden = true; els['setup-panel'].hidden = false; history.replaceState(null, '', location.pathname);
    });
    els['btn-fullscreen']?.addEventListener('click', async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
      catch (_) { App.toast('Vollbild konnte nicht aktiviert werden.', 'error'); }
    });
    document.addEventListener('keydown', event => {
      if (!engine || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); state?.questionOpen ? engine.closeQuestion() : engine.startQuestion(); }
      if (event.key === 'ArrowRight') engine.move(1);
      if (event.key === 'ArrowLeft') engine.move(-1);
    });
  }

  async function loadQuizList() {
    try {
      const response = await fetch(`./data/quiz-list.json?cb=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const list = await response.json();
      els['quiz-select'].replaceChildren();
      (Array.isArray(list) ? list : list.quizzes || []).forEach(item => {
        const option = document.createElement('option'); option.value = item.file || item.filename || ''; option.textContent = item.title || option.value; option.dataset.description = item.description || ''; els['quiz-select'].append(option);
      });
      if (els['quiz-select'].options.length) await loadSelectedQuiz();
      else throw new Error('Keine Quiz-Dateien in quiz-list.json gefunden.');
    } catch (error) {
      els['quiz-summary'].innerHTML = `<div class="notice notice--error">Quiz-Liste konnte nicht geladen werden: ${App.escapeHTML(error.message)}. Eigene JSON-Dateien können weiterhin importiert werden.</div>`;
    }
  }

  async function loadSelectedQuiz() {
    const file = els['quiz-select'].value; if (!file) return;
    try {
      const safeFile = file.replace(/^\.\//, '');
      const response = await fetch(`./data/${safeFile}?cb=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setQuiz(await response.json(), safeFile);
    } catch (error) { App.toast(`Quiz konnte nicht geladen werden: ${error.message}`, 'error'); }
  }

  function setQuiz(input, source = '') {
    const validation = Validator.validate(input);
    activeQuiz = validation.normalized;
    const q = activeQuiz.quiz;
    const questionCount = q.rounds.reduce((sum, round) => sum + round.questions.length, 0);
    const categories = Quiz.extractCategories(activeQuiz);
    els['quiz-summary'].innerHTML = `
      <div class="quiz-summary-head"><div><span class="eyebrow">${App.escapeHTML(source || 'Quiz')}</span><h2>${App.escapeHTML(q.title)}</h2><p>${App.escapeHTML(q.description)}</p></div><div class="stat-badge"><strong>${questionCount}</strong><span>Fragen</span></div></div>
      <div class="chip-row">${categories.map(c => `<span class="chip">${App.escapeHTML(c)}</span>`).join('')}</div>
      <div class="microcopy">${q.rounds.length} Runde${q.rounds.length === 1 ? '' : 'n'} · ${validation.errors.length} Fehler · ${validation.warnings.length} Hinweise</div>`;
    showValidation(validation);
    els['create-session'].disabled = !validation.valid;
  }

  function showValidation(validation) {
    if (!els['validation-box']) return;
    const items = [...validation.errors.map(x => ({...x, kind:'error'})), ...validation.warnings.map(x => ({...x, kind:'warning'}))];
    if (!items.length) { els['validation-box'].innerHTML = '<div class="notice notice--success">Quiz-Datei ist plausibel und spielbereit.</div>'; return; }
    els['validation-box'].innerHTML = `<details ${validation.errors.length ? 'open' : ''}><summary>${validation.errors.length} Fehler, ${validation.warnings.length} Hinweise</summary><div class="validation-list">${items.map(x => `<div class="validation-item validation-item--${x.kind}"><code>${App.escapeHTML(x.path)}</code><span>${App.escapeHTML(x.message)}</span></div>`).join('')}</div></details>`;
  }

  function connectSession(code) { connectEngine(new Session(code)); }
  function connectEngine(instance) {
    engine?.destroy(); engine = instance;
    const existing = engine.load();
    if (!existing) { engine.destroy(); engine = null; return App.toast('Sitzung nicht gefunden.', 'error'); }
    els['setup-panel'].hidden = true; els['session-panel'].hidden = false;
    engine.subscribe(render);
  }

  function render(nextState) {
    state = nextState;
    const current = engine.getCurrent(state);
    App.setText(els['session-code'], state.code);
    App.setText(els['session-status'], statusLabel(state));
    const qIndexGlobal = questionGlobalIndex(state);
    const total = Quiz.allQuestions(state.quiz).length;
    App.setText(els['round-progress'], current.round ? `${current.round.title} · Frage ${qIndexGlobal + 1}/${total}` : 'Keine Frage');
    renderPlayers();
    renderQuestion(current);
    renderTimer();
    renderButtons(current);
  }

  function statusLabel(s) {
    if (s.status === 'lobby') return 'Lobby';
    if (s.status === 'finished') return 'Beendet';
    return s.questionOpen ? 'Frage läuft' : 'Bereit';
  }
  function questionGlobalIndex(s) {
    let n = 0; const quiz = s.quiz.quiz;
    for (let i = 0; i < s.currentRoundIndex; i++) n += quiz.rounds[i]?.questions.length || 0;
    return n + s.currentQuestionIndex;
  }
  function renderPlayers() {
    const players = state.players.slice().sort((a,b) => b.score - a.score || a.joinedAt - b.joinedAt);
    App.setText(els['player-count'], String(players.length));
    if (!players.length) { els['players-list'].innerHTML = '<div class="empty-state compact">Noch keine Spieler beigetreten.</div>'; return; }
    els['players-list'].innerHTML = players.map((p, i) => `
      <div class="player-row" data-player="${App.escapeHTML(p.id)}">
        <div class="player-rank">${i + 1}</div><div class="avatar">${App.escapeHTML(App.avatar(p.avatar))}</div>
        <div class="player-name"><strong>${App.escapeHTML(p.name)}</strong><span>${App.formatPoints(p.score)}</span></div>
        <div class="score-controls"><button type="button" class="icon-btn score-minus" title="10 Punkte abziehen">−</button><button type="button" class="icon-btn score-plus" title="10 Punkte addieren">+</button></div>
      </div>`).join('');
    els['players-list'].querySelectorAll('.player-row').forEach(row => {
      row.querySelector('.score-minus').addEventListener('click', () => engine.adjustPlayerScore(row.dataset.player, -10));
      row.querySelector('.score-plus').addEventListener('click', () => engine.adjustPlayerScore(row.dataset.player, 10));
    });
  }
  function renderQuestion(current) {
    if (state.status === 'finished') {
      const winners = state.players.slice().sort((a,b)=>b.score-a.score);
      els['question-area'].innerHTML = `<div class="finish-card"><span class="eyebrow">Spiel beendet</span><h2>${winners[0] ? `🏆 ${App.escapeHTML(winners[0].name)}` : 'Fertig!'}</h2><p>${winners[0] ? `${App.formatPoints(winners[0].score)} · Glückwunsch!` : 'Keine Spieler in der Sitzung.'}</p></div>`;
      els['answer-status'].innerHTML = ''; return;
    }
    if (!current.question) { els['question-area'].innerHTML = '<div class="empty-state">Keine Frage verfügbar.</div>'; return; }
    Renderers.renderModerator(current.question, els['question-area'], { readOnly: true, reveal: !state.questionOpen });
    const answers = state.answers[current.question.id] || {};
    const submitted = Object.keys(answers).length;
    const total = state.players.length;
    const correct = !state.questionOpen ? Quiz.correctAnswerText(current.question) : '';
    els['answer-status'].innerHTML = `<div class="response-meter"><div><strong>${submitted}/${total}</strong><span>Antworten</span></div><div class="meter"><span style="width:${total ? Math.round(submitted/total*100) : 0}%"></span></div></div>${correct ? `<div class="reveal-box"><span>Lösung</span><strong>${App.escapeHTML(correct)}</strong></div>` : ''}${!state.questionOpen && submitted ? answerRows(current.question, answers) : ''}`;
  }
  function answerRows(question, answers) {
    const players = new Map(state.players.map(p => [p.id,p]));
    return `<div class="answer-review">${Object.entries(answers).map(([pid,a]) => {
      const player = players.get(pid); const shown = Array.isArray(a.answer) ? a.answer.join(' · ') : String(a.answer ?? '');
      return `<div><span>${App.escapeHTML(player?.name || 'Spieler')}</span><span>${App.escapeHTML(shown)}</span><strong>+${Math.round(a.awardedPoints || 0)} P</strong></div>`;
    }).join('')}</div>`;
  }
  function renderTimer() {
    timer?.stop();
    if (!state.questionOpen || !state.questionEndsAt) { App.setText(els['timer-number'], '–'); els['timer-ring']?.style.setProperty('--timer-progress','0deg'); return; }
    const total = Math.max(1, state.questionEndsAt - (state.questionStartedAt || Date.now()));
    timer = new Timer((seconds, ms) => {
      App.setText(els['timer-number'], String(seconds ?? '–'));
      const progress = ms == null ? 0 : App.clamp(ms / total, 0, 1) * 360;
      els['timer-ring']?.style.setProperty('--timer-progress', `${progress}deg`);
      els['timer-ring']?.classList.toggle('is-critical', seconds != null && seconds <= 5);
    }, () => { const fresh = engine.load(); if (fresh?.questionOpen) engine.closeQuestion(); });
    timer.start(state.questionEndsAt);
  }
  function renderButtons(current) {
    const finished = state.status === 'finished';
    els['btn-start-game'].disabled = state.status !== 'lobby' || !state.players.length;
    els['btn-start-question'].disabled = finished || state.questionOpen || !current.question;
    els['btn-close-question'].disabled = finished || !state.questionOpen;
    els['btn-prev'].disabled = state.questionOpen || questionGlobalIndex(state) <= 0;
    els['btn-next'].disabled = state.questionOpen || finished;
    els['btn-finish'].disabled = finished;
  }
  function safe(fn) { try { fn(); } catch (error) { App.toast(error.message, 'error'); } }
})();
