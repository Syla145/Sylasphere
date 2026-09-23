const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..'); let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
function getAt(rootObj,pathStr){return pathStr.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],rootObj)}
function setAt(rootObj,pathStr,value){const parts=pathStr.split('/').filter(Boolean); let o=rootObj; for(let i=0;i<parts.length-1;i++)o=o[parts[i]]??={}; const k=parts.at(-1); if(value===null||value===undefined) delete o[k]; else o[k]=JSON.parse(JSON.stringify(value));}
function snap(v){return{exists:()=>v!==undefined&&v!==null,val:()=>v===undefined?null:JSON.parse(JSON.stringify(v))}}
const data={}; const listeners=[];
function notify(changed){for(const l of listeners){if(changed===l.path||changed.startsWith(l.path+'/')||l.path.startsWith(changed+'/')) queueMicrotask(()=>l.cb(snap(getAt(data,l.path))))}}
const dbm={
 ref:(db,p='')=>({db,path:p.replace(/^\/+|\/+$/g,'')}),
 get:async r=>snap(getAt(data,r.path)),
 set:async(r,v)=>{setAt(data,r.path,v);notify(r.path)},
 remove:async r=>{setAt(data,r.path,null);notify(r.path)},
 update:async(r,patch)=>{for(const [k,v] of Object.entries(patch)){const p=[r.path,k].filter(Boolean).join('/');setAt(data,p,v);notify(p)}},
 runTransaction:async(r,fn)=>{const cur=getAt(data,r.path);const next=fn(cur===undefined?null:JSON.parse(JSON.stringify(cur)));if(next===undefined)return{committed:false,snapshot:snap(cur)};setAt(data,r.path,next);notify(r.path);return{committed:true,snapshot:snap(next)}},
 onValue:(r,cb)=>{const x={path:r.path,cb};listeners.push(x);queueMicrotask(()=>cb(snap(getAt(data,r.path))));return()=>{const i=listeners.indexOf(x);if(i>=0)listeners.splice(i,1)}},
 onDisconnect:()=>({update:async()=>{},cancel:async()=>{}}),
 serverTimestamp:()=>Date.now()
};
function context(uid,role){return{role,modules:{database:dbm},db:{},auth:{currentUser:{uid}},serverOffset:0,connected:true}}
const modCtx=context('host_uid_123456789','moderator'), p1Ctx=context('p1_uid_123456789','player'), p2Ctx=context('p2_uid_123456789','player'), specCtx=context('spec_uid_123456789','spectator');
let playerCall=0;
const Firebase={
 ready:async role=>role==='moderator'?modCtx:role==='spectator'?specCtx:(playerCall++===0?p1Ctx:p2Ctx),
 serverNow:()=>Date.now(),toLocalTime:(ctx,v)=>v,
 rotateAnonymous:async()=>({uid:'rotated_uid_123456789'})
};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval:()=>{},setTimeout,clearTimeout,window:null,document:{addEventListener(){},querySelectorAll(){return[]}},location:{search:''},URLSearchParams};base.window=base;base.window.addEventListener=()=>{};base.window.removeEventListener=()=>{};base.JHQuizFirebase=Firebase;
const ctx=vm.createContext(base); const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8'));
(async()=>{
 const host=await Online.create(quiz); await host.waitForState(); ok(host.load().online,'host gets online state'); ok(host.code.length===6,'room code has six chars');
 const code=host.code;
 // use explicit contexts to represent independent browsers
 const p1=new Online(code,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${code}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(code,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${code}/meta`);await p2.attach();await p2.waitForState();
 const spec=new Online(code,'spectator',specCtx);spec.raw.meta=getAt(data,`rooms/${code}/meta`);await spec.attach();await spec.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');await new Promise(r=>setTimeout(r,5));
 ok(host.load().players.length===2,'host sees two remote players');ok(p1.load().players.length===2&&p2.load().players.length===2,'players see each other');
 await host.startGame();await host.startQuestion();await new Promise(r=>setTimeout(r,5));
 const fullQ=host.getCurrent(host.load()).question; const pubQ=p1.getCurrent(p1.load()).question;
 ok(pubQ.id===fullQ.id,'same current question published');ok(!Object.prototype.hasOwnProperty.call(pubQ,'correctAnswer'),'correct answer hidden before reveal');
 const a1=fullQ.correctAnswer ?? fullQ.options?.[0]?.id; const a2=fullQ.options?.find(o=>String(o.id)!==String(a1))?.id ?? a1;
 ok(await p1.submitAnswer(p1.userId,a1),'player 1 answer accepted');ok(await p2.submitAnswer(p2.userId,a2),'player 2 answer accepted');await new Promise(r=>setTimeout(r,5));
 ok(Object.keys(host.load().answers[fullQ.id]||{}).length===2,'host receives both answers');
 await host.lockQuestion();await new Promise(r=>setTimeout(r,5));ok(host.load().scoredQuestionIds.length===0,'locking does not score online');
 await host.resolveQuestion();await new Promise(r=>setTimeout(r,10));
 ok(host.load().scoredQuestionIds.includes(fullQ.id),'manual online reveal marks resolved');
 ok(Object.prototype.hasOwnProperty.call(p1.getCurrent(p1.load()).question,'correctAnswer'),'solution arrives only after reveal');
 ok(p1.load().players.some(p=>p.score>0),'correct remote answer receives points');
 ok(spec.load().publicStats!=null,'spectator receives aggregated reveal stats');
 const anna=host.load().players.find(p=>p.name==='Anna'); const before=anna.score;await host.adjustPlayerScore(anna.id,1);await new Promise(r=>setTimeout(r,5));ok(host.load().players.find(p=>p.id===anna.id).score===before+1,'host +1 works online');
 await host.move(1);await new Promise(r=>setTimeout(r,5));ok(host.load().questionStartedAt===null,'next question returns to preview state');
 // Reconnect same anonymous uid should update, not duplicate.
 const p1Reload=new Online(code,'player',p1Ctx);p1Reload.raw.meta=getAt(data,`rooms/${code}/meta`);await p1Reload.attach();await p1Reload.waitForState();await p1Reload.joinPlayer('Anna','🦊');await new Promise(r=>setTimeout(r,5));ok(host.load().players.length===2,'reconnect does not duplicate player');

 function winningSurveyId(q){return q.options.slice().sort((a,b)=>(Number(b.value)||0)-(Number(a.value)||0))[0]?.id;}
 function correctFor(q){
   if(['multiple-choice','image-quiz','audio-quiz'].includes(q.type)) return q.correctAnswer;
   if(q.type==='estimate') return q.correctAnswer;
   if(q.type==='sort') return q.correctOrder.slice();
   if(q.type==='fight-list') return q.correctAnswers.slice(0,q.maxEntries||q.correctAnswers.length);
   if(q.type==='higher-lower') return q.cards.slice(0,-1).map((c,i)=>q.cards[i+1].value>=c.value?'higher':'lower');
   if(q.type==='survey') return winningSurveyId(q);
   if(q.type==='consensus') return q.options[0]?.id;
   if(q.type==='hotspot') return {x:q.targetX,y:q.targetY};
   if(q.type==='buzzer') return q.solution || null;
   return null;
 }
 // Complete the remaining showcase so every online question type, round transition
 // and the final state passes through the Firebase transport at least once.
 let safety=20;
 while(host.load().status!=='finished' && safety-->0){
   const current=host.getCurrent(host.load()).question;
   ok(Boolean(current),'online showcase has current question');
   await host.startQuestion(); await new Promise(r=>setTimeout(r,2));
   const answer=correctFor(current);
   if(current.type==='buzzer'){
     ok(await p1.submitAnswer(p1.userId,answer),`${current.type}: first buzzer accepted online`);
     ok(!(await p2.submitAnswer(p2.userId,answer)),`${current.type}: second simultaneous buzzer rejected online`);
     await host.markBuzzerIncorrect(); await new Promise(r=>setTimeout(r,3));
     ok(await p2.submitAnswer(p2.userId,answer),`${current.type}: buzzer reopened for remaining player`);
     await host.resolveQuestion(); await new Promise(r=>setTimeout(r,4));
   }else{
     ok(await p1.submitAnswer(p1.userId,answer),`${current.type}: p1 answer accepted online`);
     ok(await p2.submitAnswer(p2.userId,answer),`${current.type}: p2 answer accepted online`);
     await host.lockQuestion(); await host.resolveQuestion(); await new Promise(r=>setTimeout(r,4));
   }
   ok(host.load().scoredQuestionIds.includes(current.id),`${current.type}: resolved online`);
   await host.move(1); await new Promise(r=>setTimeout(r,3));
 }
 ok(host.load().status==='finished','full online showcase reaches finished state');
 ok(host.load().roundSummaries.length===3,'all three online round summaries created');
 ok(host.load().scoredQuestionIds.length===11,'all eleven online showcase questions resolved');

 const annaFinal=host.load().players.find(p=>p.name==='Anna');
 await host.setPlayerScore(annaFinal.id,137); await new Promise(r=>setTimeout(r,4));
 ok(host.load().players.find(p=>p.id===annaFinal.id)?.score===137,'exact moderator score works online');
 await host.resetScores(); await new Promise(r=>setTimeout(r,4));
 ok(host.load().players.every(p=>p.score===0),'online resetScores clears all player scores');
 ok(host.load().scoredQuestionIds.length===0,'online resetScores clears resolved markers');
 const benId=p2.userId; await p2.destroy(); await new Promise(r=>setTimeout(r,5));
 ok(host.load().players.find(p=>p.id===benId)?.active===false,'explicit player leave marks profile offline');
 await host.removePlayer(benId); await new Promise(r=>setTimeout(r,5));
 ok(host.load().players.length===1,'moderator can remove an online player');
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
