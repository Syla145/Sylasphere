(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Session = window.SchmobinSession;
  const Online = window.JHQuizOnlineSession;
  const Firebase = window.JHQuizFirebase;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  const PlayerIdentity = window.JHQuizPlayerIdentity;

  let engine = null, identity = null, state = null, playerId = '', currentQuestionId = '', draftAnswer = null, timer = null, joining = false, transport = 'local';
  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['join-panel','game-panel','room-code','player-name','join-btn','join-error','avatar-options','game-code','game-status','game-mode','game-question','submit-answer','answer-feedback','player-score','leaderboard','player-timer','player-progress','player-identity','player-progress-bar'].forEach(id => els[id] = document.getElementById(id));
    els['game-question'].addEventListener('quiz:interaction-end', () => { if (deferredState) render(deferredState); });
    const code = (App.getParam('code') || Session.lastCode() || Online?.lastCode?.() || '').toUpperCase(); if (code) els['room-code'].value = code;
    renderAvatars();
    els['join-btn'].addEventListener('click', join);
    els['room-code'].addEventListener('input', () => els['room-code'].value = els['room-code'].value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
    // v21: Angemeldete Spieler – Name aus dem Konto vorausfüllen (Verknüpfung mit Statistiken folgt später)
    window.SylasphereAccount?.init().then(state => {
      const user = state?.user;
      if (user && !user.isAnonymous && !els['player-name'].value.trim()) els['player-name'].value = String(user.name || '').slice(0, 28);
    }).catch(() => {});
    [els['room-code'], els['player-name']].forEach(input => input.addEventListener('keydown', e => { if (e.key === 'Enter') join(); }));
    els['submit-answer'].addEventListener('click', submit);
  }

  function renderAvatars() {
    const avatars = ['🦊','🐼','🦁','🐸','🐙','🦄','🤖','👾','🐧','🦖','🐐','🐻','🐯','🐵','🦉','🐢'];
    els['avatar-options'].innerHTML = avatars.map((a,i)=>`<button type="button" class="avatar-choice ${i===0?'is-selected':''}" data-avatar="${a}">${a}</button>`).join('');
    els['avatar-options'].addEventListener('click', e => {
      const b=e.target.closest('.avatar-choice'); if(!b)return; els['avatar-options'].querySelectorAll('.avatar-choice').forEach(x=>x.classList.toggle('is-selected',x===b));
    });
  }

  async function resolveTransport(code) {
    const hint = String(App.getParam('mode') || '').toLowerCase();
    if (hint === 'local') {
      if (!Session.exists(code)) throw new Error('Lokale Sitzung nicht gefunden.');
      return 'local';
    }
    if (hint === 'online') return 'online';
    try { if (await Online.exists(code, 'player')) return 'online'; } catch (_) {}
    if (Session.exists(code)) return 'local';
    throw new Error('Sitzung nicht gefunden. Prüfe den 6-stelligen Code.');
  }

  async function join() {
    if (joining) return;
    const code = els['room-code'].value.trim().toUpperCase(); const name = els['player-name'].value.trim();
    els['join-error'].textContent='';
    if (code.length !== 6) { els['join-error'].textContent='Bitte gib den 6-stelligen Raumcode ein.'; return; }
    if (!name) { els['join-error'].textContent='Bitte gib deinen Namen ein.'; return; }
    const joinButton = els['join-btn'];
    joining = true; joinButton.disabled = true; joinButton.textContent = 'Sitzung wird gesucht …';
    try {
      const selected = await resolveTransport(code);
      try { await engine?.destroy?.(); } catch (_) {}
      identity?.destroy(); engine = null; identity = null;
      const avatar=els['avatar-options'].querySelector('.is-selected')?.dataset.avatar || '🦊';

      if (selected === 'online') {
        joinButton.textContent = '🌐 Online beitreten …';
        identity = new PlayerIdentity(`ONLINE${code}`);
        const stored = identity.storedPlayerId();
        const reusable = await identity.reusablePlayerId();
        const context = await Firebase.ready('player');
        if (stored && !reusable && context.auth.currentUser?.uid === stored) await Firebase.rotateAnonymous('player');
        engine = await Online.connect(code, 'player');
        await engine.waitForState();
        playerId = await engine.joinPlayer(name, avatar);
        identity.activate(playerId);
        transport = 'online';
      } else {
        engine = new Session(code);
        identity = new PlayerIdentity(code);
        const previous = await identity.reusablePlayerId();
        playerId = engine.joinPlayer(name,avatar,previous);
        identity.activate(playerId);
        transport = 'local';
      }

      els['join-panel'].hidden=true; els['game-panel'].hidden=false;
      window.SylasphereJoin?.keepAwake(true); // Handy geht während des Quiz nicht in den Standby
      history.replaceState(null,'',`?code=${code}&mode=${transport}`);
      engine.subscribe(render);
      // v27: Emoji-Reaktionen (Leiste unter der Frage)
      window.SylasphereReactions?.attachBar(document.getElementById('reaction-bar'), emoji => Promise.resolve(engine.sendReaction?.(playerId, emoji)));
    } catch(error) {
      els['join-error'].textContent = /Firebase|auth|permission|network/i.test(String(error?.message || '')) ? Firebase.friendlyError(error) : (error.message || 'Beitritt fehlgeschlagen.');
      identity?.destroy(); identity = null;
      try { await engine?.destroy?.(); } catch (_) {}
      engine = null;
    } finally {
      joining = false; joinButton.disabled = false; joinButton.textContent = 'Sitzung beitreten';
    }
  }

  // Während eine Sortier-Karte gezogen wird, keine Neu-Renderings (z. B. durch Antworten
  // anderer Spieler) durchlassen – sonst würde die Karte mitten im Ziehen ersetzt.
  let deferredState = null;
  function render(next) {
    if (els['game-question']?.querySelector('.is-sorting')) { deferredState = next; return; }
    deferredState = null;
    state=next; window.SylasphereTopics?.use(state.quiz?.quiz?.categories); // eigene Themen des Quiz
    window.SylasphereThemes?.applyQuiz(state.quiz); // Design des Quiz
    const player=state.players.find(p=>p.id===playerId); if(!player){ return disconnect('Du bist nicht mehr Teil dieser Sitzung.'); }
    const current=engine.getCurrent(state); App.setText(els['game-code'],state.code); App.setText(els['player-score'],App.formatPoints(player.score));
    if (els['game-mode']) { els['game-mode'].textContent = transport === 'online' ? (state.onlineConnected === false ? '↻ Reconnect' : '🌐 Online') : '💻 Lokal'; els['game-mode'].classList.toggle('is-online', transport === 'online' && state.onlineConnected !== false); els['game-mode'].classList.toggle('is-offline', transport === 'online' && state.onlineConnected === false); }
    els['player-identity'].innerHTML=`<span class="avatar">${App.escapeHTML(App.avatar(player.avatar))}</span><span>${App.escapeHTML(player.name)}</span>`;
    renderLeaderboard(); renderStatus(current); renderTimer(current);
    window.SylasphereSfx?.observe(state, { current, playerId }); // v27: Soundeffekte + Vibration
  }

  function renderStatus(current) {
    const total = Quiz.allQuestions(state.quiz).length;
    let global = 0;
    for (let i = 0; i < state.currentRoundIndex; i++) global += state.quiz.quiz.rounds[i].questions.length;
    global += state.currentQuestionIndex;
    App.setText(els['player-progress'], current.round ? `${current.round.title} · ${Math.min(global + 1, total)}/${total}` : '');
    if (els['player-progress-bar']) els['player-progress-bar'].style.width = `${total ? Math.round(((Math.min(global + 1, total)) / total) * 100) : 0}%`;

    if (state.status === 'lobby') {
      App.setText(els['game-status'], 'Lobby');
      els['game-question'].innerHTML = `<div class="waiting-card lobby-wait"><div class="pulse-dot"></div><span class="eyebrow">${App.escapeHTML(state.quiz.quiz.title)}</span><h2>Du bist drin!</h2><p>${state.players.length} Spieler in der Lobby · ${transport === 'online' ? 'Online verbunden' : 'Der Moderator startet gleich'}.</p></div>`;
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }
    if (state.status === 'finished') {
      App.setText(els['game-status'], 'Beendet');
      const ranked = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
      const place = ranked.findIndex(p => p.id === playerId) + 1;
      els['game-question'].innerHTML = finalPodium(ranked, place);
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }
    if (!current.question) { els['game-question'].innerHTML = '<div class="empty-state">Warte auf die nächste Frage.</div>'; return; }
    if (!state.questionStartedAt) {
      App.setText(els['game-status'], 'Bereit');
      // v24: Zwischenstand immer live aus der aktuellen Rangliste (gespeicherte Runden-Stände konnten veraltet sein)
      const leader = state.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      const previous = leader && leader.score > 0 ? { standings: [{ name: leader.name, score: leader.score }] } : null;
      els['game-question'].innerHTML = `<div class="round-intro"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.topic(current.question.category).icon}</div><h2>${App.escapeHTML(current.question.category || 'Ohne Thema')}</h2><p>${Quiz.TYPE_ICONS[current.question.type] || '•'} ${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte</p>${previous?.standings?.[0] ? `<div class="round-leader">Zwischenstand: <strong>${App.escapeHTML(previous.standings[0].name)}</strong> führt mit ${App.formatPoints(previous.standings[0].score)}</div>` : ''}</div>`;
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }

    const answerRecord = state.answers[current.question.id]?.[playerId];
    const questionResult = state.questionResults?.[current.question.id] || null;
    if (currentQuestionId !== current.question.id) { currentQuestionId = current.question.id; draftAnswer = answerRecord?.answer ?? null; }
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const timedOut = Boolean(state.questionOpen && state.questionEndsAt && Date.now() >= Number(state.questionEndsAt));
    const answerWindowOpen = state.questionOpen && !timedOut;

    if (current.question.type === 'buzzer') return renderBuzzer(current, answerRecord, questionResult, resolved);
    if (Quiz.gameOf(current.question)) return renderDuel(current, answerRecord, questionResult, resolved);

    window.SylasphereMedia?.sync(state.media, current.question); // Song-Ausschnitte auf diesem Gerät abspielen
    const stages = Quiz.stagesOf(current.question);
    const stage = Number(state.stage) || 0;
    const locked = Quiz.locksOnSubmit(current.question) && Boolean(answerRecord);

    if (answerWindowOpen && locked) {
      // Antwort ist abgegeben und gesperrt (z. B. Song-Enthüllung)
      App.setText(els['game-status'], 'Antwort gesperrt');
      renderQuestion(current.question, { currentAnswer: answerRecord.answer, readOnly: true, reveal: false, result: questionResult, stage });
      els['submit-answer'].hidden = true;
      const at = stages ? stages[Math.min(stages.length - 1, Number(answerRecord.answer?.stage) || 0)] : null;
      els['answer-feedback'].innerHTML = `<div class="notice notice--success">🔒 Antwort abgegeben${at ? ` in Stufe ${(Number(answerRecord.answer?.stage) || 0) + 1} (${at.percent} % der Punkte)` : ''}. Der Moderator prüft sie bei der Auflösung.</div>`;
    } else if (answerWindowOpen) {
      App.setText(els['game-status'], 'Frage läuft');
      // v24: Ohne „Abschicken“ – jede Änderung wird automatisch gespeichert; was beim Zeitablauf drinsteht, zählt.
      // Ausnahme: Fragen, deren Antwort nach dem Abschicken gesperrt wird (Song-Enthüllung mit Stufen).
      const manual = Quiz.locksOnSubmit(current.question);
      renderQuestion(current.question, { currentAnswer: draftAnswer, readOnly: false, reveal: false, result: questionResult, stage, onAnswer: value => { draftAnswer = value; updateSubmit(); if (!manual) scheduleAutoSave(current.question.id); } });
      els['submit-answer'].hidden = !manual; els['submit-answer'].disabled = draftAnswer == null;
      els['submit-answer'].textContent = stages ? `Abschicken · ${stages[Math.min(stages.length - 1, stage)].percent} %` : 'Antwort abschicken';
      els['answer-feedback'].innerHTML = manual
        ? '<div class="notice">Du kannst nur einmal abschicken – danach ist deine Antwort gesperrt.</div>'
        : `<div class="notice autosave-note${answerRecord ? ' is-saved' : ''}">${answerRecord ? '✓ Gespeichert – du kannst bis zum Ende noch ändern.' : '✎ Deine Antwort wird automatisch gespeichert. Was beim Zeitablauf drinsteht, zählt.'}</div>`;
    } else if (!resolved) {
      App.setText(els['game-status'], 'Antworten geschlossen');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: false, result: questionResult, stage });
      els['submit-answer'].hidden = true;
      els['answer-feedback'].innerHTML = `<div class="notice notice--warning reveal-wait"><strong>⏱ Antworten sind geschlossen.</strong><span>${answerRecord ? 'Deine Antwort ist gespeichert. ' : ''}Der Moderator löst die Frage gleich auf.</span></div>`;
    } else {
      App.setText(els['game-status'], 'Auflösung');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: true, result: questionResult });
      els['submit-answer'].hidden = true;
      const correct = Quiz.correctAnswerText(current.question, questionResult); const points = answerRecord?.awardedPoints;
      const label = Quiz.solutionLabel(current.question);
      els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(correct || '–')}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points || 0)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : '<div class="notice">Keine Antwort abgegeben.</div>'}${Renderers.answerEntriesHTML(questionResult?.entries, playerId)}`;
    }
  }

  /*
   * Zeichnet die Frage nur neu, wenn sich für diesen Spieler wirklich etwas ändert
   * (andere Frage, Phase, Auflösung, Buzzer-Status). Antworten anderer Spieler lösen
   * so kein Neuzeichnen mehr aus – Textfelder behalten den Fokus, Regler springen nicht.
   */
  function renderQuestion(question, ctx) {
    const host = els['game-question'];
    const frozenAnswer = ctx.readOnly || ctx.reveal ? (ctx.currentAnswer ?? null) : null;
    const key = JSON.stringify([question.id, Boolean(ctx.readOnly), Boolean(ctx.reveal), ctx.result ?? null, frozenAnswer]);
    if (host.dataset.renderKey === key && host.querySelector('.question-shell')) {
      // Kleine Änderungen (z. B. neue Song-Stufe) ohne Neuzeichnen – Eingaben behalten den Fokus
      Quiz.typeDef(question.type)?.update?.(question, host, ctx);
      return;
    }
    Renderers.renderPlayer(question, host, Object.assign({ playerId }, ctx)); // v26: eigene Wertung (z. B. Grid)
    host.dataset.renderKey = key;
  }

  // Zeitduell (v22): alle sehen Bild und Uhren; wer dran ist, tippt (Modus „Tippen“) oder spricht
  function renderDuel(current, answerRecord, questionResult, resolved) {
    const q = current.question;
    const game = state.game || null;
    const host = els['game-question'];
    if (host.dataset.renderKey !== `duel:${q.id}`) host.replaceChildren();
    host.dataset.renderKey = `duel:${q.id}`;
    Renderers.renderPlayer(q, host, {
      readOnly: resolved, reveal: resolved, result: questionResult, game, players: state.players, playerId, role: 'player',
      onGuess: text => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, { text, pos: Number(state.game.pos) || 0 })).catch(error => App.toast(error.message, 'error')); },
      // v24: Spieler kann selbst passen (beide Modi) – der Moderator-Rechner verarbeitet es
      onPass: () => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, { pass: true, pos: Number(state.game.pos) || 0, at: Date.now() })).catch(error => App.toast(error.message, 'error')); },
      // v25: Einordnen – Zug (Karte + Stelle) an den Moderator-Rechner
      onInput: answer => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, answer)).catch(error => App.toast(error.message, 'error')); }
    });
    els['submit-answer'].hidden = true;
    const Game = Quiz.gameOf(q);
    if (!resolved && Game?.playerStatus) {
      const info = Game.playerStatus(game, playerId);
      App.setText(els['game-status'], info.status);
      if (els['answer-feedback'].innerHTML !== info.html) els['answer-feedback'].innerHTML = info.html;
      return;
    }
    if (!resolved) {
      const g = game;
      App.setText(els['game-status'], !g ? 'Gleich geht’s los' : g.phase === 'done' ? 'Duell beendet' : g.phase === 'reveal' ? 'Lösung' : g.phase === 'paused' ? 'Pause' : g.active === playerId ? 'Du bist dran!' : 'Zeitduell');
      const out = g && Array.isArray(g.eliminated) && g.eliminated.includes(playerId);
      const inGame = g && Array.isArray(g.order) && g.order.includes(playerId);
      els['answer-feedback'].innerHTML = out ? '<div class="notice">Deine Zeit ist abgelaufen – du bist raus, schau den anderen zu.</div>'
        : g && !inGame ? '<div class="notice">Du bist nach dem Start beigetreten und schaust bei diesem Duell zu.</div>'
        : g?.phase === 'done' ? '<div class="notice notice--warning reveal-wait"><strong>🏁 Duell beendet.</strong><span>Der Moderator vergibt gleich die Punkte.</span></div>' : '';
      return;
    }
    App.setText(els['game-status'], 'Auflösung');
    const points = answerRecord?.awardedPoints;
    els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>Ergebnis</span><strong>${App.escapeHTML(Quiz.correctAnswerText(q, questionResult) || '–')}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points || 0)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : ''}`;
  }

  function renderBuzzer(current, answerRecord, questionResult, resolved) {
    const result = questionResult && questionResult.kind === 'buzzer' ? questionResult : { mode: current.question.buzzerMode || 'spoken', status: state.questionOpen ? 'open' : 'idle', eliminatedIds: [] };
    const myTurn = result.contenderId && String(result.contenderId) === String(playerId);
    const eliminated = Array.isArray(result.eliminatedIds) && result.eliminatedIds.includes(playerId);
    const answerWindowOpen = state.questionOpen && result.status === 'open';

    if (resolved) {
      App.setText(els['game-status'], 'Auflösung');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: true, result, playerId });
      els['submit-answer'].hidden = true;
      const points = answerRecord?.awardedPoints || 0;
      const winnerText = result.winnerId ? `${result.winnerName || 'Spieler'} gewinnt den Buzzer` : 'Keine Wertung';
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>Buzzer-Ergebnis</span><strong>${App.escapeHTML(winnerText)}</strong></div><div class="reveal-box"><span>Lösung</span><strong>${App.escapeHTML(solution)}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : ''}`;
      return;
    }

    App.setText(els['game-status'], answerWindowOpen ? 'Buzzer offen' : 'Buzzer gesperrt');
    renderQuestion(current.question, { currentAnswer: draftAnswer, readOnly: !answerWindowOpen, reveal: false, result, playerId, onAnswer: value => { draftAnswer = value; updateSubmit(); } });

    if (answerWindowOpen && !eliminated) {
      els['submit-answer'].hidden = false;
      els['submit-answer'].textContent = current.question.buzzerMode === 'text' ? (answerRecord ? 'Schnellantwort aktualisieren' : 'Schnellantwort senden') : 'Jetzt buzzern';
      els['submit-answer'].disabled = current.question.buzzerMode === 'text' ? !String(draftAnswer ?? '').trim() : false;
      els['answer-feedback'].innerHTML = '<div class="notice">⚡ Geschwindigkeit zählt. Nur der erste Spieler kommt durch.</div>';
      return;
    }

    els['submit-answer'].hidden = true;
    if (myTurn) {
      els['answer-feedback'].innerHTML = current.question.buzzerMode === 'text'
        ? '<div class="notice notice--success">✓ Du warst zuerst. Deine Antwort wurde gesendet und wird jetzt geprüft.</div>'
        : '<div class="notice notice--success">✓ Du warst zuerst. Antworte jetzt mündlich, der Moderator prüft deine Antwort.</div>';
    } else if (eliminated) {
      els['answer-feedback'].innerHTML = '<div class="notice notice--warning">Du bist für diese Frage gesperrt, weil deine letzte Buzzer-Antwort falsch war.</div>';
    } else {
      const contender = result.contenderName || 'Ein anderer Spieler';
      els['answer-feedback'].innerHTML = `<div class="notice notice--warning">${App.escapeHTML(contender)} ist dran. Warte auf die Entscheidung des Moderators.</div>`;
    }
  }

  function finalPodium(ranked, place) {
    const top = ranked.slice(0, 3); const order = [top[1], top[0], top[2]].filter(Boolean);
    const podium = order.map(player => {
      const rank = ranked.findIndex(p => p.id === player.id) + 1;
      return `<div class="podium-place podium-place--${rank}"><div class="podium-avatar">${App.escapeHTML(App.avatar(player.avatar))}</div><strong>${App.escapeHTML(player.name)}</strong><span>${App.formatPoints(player.score)}</span><b>${rank}</b></div>`;
    }).join('');
    const me = ranked.find(p => p.id === playerId);
    return `<div class="final-screen"><span class="eyebrow">Finale</span><h2>${place === 1 ? '🏆 Sieg!' : `Platz ${place || '–'}`}</h2><div class="podium">${podium}</div>${me ? `<div class="my-final-score"><span>Dein Ergebnis</span><strong>${App.formatPoints(me.score)}</strong></div>` : ''}${window.SylasphereHighlights?.html(state.highlights) || ''}</div>`;
  }

  // Automatisches Speichern (kurz verzögert, damit Tippen/Regler nicht jede Millisekunde senden)
  let autoSaveTimer = null, autoSaveQuestion = '', lastSaved = '';
  function scheduleAutoSave(questionId) {
    autoSaveQuestion = questionId;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(autoSave, 450);
  }
  async function autoSave() {
    if (!engine || !state) return;
    const current = engine.getCurrent(state);
    if (!current.question || current.question.id !== autoSaveQuestion || draftAnswer == null) return;
    if (!state.questionOpen || (state.questionEndsAt && Date.now() > Number(state.questionEndsAt) + 400)) return;
    const serialized = JSON.stringify([current.question.id, draftAnswer]);
    if (serialized === lastSaved) return;
    try {
      const ok = await engine.submitAnswer(playerId, draftAnswer);
      if (ok) lastSaved = serialized;
    } catch (error) { console.warn('Automatisches Speichern fehlgeschlagen', error); }
  }
  // Kurz vor Zeitablauf den letzten Stand sicher senden
  setInterval(() => {
    if (!autoSaveTimer || !state?.questionEndsAt || !state.questionOpen) return;
    if (Number(state.questionEndsAt) - Date.now() < 700) { clearTimeout(autoSaveTimer); autoSave(); }
  }, 250);

  function updateSubmit(){
    const current = engine?.getCurrent(state);
    if (current?.question?.type === 'buzzer' && current.question.buzzerMode === 'spoken') { els['submit-answer'].disabled = false; return; }
    els['submit-answer'].disabled=draftAnswer==null || (typeof draftAnswer === 'string' && !draftAnswer.trim());
  }

  async function submit(){
    if(!engine)return;
    const current = engine.getCurrent(state);
    if (!current.question) return;
    if (current.question.type !== 'buzzer' && draftAnswer == null) return;
    if (current.question.type === 'buzzer' && current.question.buzzerMode === 'text' && !String(draftAnswer ?? '').trim()) return;
    const payload = current.question.type === 'buzzer' && current.question.buzzerMode === 'spoken' ? null : draftAnswer;
    const button = els['submit-answer']; button.disabled = true;
    try {
      const ok = await engine.submitAnswer(playerId,payload);
      if(ok) App.toast(current.question.type === 'buzzer' ? 'Buzzer gesendet.' : 'Antwort gespeichert.','success'); else App.toast('Antwort konnte nicht mehr angenommen werden.','error');
    } catch (error) { App.toast(transport === 'online' ? Firebase.friendlyError(error) : error.message, 'error'); }
    finally {
      const stillOpen = Boolean(state?.questionOpen && (!state.questionEndsAt || Date.now() < Number(state.questionEndsAt)));
      if (stillOpen) updateSubmit();
    }
  }

  function renderLeaderboard() {
    const ranked = state.players.slice().sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt).slice(0, 10);
    const current = engine?.getCurrent(state);
    const resolved = Boolean(current?.question && state.scoredQuestionIds?.includes(current.question.id));
    const gains = resolved ? (state.answers[current.question.id] || {}) : {};
    App.renderRanking(els['leaderboard'], ranked.map((p, i) => {
      const gain = Number(gains[p.id]?.awardedPoints) || 0;
      return `<div class="leader-row ${p.id === playerId ? 'is-me' : ''}" data-pid="${App.escapeHTML(p.id)}" data-rank="${i + 1}"><span>${i + 1}</span><span class="avatar small">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong><span class="leader-score">${gain > 0 ? `<em>+${Math.round(gain)}</em>` : ''}<b>${Math.round(p.score)} P</b></span></div>`;
    }).join(''));
  }

  function renderTimer(current){
    timer?.stop();
    els['player-timer'].classList.remove('is-critical');
    if (current?.question?.type === 'buzzer' && state.questionStartedAt && !state.scoredQuestionIds?.includes(current.question.id)) { App.setText(els['player-timer'],'⚡'); return; }
    if(!state.questionOpen||!state.questionEndsAt){App.setText(els['player-timer'],'–');return;}
    timer=new Timer((seconds)=>{App.setText(els['player-timer'],String(seconds??'–')); window.SylasphereSfx?.countdown(seconds); if(seconds!=null&&seconds<=5)els['player-timer'].classList.add('is-critical');else els['player-timer'].classList.remove('is-critical');},()=>{ els['submit-answer'].disabled=true; els['game-question'].querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true); App.setText(els['game-status'],'Zeit abgelaufen'); if(!state.scoredQuestionIds?.includes(current?.question?.id)) els['answer-feedback'].innerHTML='<div class="notice notice--warning">⏱ Zeit abgelaufen. Warte auf die Auflösung durch den Moderator.</div>'; }); timer.start(state.questionEndsAt);
  }

  async function disconnect(message){
    identity?.destroy(); identity=null; try { await engine?.destroy?.(); } catch (_) {} engine=null;
    els['game-panel'].hidden=true; els['join-panel'].hidden=false; els['join-error'].textContent=message;
  }
})();
