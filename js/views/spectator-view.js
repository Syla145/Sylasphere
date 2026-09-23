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
    ['spectator-connect','spectator-code-input','spectator-connect-btn','spectator-error','spectator-live','spectator-code','spectator-status','spectator-mode','spectator-progress','spectator-timer','spectator-question','spectator-stats','spectator-leaderboard'].forEach(id => els[id] = document.getElementById(id));
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
      history.replaceState(null, '', `?code=${code}&mode=${transport}`);
      engine.subscribe(render);
    } catch (error) {
      els['spectator-error'].textContent = /Firebase|auth|permission|network/i.test(String(error?.message || '')) ? Firebase.friendlyError(error) : (error.message || 'Verbindung fehlgeschlagen.');
    } finally {
      connecting = false; els['spectator-connect-btn'].disabled = false; els['spectator-connect-btn'].textContent = 'Verbinden';
    }
  }

  function render(next) {
    state = next;
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
    App.setText(els['spectator-progress'], current.round ? `${current.round.title} · Frage ${Math.min(idx + 1, total)}/${total}` : '');
    renderQuestion(current); renderLeaderboard(); renderTimer();
  }

  function renderQuestion(current) {
    if (state.status === 'lobby') {
      els['spectator-question'].innerHTML = `<div class="waiting-card presenter lobby-wait"><div class="pulse-dot"></div><span class="eyebrow">Sylasphere</span><h1>${App.escapeHTML(state.quiz.quiz.title)}</h1><p>Lobby geöffnet · ${state.players.length} Spieler${transport === 'online' ? ' · Online' : ''}</p></div>`;
      els['spectator-stats'].innerHTML = ''; return;
    }
    if (state.status === 'finished') {
      const ranked = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
      els['spectator-question'].innerHTML = finalPodium(ranked); els['spectator-stats'].innerHTML = ''; return;
    }
    if (!current.question) return;
    if (!state.questionStartedAt) {
      els['spectator-question'].innerHTML = `<div class="round-intro presenter"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.TYPE_ICONS[current.question.type] || '•'}</div><h1>${App.escapeHTML(current.question.category || 'Ohne Kategorie')}</h1><p>${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte</p></div>`;
      els['spectator-stats'].innerHTML = ''; return;
    }
    const result = state.questionResults?.[current.question.id] || null;
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const timedOut = Boolean(state.questionOpen && state.questionEndsAt && Date.now() >= Number(state.questionEndsAt));
    const pendingReveal = (!state.questionOpen || timedOut) && state.questionStartedAt && !resolved;
    Renderers.renderPlayer(current.question, els['spectator-question'], { readOnly: true, reveal: resolved, currentAnswer: null, result });
    const answers = state.answers[current.question.id] || {};
    const submitted = Object.keys(answers).length; const total = state.players.length;
    let html = `<div class="presenter-response"><strong>${submitted}/${total}</strong><span>Antworten</span></div>`;
    if (pendingReveal) html += '<div class="notice notice--warning reveal-wait"><strong>Antworten geschlossen</strong><span>Die Auflösung folgt durch den Moderator.</span></div>';
    if (resolved) {
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      const label = Quiz.solutionLabel(current.question);
      html += `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(solution)}</strong></div>`;
      html += stats(current.question, answers, result);
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
    const top = ranked.slice(0, 3); const order = [top[1], top[0], top[2]].filter(Boolean);
    const podium = order.map(player => {
      const rank = ranked.findIndex(p => p.id === player.id) + 1;
      return `<div class="podium-place podium-place--${rank}"><div class="podium-avatar">${App.escapeHTML(App.avatar(player.avatar))}</div><strong>${App.escapeHTML(player.name)}</strong><span>${App.formatPoints(player.score)}</span><b>${rank}</b></div>`;
    }).join('');
    return `<div class="final-screen presenter"><span class="eyebrow">Finale</span><h1>${ranked[0] ? `🏆 ${App.escapeHTML(ranked[0].name)} gewinnt!` : 'Quiz beendet'}</h1><div class="podium">${podium}</div></div>`;
  }

  function renderLeaderboard() {
    const ranked = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt).slice(0, 10);
    const current = engine.getCurrent(state);
    const resolved = Boolean(current?.question && state.scoredQuestionIds?.includes(current.question.id));
    const gains = resolved ? (state.answers[current.question.id] || {}) : {};
    els['spectator-leaderboard'].innerHTML = ranked.map((p, i) => {
      const gain = Number(gains[p.id]?.awardedPoints) || 0;
      return `<div class="leader-row presenter-row"><span>${i + 1}</span><span class="avatar">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong><span class="leader-score">${gain > 0 ? `<em>+${Math.round(gain)}</em>` : ''}<b>${Math.round(p.score)} P</b></span></div>`;
    }).join('');
  }

  function renderTimer() {
    timer?.stop();
    if (!state.questionOpen || !state.questionEndsAt) { App.setText(els['spectator-timer'], '–'); return; }
    timer = new Timer(seconds => App.setText(els['spectator-timer'], String(seconds ?? '–')), () => {});
    timer.start(state.questionEndsAt);
  }
})();
