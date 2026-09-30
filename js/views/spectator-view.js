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
    App.setText(els['beamer-count'], playing && state.questionStartedAt && !Quiz.gameOf(current.question) ? `${answered} von ${state.players.length} ${current.question.type === 'buzzer' ? 'haben gebuzzert' : Quiz.stagesOf(current.question) ? 'eingeloggt' : 'haben geantwortet'}` : '');
    const showState = beamerShow(current); // v34
    if (showState.board) {
      els['spectator-live'].dataset.phase = showState.running ? els['spectator-live'].dataset.phase : 'board';
      const by = state.show.current?.by || state.show.active;
      const boardResult = state.scoredQuestionIds?.includes(current.question?.id) ? state.questionResults?.[current.question.id]?.board : null;
      if (showState.running && boardResult && !boardResult.shared) App.setText(els['beamer-count'], `${state.players.find(p => p.id === boardResult.by)?.name || ''}: ${boardResult.correct ? `✓ richtig · +${Math.round(boardResult.points)} P` : '✗ leider falsch · 0 P'}`);
      else if (showState.running) App.setText(els['beamer-count'], state.show.current?.shared ? `👥 Alle spielen · ${answered} von ${state.players.length} haben geantwortet` : `${state.players.find(p => p.id === by)?.name || ''} antwortet · Feld ${state.show.current?.value}${state.show.current?.double ? ` · 💎 Einsatz ${state.show.current.stake}` : ''}`);
      else App.setText(els['beamer-count'], '');
      App.setText(els['spectator-progress'], window.SylasphereShowUI.progressText(current.round, state.show));
    }
    if (showState.finalHidden) els['beamer-side'].hidden = true; // Finale: Rangliste erst nach der Auflösung
    renderQuestion(current); renderLeaderboard(); renderTimer(); renderPause(); renderModeCard(current);
    scheduleFit();
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
    if (renderShowBeamer(current)) return; // v34: Brett / Einsatz-Finale
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
    const answers = state.answers[current.question.id] || {};
    // v32: Präsentations-Ansicht (ohne Eingabefelder); Song-Enthüllung zeichnet bei neuen Antworten neu (Avatare an den Stufen)
    const live = Renderers.presentLive(current.question) ? Object.entries(answers).map(([id, r]) => `${id}:${r?.answer?.stage ?? r?.stage ?? ''}`).sort().join(',') : '';
    const key = JSON.stringify([current.question.id, resolved, result ?? null, live, state.players.length]);
    if (shown.dataset.renderKey === key && shown.querySelector('.question-shell')) Quiz.typeDef(current.question.type)?.update?.(current.question, shown, { readOnly: true, reveal: resolved, result, stage: state.stage });
    else { Renderers.renderPresent(current.question, shown, { reveal: resolved, result, stage: state.stage, players: state.players, answers, role: 'spectator' }); shown.dataset.renderKey = key; }
    let html = ''; // v31: „x von y haben geantwortet“ steht groß in der Kopfzeile
    if (pendingReveal) html += '<div class="notice notice--warning reveal-wait"><strong>Antworten geschlossen</strong><span>Die Auflösung folgt durch den Moderator.</span></div>';
    if (resolved) {
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      const label = Quiz.solutionLabel(current.question);
      const extra = state.questionResults?.[current.question.id];
      if (extra?.board) html += window.SylasphereShowUI.alsoRightHTML(extra.board, state.players);
      if (state.show?.kind === 'final' && state.show.qid === current.question.id && state.show.phase === 'reveal') { els['spectator-stats'].innerHTML = window.SylasphereShowUI.finalRevealHTML(state.show.rows, Number(state.show.index) || 0, state.players, { big: true }); return; }
      if (!Renderers.presentShowsSolution(current.question)) html += `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(solution)}</strong></div>`;
      html += stats(current.question, answers, result);
      if (!Quiz.typeDef(current.question.type)?.mark) html += Renderers.answerEntriesHTML(result?.entries); // v32: Schätzung/Hotspot zeigen die Tipps schon als Avatare
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

  // ================================================================ v34: Show-Formate
  function beamerShow(current) {
    const round = state.quiz?.quiz?.rounds?.[state.currentRoundIndex];
    const out = { board: false, running: false, finalHidden: false };
    if (state.status !== 'playing') return out;
    if (Quiz.isBoardRound(round) && state.show?.kind === 'board' && state.show.roundId === round.id) {
      out.board = true;
      out.running = Boolean(current.question && state.show.current?.qid === current.question.id && state.questionStartedAt);
    }
    if (state.show?.kind === 'final' && state.show.qid === current.question?.id) {
      const rows = Array.isArray(state.show.rows) ? state.show.rows : Object.values(state.show.rows || {});
      out.finalHidden = state.show.phase !== 'reveal' || (Number(state.show.index) || 0) < rows.length - 1;
    }
    return out;
  }
  function renderShowBeamer(current) {
    const shown = els['spectator-question'];
    const UI = window.SylasphereShowUI, S = window.SylasphereShow;
    const round = state.quiz.quiz.rounds[state.currentRoundIndex];
    const info = beamerShow(current);
    if (info.board && !info.running) {
      const show = state.show;
      const key = JSON.stringify(['board', show.seq, show.phase, state.players.map(p => [p.id, p.name, p.avatar])]);
      if (shown.dataset.renderKey !== key) {
        shown.dataset.renderKey = key;
        const zoom = show.phase === 'play' || show.phase === 'wager';
        shown.innerHTML = `<div class="show-beamer${zoom ? ' has-zoom' : ''}">${UI.turnHTML(show, state.players)}${UI.boardHTML(round, show, { players: state.players })}${zoom ? `<div class="show-zoom-layer">${UI.zoomHTML(round, show, state.players)}</div>` : ''}</div>`;
      }
      els['spectator-stats'].innerHTML = '';
      return true;
    }
    if (state.show?.kind === 'final' && state.show.qid === current.question.id && !state.questionStartedAt) {
      const wid = S.wagerId(current.question.id);
      const set = state.answers[wid] || {};
      const key = JSON.stringify(['final', state.show.phase, Object.keys(set).sort(), state.players.map(p => p.id)]);
      if (shown.dataset.renderKey !== key) {
        shown.dataset.renderKey = key;
        shown.innerHTML = `<div class="round-intro presenter show-final-intro"><span class="eyebrow">💰 Einsatz-Finale</span><h1>${App.escapeHTML(current.question.category || 'Finale')}</h1><p>${state.show.phase === 'wager' ? 'Setzt eure Einsätze – geheim auf dem Handy!' : 'Die Einsätze stehen. Gleich kommt die Frage …'}</p><div class="show-wager-avatars">${state.players.map(p => `<span class="${set[p.id] || state.show.stakes?.[p.id] != null ? 'is-set' : ''}"><i>${App.escapeHTML(App.avatar(p.avatar))}</i><small>${App.escapeHTML(p.name)}</small><b>${set[p.id] || state.show.stakes?.[p.id] != null ? '✓' : '⏳'}</b></span>`).join('')}</div></div>`;
      }
      els['spectator-stats'].innerHTML = '';
      return true;
    }
    return false;
  }

  // v33: Pause – „Kurze Pause“ mit Rangliste über allem
  function renderPause() {
    let box = document.getElementById('beamer-pause');
    if (!state.paused || state.status !== 'playing') { box?.remove(); return; }
    const ranked = App.rankPlayers(state.players).slice(0, 10);
    const html = `<div class="beamer-pause-card"><span class="eyebrow">Gleich geht's weiter</span><h1>☕ Kurze Pause</h1><div class="beamer-pause-list">${ranked.map(p => `<div class="beamer-pause-row"><b>${p.place}</b><span class="avatar">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong><em>${App.formatPoints(p.score)}</em></div>`).join('') || '<p>Noch keine Spieler.</p>'}</div></div>`;
    if (!box) { box = document.createElement('div'); box.id = 'beamer-pause'; box.className = 'beamer-pause'; box.setAttribute('role', 'status'); els['spectator-live'].append(box); }
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }

  // v35: „Neu: <Spielmodus> – so geht's“ – kommt ein Spielmodus zum ersten Mal dran, erscheint vor dem Start kurz eine Karte.
  // Sie liegt über dem Bild (kein Scrollen), blockiert nichts und verschwindet mit dem Start der Frage oder per Leertaste/Klick.
  const dismissedModes = new Set();
  function renderModeCard(current) {
    const Modes = window.SylasphereModes;
    let box = document.getElementById('beamer-mode-card');
    const id = Modes && state.status === 'playing' && !state.questionStartedAt && !state.paused ? Modes.newTarget(state, current) : '';
    if (!id || dismissedModes.has(id)) { box?.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'beamer-mode-card'; box.className = 'beamer-mode-card'; box.setAttribute('role', 'status');
      box.addEventListener('click', hideModeCard);
      els['spectator-live'].append(box);
    }
    if (box.dataset.mode !== id) { box.dataset.mode = id; box.innerHTML = `${Modes.cardHTML(id, { variant: 'beamer' })}<small class="mode-card-hint">Leertaste oder Klick: ausblenden</small>`; }
  }
  function hideModeCard() {
    const box = document.getElementById('beamer-mode-card');
    if (!box) return false;
    dismissedModes.add(box.dataset.mode); box.remove(); return true;
  }
  document.addEventListener('keydown', event => {
    if (![' ', 'Enter', 'Escape'].includes(event.key) || event.target.closest?.('input, textarea, select, button')) return;
    if (hideModeCard()) event.preventDefault();
  });

  // v32: Der Beamer scrollt nie – passt der Inhalt nicht auf den Bildschirm, wird er stufenlos verkleinert
  let fitFrame = 0;
  let fitLate = 0;
  function scheduleFit() {
    cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fitBeamer);
    clearTimeout(fitLate); fitLate = setTimeout(fitBeamer, 800); // v34: nach Animationen (Zoom, Tipps) noch einmal messen
  }
  function fitBeamer() {
    const live = els['spectator-live'];
    if (!live || live.hidden) return;
    const root = document.documentElement;
    let fit = 1;
    live.style.setProperty('--fit', '1');
    if (innerWidth <= 900) { live.classList.remove('is-fitted'); return; } // Handy/Tablet: normal scrollen
    for (let i = 0; i < 12 && root.scrollHeight > innerHeight + 1 && fit > 0.5; i++) {
      fit = Math.max(0.5, fit * Math.min(0.97, innerHeight / root.scrollHeight));
      live.style.setProperty('--fit', fit.toFixed(3));
    }
    live.classList.toggle('is-fitted', fit < 1);
  }
  window.addEventListener('resize', scheduleFit);
  document.fonts?.ready?.then(scheduleFit); // v36: nach dem Laden der Schriften neu messen
  document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') scheduleFit(); }, true);

  // v31: Lobby „Wer ist da?“ – QR-Code links, Avatare rechts; neue Spieler ploppen einzeln auf
  const lobbySeen = new Set();
  // v35: Lobby – welche Spielmodi heute dran sind, mit Link zur Spielmodi-Seite
  function modesStrip() {
    const Modes = window.SylasphereModes;
    const ids = Modes ? Modes.inQuiz(state.quiz) : [];
    if (!ids.length) return '';
    const chips = ids.map(id => Modes.get(id)).filter(Boolean).map(m => `<span class="beamer-mode-chip">${App.escapeHTML(m.icon)} ${App.escapeHTML(m.label)}</span>`).join('');
    return `<div class="beamer-modes"><span class="eyebrow">Heute im Quiz</span><div class="beamer-mode-chips">${chips}</div><a class="link-btn" href="./spielmodi.html?nur=${encodeURIComponent(ids.join(','))}" target="_blank" rel="noopener">🎲 Spielmodi ansehen</a></div>`;
  }
  function renderLobby(shown) {
    const key = `lobby|${state.code}|${transport}`;
    if (shown.dataset.renderKey !== key) {
      shown.dataset.renderKey = key; lobbySeen.clear();
      shown.innerHTML = `<div class="beamer-lobby"><div class="beamer-lobby-join"><span class="eyebrow">Gleich geht's los</span><h1 class="beamer-title">${App.escapeHTML(state.quiz.quiz.title)}</h1>${window.SylasphereJoin ? window.SylasphereJoin.joinCard(state.code, transport, { size: 'large' }) : ''}${modesStrip()}</div><div class="beamer-lobby-players"><h2>Wer ist da? <span class="beamer-lobby-count">0</span></h2><div class="beamer-avatars"></div><p class="beamer-lobby-empty">Noch niemand – QR-Code scannen!</p></div></div>`;
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
