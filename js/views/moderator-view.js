(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Validator = window.SchmobinValidator;
  const Session = window.SchmobinSession;
  const Online = window.JHQuizOnlineSession;
  const Firebase = window.JHQuizFirebase;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  const Gate = window.SylasphereModeratorGate;

  let activeQuiz = null;
  let engine = null;
  let state = null;
  let timer = null;
  let transport = 'local';
  // Moderator-Entscheidungen je Frage: { frageId: { spielerId: true|false } }
  const reviews = {};

  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['quiz-select','quiz-summary','quiz-import','create-session','create-online-session','firebase-status','setup-panel','session-panel','session-code','session-status','session-mode','transport-hint','players-list','player-count','question-area','answer-status','round-progress','timer-number','timer-ring','btn-start-game','btn-start-question','btn-close-question','btn-resolve-question','btn-prev','btn-next','btn-finish','btn-new-session','btn-fullscreen','validation-box','player-link','spectator-link','copy-player-link','copy-spectator-link'].forEach(id => els[id] = document.getElementById(id));
    bind();
    if (Gate) await Gate.whenUnlocked();
    await loadQuizList();

    const requested = (App.getParam('code') || '').toUpperCase();
    const requestedMode = String(App.getParam('mode') || '').toLowerCase();
    if (requested) {
      if (requestedMode === 'online') await connectOnlineSession(requested, true);
      else if (Session.exists(requested)) connectLocalSession(requested);
      else await connectOnlineSession(requested, false);
    }
  }

  function bind() {
    els['quiz-select']?.addEventListener('change', () => loadSelectedQuiz());
    els['quiz-import']?.addEventListener('change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { setQuiz(await App.readJSONFile(file), file.name); }
      catch (error) { App.toast(error.message, 'error'); }
      event.target.value = '';
    });

    els['create-session']?.addEventListener('click', () => safe(async () => {
      const validation = validateForStart(); if (!validation) return;
      await connectEngine(Session.create(validation.normalized), 'local');
      history.replaceState(null, '', `?code=${engine.code}&mode=local`);
      App.toast(`Lokale Sitzung ${engine.code} erstellt.`, 'success');
    }));

    els['create-online-session']?.addEventListener('click', () => safe(async () => {
      const validation = validateForStart(); if (!validation) return;
      const button = els['create-online-session'];
      const original = button.textContent;
      button.disabled = true; button.textContent = '🌐 Firebase verbindet …';
      setFirebaseStatus('Verbindung zu Firebase wird aufgebaut …');
      try {
        if (Gate) await Gate.ensureOnlineGrant();
        let instance;
        try { instance = await Online.create(validation.normalized); }
        catch (error) {
          const explained = Gate?.explainCreateError(error);
          if (explained) { setFirebaseStatus(explained, 'error'); throw new Error(explained); }
          throw error;
        }
        await connectEngine(instance, 'online');
        history.replaceState(null, '', `?code=${engine.code}&mode=online`);
        setFirebaseStatus('✓ Online-Modus bereit. Spieler können von überall beitreten.', 'ready');
        App.toast(`Online-Sitzung ${engine.code} erstellt.`, 'success');
      } finally {
        button.textContent = original;
        button.disabled = !activeQuiz || !Validator.validate(activeQuiz).valid;
      }
    }));

    els['btn-start-game']?.addEventListener('click', () => safe(() => engine.startGame()));
    els['btn-start-question']?.addEventListener('click', () => safe(() => engine.startQuestion()));
    els['btn-close-question']?.addEventListener('click', () => safe(() => engine.lockQuestion()));
    els['btn-resolve-question']?.addEventListener('click', () => safe(() => engine.resolveQuestion(resolveOptions())));
    // Moderator-Prüfung (✓/✗) per Klick in der Antwortliste
    els['answer-status']?.addEventListener('click', event => {
      const btn = event.target.closest('[data-review-player]');
      if (!btn || !engine) return;
      const question = engine.getCurrent(state).question;
      if (!question) return;
      reviews[question.id] = reviews[question.id] || {};
      reviews[question.id][btn.dataset.reviewPlayer] = Object.assign({}, reviews[question.id][btn.dataset.reviewPlayer], { [btn.dataset.reviewPart || '']: btn.dataset.verdict === 'true' });
      renderQuestion(engine.getCurrent(state));
    });
    // Song-Steuerung: Stufe abspielen, nächste Stufe, Ton auf diesem Gerät, Auflösung erneut
    els['answer-status']?.addEventListener('click', event => {
      const btn = event.target.closest('[data-song-action]');
      if (!btn || !engine) return;
      const action = btn.dataset.songAction;
      window.SylasphereMedia?.unlock();
      if (action === 'play') safe(() => engine.playStage());
      if (action === 'next') safe(() => engine.advanceStage());
      if (action === 'reveal') safe(() => engine.playReveal());
      if (action === 'mute') { const m = window.SylasphereMedia; m?.setEnabled(!m.status().enabled); renderQuestion(engine.getCurrent(state)); }
    });
    els['btn-prev']?.addEventListener('click', () => safe(() => engine.move(-1)));
    els['btn-next']?.addEventListener('click', () => safe(() => engine.move(1)));
    els['btn-finish']?.addEventListener('click', () => { if (confirm('Quiz wirklich beenden?')) safe(() => engine.finish()); });
    els['btn-new-session']?.addEventListener('click', async () => {
      try { await engine?.destroy?.(); } catch (_) {}
      engine = null; state = null; timer?.stop(); transport = 'local';
      els['session-panel'].hidden = true; els['setup-panel'].hidden = false; history.replaceState(null, '', location.pathname);
    });
    els['btn-fullscreen']?.addEventListener('click', async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
      catch (_) { App.toast('Vollbild konnte nicht aktiviert werden.', 'error'); }
    });
    els['copy-player-link']?.addEventListener('click', () => copyJoinLink('player'));
    els['copy-spectator-link']?.addEventListener('click', () => copyJoinLink('spectator'));

    document.addEventListener('keydown', event => {
      if (!engine || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        const current = engine.getCurrent(state);
        const resolved = Boolean(current.question && state.scoredQuestionIds?.includes(current.question.id));
        if (!state?.questionStartedAt && !resolved) safe(() => engine.startQuestion());
        else if (current.question?.type === 'buzzer') { if (!state?.questionOpen && !resolved) safe(() => engine.resolveQuestion()); }
        else if (state?.questionOpen) safe(() => engine.lockQuestion());
        else if (!resolved) safe(() => engine.resolveQuestion(resolveOptions()));
      }
      if (event.key === 'ArrowRight') safe(() => engine.move(1));
      if (event.key === 'ArrowLeft') safe(() => engine.move(-1));
    });
  }

  function validateForStart() {
    if (!activeQuiz) { App.toast('Bitte zuerst ein gültiges Quiz laden.', 'error'); return null; }
    const validation = Validator.validate(activeQuiz);
    if (!validation.valid) { showValidation(validation); return null; }
    return validation;
  }

  async function connectOnlineSession(code, loud = true) {
    try {
      setFirebaseStatus('Online-Sitzung wird geladen …');
      const instance = await Online.connect(code, 'moderator');
      await connectEngine(instance, 'online');
      history.replaceState(null, '', `?code=${instance.code}&mode=online`);
      setFirebaseStatus('✓ Online-Modus verbunden.', 'ready');
    } catch (error) {
      setFirebaseStatus(Firebase.friendlyError(error), 'error');
      if (loud) App.toast(Firebase.friendlyError(error), 'error');
    }
  }

  function connectLocalSession(code) { return connectEngine(new Session(code), 'local'); }

  async function connectEngine(instance, mode) {
    if (engine && engine !== instance) { try { await engine.destroy?.(); } catch (_) {} }
    engine = instance; transport = mode;
    const existing = mode === 'online' ? await engine.waitForState() : engine.load();
    if (!existing) { try { await engine.destroy?.(); } catch (_) {} engine = null; throw new Error('Sitzung nicht gefunden.'); }
    els['setup-panel'].hidden = true; els['session-panel'].hidden = false;
    engine.subscribe(render);
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
      <div class="chip-row">${categories.map(c => { const t = Quiz.topic(c, q.categories); return `<span class="chip topic-chip" style="--cat-hue:${t.hue}">${t.icon} ${App.escapeHTML(c)}</span>`; }).join('')}</div>
      <div class="microcopy">${q.rounds.length} Runde${q.rounds.length === 1 ? '' : 'n'} · ${validation.errors.length} Fehler · ${validation.warnings.length} Hinweise</div>`;
    // Design: Vorgabe aus dem Quiz, für diese Sitzung änderbar (wird an alle Geräte übertragen)
    window.SylasphereThemes?.applyQuiz(activeQuiz);
    const themeBox = document.getElementById('session-theme');
    if (themeBox && window.SylasphereThemes) themeBox.replaceChildren(window.SylasphereThemes.picker(activeQuiz.quiz.settings.theme, id => {
      activeQuiz.quiz.settings.theme = id;
      window.SylasphereThemes.apply(id);
    }));
    showValidation(validation);
    els['create-session'].disabled = !validation.valid;
    els['create-online-session'].disabled = !validation.valid;
  }

  function showValidation(validation) {
    if (!els['validation-box']) return;
    const items = [...validation.errors.map(x => ({...x, kind:'error'})), ...validation.warnings.map(x => ({...x, kind:'warning'}))];
    if (!items.length) { els['validation-box'].innerHTML = '<div class="notice notice--success">Quiz-Datei ist plausibel und spielbereit.</div>'; return; }
    els['validation-box'].innerHTML = `<details ${validation.errors.length ? 'open' : ''}><summary>${validation.errors.length} Fehler · ${validation.warnings.length} Hinweise</summary><div class="validation-list">${items.slice(0, 18).map(item => `<div class="validation-item validation-item--${item.kind}"><code>${App.escapeHTML(item.path)}</code><span>${App.escapeHTML(item.message)}</span></div>`).join('')}${items.length > 18 ? `<div class="microcopy">+ ${items.length - 18} weitere</div>` : ''}</div></details>`;
  }

  function setFirebaseStatus(message, kind = 'info') {
    if (!els['firebase-status']) return;
    els['firebase-status'].textContent = message;
    els['firebase-status'].dataset.state = kind;
  }

  function render(next) {
    state = next;
    window.SylasphereTopics?.use(state.quiz?.quiz?.categories); // eigene Themen des Quiz
    window.SylasphereThemes?.applyQuiz(state.quiz); // Design des Quiz
    const current = engine.getCurrent(state);
    App.setText(els['session-code'], state.code);
    App.setText(els['session-status'], statusLabel(state));
    if (els['session-mode']) {
      els['session-mode'].textContent = transport === 'online' ? (state.onlineConnected === false ? '↻ Reconnect' : '🌐 Online') : '💻 Lokal';
      els['session-mode'].classList.toggle('is-online', transport === 'online' && state.onlineConnected !== false);
      els['session-mode'].classList.toggle('is-offline', transport === 'online' && state.onlineConnected === false);
    }
    const modeQuery = transport === 'online' ? '&mode=online' : '&mode=local';
    if (els['player-link']) els['player-link'].href = `./spieler.html?code=${encodeURIComponent(state.code)}${modeQuery}`;
    if (els['spectator-link']) els['spectator-link'].href = `./zuschauer.html?code=${encodeURIComponent(state.code)}${modeQuery}`;
    if (els['transport-hint']) els['transport-hint'].textContent = transport === 'online'
      ? '🌐 Diesen Link kannst du an Spieler an anderen Orten schicken. Kein Login nötig.'
      : '💻 Lokaler Testmodus: Spieler-/Zuschaueransicht im selben Browser/Gerät öffnen.';
    const qIndexGlobal = questionGlobalIndex(state);
    const total = Quiz.allQuestions(state.quiz).length;
    App.setText(els['round-progress'], current.round ? `${current.round.title} · Frage ${qIndexGlobal + 1}/${total}` : 'Keine Frage');
    renderPlayers(); renderQuestion(current); renderTimer(); renderButtons(current);
  }

  function statusLabel(s) {
    if (s.status === 'lobby') return 'Lobby';
    if (s.status === 'finished') return 'Beendet';
    const current = engine?.getCurrent(s);
    if (!s.questionOpen && current?.question && s.scoredQuestionIds?.includes(current.question.id)) return 'Aufgelöst';
    if (!s.questionOpen && current?.question && s.questionStartedAt) return 'Antworten geschlossen';
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
        <div class="player-name"><strong>${App.escapeHTML(p.name)}</strong><span>${App.formatPoints(p.score)}${transport === 'online' && p.active === false ? ' · offline' : ''}</span></div>
        <div class="score-controls score-controls--precise" aria-label="Punkte von ${App.escapeHTML(p.name)} anpassen">
          <button type="button" class="score-step" data-delta="-10" title="10 Punkte abziehen">−10</button>
          <button type="button" class="score-step score-step--one" data-delta="-1" title="1 Punkt abziehen">−1</button>
          <input class="score-input" type="number" step="1" value="${Math.round(Number(p.score) || 0)}" inputmode="numeric" aria-label="Punktestand von ${App.escapeHTML(p.name)} direkt setzen" title="Punktestand direkt eingeben">
          <button type="button" class="score-step score-step--one" data-delta="1" title="1 Punkt addieren">+1</button>
          <button type="button" class="score-step" data-delta="10" title="10 Punkte addieren">+10</button>
        </div>
      </div>`).join('');
    els['players-list'].querySelectorAll('.player-row').forEach(row => {
      row.querySelectorAll('.score-step').forEach(button => button.addEventListener('click', () => safe(() => engine.adjustPlayerScore(row.dataset.player, Number(button.dataset.delta)))));
      const input = row.querySelector('.score-input');
      const applyExactScore = () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) { render(state); return; }
        safe(() => engine.setPlayerScore(row.dataset.player, Math.round(value)));
      };
      input.addEventListener('change', applyExactScore);
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); input.blur(); } });
      input.addEventListener('focus', () => input.select());
    });
  }

  function renderQuestion(current) {
    if (state.status === 'finished') {
      const winners = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
      els['question-area'].innerHTML = finalPodium(winners); els['answer-status'].innerHTML = ''; return;
    }
    if (!current.question) { els['question-area'].innerHTML = '<div class="empty-state">Keine Frage verfügbar.</div>'; return; }
    if (!state.questionStartedAt) {
      els['question-area'].innerHTML = `<div class="round-intro moderator-intro"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.topic(current.question.category).icon}</div><h2>${App.escapeHTML(current.question.category || 'Ohne Thema')}</h2><p>${Quiz.TYPE_ICONS[current.question.type] || '•'} ${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte${current.question.type === 'buzzer' ? ' · ohne Zeitlimit' : ` · ${current.question.timer || 0}s`}</p></div>`;
      els['answer-status'].innerHTML = `<div class="notice">Die Frage wird den Spielern erst beim Öffnen angezeigt.</div>${moderatorSolution(current.question, null, true)}`; return;
    }

    const questionResult = state.questionResults?.[current.question.id] || null;
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const pendingReveal = !state.questionOpen && state.questionStartedAt && !resolved;
    Renderers.renderModerator(current.question, els['question-area'], { readOnly: true, reveal: resolved, result: questionResult, stage: state.stage });
    window.SylasphereMedia?.sync(state.media, current.question); // Ton auch auf dem Moderator-Gerät (abschaltbar)
    const answers = state.answers[current.question.id] || {};
    const submitted = Object.keys(answers).length; const total = state.players.length;
    const correct = resolved ? Quiz.correctAnswerText(current.question, questionResult) : '';
    const label = Quiz.solutionLabel(current.question);

    if (current.question.type === 'buzzer') {
      const buzzer = questionResult && questionResult.kind === 'buzzer' ? questionResult : { status: state.questionOpen ? 'open' : 'idle', eliminatedIds: [] };
      const eligible = Math.max(0, total - (buzzer.eliminatedIds || []).length);
      const contender = buzzer.contenderName || findPlayerName(buzzer.contenderId);
      let html = `<div class="response-meter"><div><strong>${submitted}/${total}</strong><span>Buzzer-Versuche</span></div><div class="meter"><span style="width:${total ? Math.round(submitted / total * 100) : 0}%"></span></div></div>`;
      html += `<div class="stat-cards"><div><span>Status</span><strong>${buzzer.status === 'locked' ? 'Prüfung läuft' : buzzer.status === 'resolved' ? 'Aufgelöst' : buzzer.status === 'exhausted' ? 'Kein Spieler frei' : state.questionOpen ? 'Buzzer offen' : 'Geschlossen'}</strong></div><div><span>Verbleibend</span><strong>${eligible}</strong></div></div>`;
      if (buzzer.contenderId) html += `<div class="reveal-box"><span>Schnellster Spieler</span><strong>${App.escapeHTML(contender || 'Spieler')}</strong>${buzzer.mode === 'text' && buzzer.contenderAnswer ? `<small>${App.escapeHTML(String(buzzer.contenderAnswer))}</small>` : '<small>Antwort erfolgt mündlich</small>'}</div>`;
      if ((buzzer.eliminatedIds || []).length) {
        const blocked = (buzzer.eliminatedIds || []).map(findPlayerName).filter(Boolean).map(name => `<span class="chip">${App.escapeHTML(name)}</span>`).join('');
        if (blocked) html += `<div class="chip-row" style="margin-top:12px">${blocked}</div>`;
      }
      if (!resolved) html += moderatorSolution(current.question, questionResult);
      if (!resolved) html += `<div class="buzzer-admin-actions"><button type="button" class="btn btn--reveal" data-buzzer-action="resolve" ${buzzer.contenderId || buzzer.status === 'exhausted' ? '' : 'disabled'}>${buzzer.contenderId ? '✅ Richtig werten & auflösen' : 'Ohne Gewinner auflösen'}</button><button type="button" class="btn" data-buzzer-action="wrong" ${buzzer.contenderId ? '' : 'disabled'}>❌ Falsch · Spieler sperren & neu freigeben</button></div>`;
      if (resolved && correct) html += `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(correct)}</strong></div>`;
      if (resolved && submitted) html += answerRows(current.question, answers);
      els['answer-status'].innerHTML = html;
      els['answer-status'].querySelector('[data-buzzer-action="resolve"]')?.addEventListener('click', () => safe(() => engine.resolveQuestion()));
      els['answer-status'].querySelector('[data-buzzer-action="wrong"]')?.addEventListener('click', () => safe(() => engine.markBuzzerIncorrect()));
      return;
    }

    const hold = pendingReveal ? '<div class="notice notice--warning reveal-hold"><strong>Antwortphase beendet.</strong><span>Die Lösung ist für die Spieler noch verborgen. Klicke auf „Frage auflösen“, wenn du bereit bist.</span></div>' : '';
    const review = Quiz.needsReview(current.question) && !resolved ? reviewPanel(current.question, answers) : '';
    const songControl = stagePanel(current.question, resolved);
    els['answer-status'].innerHTML = `${songControl}<div class="response-meter"><div><strong>${submitted}/${total}</strong><span>Antworten</span></div><div class="meter"><span style="width:${total ? Math.round(submitted / total * 100) : 0}%"></span></div></div>${hold}${review}${correct ? `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(correct)}</strong></div>` : moderatorSolution(current.question, questionResult)}${resolved && submitted ? answerRows(current.question, answers) : ''}`;
  }

  // Lösung dauerhaft für den Moderator – vor, während und nach der Frage (Spieler sehen sie erst bei der Auflösung).
  function moderatorSolution(question, result, withQuestion = false) {
    if (!question) return '';
    // Text und Zusatzinfo (z. B. Toleranz) liefert das Fragetyp-Modul
    const label = Quiz.solutionLabel(question);
    const { text, extra: extraText } = Quiz.moderatorSolution(question, result);
    const extra = extraText ? `<small>${App.escapeHTML(extraText)}</small>` : '';
    const preview = withQuestion && question.text ? `<small class="moderator-solution-question">${App.escapeHTML(question.text)}</small>` : '';
    return `<div class="reveal-box moderator-solution"><span>🔒 ${label} · nur für dich sichtbar</span>${preview}<strong>${App.escapeHTML(text)}</strong>${extra}</div>`;
  }

  // Prüf-Teile: eine Prüfung (Lückentext) oder mehrere (Song: Titel + Interpret)
  const partsOf = question => Quiz.reviewParts(question) || [{ key: '', label: '' }];
  // Endgültige Entscheidung je Teil: explizit gesetzt → sonst Vorschlag (autoCheck) → sonst offen
  function verdictFor(question, playerId, answer, part = '') {
    const explicit = reviews[question.id]?.[playerId]?.[part];
    if (typeof explicit === 'boolean') return { value: explicit, source: 'moderator' };
    const suggestion = Quiz.autoCheck(question, answer, part);
    return typeof suggestion === 'boolean' ? { value: suggestion, source: 'auto' } : { value: null, source: 'open' };
  }
  function resolveOptions() {
    const question = engine?.getCurrent(state)?.question;
    if (!question || !Quiz.needsReview(question)) return {};
    const parts = Quiz.reviewParts(question);
    const answers = state.answers[question.id] || {};
    return { verdicts: Object.fromEntries(Object.entries(answers).map(([pid, record]) => [pid, parts
      ? Object.fromEntries(parts.map(part => [part.key, verdictFor(question, pid, record.answer, part.key).value === true]))
      : verdictFor(question, pid, record.answer).value === true])) };
  }
  function reviewPanel(question, answers) {
    const entries = Object.entries(answers || {});
    if (!entries.length) return '<div class="notice review-empty">Noch keine Antworten zum Prüfen.</div>';
    const parts = partsOf(question);
    const stages = Quiz.stagesOf(question);
    let open = 0;
    const rows = entries.map(([pid, a]) => {
      const verdicts = parts.map(part => verdictFor(question, pid, a.answer, part.key));
      open += verdicts.filter(v => v.value === null).length;
      const cls = verdicts.every(v => v.value === true) ? 'is-right' : verdicts.some(v => v.value === null) ? 'is-open' : verdicts.some(v => v.value === true) ? 'is-partial' : 'is-wrong';
      const auto = verdicts.some(v => v.source === 'auto') ? '<small>Vorschlag: exakter Treffer</small>' : '';
      const stageNote = stages && a.answer && typeof a.answer === 'object' ? `<small>Stufe ${(Number(a.answer.stage) || 0) + 1} · ${stages[Math.min(stages.length - 1, Number(a.answer.stage) || 0)].percent} %</small>` : '';
      const shown = parts.length > 1 && a.answer && typeof a.answer === 'object'
        ? parts.map(part => `<span class="review-part-answer"><em>${App.escapeHTML(part.label)}:</em> ${App.escapeHTML(String(a.answer[part.key] || '–'))}</span>`).join('')
        : `<span>${App.escapeHTML(Quiz.answerLabel(question, a.answer))}</span>`;
      const buttons = parts.map((part, i) => `<div class="review-actions">${part.label ? `<span class="review-part-label">${App.escapeHTML(part.label)}</span>` : ''}<button type="button" class="review-btn review-btn--right${verdicts[i].value === true ? ' is-active' : ''}" data-review-player="${App.escapeHTML(pid)}" data-review-part="${part.key}" data-verdict="true" aria-label="${App.escapeHTML(part.label || 'Antwort')} richtig">✓</button><button type="button" class="review-btn review-btn--wrong${verdicts[i].value === false ? ' is-active' : ''}" data-review-player="${App.escapeHTML(pid)}" data-review-part="${part.key}" data-verdict="false" aria-label="${App.escapeHTML(part.label || 'Antwort')} falsch">✗</button></div>`).join('');
      return `<div class="review-row ${cls}"><div class="review-who"><strong>${App.escapeHTML(findPlayerName(pid) || 'Spieler')}</strong>${shown}${stageNote}${auto}</div><div class="review-action-group">${buttons}</div></div>`;
    }).join('');
    return `<div class="review-panel"><div class="review-head"><strong>Antworten prüfen</strong><span>${open ? `${open} offen – ungeprüfte zählen als falsch` : 'Alle geprüft ✓'}</span></div>${rows}</div>`;
  }

  // Steuerung für Stufen-Fragen (Song-Enthüllung)
  function stagePanel(question, resolved) {
    const stages = Quiz.stagesOf(question);
    if (!stages) return '';
    const stage = Math.min(stages.length - 1, Number(state.stage) || 0);
    const media = window.SylasphereMedia?.status() || { enabled: false };
    const perStage = stages.map(() => 0);
    Object.values(state.answers[question.id] || {}).forEach(record => { const i = Math.min(stages.length - 1, Number(record?.answer?.stage) || 0); perStage[i]++; });
    const chips = stages.map((s, i) => `<div class="song-stage${!resolved && i === stage ? ' is-current' : ''}${!resolved && i < stage ? ' is-past' : ''}"><b>${i + 1}</b><span>${String(s.duration).replace('.', ',')} s</span><small>${s.percent} % · ${perStage[i]} Antw.</small></div>`).join('');
    const last = stage >= stages.length - 1;
    const sound = `<button type="button" class="btn btn--small${media.enabled ? '' : ' is-off'}" data-song-action="mute">${media.enabled ? '🔊 Ton hier an' : '🔇 Ton hier aus'}</button>`;
    const controls = resolved
      ? `<button type="button" class="btn" data-song-action="reveal">▶ Auflösung erneut abspielen</button>${sound}`
      : `<button type="button" class="btn btn--success" data-song-action="play" ${state.questionStartedAt ? '' : 'disabled'}>▶ Stufe ${stage + 1} abspielen (${String(stages[stage].duration).replace('.', ',')} s)</button><button type="button" class="btn btn--primary" data-song-action="next" ${state.questionOpen && !last ? '' : 'disabled'}>⏭ Nächste Stufe${last ? '' : ` (${String(stages[stage + 1].duration).replace('.', ',')} s)`}</button>${sound}`;
    return `<div class="song-control"><div class="song-stages">${chips}</div><div class="song-control-actions">${controls}</div><p class="microcopy">Jeder Klick auf ▶ spielt die aktuelle Stufe erneut für alle. Spieler können antworten, bis du zur nächsten Stufe wechselst oder die Antworten schließt.</p></div>`;
  }

  function findPlayerName(playerId) {
    return state.players.find(player => player.id === playerId)?.name || '';
  }

  function answerRows(question, answers) {
    const players = new Map(state.players.map(p => [p.id, p]));
    return `<div class="answer-review">${Object.entries(answers).map(([pid, a]) => {
      const player = players.get(pid); const shown = Quiz.answerLabel(question, a.answer);
      return `<div><span>${App.escapeHTML(player?.name || 'Spieler')}</span><span>${App.escapeHTML(shown)}</span><strong class="${Number(a.awardedPoints) > 0 ? 'score-positive' : ''}">+${Math.round(a.awardedPoints || 0)} P</strong></div>`;
    }).join('')}</div>`;
  }

  function finalPodium(ranked) {
    const top = ranked.slice(0, 3); const order = [top[1], top[0], top[2]].filter(Boolean);
    const podium = order.map(player => {
      const rank = ranked.findIndex(p => p.id === player.id) + 1;
      return `<div class="podium-place podium-place--${rank}"><div class="podium-avatar">${App.escapeHTML(App.avatar(player.avatar))}</div><strong>${App.escapeHTML(player.name)}</strong><span>${App.formatPoints(player.score)}</span><b>${rank}</b></div>`;
    }).join('');
    return `<div class="final-screen"><span class="eyebrow">Spiel beendet</span><h2>${ranked[0] ? `🏆 ${App.escapeHTML(ranked[0].name)} gewinnt!` : 'Fertig!'}</h2><div class="podium">${podium}</div></div>`;
  }

  async function copyJoinLink(kind) {
    if (!state?.code) return;
    const file = kind === 'spectator' ? 'zuschauer.html' : 'spieler.html';
    const mode = transport === 'online' ? 'online' : 'local';
    const url = new URL(`./${file}?code=${encodeURIComponent(state.code)}&mode=${mode}`, location.href).href;
    try { await App.copyText(url); App.toast(kind === 'spectator' ? 'Presenter-Link kopiert.' : 'Spieler-Link kopiert.', 'success'); }
    catch (_) { App.toast('Link konnte nicht kopiert werden.', 'error'); }
  }

  function renderTimer() {
    timer?.stop();
    const current = engine?.getCurrent(state);
    els['timer-ring']?.classList.remove('is-critical', 'is-ended');
    if (current?.question?.type === 'buzzer' && state.questionStartedAt && !state.scoredQuestionIds?.includes(current.question.id)) {
      App.setText(els['timer-number'], '⚡');
      els['timer-ring']?.style.setProperty('--timer-progress', '360deg');
      return;
    }
    const resolved = Boolean(current?.question && state.scoredQuestionIds?.includes(current.question.id));
    const pendingReveal = Boolean(current?.question && state.questionStartedAt && !state.questionOpen && !resolved);
    if (pendingReveal) { App.setText(els['timer-number'], '0'); els['timer-ring']?.style.setProperty('--timer-progress','0deg'); els['timer-ring']?.classList.add('is-ended'); return; }
    if (!state.questionOpen || !state.questionEndsAt) { App.setText(els['timer-number'], '–'); els['timer-ring']?.style.setProperty('--timer-progress','0deg'); return; }
    const total = Math.max(1, state.questionEndsAt - (state.questionStartedAt || Date.now()));
    timer = new Timer((seconds, ms) => {
      App.setText(els['timer-number'], String(seconds ?? '–'));
      const progress = ms == null ? 0 : App.clamp(ms / total, 0, 1) * 360;
      els['timer-ring']?.style.setProperty('--timer-progress', `${progress}deg`);
      els['timer-ring']?.classList.toggle('is-critical', seconds != null && seconds <= 5);
    }, () => { const fresh = engine.load(); if (fresh?.questionOpen) safe(() => engine.lockQuestion()); });
    timer.start(state.questionEndsAt);
  }

  function renderButtons(current) {
    const finished = state.status === 'finished';
    const isBuzzer = current.question?.type === 'buzzer';
    els['btn-start-game'].disabled = state.status !== 'lobby' || !state.players.length;
    const alreadyScored = Boolean(current.question && state.scoredQuestionIds?.includes(current.question.id));
    const started = Boolean(current.question && state.questionStartedAt);
    const pendingReveal = started && !state.questionOpen && !alreadyScored;
    const buzzerResult = isBuzzer ? (state.questionResults?.[current.question.id] || {}) : null;
    els['btn-start-question'].disabled = finished || started || !current.question || alreadyScored;
    els['btn-close-question'].disabled = finished || !state.questionOpen || isBuzzer;
    els['btn-resolve-question'].disabled = finished || !pendingReveal || isBuzzer;
    els['btn-resolve-question'].classList.toggle('is-ready', pendingReveal && !isBuzzer);
    els['btn-prev'].disabled = state.questionOpen || pendingReveal || questionGlobalIndex(state) <= 0;
    els['btn-next'].disabled = state.questionOpen || pendingReveal || finished;
    if (isBuzzer && started && !alreadyScored && buzzerResult?.status === 'open') els['btn-next'].disabled = true;
    els['btn-finish'].disabled = finished;
  }

  async function safe(fn) {
    try { await fn(); }
    catch (error) {
      const message = transport === 'online' ? Firebase.friendlyError(error) : error.message;
      App.toast(message, 'error');
      if (transport === 'online' && /Firebase/i.test(message)) setFirebaseStatus(message, 'error');
    }
  }
})();
