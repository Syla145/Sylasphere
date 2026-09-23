// Mini-Auswerter für firebase-database.rules.json: führt die echten Regel-Ausdrücke aus.
// Deckt .write (kaskadierend von oben) und .validate (für geänderte, nicht-leere Knoten) ab.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto').webcrypto;const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const RULES=JSON.parse(fs.readFileSync(path.join(root,'firebase-database.rules.json'),'utf8')).rules;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const split=p=>String(p).split('/').filter(Boolean);
function get(tree,parts){return parts.reduce((o,k)=>o==null||typeof o!=='object'?undefined:o[k],tree)}
function strip(v){if(v===null||v===undefined)return undefined;if(typeof v!=='object')return v;const o={};for(const[k,x]of Object.entries(v)){const y=strip(x);if(y!==undefined)o[k]=y}return Object.keys(o).length?o:undefined}
function setIn(tree,parts,value){tree=clone(tree)||{};if(!parts.length)return strip(value)||{};let o=tree;for(let i=0;i<parts.length-1;i++){if(typeof o[parts[i]]!=='object'||o[parts[i]]===null)o[parts[i]]={};o=o[parts[i]]}const v=strip(value);if(v===undefined)delete o[parts.at(-1)];else o[parts.at(-1)]=v;return strip(tree)||{}}
class Snap{constructor(tree,parts){this.t=tree;this.p=parts}_v(){return get(this.t,this.p)}
 child(p){if(p===null||p===undefined)throw new Error('child(null)');return new Snap(this.t,[...this.p,...split(String(p))])}
 parent(){return new Snap(this.t,this.p.slice(0,-1))}
 val(){const v=this._v();return v===undefined?null:clone(v)} exists(){return this._v()!==undefined}
 isString(){return typeof this._v()==='string'} isNumber(){return typeof this._v()==='number'} isBoolean(){return typeof this._v()==='boolean'}
 hasChild(p){return this.child(p).exists()} hasChildren(a){const v=this._v();if(!a)return !!v&&typeof v==='object';return a.every(k=>this.hasChild(k))}}
function evalRule(expr,vars){const names=Object.keys(vars);try{return Boolean(new Function(...names,`return (${expr});`)(...names.map(n=>vars[n])))}catch(e){return false}}
// Liefert für einen Pfad die Regelknoten entlang des Weges plus $-Variablen
function walk(parts){const nodes=[{node:RULES,depth:0,vars:{}}];let cur=RULES,vars={};for(let i=0;i<parts.length;i++){if(!cur)break;const k=parts[i];let next=cur[k];if(next===undefined){const w=Object.keys(cur).find(x=>x.startsWith('$'));if(w){next=cur[w];vars=Object.assign({},vars,{[w]:k})}}cur=next;nodes.push({node:cur,depth:i+1,vars:clone(vars)})}return nodes}
function canWrite(db,uid,writes){ // writes: {path:value} (multi-path update)
 let after=clone(db);for(const[p,v]of Object.entries(writes))after=setIn(after,split(p),v);
 const auth=uid?{uid}:null;const now=Date.now();
 for(const p of Object.keys(writes)){const parts=split(p);const nodes=walk(parts);let allowed=false;
  for(const {node,depth,vars} of nodes){if(!node)break;if(node['.write']!==undefined){const r=node['.write'];const res=typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now,root:new Snap(db,[]),data:new Snap(db,parts.slice(0,depth)),newData:new Snap(after,parts.slice(0,depth))},vars));if(res){allowed=true;break}}}
  if(!allowed)return false;
  // .validate an Pfad + Vorfahren + Nachfahren mit nicht-leeren neuen Daten
  const checkValidate=(parts2)=>{const nodes2=walk(parts2);const last=nodes2[nodes2.length-1];if(!last||!last.node||last.depth!==parts2.length)return true;const r=last.node['.validate'];if(r===undefined)return true;const nd=new Snap(after,parts2);if(!nd.exists())return true;return typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now,root:new Snap(db,[]),data:new Snap(db,parts2),newData:nd},last.vars))};
  for(let d=1;d<=parts.length;d++)if(!checkValidate(parts.slice(0,d)))return false;
  const visit=(val,pp)=>{if(val&&typeof val==='object')for(const[k,x]of Object.entries(val)){const np=[...pp,k];if(!checkValidate(np))throw 0;visit(x,np)}};
  try{visit(strip(writes[p]),parts)}catch(_){return false}
 }
 return true}


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


