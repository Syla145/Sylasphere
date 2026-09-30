// v34: Show-Formate in beiden Engines (Brett-Wertung, Sprünge, Auswahl, geheime Einsätze) + Firebase-Regeln ohne Änderung
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..'); let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
function getAt(rootObj,pathStr){return pathStr.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],rootObj)}
function setAt(rootObj,pathStr,value){const parts=pathStr.split('/').filter(Boolean); let o=rootObj; for(let i=0;i<parts.length-1;i++)o=o[parts[i]]??={}; const k=parts.at(-1); const v=fbStrip(value==null?undefined:JSON.parse(JSON.stringify(value))); if(v===undefined) delete o[k]; else o[k]=v;}
// wie Firebase: null, leere Objekte und leere Listen werden nicht gespeichert
function fbStrip(v){if(v===null||v===undefined)return undefined;if(typeof v!=='object')return v;const o={};for(const [k,x] of Object.entries(v)){const y=fbStrip(x);if(y!==undefined)o[k]=y}if(!Object.keys(o).length)return undefined;return Array.isArray(v)&&Object.keys(o).every((k,i)=>String(i)===k)?Object.values(o):o}
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
base.BroadcastChannel=class{constructor(){}postMessage(){}close(){}addEventListener(){}};base.matchMedia=()=>({matches:false,addEventListener(){}});
base.document.documentElement={setAttribute(){},removeAttribute(){},classList:{add(){}}};base.document.querySelector=()=>null;
const ctx=vm.createContext(base); const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');load('js/core/session-engine.js');load('js/core/show-formats.js');load('js/core/highlights.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(code('data/quiz-show-abend.json'));
const Local=ctx.window.SchmobinSession, S=ctx.window.SylasphereShow, Q=ctx.window.SchmobinQuiz, H=ctx.window.SylasphereHighlights;
const {canWrite,canRead}=require('./lib/rules-eval.js');
const tick=(ms=10)=>new Promise(r=>setTimeout(r,ms));
const V=ctx.window.SchmobinValidator;
// ---------- Demo-Quiz ----------
{load('js/core/quiz-validator.js');const v=ctx.window.SchmobinValidator.validate(quiz);const R=v.normalized.quiz.rounds[1];
 ok(v.valid&&!v.errors.length,'Demo „Show-Abend“ ist gültig');
 ok(R.format==='board'&&R.questions.length===15&&R.board.doubles===1&&Q.isFinalWager(v.normalized,2,0),'Demo: Brett 5×3 mit Doppel-Feld + Einsatz-Finale');
 ok(JSON.parse(code('data/quiz-list.json')).some(x=>x.file==='quiz-show-abend.json'),'Demo in der Quiz-Liste');}
