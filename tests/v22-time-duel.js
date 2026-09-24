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
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');

const Online=ctx.window.JHQuizOnlineSession, Session=ctx.window.SchmobinSession, Q=ctx.window.SchmobinQuiz, V=ctx.window.SchmobinValidator;
const T=ctx.window.SylasphereTypes, def=T.get('time-duel'), G=def.game;
const demo=JSON.parse(fs.readFileSync(path.join(root,'data/quiz-zeitduell-demo.json'),'utf8'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 // ---- Grundlagen
 ok(T.has('time-duel')&&Q.SUPPORTED_TYPES.includes('time-duel'),'time-duel registered');
 const v=V.validate(demo);ok(v.valid,'demo quiz valid '+JSON.stringify(v.errors));
 const qd=v.normalized.quiz.rounds[0].questions[1]; ok(qd.answerMode==='typed'&&qd.items.length===16,'typed duel with 16 images');
 const pub=Q.publicQuestion(qd,false);ok(pub.items.every(i=>!('answer' in i)&&i.image),'public question hides answers but keeps images');
 ok(!JSON.stringify(pub).includes('"Schneemann"'),'no solution text in public question');
 ok(G.normalizeGuess('  SchneeMANN ')===G.normalizeGuess('schneemann'),'case and spaces ignored');
 ok(G.normalizeGuess('Kaese')!==G.normalizeGuess('Käse'),'umlauts stay strict');
 // ---- Logik: Passen, Zeit, Ende
 let t=1e6;let g=G.start(qd,['a','b'],t,()=>0.1);const first=g.active;
 g=G.pass(g,qd,t+2000);ok(g.clocks[first]===25000&&g.reveal.reason==='pass'&&g.reveal.answer,'pass: −3 s, answer revealed');
 ok(G.tick(g,qd,t+2000+2999)===g,'reveal lasts 3 s');g=G.tick(g,qd,t+5000);ok(g.phase==='play'&&g.active!==first&&g.pos===1,'after pass: next player, new image');
 const second=g.active;g=G.tick(g,qd,t+5000+30001);ok(g.reveal.reason==='timeout'&&g.clocks[second]===0,'timeout detected');
 g=G.tick(g,qd,t+5000+30001+3000);ok(g.phase==='done'&&g.endReason==='last-standing','last player standing ends duel');
 ok(G.placements(g)[0].playerId===first,'winner is remaining player');
 let h=G.start(qd,['a','b','c'],t,()=>0.3);h=G.pause(h,t+1000);ok(h.phase==='paused'&&G.remaining(h,h.active,t+9000)===29000,'pause stops the clock');h=G.resume(h,t+9000);ok(G.remaining(h,h.active,t+10000)===28000,'resume continues');
 let k=G.start(Object.assign({},qd,{items:qd.items.slice(0,2)}),['a','b','c'],t,()=>0.3);k=G.correct(k,qd,t+100);k=G.tick(k,qd,t+2200);k=G.correct(k,qd,t+2300);k=G.tick(k,qd,t+4400);ok(k.phase==='done'&&k.endReason==='out-of-images','runs out of images → ends');
 const r=def.resolve(qd,{},{game:k,names:{a:'A',b:'B',c:'C'}});ok(r.placements.length===3&&r.placements[0].remainingMs>=r.placements[1].remainingMs,'ranking by remaining time');
 const pts=r.placements.map(p=>def.score(qd,null,{base:300,result:r,playerId:p.playerId}).points);ok(pts.join()==='300,180,90','points by placement (100/60/30 %)');
 // ---- Lokale Engine: kompletter Ablauf
 const e=Session.create(demo);const p1=e.joinPlayer('Anna','🦊'),p2=e.joinPlayer('Ben','🐼');e.startGame();e.startQuestion();
 let s=e.load();const lq=e.getCurrent(s).question;let lg=G.start(lq,[p1,p2],Date.now(),()=>0.2);e.setGame(lg);
 s=e.load();ok(s.game&&s.game.order.length===2,'local engine stores game');
 lg=G.correct(s.game,lq,Date.now());e.setGame(lg);lg=G.advance(G.normalize(e.load().game),Date.now());e.setGame(lg);
 lg=G.pass(e.load().game,lq,Date.now());lg.clocks[lg.reveal.by]=0;e.setGame(lg);lg=G.advance(G.normalize(e.load().game),Date.now());e.setGame(lg);
 ok(e.load().game.phase==='done','local duel finished');e.lockQuestion();e.resolveQuestion();s=e.load();
 const scores=s.players.map(p=>p.score).sort((a,b)=>b-a);ok(scores[0]===300&&scores[1]===180,'local engine scores all players by placement '+scores);
 ok(s.scoredQuestionIds.includes(lq.id)&&s.questionResults[lq.id].placements[0].name,'result with names stored');
 e.move(1);ok(e.load().game===null,'game reset on next question');
 // ---- Online: Spieler tippen, Moderator prüft
 const host=await Online.create(demo);await host.waitForState();const code=host.code;
 const a=new Online(code,'player',p1Ctx);a.raw.meta=getAt(data,`rooms/${code}/meta`);await a.attach();await a.waitForState();
 const b=new Online(code,'player',p2Ctx);b.raw.meta=getAt(data,`rooms/${code}/meta`);await b.attach();await b.waitForState();
 await a.joinPlayer('Anna','🦊');await b.joinPlayer('Ben','🐼');await wait(5);
 await host.startGame();await host.move(1);await host.startQuestion();await wait(5);
 let hs=host.load();const oq=host.getCurrent(hs).question;ok(oq.answerMode==='typed','online: typed duel is current');
 ok(a.getCurrent(a.load()).question.items.every(i=>!i.answer),'online: players never get answers');
 await host.setGame(G.start(oq,hs.players.map(p=>p.id),Date.now(),()=>0.2));await wait(5);
 const ag=a.load().game;ok(ag&&ag.phase==='play'&&ag.order.length===2,'online: players receive game state');
 ok(!JSON.stringify(ag).includes(oq.items[ag.deck[ag.pos]].answer),'online: current answer not in public game state');
 const active=ag.active===a.userId?a:b;const answer=oq.items[ag.deck[ag.pos]].answer;
 ok(await active.submitAnswer(active.userId,{text:'falsch',pos:ag.pos}),'online: wrong guess accepted');await wait(5);
 hs=host.load();let rec=hs.answers[oq.id][active.userId];let ng=G.guess(hs.game,oq,active.userId,rec.answer.text,Date.now());ok(ng.phase==='play'&&ng.lastGuess.text==='falsch','wrong guess shown, still playing');await host.setGame(ng);await wait(5);
 ok(b.load().game.lastGuess?.text==='falsch','other players see wrong guess');
 await active.submitAnswer(active.userId,{text:answer.toUpperCase(),pos:ag.pos});await wait(5);
 hs=host.load();rec=hs.answers[oq.id][active.userId];ng=G.guess(hs.game,oq,active.userId,rec.answer.text,Date.now());ok(ng.phase==='reveal'&&ng.reveal.reason==='correct','typed correct answer (any case) recognised');await host.setGame(ng);await wait(5);
 ok(b.load().game.reveal.answer===answer,'answer revealed to all after correct');
 let hg=G.advance(G.normalize(host.load().game),Date.now());await host.setGame(hg);await wait(5);
 hg=G.pass(host.load().game,oq,Date.now());hg.clocks[hg.reveal.by]=0;await host.setGame(hg);await wait(5);hg=G.advance(G.normalize(host.load().game),Date.now());await host.setGame(hg);await wait(5);
 ok(host.load().game.phase==='done','online duel done');
 await host.lockQuestion();await host.resolveQuestion();await wait(10);
 const ps=host.load().players.map(p=>p.score).sort((x,y)=>y-x);ok(ps[0]===300&&ps[1]===180,'online: both players scored by placement '+ps);
 ok(a.load().questionResults[oq.id]?.placements?.length===2,'players see final placements');
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
