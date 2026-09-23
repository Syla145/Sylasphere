const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..'); let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
function getAt(rootObj,pathStr){return pathStr.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],rootObj)}
function stripNulls(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(stripNulls);const o={};for(const[k,x]of Object.entries(v)){const y=stripNulls(x);if(y!==null&&y!==undefined&&!(typeof y==='object'&&!Array.isArray(y)&&!Object.keys(y).length))o[k]=y}return o}
const violations=[];
function setAt(rootObj,pathStr,value){value=stripNulls(value);const parts=pathStr.split('/').filter(Boolean); let o=rootObj; for(let i=0;i<parts.length-1;i++)o=o[parts[i]]??={}; const k=parts.at(-1); if(value===null||value===undefined) delete o[k]; else o[k]=JSON.parse(JSON.stringify(value));}
function snap(v){return{exists:()=>v!==undefined&&v!==null,val:()=>v===undefined?null:JSON.parse(JSON.stringify(v))}}
const data={}; const listeners=[];
function notify(changed){for(const l of listeners){if(changed===l.path||changed.startsWith(l.path+'/')||l.path.startsWith(changed+'/')) queueMicrotask(()=>l.cb(snap(getAt(data,l.path))))}}
const dbm={
 ref:(db,p='')=>({db,path:p.replace(/^\/+|\/+$/g,'')}),
 get:async r=>snap(getAt(data,r.path)),
 set:async(r,v)=>{setAt(data,r.path,v);notify(r.path)},
 remove:async r=>{setAt(data,r.path,null);notify(r.path)},
 update:async(r,patch)=>{const keys=Object.keys(patch).map(k=>[r.path,k].filter(Boolean).join('/'));for(const a of keys)for(const b of keys)if(a!==b&&b.startsWith(a+'/'))throw new Error('update failed: values argument contains a path '+a+' that is ancestor of another path '+b);
  for(const k of keys){const m=k.match(/^rooms\/[^/]+\/buzzerBlocked\/[^/]+$/);if(m)violations.push('moderator deletes whole '+k+' (PERMISSION_DENIED with v10 rules)')}
  for(const [k,v] of Object.entries(patch)){const p=[r.path,k].filter(Boolean).join('/');const m=p.match(/^rooms\/[^/]+\/answers\/([^/]+)\/([^/]+)$/);if(m&&v!==null&&r.writer!=='host'){const rec=stripNulls(v);if(!('answer' in rec)||!('submittedAt' in rec))throw new Error('PERMISSION_DENIED: answer record needs answer+submittedAt at '+p)}}
  for(const [k,v] of Object.entries(patch)){const p=[r.path,k].filter(Boolean).join('/');setAt(data,p,v);notify(p)}},
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
load('js/core/app.js');load('js/core/topics.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8'));


