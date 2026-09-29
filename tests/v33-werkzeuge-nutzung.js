// v33: Moderator-Werkzeuge (beide Engines), Firebase-Regeln fürs Admin-Lesen, Nutzungs-Dashboard (Rechenlogik)
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..'); let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
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
base.BroadcastChannel=class{constructor(){}postMessage(){}close(){}addEventListener(){}};base.matchMedia=()=>({matches:false,addEventListener(){}});
base.document.documentElement={setAttribute(){},removeAttribute(){},classList:{add(){}}};base.document.querySelector=()=>null;
const ctx=vm.createContext(base); const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');load('js/core/session-engine.js');load('js/core/usage-limits.js');load('js/core/usage-stats.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(code('data/quiz-showtime.json'));
const Local=ctx.window.SchmobinSession, U=ctx.window.SylasphereUsage, L=ctx.window.SylasphereUsageLimits;
const {canWrite,canRead}=require('./lib/rules-eval.js');
const tick=(ms=10)=>new Promise(r=>setTimeout(r,ms));
// ---------- Lokal ----------
{const e=Local.create(quiz);const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐼');
 e.renamePlayer(b,'  Benjamin ');ok(e.load().players.find(p=>p.id===b).name==='Benjamin','lokal: umbenennen');
 e.setReady(a,true);ok(e.load().players.find(p=>p.id===a).ready===true&&!e.load().players.find(p=>p.id===b).ready,'lokal: Bereit-Check');
 e.heartbeat(b);ok(Date.now()-e.load().players.find(p=>p.id===b).seenAt<1000,'lokal: Spieler-Tab meldet sich (Online-Punkt)');
 e.startGame();e.startQuestion();const st=e.load();const left=st.questionEndsAt-Date.now();
 e.pause();let s=e.load();ok(s.paused&&s.questionEndsAt===null&&Math.abs(s.paused.remaining-left)<200,'lokal: Pause hält den Timer an');
 e.pause();ok(e.load().paused.since===s.paused.since,'lokal: doppelte Pause ändert nichts');
 e.resume();s=e.load();ok(!s.paused&&Math.abs(s.questionEndsAt-Date.now()-left)<300,'lokal: Weiter mit der Restzeit');
 const q=e.getCurrent().question;e.submitAnswer(a,q.correctAnswer??q.options?.[0]?.id);e.lockQuestion();
 const snap=e.scoreSnapshot();e.resolveQuestion();ok(e.load().players.find(p=>p.id===a).score>0,'lokal: Wertung');
 e.restoreScores(snap,{unresolve:q.id});s=e.load();
 ok(s.players.every(p=>p.score===0)&&!s.scoredQuestionIds.includes(q.id)&&!s.questionResults[q.id]&&s.answers[q.id][a].awardedPoints===undefined,'lokal: Rückgängig nimmt Auflösung und Punkte zurück');
 e.resolveQuestion();ok(e.load().players.find(p=>p.id===a).score>0,'lokal: danach erneut auflösbar');
 const snap2=e.scoreSnapshot();e.adjustPlayerScore(b,10);e.restoreScores(snap2);ok(e.load().players.find(p=>p.id===b).score===0,'lokal: Rückgängig für Punkteänderung');
 e.removePlayer(b);s=e.load();ok(!s.players.some(p=>p.id===b)&&s.removedIds.includes(b),'lokal: entfernen + gemerkt (kein automatisches Wiederverbinden)');
 e.finish();e.restart();ok(e.load().players.every(p=>!p.ready)&&!e.load().paused,'lokal: Nochmal spielen setzt Bereit zurück');}
