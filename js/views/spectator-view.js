(function () {
  'use strict';
  const App=window.SchmobinApp, Quiz=window.SchmobinQuiz, Session=window.SchmobinSession, Renderers=window.SchmobinRenderers, Timer=window.SchmobinTimer;
  let engine=null,state=null,timer=null; const els={};
  document.addEventListener('DOMContentLoaded',init);
  function init(){
    ['spectator-connect','spectator-code-input','spectator-connect-btn','spectator-error','spectator-live','spectator-code','spectator-status','spectator-progress','spectator-timer','spectator-question','spectator-stats','spectator-leaderboard'].forEach(id=>els[id]=document.getElementById(id));
    els['spectator-connect-btn'].addEventListener('click',()=>connect(els['spectator-code-input'].value));
    const code=(App.getParam('code')||Session.lastCode()||'').toUpperCase(); if(code&&Session.exists(code))connect(code); else if(code)els['spectator-code-input'].value=code;
  }
  function connect(code){
    code=String(code||'').trim().toUpperCase(); if(!Session.exists(code)){els['spectator-error'].textContent='Sitzung nicht gefunden.';return;}
    engine?.destroy();engine=new Session(code);els['spectator-connect'].hidden=true;els['spectator-live'].hidden=false;history.replaceState(null,'',`?code=${code}`);engine.subscribe(render);
  }
  function render(next){
    state=next;const current=engine.getCurrent(state);App.setText(els['spectator-code'],state.code);App.setText(els['spectator-status'],state.status==='finished'?'Beendet':state.questionOpen?'Live':'Bereit');
    const total=Quiz.allQuestions(state.quiz).length;let idx=0;for(let i=0;i<state.currentRoundIndex;i++)idx+=state.quiz.quiz.rounds[i].questions.length;idx+=state.currentQuestionIndex;App.setText(els['spectator-progress'],current.round?`${current.round.title} · Frage ${Math.min(idx+1,total)}/${total}`:'');
    renderQuestion(current);renderLeaderboard();renderTimer();
  }
  function renderQuestion(current){
    if(state.status==='lobby'){els['spectator-question'].innerHTML=`<div class="waiting-card presenter"><div class="pulse-dot"></div><h1>${App.escapeHTML(state.quiz.quiz.title)}</h1><p>Lobby geöffnet · ${state.players.length} Spieler</p></div>`;els['spectator-stats'].innerHTML='';return;}
    if(state.status==='finished'){const ranked=state.players.slice().sort((a,b)=>b.score-a.score);els['spectator-question'].innerHTML=`<div class="finish-card presenter"><span class="eyebrow">Finale</span><h1>${ranked[0]?`🏆 ${App.escapeHTML(ranked[0].name)}`:'Quiz beendet'}</h1><p>${ranked[0]?App.formatPoints(ranked[0].score):''}</p></div>`;els['spectator-stats'].innerHTML='';return;}
    if(!current.question)return;
    if(!state.questionStartedAt){els['spectator-question'].innerHTML='<div class="waiting-card presenter"><div class="pulse-dot"></div><h1>Nächste Frage</h1><p>Der Moderator bereitet die nächste Frage vor.</p></div>';els['spectator-stats'].innerHTML='';return;}
    Renderers.renderPlayer(current.question,els['spectator-question'],{readOnly:true,reveal:!state.questionOpen,currentAnswer:null});
    const answers=state.answers[current.question.id]||{};const submitted=Object.keys(answers).length;const total=state.players.length;
    let html=`<div class="presenter-response"><strong>${submitted}/${total}</strong><span>Antworten</span></div>`;
    if(!state.questionOpen){html+=`<div class="reveal-box"><span>Lösung</span><strong>${App.escapeHTML(Quiz.correctAnswerText(current.question)||'–')}</strong></div>`;html+=stats(current.question,answers);}
    els['spectator-stats'].innerHTML=html;
  }
  function stats(q,answers){
    const values=Object.values(answers).map(a=>a.answer); if(!values.length)return'';
    if(q.type==='multiple-choice'||q.type==='image-quiz'){
      const counts=new Map((q.options||[]).map(o=>[o.id,0]));values.forEach(v=>counts.set(String(v),(counts.get(String(v))||0)+1));const max=Math.max(1,...counts.values());
      return `<div class="stat-bars">${(q.options||[]).map(o=>`<div><span>${App.escapeHTML(o.text)}</span><div class="bar"><i style="width:${Math.round((counts.get(o.id)||0)/max*100)}%"></i></div><b>${counts.get(o.id)||0}</b></div>`).join('')}</div>`;
    }
    if(q.type==='estimate'){const nums=values.map(Number).filter(Number.isFinite);if(!nums.length)return'';const avg=nums.reduce((a,b)=>a+b,0)/nums.length;return `<div class="stat-cards"><div><span>Ø Schätzung</span><strong>${Number(avg.toFixed(1))}${q.unit?` ${App.escapeHTML(q.unit)}`:''}</strong></div><div><span>Spanne</span><strong>${Math.min(...nums)}–${Math.max(...nums)}</strong></div></div>`;}
    if(q.type==='fight-list'){const map=new Map();values.flatMap(v=>Array.isArray(v)?v:[]).forEach(x=>{const k=Quiz.normalizeTerm(x);if(k)map.set(k,(map.get(k)||0)+1)});const top=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);return `<div class="chip-row large">${top.map(([t,n])=>`<span class="chip">${App.escapeHTML(t)} <b>${n}×</b></span>`).join('')}</div>`;}
    return '';
  }
  function renderLeaderboard(){const ranked=state.players.slice().sort((a,b)=>b.score-a.score||a.joinedAt-b.joinedAt).slice(0,10);els['spectator-leaderboard'].innerHTML=ranked.map((p,i)=>`<div class="leader-row presenter-row"><span>${i+1}</span><span class="avatar">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}</strong><b>${Math.round(p.score)} P</b></div>`).join('');}
  function renderTimer(){timer?.stop();if(!state.questionOpen||!state.questionEndsAt){App.setText(els['spectator-timer'],'–');return;}timer=new Timer(seconds=>App.setText(els['spectator-timer'],String(seconds??'–')),()=>{});timer.start(state.questionEndsAt);}
})();
