// v37: Hinweis-Kaskade + Bild-Enthüllung – Stufen, Einloggen, Punkte, ≈-Prüfung, Spick-Schutz (lokal + online + Regeln)
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
load('js/views/moderator-flow.js');
const Flow=ctx.window.SylasphereModeratorFlow, Geo=ctx.window.SylasphereImageReveal, Kit=ctx.window.SylasphereTypeKit;
const show=V.validate(JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8')));
ok(show.valid,'Showtime mit den neuen Demo-Fragen ist gültig '+JSON.stringify(show.errors.slice(0,2)));
const all=Q.allQuestions(show.normalized).map(x=>x.question);
const clue=all.find(q=>q.id==='show_clue_einstein'), tokio=all.find(q=>q.id==='show_clue_tokio'), flag=all.find(q=>q.id==='show_reveal_flag'), zoom=all.find(q=>q.id==='show_reveal_zoom');
ok(clue&&tokio&&flag&&zoom&&all.filter(q=>q.type==='clue-cascade').length===2&&all.filter(q=>q.type==='image-reveal').length===2,'je 2 Demo-Fragen im Showtime-Quiz');
// ---------- Modul
ok(JSON.stringify(Q.stagesOf(clue).map(s=>s.percent))==='[100,80,60,40]'&&Q.stagesOf(tokio).length===5,'Stufen = Hinweise, Standard 100/80/60/40/20 %');
ok(Q.locksOnSubmit(clue)&&Q.needsReview(clue)&&!Q.hasTimer(clue)&&Q.typeDef('clue-cascade').stageFlow==='step','Einloggen gesperrt, Prüfliste, ohne Timer, Nächster Schritt = Stufe');
ok(Q.BOARD_TYPES.includes('clue-cascade')&&Q.BOARD_TYPES.includes('image-reveal'),'im Brett und Einsatz-Finale erlaubt');
ok(Q.autoCheck(tokio,{text:'tokyo',stage:0})===true&&Q.autoCheck(tokio,{text:'Tokjo',stage:0})==='fuzzy'&&Q.autoCheck(tokio,{text:'Osaka',stage:0})===false,'Prüfliste: Variante ✓, Tippfehler ≈, falsch ✗');
ok(Q.autoCheck(clue,{text:'einstein'})===true,'Teil der Lösung (Nachname) zählt als Treffer');
const sc=(q,a,v)=>Q.scoreAnswer(q,a,1,v===undefined?null:{verdicts:{p:v}},'p').points;
ok(sc(tokio,{text:'Tokio',stage:0})===100&&sc(tokio,{text:'Tokio',stage:2})===60&&sc(tokio,{text:'Tokjo',stage:4})===20,'Punkte nach Stufe, ≈ zählt als richtig');
ok(sc(tokio,{text:'Osaka',stage:0})===0&&sc(tokio,{text:'Tokio',stage:0},false)===0&&sc(tokio,{text:'Osaka',stage:1},true)===80,'falsch = 0, Moderator kann umdrehen');
ok(Q.scoreAnswer(tokio,null,1).points===0&&Q.scoreAnswer(tokio,{text:'  '},1).points===0,'nicht eingeloggt = 0');
ok(Q.judge(flag,{text:'indien',stage:4})===true&&Q.judge(flag,{text:'pakistan',stage:0})===false,'Brett/Finale: richtig/falsch unabhängig von der Stufe');
ok(Q.answerLabel(clue,{text:'Einstein',stage:2})==='Einstein · Stufe 3','Antwort mit Stufe');
// ---------- Spick-Schutz
const pubClue=Q.publicQuestion(clue,false), pubImg=Q.publicQuestion(flag,false);
ok(!('clues' in pubClue)&&!('solution' in pubClue)&&!('aliases' in pubClue)&&pubClue.clueCount===4&&pubClue.percents.length===4,'online: Hinweise + Lösung nicht in der Frage für Spieler');
ok(!('image' in pubImg)&&!('zoomX' in pubImg)&&!('solution' in pubImg)&&pubImg.mode==='pixel'&&pubImg.percents.length===5,'online: Bildadresse + Lösung nicht in der Frage für Spieler');
const pubNorm=Q.clone(pubClue);Q.typeDef('clue-cascade').normalize(pubNorm);ok(Q.stagesOf(pubNorm).length===4,'Spielergerät kennt trotzdem die Stufen-Anzahl');
const sr=Q.typeDef('clue-cascade').stageReveal(clue,1);ok(sr.qid===clue.id&&sr.stage===1&&sr.clues.length===2&&sr.clues[1].text===clue.clues[1].text,'stageReveal: nur die bis jetzt aufgedeckten Hinweise');
// ---------- Bild-Geometrie
ok(Geo.pixelBlocks(0,5)===6&&Geo.pixelBlocks(4,5)===64&&Geo.pixelBlocks(2,5)>Geo.pixelBlocks(1,5),'Verpixelt: 6 → 64 Blöcke, wird schärfer');
const z0=Geo.zoomRect(zoom,0,5),z4=Geo.zoomRect(zoom,4,5);ok(Math.abs(z0.w-1/zoom.zoomMax)<1e-9&&z4.w===1&&z4.x===0&&z0.x>=0&&z0.y>=0&&z0.x+z0.w<=1,'Zoom: starker Ausschnitt um den Startpunkt → ganzes Bild');
const t=[0,1,2,3,4].map(i=>Geo.openTiles(flag,i,5));ok(t[0].size===4&&t[4].size===20&&[...t[1]].every(k=>t[2].has(k))&&JSON.stringify([...Geo.openTiles(flag,2,5)])===JSON.stringify([...t[2]]),'Kacheln: pro Stufe mehr offen, feste Reihenfolge');
// ---------- Validierung
const vq=q=>V.validate({quiz:{title:'t',rounds:[{questions:[Object.assign({id:'v1',category:'x',points:100},q)]}]}});
ok(vq({type:'clue-cascade',text:'x',clues:[{text:'a'},{text:'b'}],solution:'x'}).errors.some(e=>/Mindestens 3 Hinweise/.test(e.message)),'mind. 3 Hinweise');
ok(vq({type:'clue-cascade',text:'x',clues:['a','b','c'],solution:''}).errors.some(e=>/Lösung fehlt/.test(e.message)),'Lösung Pflicht');
ok(vq({type:'image-reveal',text:'x',image:'',solution:'x'}).errors.some(e=>/benötigt ein Bild/.test(e.message)),'Bild Pflicht');
ok(vq({type:'image-reveal',text:'x',image:'https://example.com/a.jpg',solution:'x'}).warnings.length>0,'Warnung bei fremden Bildadressen (Zeichnen evtl. gesperrt)');
// ---------- Ablauf „Nächster Schritt“
const facts={status:'playing',players:3,hasQuestion:true,started:true,open:true,resolved:false,isFirst:false,isLast:false,stageStep:true,stage:0,stageLast:3,paused:false};
ok(Flow.next(facts).key==='stage'&&/2\/4/.test(Flow.next(facts).label),'Leertaste = nächste Stufe');
ok(Flow.next(Object.assign({},facts,{stage:3})).key==='close','nach der letzten Stufe: Einloggen beenden');
ok(Flow.next(Object.assign({},facts,{paused:true})).disabled===true,'Pause: Stufe weiter gesperrt');
ok(Flow.next(Object.assign({},facts,{stageStep:false})).key==='close','andere Spielmodi unverändert');
// ---------- Lokal
const lq={quiz:{title:'S',rounds:[{pointsMultiplier:1,questions:[tokio]}]}};
const e=Session.create(lq);const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐼'),c=e.joinPlayer('Cem','🐸');e.startGame();e.startQuestion();
e.setStageReveal(Q.typeDef('clue-cascade').stageReveal(tokio,0));ok(e.load().stageReveal.clues.length===1,'lokal: Stufe 1 veröffentlicht');
ok(e.submitAnswer(a,{text:'Tokyo',stage:4})===true&&e.load().answers[tokio.id][a].answer.stage===0,'lokal: Einloggen bei Stufe 1 (Stufe stempelt die Engine)');
ok(e.submitAnswer(a,{text:'Osaka'})===false,'lokal: eingeloggt ist fest');
e.advanceStage();e.advanceStage();ok(e.load().stage===2,'lokal: Stufe 3');
e.submitAnswer(b,{text:'Tokjo'});
e.setStage(1);ok(e.load().stage===1,'lokal: Rückgängig setzt Stufe zurück');e.advanceStage();e.advanceStage();e.advanceStage();e.advanceStage();ok(e.load().stage===4,'lokal: höchstens letzte Stufe');
e.lockQuestion();e.resolveQuestion({verdicts:{[a]:true,[b]:true}});
let st=e.load();const pts=id=>st.players.find(p=>p.id===id).score;
ok(pts(a)===100&&pts(b)===60&&pts(c)===0,`lokal: 100 / 60 / 0 (nicht eingeloggt) (${pts(a)},${pts(b)},${pts(c)})`);
const entry=st.questionResults[tokio.id].entries.find(x=>x.name==='Ben');ok(entry&&entry.mark&&entry.mark.s===2&&entry.mark.f===1,'Auflösung: Stufe + ≈ für die Anzeige');
e.move(1);ok(e.load().stageReveal==null,'lokal: stageReveal wird beim Fragenwechsel geleert');
// ---------- Firebase-Regeln: unverändert, Stufe wird geprüft
const HOST='host_uid_1234567890',P1='p1_uid_1234567890';
let db=setIn({},split('rooms/R1/meta'),{ownerUid:HOST,createdAt:1,quizTitle:'T',schemaVersion:1});
db=setIn(db,split('rooms/R1/public'),{questionOpen:true,currentQuestionId:'c1',currentQuestion:{type:'clue-cascade'},stage:2,answerLock:true});
ok(canWrite(db,P1,{[`rooms/R1/answers/${P1}/c1`]:{answer:{text:'x',stage:2},submittedAt:1}})&&!canWrite(db,P1,{[`rooms/R1/answers/${P1}/c1`]:{answer:{text:'x',stage:0},submittedAt:1}}),'Regeln: nur aktuelle Stufe, keine frühere');
ok(canWrite(db,HOST,{'rooms/R1/public/stageReveal':{qid:'c1',stage:2,clues:[{text:'a'}]}})&&!canWrite(db,P1,{'rooms/R1/public/stageReveal':{qid:'c1',stage:4}}),'Regeln: stageReveal schreibt nur der Moderator');
// ---------- Online
(async()=>{
 try{
 const oq={quiz:{title:'S',rounds:[{pointsMultiplier:1,questions:[clue]}]}};
 const host=await Online.create(oq); await host.waitForState(); const code=host.code;
 const p1=new Online(code,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${code}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(code,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${code}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');const tick=()=>new Promise(r=>setTimeout(r,5));await tick();
 await host.startGame();await tick();await host.startQuestion();await tick();
 const pubQ=getAt(data,`rooms/${code}/public/currentQuestion`);
 ok(pubQ&&!pubQ.clues&&!pubQ.solution&&JSON.stringify(Object.assign({},getAt(data,`rooms/${code}`),{host:null})).indexOf('Patentamt')<0,'online: kein Hinweis-Text im Raum vor der Freigabe');
 await host.setStageReveal(Q.typeDef('clue-cascade').stageReveal(clue,0));await tick();
 ok(p1.load().stageReveal&&p1.load().stageReveal.clues.length===1&&JSON.stringify(Object.assign({},getAt(data,`rooms/${code}`),{host:null})).indexOf('Patentamt')<0,'online: Spieler sehen nur Hinweis 1');
 ok(await p1.submitAnswer(p1.userId,{text:'Einstein'})===true,'online: Einloggen bei Stufe 1');await tick();
 await host.advanceStage();await tick();await host.setStageReveal(Q.typeDef('clue-cascade').stageReveal(clue,1));await tick();
 ok(p2.load().stage===1&&p2.load().stageReveal.clues.length===2,'online: Stufe 2 mit zwei Hinweisen');
 await p2.submitAnswer(p2.userId,{text:'Newton'});await tick();
 ok(getAt(data,`rooms/${code}/answers/${p2.userId}/${clue.id}`).answer.stage===1,'online: Stufe aus dem öffentlichen Stand gestempelt');
 await host.setStage(0);await tick();ok(host.load().stage===0,'online: Rückgängig setzt Stufe zurück');
 await host.lockQuestion();await tick();
 await host.resolveQuestion({verdicts:{[p1.userId]:true,[p2.userId]:false}});await tick();
 const s=host.load();
 ok(s.players.find(p=>p.id===p1.userId).score===100&&s.players.find(p=>p.id===p2.userId).score===0,'online: 100 (Stufe 1) und 0 (falsch)');
 ok(p2.load().currentPublicQuestion.clues.length===4&&p2.load().currentPublicQuestion.solution==='Albert Einstein','online: nach der Auflösung alle Hinweise + Lösung');
 ok(violations.length===0,'online: keine Regelverstöße');
 }catch(err){fail++;console.error('FAIL',err.stack)}
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})();