const Q=ctx.window.SchmobinQuiz,T=ctx.window.SylasphereTopics;
load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const V=ctx.window.SchmobinValidator,Session=ctx.window.SchmobinSession;
// ---------- Themenbibliothek
ok(T.resolve('Geschichte').icon==='🏛️'&&T.resolve('Geschichte').source==='library','library topic resolves');
ok(T.resolve('Musik & Sounds').icon==='🎵','alias maps to library topic');
ok(T.resolve('  geschichte ').icon==='🏛️','lookup ignores case/whitespace');
const auto=T.resolve('Brettspiele');ok(auto.source==='auto'&&auto.icon===T.FALLBACK_ICON&&auto.hue===T.resolve('Brettspiele').hue,'unknown topic gets stable auto look');
const custom=[{name:'Brettspiele',icon:'🎲',color:'#ff0000'},{name:'Geschichte',icon:'📜'}];
ok(T.resolve('Brettspiele',custom).icon==='🎲'&&T.resolve('Brettspiele',custom).hue===0,'custom topic icon + color');
ok(T.resolve('Geschichte',custom).icon==='📜','custom override beats library');
ok(T.hexToHue(T.hueToHex(210))>=205&&T.hexToHue(T.hueToHex(210))<=215,'hue <-> hex roundtrip');
const nq=Q.normalizeQuiz({quiz:{title:'t',categories:['Sport',{name:'Sport'},{title:'Brettspiele',icon:'🎲',color:'zzz'},''],rounds:[]}});
ok(JSON.stringify(nq.quiz.categories)===JSON.stringify([{name:'Sport'},{name:'Brettspiele',icon:'🎲'}]),'categories normalized, deduped, invalid color dropped: '+JSON.stringify(nq.quiz.categories));
ok(Q.topic('Sport').icon==='⚽','Quiz.topic uses library');
// ---------- Neue Typen: Wertung
const show=V.validate(JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8')));ok(show.valid,'showtime quiz with new formats is valid');
const byId=Object.fromEntries(Q.allQuestions(show.normalized).map(x=>[x.question.id,x.question]));
const tf=byId.show_tf,gap=byId.show_gap,mt=byId.show_match;
ok(Q.scoreAnswer(tf,'false',1).points===100&&Q.scoreAnswer(tf,'true',1).points===0,'true-false scoring');
ok(Q.scoreAnswer(tf,'falsch',1).points===100,'true-false accepts german words');
ok(Q.scoreAnswer(mt,mt.pairs.map(p=>p.right),1).points===200,'matching all correct');
ok(Q.scoreAnswer(mt,['Ottawa','Canberra','',''],1).points===100,'matching partial credit');
ok(Q.scoreAnswer(mt,['ottawa ','CANBERRA','Brasília','Bern'],2).points===400,'matching tolerant + multiplier');
const pubM=Q.publicQuestion(mt,false);ok(!('pairs' in pubM)&&pubM.lefts.length===4&&pubM.rights.length===4,'matching pairs hidden online');
ok(JSON.stringify(pubM.rights)===JSON.stringify(Q.publicQuestion(mt,false).rights),'matching shuffle stable across calls');
ok(JSON.stringify(pubM.rights.slice().sort())===JSON.stringify(mt.pairs.map(p=>p.right).sort()),'matching rights complete');
ok(Q.needsReview(gap)&&Q.publishesAnswers(gap),'gap-text needs moderator review');
ok(Q.autoCheck(gap,' palindrom ')===true&&Q.autoCheck(gap,'Palindromm')===null,'gap-text suggests exact matches only');
ok(!('correctAnswers' in Q.publicQuestion(gap,false)),'gap-text solution hidden online');
// ---------- Lückentext lokal: Moderator entscheidet
const gq={quiz:{title:'G',rounds:[{pointsMultiplier:1,questions:[gap]}]}};
const e=Session.create(gq);const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐼'),c=e.joinPlayer('Cem','🐸');e.startGame();e.startQuestion();
e.submitAnswer(a,'Palindrom');e.submitAnswer(b,'Palindrohm');e.submitAnswer(c,'Anagramm');e.lockQuestion();
e.resolveQuestion({verdicts:{[a]:true,[b]:true,[c]:false}});
let st=e.load();const sc=id=>st.players.find(p=>p.id===id).score;
ok(sc(a)===150&&sc(b)===150&&sc(c)===0,'local: moderator verdicts decide points (typo accepted)');
const entries=st.questionResults[gap.id].entries;
ok(entries.length===3&&entries.find(x=>x.name==='Ben').answer==='Palindrohm'&&entries.find(x=>x.name==='Cem').correct===false,'local: all answers published after reveal');
// ---------- Lückentext online
(async()=>{
 try{
 const host=await Online.create(gq); await host.waitForState(); const code=host.code;
 const p1=new Online(code,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${code}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(code,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${code}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');const tick=()=>new Promise(r=>setTimeout(r,5));await tick();
 await host.startGame();await tick();await host.startQuestion();await tick();
 ok(!('correctAnswers' in (getAt(data,`rooms/${code}/public/currentQuestion`)||{})),'online: solution not in public question');
 await p1.submitAnswer(p1.userId,'palindrom');await p2.submitAnswer(p2.userId,'Palindromm');await tick();
 await host.lockQuestion();await tick();
 await host.resolveQuestion({verdicts:{[p1.userId]:true,[p2.userId]:false}});await tick();
 const s=host.load();
 ok(s.players.find(p=>p.id===p1.userId).score===150&&s.players.find(p=>p.id===p2.userId).score===0,'online: verdicts decide points');
 await tick();const seen=p2.load().questionResults[gap.id];
 ok(seen&&seen.entries&&seen.entries.length===2&&seen.entries.some(x=>x.answer==='palindrom'&&x.correct),'online: other players see all answers after reveal');
 ok(violations.length===0,'online: no rule violations');
 }catch(err){fail++;console.error('FAIL',err.message)}
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})();