// ---------- Regeln ----------
{const host='host_uid_123456789',p1='p1_uid_123456789',admin='admin_uid_12345678';
 const db={admins:{[admin]:true},rooms:{R1:{meta:{ownerUid:host},public:{currentQuestionId:'q1'},profiles:{[p1]:{name:'A',avatar:'🦊',joinedAt:1,active:true}}}},userMedia:{m:{x1:{path:'media/m/a',url:'u',kind:'image',size:5}}},players:{p1:{}},modStats:{m:{}},userQuizzes:{m:{index:{}}}};
 ok(canWrite(db,host,{'rooms/R1/profiles/p1_uid_123456789/name':'Neu','rooms/R1/profiles/p1_uid_123456789/updatedAt':1}),'Regeln: Moderator darf umbenennen');
 ok(canWrite(db,p1,{'rooms/R1/profiles/p1_uid_123456789/ready':true}),'Regeln: Spieler setzt „Bereit“');
 ok(canWrite(db,host,{'rooms/R1/public/paused':{since:1,remaining:5}})&&canWrite(db,host,{'rooms/R1/public/removed/x':true}),'Regeln: Pause und Entfernt-Liste im öffentlichen Raum');
 ok(!canWrite(db,p1,{'rooms/R1/public/paused':{since:1}}),'Regeln: Spieler können nicht pausieren');
 ok(canRead(db,admin,'userQuizzes/m/index')&&!canRead(db,admin,'userQuizzes/m/data')&&!canRead(db,admin,'userQuizzes'),'Regeln: Admin zählt nur Quiz-Listen, liest keine fremden Quizze');
 for(const path of ['userMedia','players','modStats']){ok(canRead(db,admin,path),`Regeln: Admin darf ${path} lesen`);ok(!canRead(db,host,path)&&!canRead(db,p1,path),`Regeln: andere dürfen ${path} nicht als Ganzes lesen`);}
 ok(!canWrite(db,admin,{'userMedia/m/x2':{path:'media/m/b',url:'u',kind:'image',size:1}}),'Regeln: Admin bekommt kein zusätzliches Schreibrecht');}