// ---------- Lokal ----------
{const e=Local.create(quiz);const ids=['Anna','Ben','Cleo'].map((n,i)=>e.joinPlayer(n,'🦊🐼🐸'.split('')[i]||'🦊'));
 e.startGame();const R=e.load().quiz.quiz.rounds[1];
 let show=S.startBoard(R,1,ids,{rand:()=>0});e.setShow(show);ok(e.load().show.kind==='board'&&e.load().show.active===ids[0],'lokal: Brett-Zustand gespeichert');
 e.setPick(ids[0],{key:S.pickKey(show),qid:R.questions[0].id});ok(e.load().players.find(p=>p.id===ids[0]).pick.qid===R.questions[0].id,'lokal: Spieler wählt Feld');
 show=S.pick(show,R,ids[0],R.questions[0].id);e.setShow(show);e.goTo(1,0);
 ok(e.load().currentRoundIndex===1&&e.load().currentQuestionIndex===0&&e.load().roundSummaries.some(x=>x.roundId==='round_warmup'),'lokal: Sprung ins Feld (Rundenstand gesichert)');
 e.startQuestion();const q=R.questions[0];e.submitAnswer(ids[0],q.correctAnswer);e.submitAnswer(ids[1],q.correctAnswer);e.lockQuestion();
 const st=e.load();const sc=S.scoreCell(show,R,st.players,st.answers[q.id]||{},(pid,ans)=>Q.judge(q,ans,{playerId:pid}));
 e.resolveQuestion({override:sc.scores,extraResult:sc.result});const after=e.load();
 ok(after.players.find(p=>p.id===ids[0]).score===100&&after.players.find(p=>p.id===ids[1]).score===0,'lokal: nur der Aktive bekommt den Feldwert');
 ok(after.questionResults[q.id].board.alsoRight.includes(ids[1])&&/^Mitgeraten/.test(after.answers[q.id][ids[1]].scoreDetail||''),'lokal: „Hätten es auch gewusst“ + Mitgeraten markiert');
 const cards=H.compute(after);ok(cards.some(c=>c.title==='Brett-König'&&c.ids[0]===ids[0])&&!cards.some(c=>c.title==='Treffsicher'&&c.ids.includes(ids[1])),'lokal: Highlights – Brett-König, Mitraten zählt nicht');
 // Finale
 const fq=after.quiz.quiz.rounds[2].questions[0];e.goTo(2,0);const wid=S.wagerId(fq.id);e.openWager(wid);
 e.submitWager(ids[0],wid,80);e.submitWager(ids[1],wid,40);const stakes=S.collectStakes(e.load().players,e.load().answers[wid]);
 ok(stakes[ids[0]]===80&&stakes[ids[1]]===40&&stakes[ids[2]]===0,'lokal: geheime Einsätze');
 e.startQuestion();e.submitAnswer(ids[0],fq.correctAnswer);e.submitAnswer(ids[1],1000);e.lockQuestion();const s2=e.load();
 const fin=S.scoreFinal(s2.players,s2.answers[fq.id],stakes,(pid,ans)=>Q.judge(fq,ans,{playerId:pid}));
 e.resolveQuestion({override:fin.scores,extraResult:{final:fin.rows}});const s3=e.load();
 ok(s3.players.find(p=>p.id===ids[0]).score===180&&s3.players.find(p=>p.id===ids[1]).score===-40,'lokal: Finale +/− Einsatz');
 ok(H.compute(s3).some(c=>c.title==='Alles auf eine Karte'&&c.ids[0]===ids[0]),'lokal: Highlight „Alles auf eine Karte“');
 e.goTo(3,0);ok(e.load().status==='finished','lokal: nach der letzten Runde ist Schluss');
 e.restart();ok(!e.load().show&&e.load().players.every(p=>!p.pick),'lokal: Neustart setzt Brett und Auswahl zurück');}
