(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Session = window.SchmobinSession;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  const PlayerIdentity = window.JHQuizPlayerIdentity;

  let engine = null, identity = null, state = null, playerId = '', currentQuestionId = '', draftAnswer = null, timer = null, joining = false;
  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    ['join-panel','game-panel','room-code','player-name','join-btn','join-error','avatar-options','game-code','game-status','game-question','submit-answer','answer-feedback','player-score','leaderboard','player-timer','player-progress','player-identity'].forEach(id => els[id] = document.getElementById(id));
    const code = (App.getParam('code') || Session.lastCode() || '').toUpperCase(); if (code) els['room-code'].value = code;
    renderAvatars();
    els['join-btn'].addEventListener('click', join);
    els['room-code'].addEventListener('input', () => els['room-code'].value = els['room-code'].value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
    [els['room-code'], els['player-name']].forEach(input => input.addEventListener('keydown', e => { if (e.key === 'Enter') join(); }));
    els['submit-answer'].addEventListener('click', submit);
  }
  function renderAvatars() {
    const avatars = ['🦊','🐼','🦁','🐸','🐙','🦄','🤖','👾','🐧','🦖'];
    els['avatar-options'].innerHTML = avatars.map((a,i)=>`<button type="button" class="avatar-choice ${i===0?'is-selected':''}" data-avatar="${a}">${a}</button>`).join('');
    els['avatar-options'].addEventListener('click', e => {
      const b=e.target.closest('.avatar-choice'); if(!b)return; els['avatar-options'].querySelectorAll('.avatar-choice').forEach(x=>x.classList.toggle('is-selected',x===b));
    });
  }
  async function join() {
    if (joining) return;
    const code = els['room-code'].value.trim().toUpperCase(); const name = els['player-name'].value.trim();
    els['join-error'].textContent='';
    if (!Session.exists(code)) { els['join-error'].textContent='Sitzung nicht gefunden. Prüfe den 6-stelligen Code.'; return; }
    if (!name) { els['join-error'].textContent='Bitte gib deinen Namen ein.'; return; }
    const joinButton = els['join-btn'];
    joining = true;
    joinButton.disabled = true;
    joinButton.textContent = 'Beitritt läuft …';
    try {
      engine?.destroy();
      identity?.destroy();
      engine = new Session(code);
      identity = new PlayerIdentity(code);

      // A stored id is reused only for a genuine reload/reconnect. If another live tab
      // currently owns it (e.g. Chrome "Tab duplizieren"), reusablePlayerId() returns
      // an empty id so joinPlayer() creates a second, independent player.
      const previous = await identity.reusablePlayerId();
      const avatar=els['avatar-options'].querySelector('.is-selected')?.dataset.avatar || '🦊';
      playerId=engine.joinPlayer(name,avatar,previous);
      identity.activate(playerId);

      els['join-panel'].hidden=true; els['game-panel'].hidden=false; history.replaceState(null,'',`?code=${code}`);
      engine.subscribe(render);
    } catch(error) {
      els['join-error'].textContent=error.message;
      identity?.destroy(); identity = null;
    } finally {
      joining = false;
      joinButton.disabled = false;
      joinButton.textContent = 'Sitzung beitreten';
    }
  }
  function render(next) {
    state=next; const player=state.players.find(p=>p.id===playerId); if(!player){ return disconnect('Du bist nicht mehr Teil dieser Sitzung.'); }
    const current=engine.getCurrent(state); App.setText(els['game-code'],state.code); App.setText(els['player-score'],App.formatPoints(player.score));
    els['player-identity'].innerHTML=`<span class="avatar">${App.escapeHTML(App.avatar(player.avatar))}</span><span>${App.escapeHTML(player.name)}</span>`;
    renderLeaderboard(); renderStatus(current); renderTimer(current);
  }
  function renderStatus(current) {
    const total=Quiz.allQuestions(state.quiz).length; let global=0; for(let i=0;i<state.currentRoundIndex;i++) global+=state.quiz.quiz.rounds[i].questions.length; global+=state.currentQuestionIndex;
    App.setText(els['player-progress'],current.round ? `${current.round.title} · ${Math.min(global+1,total)}/${total}` : '');
    if(state.status==='lobby'){
      App.setText(els['game-status'],'Lobby'); els['game-question'].innerHTML='<div class="waiting-card"><div class="pulse-dot"></div><h2>Du bist drin!</h2><p>Der Moderator startet gleich das Quiz.</p></div>'; els['submit-answer'].hidden=true; els['answer-feedback'].innerHTML=''; return;
    }
    if(state.status==='finished'){
      App.setText(els['game-status'],'Beendet'); const ranked=state.players.slice().sort((a,b)=>b.score-a.score); const place=ranked.findIndex(p=>p.id===playerId)+1;
      els['game-question'].innerHTML=`<div class="finish-card"><span class="eyebrow">Dein Ergebnis</span><h2>${place ? `Platz ${place}`:'Fertig'}</h2><p>${App.formatPoints(state.players.find(p=>p.id===playerId)?.score)}</p></div>`; els['submit-answer'].hidden=true; els['answer-feedback'].innerHTML=''; return;
    }
    if(!current.question){ els['game-question'].innerHTML='<div class="empty-state">Warte auf die nächste Frage.</div>'; return; }
    if(!state.questionStartedAt){ App.setText(els['game-status'],'Bereit'); els['game-question'].innerHTML='<div class="waiting-card"><div class="pulse-dot"></div><h2>Nächste Frage bereit</h2><p>Warte, bis der Moderator die Frage öffnet.</p></div>'; els['submit-answer'].hidden=true; els['answer-feedback'].innerHTML=''; return; }
    const answerRecord=state.answers[current.question.id]?.[playerId];
    if(currentQuestionId!==current.question.id){ currentQuestionId=current.question.id; draftAnswer=answerRecord?.answer ?? null; }
    if(state.questionOpen){
      App.setText(els['game-status'],'Frage läuft'); Renderers.renderPlayer(current.question,els['game-question'],{currentAnswer:draftAnswer,readOnly:false,reveal:false,onAnswer:value=>{draftAnswer=value;updateSubmit();}});
      els['submit-answer'].hidden=false; els['submit-answer'].disabled = draftAnswer == null; els['submit-answer'].textContent=answerRecord?'Antwort aktualisieren':'Antwort abschicken';
      els['answer-feedback'].innerHTML=answerRecord?'<div class="notice notice--success">Antwort gespeichert. Du kannst sie bis zum Ablauf des Timers noch ändern.</div>':'';
    } else {
      App.setText(els['game-status'],'Auflösung'); Renderers.renderPlayer(current.question,els['game-question'],{currentAnswer:answerRecord?.answer ?? draftAnswer,readOnly:true,reveal:true}); els['submit-answer'].hidden=true;
      const correct=Quiz.correctAnswerText(current.question); const points=answerRecord?.awardedPoints;
      els['answer-feedback'].innerHTML=`<div class="reveal-box"><span>Lösung</span><strong>${App.escapeHTML(correct || '–')}</strong></div>${answerRecord?`<div class="points-earned ${points>0?'is-positive':''}"><span>Deine Punkte</span><strong>+${Math.round(points||0)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail||'')}</small></div>`:'<div class="notice">Keine Antwort abgegeben.</div>'}`;
    }
  }
  function updateSubmit(){ els['submit-answer'].disabled=draftAnswer==null; }
  function submit(){ if(!engine||draftAnswer==null)return; const ok=engine.submitAnswer(playerId,draftAnswer); if(ok)App.toast('Antwort gespeichert.','success'); else App.toast('Antwort konnte nicht mehr angenommen werden.','error'); }
  function renderLeaderboard(){
    const ranked=state.players.slice().sort((a,b)=>b.score-a.score||a.joinedAt-b.joinedAt).slice(0,8);
    els['leaderboard'].innerHTML=ranked.map((p,i)=>`<div class="leader-row ${p.id===playerId?'is-me':''}"><span>${i+1}</span><span class="avatar small">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong><b>${Math.round(p.score)} P</b></div>`).join('');
  }
  function renderTimer(current){
    timer?.stop(); if(!state.questionOpen||!state.questionEndsAt){App.setText(els['player-timer'],'–');return;}
    timer=new Timer((seconds)=>{App.setText(els['player-timer'],String(seconds??'–')); if(seconds!=null&&seconds<=5)els['player-timer'].classList.add('is-critical');else els['player-timer'].classList.remove('is-critical');},()=>{ els['submit-answer'].disabled=true; els['game-question'].querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true); }); timer.start(state.questionEndsAt);
  }
  function disconnect(message){ identity?.destroy(); identity=null; engine?.destroy(); engine=null; els['game-panel'].hidden=true; els['join-panel'].hidden=false; els['join-error'].textContent=message; }
})();
