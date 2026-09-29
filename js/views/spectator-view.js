(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Session = window.SchmobinSession;
  const Online = window.JHQuizOnlineSession;
  const Firebase = window.JHQuizFirebase;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  let engine = null, state = null, timer = null, transport = 'local', connecting = false;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['spectator-connect','spectator-code-input','spectator-connect-btn','spectator-error','spectator-live','spectator-code','spectator-status','spectator-mode','spectator-progress','spectator-timer','spectator-question','spectator-stats','spectator-leaderboard','spectator-live','beamer-top','beamer-count','beamer-timer','beamer-grid','beamer-side'].forEach(id => els[id] = document.getElementById(id));
    els['spectator-connect-btn'].addEventListener('click', () => connect(els['spectator-code-input'].value));
    els['spectator-code-input'].addEventListener('keydown', e => { if (e.key === 'Enter') connect(e.currentTarget.value); });
    els['spectator-code-input'].addEventListener('input', e => e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    const code = (App.getParam('code') || Session.lastCode() || Online?.lastCode?.() || '').toUpperCase();
    if (code) { els['spectator-code-input'].value = code; if (App.getParam('code')) connect(code); }
  }

  async function resolveTransport(code) {
    const hint = String(App.getParam('mode') || '').toLowerCase();
    if (hint === 'local') {
      if (!Session.exists(code)) throw new Error('Lokale Sitzung nicht gefunden.');
      return 'local';
    }
    if (hint === 'online') return 'online';
    try { if (await Online.exists(code, 'spectator')) return 'online'; } catch (_) {}
    if (Session.exists(code)) return 'local';
    throw new Error('Sitzung nicht gefunden.');
  }

  async function connect(code) {
    if (connecting) return;
    code = String(code || '').trim().toUpperCase();
    els['spectator-error'].textContent = '';
    if (code.length !== 6) { els['spectator-error'].textContent = 'Bitte einen gültigen 6-stelligen Raumcode eingeben.'; return; }
    connecting = true; els['spectator-connect-btn'].disabled = true; els['spectator-connect-btn'].textContent = 'Verbinden …';
    try {
      const selected = await resolveTransport(code);
      try { await engine?.destroy?.(); } catch (_) {}
      if (selected === 'online') {
        engine = await Online.connect(code, 'spectator');
        await engine.waitForState(); transport = 'online';
      } else { engine = new Session(code); transport = 'local'; }
      els['spectator-connect'].hidden = true; els['spectator-live'].hidden = false;
      window.SylasphereJoin?.keepAwake(true); // Beamer-Laptop bleibt an
      history.replaceState(null, '', `?code=${code}&mode=${transport}`);
      engine.subscribe(render);
      engine.onReaction?.(reaction => window.SylasphereReactions?.show(reaction, id => (state?.players || []).find(p => p.id === id)?.name || '')); // v27
    } catch (error) {
      els['spectator-error'].textContent = /Firebase|auth|permission|network/i.test(String(error?.message || '')) ? Firebase.friendlyError(error) : (error.message || 'Verbindung fehlgeschlagen.');
    } finally {
      connecting = false; els['spectator-connect-btn'].disabled = false; els['spectator-connect-btn'].textContent = 'Verbinden';
    }
  }

  function render(next) {
    state = next;
    window.SylasphereTopics?.use(state.quiz?.quiz?.categories); // eigene Themen des Quiz
    window.SylasphereThemes?.applyQuiz(state.quiz, state.currentRoundIndex); // Design des Quiz (v29: optional pro Runde)
    window.SylasphereThemes?.observe(state); // v29: Übergang zwischen Fragen
    const current = engine.getCurrent(state);
    App.setText(els['spectator-code'], state.code);
    if (els['spectator-mode']) { els['spectator-mode'].textContent = transport === 'online' ? (state.onlineConnected === false ? '↻ Reconnect' : '🌐 Online') : '💻 Lokal'; els['spectator-mode'].classList.toggle('is-online', transport === 'online' && state.onlineConnected !== false); els['spectator-mode'].classList.toggle('is-offline', transport === 'online' && state.onlineConnected === false); }
    let statusLabel = 'Bereit';
    const timedOut = Boolean(state.questionOpen && state.questionEndsAt && Date.now() >= Number(state.questionEndsAt));
    if (state.status === 'lobby') statusLabel = 'Lobby';
    else if (state.status === 'finished') statusLabel = 'Beendet';
    else if (state.questionOpen && !timedOut) statusLabel = 'Live';
    else if (current.question && state.questionStartedAt && state.scoredQuestionIds?.includes(current.question.id)) statusLabel = 'Auflösung';
    else if (current.question && state.questionStartedAt) statusLabel = 'Antworten geschlossen';
    App.setText(els['spectator-status'], statusLabel);
    const total = Quiz.allQuestions(state.quiz).length;
    let idx = 0; for (let i = 0; i < state.currentRoundIndex; i++) idx += state.quiz.quiz.rounds[i].questions.length; idx += state.currentQuestionIndex;
    // v31: Kopfzeile nur während des Spiels; Lobby und Spielende ohne „Frage x/y“, Timer und Tabelle
    const playing = state.status === 'playing' && Boolean(current.question);
    els['spectator-live'].dataset.phase = state.status === 'playing' ? (!state.questionStartedAt ? 'intro' : current.question && state.scoredQuestionIds?.includes(current.question.id) ? 'resolved' : 'question') : state.status;
    els['beamer-top'].hidden = !playing;
    els['beamer-side'].hidden = !playing;
    App.setText(els['spectator-progress'], playing && current.round ? `${current.round.title} · Frage ${Math.min(idx + 1, total)} / ${total}` : '');
    const answered = playing ? Object.keys(state.answers[current.question.id] || {}).length : 0;
    App.setText(els['beamer-count'], playing && state.questionStartedAt && !Quiz.gameOf(current.question) ? `${answered} von ${state.players.length} haben ${current.question.type === 'buzzer' ? 'gebuzzert' : 'geantwortet'}` : '');
    renderQuestion(current); renderLeaderboard(); renderTimer();
    window.SylasphereSfx?.observe(state, { current }); // v27
  }

  function renderQuestion(current) {
    const shownEl = els['spectator-question'];
    if (state.status === 'lobby') { renderLobby(shownEl); els['spectator-stats'].innerHTML = ''; return; }
    lobbySeen.clear();
    if (state.status === 'finished') {
      const key = `final:${JSON.stringify(state.players.map(p => [p.id, p.score]))}:${JSON.stringify(state.highlights || null)}`;
      if (shownEl.dataset.renderKey !== key) { shownEl.innerHTML = finalPodium(App.rankPlayers(state.players)); shownEl.dataset.renderKey = key; }
      els['spectator-stats'].innerHTML = ''; return;
    }
    if (!current.question) return;
    delete shownEl.dataset.lobbyReady;
    if (!state.questionStartedAt) {
      shownEl.dataset.renderKey = '';
      els['spectator-question'].innerHTML = `<div class="round-intro presenter"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.topic(current.question.category).icon}</div><h1>${App.escapeHTML(current.question.category || 'Ohne Thema')}</h1><p>${Quiz.TYPE_ICONS[current.question.type] || '•'} ${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte</p></div>`;
      els['spectator-stats'].innerHTML = ''; return;
    }
    const result = state.questionResults?.[current.question.id] || null;
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const timedOut = Boolean(state.questionOpen && state.questionEndsAt && Date.now() >= Number(state.questionEndsAt));
    const pendingReveal = (!state.questionOpen || timedOut) && state.questionStartedAt && !resolved;
    window.SylasphereMedia?.sync(state.media, current.question); // Song-Ausschnitte auch beim Zuschauer (z. B. Discord-Stream)
    const shown = els['spectator-question'];
    if (Quiz.gameOf(current.question)) {
      // Zeitduell: großes Bild, alle Uhren, Lösung nach jedem Bild
      if (shown.dataset.renderKey !== `duel:${current.question.id}`) shown.replaceChildren();
      shown.dataset.renderKey = `duel:${current.question.id}`;
      Renderers.renderPlayer(current.question, shown, { readOnly: true, reveal: resolved, result, game: state.game || null, players: state.players, role: 'spectator' });
      els['spectator-stats'].innerHTML = resolved ? `<div class="reveal-box"><span>Ergebnis</span><strong>${App.escapeHTML(Quiz.correctAnswerText(current.question, result) || '–')}</strong></div>` : '';
      return;
    }
    const key = JSON.stringify([current.question.id, resolved, result ?? null]);
    if (shown.dataset.renderKey === key && shown.querySelector('.question-shell')) Quiz.typeDef(current.question.type)?.update?.(current.question, shown, { readOnly: true, reveal: resolved, result, stage: state.stage });
    else { Renderers.renderPlayer(current.question, shown, { readOnly: true, reveal: resolved, currentAnswer: null, result, stage: state.stage }); shown.dataset.renderKey = key; }
    const answers = state.answers[current.question.id] || {};
    let html = ''; // v31: „x von y haben geantwortet“ steht groß in der Kopfzeile
    if (pendingReveal) html += '<div class="notice notice--warning reveal-wait"><strong>Antworten geschlossen</strong><span>Die Auflösung folgt durch den Moderator.</span></div>';
    if (resolved) {
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      const label = Quiz.solutionLabel(current.question);
      html += `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(solution)}</strong></div>`;
      html += stats(current.question, answers, result);
      html += Renderers.answerEntriesHTML(result?.entries);
    }
    els['spectator-stats'].innerHTML = html;
  }

  // Statistik kommt aus dem Fragetyp-Modul (online bereits vom Moderator berechnet)
  function stats(q, answers, result) {
    if (state.online) return Quiz.statsHTML(q, state.publicStats);
    if (!Object.keys(answers || {}).length) return '';
    return Quiz.statsHTML(q, Quiz.aggregateStats(q, answers, result));
  }

  function finalPodium(ranked) {
    // v29: Siegerehrung im Stil des Themes (js/core/themes.js)
    return window.SylasphereThemes.ceremony(ranked, { role: 'spectator', className: 'presenter', eyebrow: 'Finale', title: App.winnerTitle(ranked) || 'Quiz beendet', after: window.SylasphereHighlights?.html(state.highlights) || '' });
  }

  // v31: Lobby „Wer ist da?“ – QR-Code links, Avatare rechts; neue Spieler ploppen einzeln auf
  const lobbySeen = new Set();
  function renderLobby(shown) {
    const key = `lobby|${state.code}|${transport}`;
    if (shown.dataset.renderKey !== key) {
      shown.dataset.renderKey = key; lobbySeen.clear();
      shown.innerHTML = `<div class="beamer-lobby"><div class="beamer-lobby-join"><span class="eyebrow">Gleich geht's los</span><h1 class="beamer-title">${App.escapeHTML(state.quiz.quiz.title)}</h1>${window.SylasphereJoin ? window.SylasphereJoin.joinCard(state.code, transport, { size: 'large' }) : ''}</div><div class="beamer-lobby-players"><h2>Wer ist da? <span class="beamer-lobby-count">0</span></h2><div class="beamer-avatars"></div><p class="beamer-lobby-empty">Noch niemand – QR-Code scannen!</p></div></div>`;
    }
    const box = shown.querySelector('.beamer-avatars');
    if (!box) return;
    const players = state.players.slice().sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    const ids = new Set(players.map(p => p.id));
    box.querySelectorAll('[data-pid]').forEach(el => { if (!ids.has(el.dataset.pid)) { el.remove(); lobbySeen.delete(el.dataset.pid); } });
    players.forEach(p => {
      let tile = box.querySelector(`[data-pid="${CSS.escape(p.id)}"]`);
      const html = `<span class="beamer-avatar-icon">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong>`;
      if (!tile) {
        tile = document.createElement('div'); tile.className = 'beamer-avatar'; tile.dataset.pid = p.id;
        if (lobbySeen.size || shown.dataset.lobbyReady) tile.classList.add('is-new'); // beim ersten Aufbau nicht alle auf einmal animieren
        box.appendChild(tile); lobbySeen.add(p.id);
      }
      if (tile.innerHTML !== html) tile.innerHTML = html;
      tile.classList.toggle('is-away', transport === 'online' && p.active === false);
    });
    shown.dataset.lobbyReady = '1';
    App.setText(shown.querySelector('.beamer-lobby-count'), String(players.length));
    shown.querySelector('.beamer-lobby-empty').hidden = players.length > 0;
  }


  function renderLeaderboard() {
    if (state.status !== 'playing') return; // Lobby/Spielende: keine Tabelle (Podest bzw. „Wer ist da?“)
    const ranked = App.rankPlayers(state.players).slice(0, 10);
    const current = engine.getCurrent(state);
    const resolved = Boolean(current?.question && state.scoredQuestionIds?.includes(current.question.id));
    const gains = resolved ? (state.answers[current.question.id] || {}) : {};
    App.renderRanking(els['spectator-leaderboard'], ranked.map((p, i) => {
      const gain = Number(gains[p.id]?.awardedPoints) || 0;
      return `<div class="leader-row presenter-row" data-pid="${App.escapeHTML(p.id)}" data-rank="${i + 1}"><span>${p.place}</span><span class="avatar">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}${window.SylasphereProgress?.badge(p) || ''}</strong><span class="leader-score">${gain > 0 ? `<em>+${Math.round(gain)}</em>` : ''}<b>${Math.round(p.score)} P</b></span></div>`;
    }).join(''));
  }

  // v31: großer runder Timer (SVG, gleichmäßige Linie); nur sichtbar, wenn die Frage einen Timer hat
  let ringFrame = 0;
  function setRing(progress, text, cls = '') {
    const ring = els['beamer-timer'];
    ring.style.setProperty('--p', String(App.clamp(Number(progress) || 0, 0, 1)));
    ring.classList.remove('is-critical', 'is-ended');
    if (cls) ring.classList.add(cls);
    if (text != null) App.setText(els['spectator-timer'], text);
  }
  function renderTimer() {
    timer?.stop(); cancelAnimationFrame(ringFrame);
    const ring = els['beamer-timer'];
    const ends = Number(state.questionEndsAt) || 0, started = Number(state.questionStartedAt) || 0;
    const running = state.status === 'playing' && state.questionOpen && ends && started;
    ring.hidden = !running;
    if (!running) return;
    const span = Math.max(1000, ends - started);
    const tick = () => {
      const left = ends - Date.now();
      setRing(left / span, null, left <= 0 ? 'is-ended' : left <= 5000 ? 'is-critical' : '');
      if (left > 0) ringFrame = requestAnimationFrame(tick);
    };
    tick();
    timer = new Timer(seconds => { App.setText(els['spectator-timer'], seconds <= 0 ? '0' : String(seconds ?? '–')); window.SylasphereSfx?.countdown(seconds); }, () => setRing(0, '0', 'is-ended'));
    timer.start(state.questionEndsAt);
  }
})();