// ---------- Nutzungs-Dashboard ----------
{const now=Date.UTC(2026,8,20,12);const DAY=U.DAY;const MB=1024*1024,GB=1024*MB;
 const own=U.ownStats({userMedia:{a:{x:{size:3*MB,createdAt:now-DAY},y:{size:MB,createdAt:Date.UTC(2026,7,1)}},b:{z:{size:5*MB,createdAt:now}}},moderators:{a:{name:'Anna'},b:{name:'Bert'}},accounts:4,rooms:2,games:U.countGames({a:{q:{games:7},r:{games:2}},b:{q:{games:3}}}),quizzes:3},now);
 ok(own.uploads.bytes===9*MB&&own.uploads.count===3&&own.uploads.monthBytes===8*MB,'eigene Daten: Summe gesamt und dieser Monat');
 ok(own.uploads.perUser[0].name==='Bert'&&own.uploads.perUser[1].bytes===4*MB&&own.games===12&&own.moderators===2&&own.accounts===4,'eigene Daten: pro Konto, Spiele, Moderatoren, Konten');
 ok(U.classify('ReadObject')==='B'&&U.classify('GetObjectMetadata')==='B'&&U.classify('WriteObject')==='A'&&U.classify('ListObjects')==='A'&&U.classify('DeleteObject')==='free','Class A/B nach Methode');
 const item=L.items.find(i=>i.id==='storage-class-b');const url=new URL(U.requestFor(item,'jh-quiz',now));
 ok(url.pathname==='/v3/projects/jh-quiz/timeSeries'&&url.searchParams.get('filter')==='metric.type="storage.googleapis.com/api/request_count"'&&url.searchParams.get('aggregation.alignmentPeriod')==='86400s'&&url.searchParams.get('aggregation.groupByFields')==='metric.label.method','Monitoring-Abfrage korrekt aufgebaut');
 ok(new URL(U.requestFor(L.items[0],'jh-quiz',now)).searchParams.get('aggregation.perSeriesAligner')==='ALIGN_MAX','Speicherstand: Maximum pro Tag');
 const pts=(n,v)=>Array.from({length:n},(_,i)=>({interval:{endTime:new Date(now-i*DAY).toISOString()},value:{int64Value:String(v)}}));
 const json={timeSeries:[{metric:{labels:{method:'ReadObject'}},points:pts(30,100)},{metric:{labels:{method:'WriteObject'}},points:pts(30,7)},{metric:{labels:{method:'DeleteObject'}},points:pts(30,99)}]};
 const sB=U.parseSeries(json,item);ok(sB.length===30&&sB.every(p=>p.value===100)&&sB[0].end<sB[29].end,'Tageswerte aufsteigend, nur Class B');
 ok(U.periodValue(sB,item,now)===100*20,'Monatssumme ab Monatsbeginn (20 Tage im September)');
 const expected=['metric.type="storage.googleapis.com/storage/total_bytes"','metric.type="storage.googleapis.com/network/sent_bytes_count"','metric.type="storage.googleapis.com/api/request_count"','metric.type="firebasedatabase.googleapis.com/storage/total_bytes"','metric.type="firebasedatabase.googleapis.com/network/sent_bytes_count"','metric.type="firestore.googleapis.com/document/read_count"','metric.type="firestore.googleapis.com/document/write_count"'];
 const seen=[];const fakeFetch=async(u,o)=>{seen.push([new URL(u).searchParams.get('filter'),o.headers.Authorization]);return{ok:true,status:200,json:async()=>json};};
 (async()=>{
  const r=await U.fetchMonitoring({token:'T',projectId:'jh-quiz',limits:L,fetchFn:fakeFetch,now});
  ok(JSON.stringify([...new Set(seen.map(s=>s[0]))])===JSON.stringify(expected)&&seen.length===7&&seen.every(s=>s[1]==='Bearer T'),'7 Abfragen (request_count nur einmal), Token im Header');
  const bad=await U.fetchMonitoring({token:'T',projectId:'jh-quiz',limits:L,fetchFn:async()=>({ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:'Cloud Monitoring API has not been used in project jh-quiz before or it is disabled.'}})}),now});
  ok(bad.errors.length===8&&/nicht aktiviert/.test(U.explainError(bad.errors[0])),'API aus → verständliche Meldung');
  ok(/abgelaufen/.test(U.explainError({status:401}))&&/Verbindung/.test(U.explainError({status:0,message:'Failed to fetch'})),'weitere Fehlermeldungen');
  const values={'storage-stored':{value:6*GB,series:[]},'storage-download':{value:80*GB,series:[]},'storage-class-a':{value:1000,series:[]},
   'firestore-reads':{value:60000,series:[{end:now-DAY*2,value:60000},{end:now,value:10000}]}};
  const ev=U.evaluate(L,{values},now);const by=id=>ev.items.find(i=>i.id===id);
  ok(by('storage-stored').level==='over'&&by('storage-download').level==='warn'&&by('storage-class-a').level==='ok'&&by('rtdb-stored').level==='none'&&by('firestore-stored').level==='manual','Ampel: über / knapp / ok / keine Daten / nur Konsole');
  ok(Math.abs(by('storage-stored').costUsd-0.02)<1e-9&&Math.abs(by('firestore-reads').costUsd-10000*0.06/100000)<1e-9,'Kosten über dem Freikontingent (Storage 1 GB, Firestore pro Tag)');
  ok(Math.abs(ev.costEur-ev.costUsd*L.usdToEur)<1e-12&&ev.worst==='over','Summe in Euro, schlimmste Ampel');
  ok(L.items.find(i=>i.id==='storage-stored').free===5*GB&&L.items.find(i=>i.id==='storage-class-a').free===5000&&L.items.find(i=>i.id==='storage-class-b').free===50000&&L.items.find(i=>i.id==='firestore-writes').free===20000&&L.region==='US-CENTRAL1','Freikontingente zentral in usage-limits.js');
  ok(U.fmtBytes(1536)==='1,5 KB'&&U.fmtBytes(5*GB)==='5 GB','Formatierung');
  await onlineTests();
 })().catch(e=>{console.error(e);process.exit(1)});}