load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator,Session=ctx.window.SchmobinSession;
const show=V.validate(JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8')));
const song=Q.allQuestions(show.normalized).map(x=>x.question).find(q=>q.id==='show_song');
ok(song&&show.valid,'showtime contains a valid song question');
// ---------- Modul
ok(JSON.stringify(Q.stagesOf(song).map(s=>s.duration))==='[0.1,1,3,10]','default stages 0,1/1/3/10 s');
ok(Q.locksOnSubmit(song)&&Q.needsReview(song)&&Q.publishesAnswers(song)&&Q.revealsMedia(song)&&!Q.hasTimer(song),'song flags');
ok(JSON.stringify(Q.reviewParts(song).map(p=>p.key))==='["title","artist"]','title+artist reviewed separately');
const def=Q.typeDef('song-reveal');
ok(def.mediaClip(song,{kind:'snippet',stage:2}).duration===3&&def.mediaClip(song,{kind:'snippet',stage:2}).offset===song.clipStart,'snippet clip = stage length from clip start');
ok(def.mediaClip(song,{kind:'reveal'}).offset===12&&def.mediaClip(song,{kind:'reveal'}).duration===8,'reveal clip from editor settings');
const pub=Q.publicQuestion(song,false);
ok(!('songTitle' in pub)&&!('artist' in pub)&&!('cover' in pub)&&!('titleAliases' in pub)&&pub.audio,'solution + cover hidden online, audio kept');
const sc=(ans,v)=>Q.scoreAnswer(song,ans,1,{verdicts:{p:v}},'p').points;
ok(sc({title:'x',artist:'y',stage:0},{title:true,artist:true})===200,'stage 1 both right = 100 %');
ok(sc({title:'x',artist:'y',stage:1},{title:true,artist:true})===150,'stage 2 = 75 %');
ok(sc({title:'x',artist:'y',stage:3},{title:true,artist:false})===25,'stage 4 title only = 25 % × ½');
ok(sc({title:'x',artist:'y',stage:0},{title:false,artist:false})===0,'wrong = 0');
const titleOnly=Object.assign({},song,{guessArtist:false});
ok(Q.scoreAnswer(titleOnly,{title:'x',stage:2},2,{verdicts:{p:true}},'p').points===200,'title-only mode: 50 % × multiplier 2');
ok(Q.autoCheck(song,{title:' sylasphere theme ',artist:'demo band'},'title')===true&&Q.autoCheck(song,{artist:'Demo Band'},'artist')===true,'auto suggestions incl. aliases');
ok(Q.autoCheck(song,{title:'Sylasfere'},'title')===null,'typos left for moderator');
const warnQ=V.validate({quiz:{title:'w',rounds:[{questions:[Object.assign({},song,{id:'w1',audio:'./assets/sylasphere-theme.mp3'})]}]}});
ok(warnQ.warnings.some(w=>/Dateiname/.test(w.message)),'warns when file name reveals solution');
// ---------- Lokal
const lq={quiz:{title:'S',rounds:[{pointsMultiplier:1,questions:[song]}]}};
const e=Session.create(lq);const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐼'),c=e.joinPlayer('Cem','🐸');e.startGame();e.startQuestion();
e.playStage();let st=e.load();ok(st.media&&st.media.kind==='snippet'&&st.media.stage===0,'local: play stage 1 command');
const n1=st.media.nonce;e.playStage();ok(e.load().media.nonce!==n1,'local: replay gives new command');
ok(e.submitAnswer(a,{title:'Sylasphere Theme',artist:'Demo-Band',stage:3})===true,'local: answer in stage 1');
ok(e.load().answers[song.id][a].answer.stage===0,'local: stage stamped by engine (client value ignored)');
ok(e.submitAnswer(a,{title:'changed',stage:0})===false,'local: answer locked after submit');
e.advanceStage();ok(e.load().stage===1&&e.load().media.stage===1,'local: advance to stage 2 + play');
e.submitAnswer(b,{title:'Sylasfere Theme',artist:'Demo Band'});
e.advanceStage();e.advanceStage();e.advanceStage();ok(e.load().stage===3,'local: stage capped at last');
e.submitAnswer(c,{title:'Falsch',artist:'Demo-Band'});
e.lockQuestion();
e.resolveQuestion({verdicts:{[a]:{title:true,artist:true},[b]:{title:true,artist:true},[c]:{title:false,artist:true}}});
st=e.load();const pts=id=>st.players.find(p=>p.id===id).score;
ok(pts(a)===200&&pts(b)===150&&pts(c)===25,`local: points by stage + parts (${pts(a)},${pts(b)},${pts(c)})`);
ok(st.media.kind==='reveal','local: reveal clip triggered on resolve');
ok(st.questionResults[song.id].entries.length===3&&/Stufe 2/.test(st.questionResults[song.id].entries.find(x=>x.name==='Ben').answer),'local: all answers with stage published');
// ---------- Firebase-Regeln (Anti-Schummeln)
const HOST='host_uid_1234567890',P1='p1_uid_1234567890';
let db=setIn({},split('config/moderatorKeys/Geheim-2026'),true);
db=setIn(db,split(`moderatorGrants/${HOST}`),'Geheim-2026');
db=setIn(db,split('rooms/R1/meta'),{ownerUid:HOST,createdAt:1,quizTitle:'T',schemaVersion:1});
db=setIn(db,split('rooms/R1/public'),{questionOpen:true,currentQuestionId:'s1',currentQuestion:{type:'song-reveal'},stage:1,answerLock:true});
ok(canWrite(db,P1,{[`rooms/R1/answers/${P1}/s1`]:{answer:{title:'x',stage:1},submittedAt:1}}),'rules: answer with current stage accepted');
ok(!canWrite(db,P1,{[`rooms/R1/answers/${P1}/s1`]:{answer:{title:'x',stage:0},submittedAt:1}}),'rules: faking an earlier stage rejected');
const answered=setIn(db,split(`rooms/R1/answers/${P1}/s1`),{answer:{title:'x',stage:1},submittedAt:1});
ok(!canWrite(answered,P1,{[`rooms/R1/answers/${P1}/s1`]:{answer:{title:'y',stage:1},submittedAt:2}}),'rules: changing a locked answer rejected');
ok(canWrite(answered,HOST,{[`rooms/R1/answers/${P1}/s1/awardedPoints`]:150}),'rules: moderator can still score');
const normal=setIn(db,split('rooms/R1/public/answerLock'),false);
const normalAnswered=setIn(normal,split(`rooms/R1/answers/${P1}/s1`),{answer:'a',submittedAt:1});
ok(canWrite(normalAnswered,P1,{[`rooms/R1/answers/${P1}/s1`]:{answer:'b',submittedAt:2}}),'rules: normal questions still allow changing answers');
ok(!canWrite(db,P1,{'rooms/R1/public/stage':0}),'rules: players cannot change the stage');
// ---------- Online
(async()=>{
 try{
 const host=await Online.create(lq); await host.waitForState(); const code=host.code;
 const p1=new Online(code,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${code}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(code,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${code}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');const tick=()=>new Promise(r=>setTimeout(r,5));await tick();
 await host.startGame();await tick();await host.startQuestion();await tick();
 ok(getAt(data,`rooms/${code}/public/answerLock`)===true&&getAt(data,`rooms/${code}/public/stage`)===0,'online: lock + stage published');
 await host.playStage();await tick();
 ok(p1.load().media&&p1.load().media.kind==='snippet'&&p1.load().media.stage===0,'online: players receive play command');
 ok(await p1.submitAnswer(p1.userId,{title:'Sylasphere Theme',artist:'Demo-Band'})===true,'online: answer in stage 1');await tick();
 ok(await p1.submitAnswer(p1.userId,{title:'x',artist:'y'})===false,'online: second answer blocked by client');
 await host.advanceStage();await tick();await host.advanceStage();await tick();
 ok(p2.load().stage===2,'online: player sees stage 3');
 await p2.submitAnswer(p2.userId,{title:'Sylasphere Theme',artist:'falsch'});await tick();
 ok(getAt(data,`rooms/${code}/answers/${p2.userId}/${song.id}`).answer.stage===2,'online: stage stamped from public state');
 await host.lockQuestion();await tick();
 await host.resolveQuestion({verdicts:{[p1.userId]:{title:true,artist:true},[p2.userId]:{title:true,artist:false}}});await tick();
 const s=host.load();
 ok(s.players.find(p=>p.id===p1.userId).score===200&&s.players.find(p=>p.id===p2.userId).score===50,'online: 200 (stage 1) and 50 (stage 3, title only)');
 await tick();
 ok(p2.load().media.kind==='reveal','online: reveal plays on all devices');
 const res=p2.load().questionResults[song.id];ok(res&&res.entries.length===2,'online: players see all answers');
 ok(p2.load().currentPublicQuestion.cover==='./assets/demo-cover.svg','online: cover available after reveal');
 ok(violations.length===0,'online: no rule violations');
 }catch(err){fail++;console.error('FAIL',err.stack)}
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})();