// ---------- Online ----------
(async()=>{
 const host=await Online.create(quiz);await host.waitForState();const c=host.code;
 const p1=new Online(c,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${c}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(c,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${c}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');await tick();
 await host.startGame();await tick();const R=host.raw.hostQuiz.quiz.rounds[1];const ids=host.load().players.map(p=>p.id);
 let show=S.startBoard(R,1,ids,{rand:()=>0});await host.setShow(show);await tick();
 ok(p1.load().show?.active===ids[0],'online: Spieler sehen das Brett');
 const pickPatch={[`rooms/${c}/profiles/${p1.userId}/pick`]:{key:S.pickKey(show),qid:R.questions[4].id},[`rooms/${c}/profiles/${p1.userId}/updatedAt`]:Date.now()};
 ok(canWrite(data,p1.userId,pickPatch)&&!canWrite(data,p2.userId,pickPatch),'Regeln (unverändert): Auswahl nur im eigenen Profil');
 ok(canWrite(data,host.userId,{[`rooms/${c}/public/show`]:show})&&!canWrite(data,p1.userId,{[`rooms/${c}/public/show`]:show}),'Regeln: Brett nur vom Moderator');
 await p1.setPick(p1.userId,{key:S.pickKey(show),qid:R.questions[4].id});await tick();
 ok(host.load().players.find(p=>p.id===p1.userId).pick?.qid===R.questions[4].id&&!(await p2.setPick(p1.userId,{qid:'x'})),'online: Auswahl kommt beim Moderator an, nur für sich selbst');
 show=S.pick(show,R,ids[0],R.questions[4].id);await host.setShow(show);await host.goTo(1,4);await tick();
 ok(p1.load().currentRoundIndex===1&&p1.load().currentQuestionIndex===4,'online: Sprung ins gewählte Feld');
 await host.startQuestion();await tick();const q=R.questions[4];
 await p1.submitAnswer(p1.userId,q.correctAnswer);await p2.submitAnswer(p2.userId,q.correctAnswer);await tick();await host.lockQuestion();await tick();
 const st=host.load();const sc=S.scoreCell(show,R,st.players,st.answers[q.id]||{},(pid,ans)=>Q.judge(q,ans,{playerId:pid}));
 await host.resolveQuestion({override:sc.scores,extraResult:sc.result});await tick(20);
 const a1=host.load().players.find(p=>p.id===ids[0]).score,a2=host.load().players.find(p=>p.id===ids[1]).score;
 ok(a1===300&&a2===0,'online: Feldwert nur für den Aktiven ('+a1+'/'+a2+')');
 ok((p2.load().questionResult?.board||p2.load().questionResults?.[q.id]?.board)?.alsoRight?.includes(ids[1]),'online: „Hätten es auch gewusst“ öffentlich');
 // Finale: geheime Einsätze
 const fq=host.raw.hostQuiz.quiz.rounds[2].questions[0];await host.goTo(2,0);const wid=S.wagerId(fq.id);await host.openWager(wid);await tick();
 const wagerPatch={[`rooms/${c}/answers/${p1.userId}/${wid}`]:{answer:{stake:200},submittedAt:Date.now()},[`rooms/${c}/profiles/${p1.userId}/lastAnsweredQuestionId`]:wid,[`rooms/${c}/profiles/${p1.userId}/updatedAt`]:Date.now()};
 ok(canWrite(data,p1.userId,wagerPatch),'Regeln (unverändert): Einsatz als private Antwort erlaubt');
 ok(!canRead(data,p2.userId,`rooms/${c}/answers/${p1.userId}/${wid}`)&&canRead(data,host.userId,`rooms/${c}/answers/${p1.userId}/${wid}`),'Regeln: Einsatz sehen nur Spieler selbst + Moderator');
 await p1.submitWager(p1.userId,wid,200);await tick();
 ok(host.load().answers?.[wid]?.[p1.userId]?.answer?.stake===200,'online: Einsatz kommt beim Moderator an');
 await host.closeWager(fq.id);await tick();ok(!canWrite(data,p1.userId,wagerPatch),'Regeln: nach dem Einsammeln kein Einsatz mehr');
 const stakes=S.collectStakes(host.load().players,host.load().answers[wid]);ok(stakes[p1.userId]===200,'online: Einsatz begrenzt auf eigene Punkte');
 const pre=host.scoreSnapshot();
 await host.startQuestion();await tick();await p1.submitAnswer(p1.userId,1000);await tick();await host.lockQuestion();await tick();
 const s2=host.load();const fin=S.scoreFinal(s2.players,s2.answers[fq.id],stakes,(pid,ans)=>Q.judge(fq,ans,{playerId:pid}));
 await host.resolveQuestion({override:fin.scores,extraResult:{final:fin.rows}});await tick(20);
 ok(host.load().players.find(p=>p.id===p1.userId).score===100,'online: falsch → −Einsatz');
 await host.restoreScores(pre,{unresolve:fq.id});await tick(20);ok(host.load().players.find(p=>p.id===p1.userId).score===300,'online: Rückgängig im Finale');
 await host.goTo(3,0);await tick(20);ok(host.load().status==='finished','online: Ende nach der letzten Runde');
 const rulesChanged=require('child_process').execSync('git diff --name-only HEAD -- firebase-database.rules.json storage.rules firestore.rules',{cwd:root}).toString().trim();
 ok(rulesChanged==='','keine Firebase-Regeländerung nötig');
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