// ---------- Online ----------
async function onlineTests(){
 const host=await Online.create(quiz);await host.waitForState();const c=host.code;
 const p1=new Online(c,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${c}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(c,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${c}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');await tick();
 await p1.setReady(p1.userId,true);await tick();ok(host.load().players.find(p=>p.id===p1.userId).ready===true,'online: Bereit kommt beim Moderator an');
 ok(!(await p1.setReady(p2.userId,true)),'online: niemand setzt andere auf bereit');
 await host.renamePlayer(p2.userId,'Benni');await tick();ok(p2.load().players.find(p=>p.id===p2.userId).name==='Benni','online: umbenennen');
 await host.startGame();await host.startQuestion();await tick();const left=host.load().questionEndsAt-Date.now();
 await host.pause();await tick();ok(p1.load().paused&&p1.load().questionEndsAt===null&&Math.abs(p1.load().paused.remaining-left)<300,'online: Pause (Spieler sieht sie)');
 await host.resume();await tick();ok(!p1.load().paused&&Math.abs(p1.load().questionEndsAt-Date.now()-left)<400,'online: Weiter mit Restzeit');
 const q=host.getCurrent(host.load()).question;await p1.submitAnswer(p1.userId,q.correctAnswer??q.options?.[0]?.id);await tick();
 await host.lockQuestion();const snap=host.scoreSnapshot();await host.resolveQuestion();await tick(20);
 ok(host.load().players.find(p=>p.id===p1.userId).score>0&&Object.prototype.hasOwnProperty.call(p1.getCurrent(p1.load()).question,'correctAnswer'),'online: Wertung + Lösung sichtbar');
 await host.restoreScores(snap,{unresolve:q.id});await tick(20);
 ok(host.load().players.every(p=>p.score===0)&&!host.load().scoredQuestionIds.includes(q.id)&&!Object.prototype.hasOwnProperty.call(p1.getCurrent(p1.load()).question,'correctAnswer'),'online: Rückgängig – Punkte zurück, Lösung wieder verborgen');
 ok(getAt(data,`rooms/${c}/answers/${p1.userId}/${q.id}/awardedPoints`)===undefined,'online: Wertung der Antwort entfernt');
 await host.resolveQuestion();await tick(20);ok(host.load().players.find(p=>p.id===p1.userId).score>0,'online: erneut auflösbar');
 await host.removePlayer(p2.userId);await tick();ok(!host.load().players.some(p=>p.id===p2.userId)&&p1.load().removedIds.includes(p2.userId),'online: entfernen + für Wiederverbinden gesperrt');
 // Wiederverbinden: Verbindung weg → onDisconnect setzt active:false; wieder da → markPresent
 setAt(data,`rooms/${c}/profiles/${p1.userId}/active`,false);await p1.markPresent();await tick();ok(host.load().players.find(p=>p.id===p1.userId).active===true,'online: nach Verbindungsabbruch wieder „online“');
 const mv=code('js/views/moderator-view.js'),pv=code('js/views/player-view.js'),sv=code('js/views/spectator-view.js'),html=code('moderator.html'),css=code('css/main.css');
 ok(html.includes('id="btn-pause"')&&html.includes('id="btn-undo"')&&mv.includes("event.key.toLowerCase() === 'p'")&&mv.includes('undoStack'),'Moderator: Pause (P) und Rückgängig');
 ok(mv.includes('data-rename')&&mv.includes('data-remove')&&mv.includes('confirm(`${player.name} aus dem Raum entfernen?')&&mv.includes('mod-dot'),'Moderator: umbenennen, entfernen mit Rückfrage, Online-Punkt');
 ok(mv.includes('es fehlt:')&&pv.includes('✋ Bereit'),'Bereit-Check');
 ok(pv.includes("sessionStorage.getItem(REJOIN_KEY)")&&pv.includes('tryRejoin()')&&pv.includes('Der Moderator hat dich aus dem Raum entfernt.'),'Wiederverbinden pro Tab, entfernte nicht automatisch');
 ok(sv.includes('Kurze Pause')&&css.includes('.beamer-pause{'),'Beamer: Kurze Pause + Rangliste');
 ok(css.includes('.admin-list>*,.admin-storage .notice{min-width:0;overflow-wrap:anywhere}'),'admin.html: Upload-Warnung bricht am Handy um');
 const av=code('js/views/admin-view.js');ok(av.includes('googleAccessToken')&&!/localStorage\.setItem|sessionStorage\.setItem/.test(av)&&code('js/core/account.js').includes('reauthenticateWithPopup'),'Token nur im Speicher, über die Google-Anmeldung');
 ok(code('admin.html').includes('usage-limits.js')&&code('FIREBASE_SETUP.md').includes('Cloud Monitoring API aktivieren')&&code('FIREBASE_SETUP.md').includes('nicht überprüft'),'Einbindung + Anleitung');
 ok(/APP_VERSION = 'v(3[3-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v33'),'Version v33 + Changelog');
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
}
