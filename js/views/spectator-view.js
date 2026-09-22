(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Session = window.SchmobinSession;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  let engine = null, state = null, timer = null;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    ['spectator-connect','spectator-code-input','spectator-connect-btn','spectator-error','spectator-live','spectator-code','spectator-status','spectator-progress','spectator-timer','spectator-question','spectator-stats','spectator-leaderboard'].forEach(id => els[id] = document.getElementById(id));
    els['spectator-connect-btn'].addEventListener('click', () => connect(els['spectator-code-input'].value));
    els['spectator-code-input'].addEventListener('keydown', e => { if (e.key === 'Enter') connect(e.currentTarget.value); });
    els['spectator-code-input'].addEventListener('input', e => e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    const code = (App.getParam('code') || Session.lastCode() || '').toUpperCase();
    if (code && Session.exists(code)) connect(code); else if (code) els['spectator-code-input'].value = code;
  }
  function connect(code) {
    code = String(code || '').trim().toUpperCase();
    if (!Session.exists(code)) { els['spectator-error'].textContent = 'Sitzung nicht gefunden.'; return; }
    engine?.destroy(); engine = new Session(code);
    els['spectator-connect'].hidden = true; els['spectator-live'].hidden = false;
    history.replaceState(null, '', `?code=${code}`); engine.subscribe(render);
  }
  function render(next) {
    state = next;
    const current = engine.getCurrent(state);
    App.setText(els['spectator-code'], state.code);
    let statusLabel = 'Bereit';
    if (state.status === 'lobby') statusLabel = 'Lobby';
    else if (state.status === 'finished') statusLabel = 'Beendet';
    else if (state.questionOpen) statusLabel = 'Live';
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
      els['spectator-question'].innerHTML = `<div class="waiting-card presenter lobby-wait"><div class="pulse-dot"></div><span class="eyebrow">JH-Quiz</span><h1>${App.escapeHTML(state.quiz.quiz.title)}</h1><p>Lobby geöffnet · ${state.players.length} Spieler</p></div>`;
      els['spectator-stats'].innerHTML = ''; return;
    }
    if (state.status === 'finished') {
      const ranked = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
      els['spectator-question'].innerHTML = finalPodium(ranked);
      els['spectator-stats'].innerHTML = ''; return;
    }
    if (!current.question) return;
    if (!state.questionStartedAt) {
      els['spectator-question'].innerHTML = `<div class="round-intro presenter"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.TYPE_ICONS[current.question.type] || '•'}</div><h1>${App.escapeHTML(current.question.category || 'Ohne Kategorie')}</h1><p>${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte</p></div>`;
      els['spectator-stats'].innerHTML = ''; return;
    }
    const result = state.questionResults?.[current.question.id] || null;
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const pendingReveal = !state.questionOpen && state.questionStartedAt && !resolved;
    Renderers.renderPlayer(current.question, els['spectator-question'], { readOnly: true, reveal: resolved, currentAnswer: null, result });
    const answers = state.answers[current.question.id] || {};
    const submitted = Object.keys(answers).length;
    const total = state.players.length;
    let html = `<div class="presenter-response"><strong>${submitted}/${total}</strong><span>Antworten</span></div>`;
    if (pendingReveal) html += '<div class="notice notice--warning reveal-wait"><strong>Antworten geschlossen</strong><span>Die Auflösung folgt durch den Moderator.</span></div>';
    if (resolved) {
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      const label = current.question.type === 'consensus' ? 'Mehrheit' : current.question.type === 'survey' ? 'Top-Antwort' : current.question.type === 'hotspot' ? 'Zielbereich' : 'Lösung';
      html += `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(solution)}</strong></div>`;
      html += stats(current.question, answers, result);
    }
    els['spectator-stats'].innerHTML = html;
  }
  function stats(q, answers, result) {
    const values = Object.values(answers).map(a => a.answer);
    if (!values.length) return '';
    if (['multiple-choice', 'image-quiz', 'audio-quiz', 'survey', 'consensus'].includes(q.type)) {
      const counts = result?.counts || Object.fromEntries((q.options || []).map(o => [o.id, 0]));
      if (!result?.counts) values.forEach(v => { const key = String(v); if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1; });
      const max = Math.max(1, ...Object.values(counts));
      return `<div class="stat-bars">${(q.options || []).map(o => `<div><span>${App.escapeHTML(o.text)}</span><div class="bar"><i style="width:${Math.round((counts[o.id] || 0) / max * 100)}%"></i></div><b>${counts[o.id] || 0}</b></div>`).join('')}</div>`;
    }
    if (q.type === 'estimate') {
      const nums = values.map(Number).filter(Number.isFinite); if (!nums.length) return '';
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return `<div class="stat-cards"><div><span>Ø Schätzung</span><strong>${Number(avg.toFixed(1))}${q.unit ? ` ${App.escapeHTML(q.unit)}` : ''}</strong></div><div><span>Spanne</span><strong>${Math.min(...nums)}–${Math.max(...nums)}</strong></div></div>`;
    }
    if (q.type === 'fight-list') {
      const map = new Map();
      values.flatMap(v => Array.isArray(v) ? v : []).forEach(x => { const k = Quiz.normalizeTerm(x); if (k) map.set(k, (map.get(k) || 0) + 1); });
      const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return `<div class="chip-row large">${top.map(([t, n]) => `<span class="chip">${App.escapeHTML(t)} <b>${n}×</b></span>`).join('')}</div>`;
    }
    if (q.type === 'hotspot') {
      const records = Object.values(answers); const hits = records.filter(record => Number(record.awardedPoints) > 0).length;
      return `<div class="stat-cards"><div><span>Treffer</span><strong>${hits}/${records.length}</strong></div><div><span>Trefferquote</span><strong>${records.length ? Math.round(hits / records.length * 100) : 0}%</strong></div></div>`;
    }
    return '';
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
