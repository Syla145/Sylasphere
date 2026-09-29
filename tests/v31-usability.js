// v31: Usability Spielablauf – Nächster-Schritt-Knopf, Gleichstand, Nochmal spielen (beide Engines), Beamer/Spieler/Startseite
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
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');load('js/core/session-engine.js');load('js/views/moderator-flow.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(code('data/quiz-showtime.json'));
const App=ctx.window.SchmobinApp, Flow=ctx.window.SylasphereModeratorFlow, Th=ctx.window.SylasphereThemes, Local=ctx.window.SchmobinSession;
// ---------- Nächster Schritt (Leertaste = großer Knopf) ----------
const f=(o={})=>Object.assign({status:'playing',players:3,hasQuestion:true,started:false,open:false,resolved:false,isLast:false,isFirst:false,isBuzzer:false,contender:false,isGame:false,gameRunning:false,gameDone:false},o);
let s=Flow.next(f({status:'lobby',players:0}));ok(s.key==='start-game'&&s.disabled&&/Warte/.test(s.label),'Lobby ohne Spieler: Knopf grau „Warte auf Spieler“');
s=Flow.next(f({status:'lobby',players:2}));ok(s.key==='start-game'&&!s.disabled&&s.label.includes('Spiel starten')&&s.prev.disabled&&s.skip.disabled,'Lobby: ▶ Spiel starten, Zurück/Überspringen grau');
ok(Flow.next(f()).key==='open','Frage vorbereitet → ❓ Frage öffnen');
s=Flow.next(f({started:true,open:true}));ok(s.key==='close'&&s.skip.disabled&&s.prev.disabled,'Frage offen → ⏹ Antworten schließen, Überspringen gesperrt');
ok(Flow.next(f({started:true,open:false})).key==='resolve','geschlossen → ✓ Auflösen');
s=Flow.next(f({started:true,resolved:true}));ok(s.key==='next'&&!s.skip.disabled,'aufgelöst → ➜ Nächste Frage');
ok(Flow.next(f({started:true,resolved:true,isLast:true})).key==='finish','letzte Frage → 🏁 Zur Siegerehrung');
ok(Flow.next(f({status:'finished'})).key==='replay'&&Flow.next(f({status:'finished'})).finish.disabled,'Spielende → 🔁 Nochmal spielen');
ok(/Richtig/.test(Flow.next(f({started:true,open:true,isBuzzer:true,contender:true})).label)&&/Ohne Gewinner/.test(Flow.next(f({started:true,open:true,isBuzzer:true})).label),'Buzzer: mit/ohne Gewinner auflösen');
ok(Flow.next(f({started:true,open:true,isGame:true})).key==='game-start'&&Flow.next(f({started:true,open:true,isGame:true,gameRunning:true})).disabled&&Flow.next(f({started:true,isGame:true,gameDone:true})).key==='resolve','Mini-Spiele: 🎲 starten, läuft, auflösen');
ok(Flow.next(f({isFirst:true})).prev.disabled&&!Flow.next(f()).prev.disabled,'‹ Zurück nur, wenn es eine vorige Frage gibt');
// ---------- Gleichstand ----------
const P=(id,score,joinedAt)=>({id,name:id,score,joinedAt,avatar:'🦊'});
let r=App.rankPlayers([P('a',10,3),P('b',30,2),P('c',30,1),P('d',5,4)]);
ok(JSON.stringify(r.map(p=>[p.id,p.place]))==='[["c",1],["b",1],["a",3],["d",4]]','gleiche Punkte = gleicher Platz (1, 1, 3, 4)');
ok(r[0].tied&&r[1].tied&&!r[2].tied,'geteilte Plätze markiert');
ok(App.winnersOf(r).length===2&&App.winnerTitle(r).includes('Gleichstand')&&App.winnerTitle(r).includes('final-names'),'Titel „Gleichstand!“ statt „X gewinnt!“');
ok(/gewinnt/.test(App.winnerTitle(App.rankPlayers([P('a',1,1),P('b',0,2)])))&&App.winnerTitle([])==='','ohne Gleichstand wie bisher');
ok(App.winnerTitle(App.rankPlayers([P('<b>',3,1),P('x',3,2)])).includes('&lt;b&gt;'),'Namen im Titel escaped');
for(const t of ['kart','legends','geo','tactical']) load(`js/themes/${t}.js`);
for(const t of ['neon','kart','legends','geo','tactical']){Th.apply(t);const h=Th.ceremony([P('a',30,1),P('b',30,2),P('c',10,3)],{role:'spectator',title:App.winnerTitle(App.rankPlayers([P('a',30,1),P('b',30,2),P('c',10,3)]))});
 ok((h.match(/podium-place--1/g)||[]).length===2&&(h.match(/<b class="podium-rank">1<\/b>/g)||[]).length===2&&h.includes('<b class="podium-rank">3</b>'),`${t}: Podest zeigt zweimal Platz 1, dann Platz 3`);
 ok(!/gewinnt|Sieg<|MVP/.test(h.replace(/podium[^"]*/g,''))||/Gleichstand|Fotofinish|Unentschieden/.test(h),`${t}: Siegerehrung erkennt Gleichstand`);}
{Th.apply('tactical');const h=Th.ceremony(App.rankPlayers([P('a',30,1),P('b',30,2)]),{role:'player',place:1});ok(h.includes('Unentschieden')&&!h.includes('tactical-mvp'),'Valorant: Unentschieden, keine MVP-Karte bei Gleichstand');}
{const h=Th.ceremony([P('a',30,1),P('b',10,2)],{role:'moderator'});ok(h.includes('podium-name')&&h.includes('podium-score')&&h.includes('podium-rank'),'Podest: Name, Punkte, Platz als eigene Zeilen');}
const css=code('css/main.css');
ok(/\.podium-place>b,\.podium-place>\.podium-rank\{position:static/.test(css),'Platz-Zahl nicht mehr absolut → keine Überlappung mit langen Namen');
// ---------- Nochmal spielen: lokal ----------
{const e=Local.create(quiz);const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐼');e.startGame();e.startQuestion();const q=e.getCurrent().question;e.submitAnswer(a,q.correctAnswer??q.options?.[0]?.id);e.lockQuestion();e.resolveQuestion();e.setPlayerScore(b,50);e.finish();
 ok(e.load().status==='finished','lokal: Spiel beendet');e.restart();const st=e.load();
 ok(st.status==='lobby'&&st.players.length===2&&st.players.every(p=>p.score===0),'lokal: gleiche Spieler, Punkte 0, Lobby');
 ok(!Object.keys(st.answers).length&&!st.scoredQuestionIds.length&&st.currentRoundIndex===0&&st.currentQuestionIndex===0&&!st.questionStartedAt&&!st.finishedAt,'lokal: Antworten/Fortschritt zurückgesetzt');}
// ---------- Avatare ----------
{const pv=code('js/views/player-view.js');const m=pv.match(/const AVATARS = (\[[^\]]+\]);[\s\S]*?(function pickAvatar[\s\S]*?\n  \})/);const pick=new Function(`const AVATARS=${m[1]};${m[2]};return pickAvatar;`)();
 const AV=JSON.parse(m[1].replace(/'/g,'"'));const taken=AV.slice(0,15).map((a,i)=>({id:'p'+i,avatar:a}));
 ok(pick('🦊',taken,'me',()=>0)===AV[15],'freier Avatar, wenn der gewünschte schon vergeben ist');
 ok(pick(AV[15],taken,'me')===AV[15],'gewünschter Avatar bleibt, wenn frei');
 ok(pick('🦊',[{id:'me',avatar:'🦊'}],'me')==='🦊','eigener Eintrag zählt nicht als vergeben');
 ok(AV.includes(pick('🦊',AV.map((a,i)=>({id:'x'+i,avatar:a})),'me',()=>0.5)),'alle vergeben → trotzdem gültiger Avatar');
 ok(pv.includes('Math.floor(Math.random() * AVATARS.length)')&&pv.includes('avatarPicked'),'Standard-Avatar zufällig, eigene Wahl bleibt');}
// ---------- Einbindung Moderator / Beamer / Spieler / Startseite ----------
const mod=code('moderator.html'),mv=code('js/views/moderator-view.js'),zu=code('zuschauer.html'),sv=code('js/views/spectator-view.js'),sp=code('spieler.html'),home=code('js/views/home-view.js');
ok(mod.includes('id="btn-next-step"')&&mod.includes('<kbd')&&mod.includes('moderator-flow.js')&&mv.includes("if (event.code === 'Space') { event.preventDefault(); doStep(); }"),'Moderator: großer Nächster-Schritt-Knopf + Leertaste');
ok(mod.includes('id="btn-replay"')&&mod.includes('Nochmal spielen (gleiche Spieler)')&&mod.includes('Neues Quiz')&&mv.includes('engine.restart()'),'Spielende: Nochmal spielen + Neues Quiz');
ok(mod.includes('<details id="mod-share"')&&mod.includes('session-theme-toggle')&&mv.includes('Wie im Quiz'),'Teilen einklappbar, Design zusammengeklappt');
ok(mod.includes('<svg viewBox="0 0 100 100"')&&/\.timer-ring \.timer-fill\{[^}]*stroke-dashoffset/.test(css)&&/width:68px;height:68px/.test(css),'Timer-Ring rund (SVG, feste Größe, gleich dicke Linie)');
ok(mv.includes('— keine Antwort')&&mv.includes('⏳ wartet')&&mv.includes('✓ geantwortet')&&mv.includes('expandedPlayer'),'Antwortstatus pro Spieler, Punkte erst nach Antippen');
ok(/\.btn\.btn:disabled\{background:rgba\(var\(--overlay-rgb\)/.test(css),'deaktivierte Knöpfe grau');
ok(/\.mod-control\{position:fixed;left:0;right:0;bottom:0/.test(css)&&mv.includes("classList.add('has-mod-bar')"),'Handy: feste Leiste unten');
ok(zu.includes('class="beamer-page"')&&zu.includes('id="beamer-timer"')&&sv.includes('Wer ist da?')&&sv.includes('is-new')&&css.includes('html[data-motion="reduced"] .beamer-avatar.is-new{animation:none}'),'Beamer: Lobby „Wer ist da?“ mit Einblendung (abschaltbar)');
ok(sv.includes("els['beamer-top'].hidden = !playing")&&sv.includes("els['beamer-side'].hidden = !playing")&&sv.includes('App.winnerTitle(ranked)'),'Beamer: Spielende ohne Timer/Frage x/y/Tabelle, Gleichstand');
ok(sp.includes('id="player-timebar"')&&sp.includes('>Beitreten</button>')&&!sp.includes('Lokale Test-Räume')&&!sp.includes('id="game-code"'),'Spieler: Timer-Balken, „Beitreten“, kein Lokal/Online-Hinweis');
ok(css.includes('#game-question .question-meta .pill--type,#game-question .question-meta .pill--timer{display:none}')&&css.includes('content:"✓"'),'Spieler: weniger Chips, gewählte Antwort mit ✓');
ok(code('js/question-types/kit.js').includes("'pill pill--timer'"),'Chips mit eigenen Klassen');
ok(home.includes('data-home-join')&&home.includes("spieler.html?code=")&&!home.includes('Als Gast fortfahren'),'Startseite: Raumcode-Feld für alle');
ok(/APP_VERSION = 'v(3[1-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v31'),'Version v31 + Changelog');
// ---------- Nochmal spielen: online ----------
(async()=>{
 const host=await Online.create(quiz); await host.waitForState(); const c=host.code;
 const p1=new Online(c,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${c}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(c,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${c}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('Anna','🦊');await p2.joinPlayer('Ben','🐼');await new Promise(r=>setTimeout(r,5));
 await host.startGame();await host.startQuestion();await new Promise(r=>setTimeout(r,5));
 const q=host.getCurrent(host.load()).question;await p1.submitAnswer(p1.userId,q.correctAnswer??q.options?.[0]?.id);await new Promise(r=>setTimeout(r,5));
 await host.lockQuestion();await host.resolveQuestion();await new Promise(r=>setTimeout(r,10));await host.move(1);await host.finish();await new Promise(r=>setTimeout(r,5));
 ok(host.load().status==='finished','online: Spiel beendet');
 await host.restart();await new Promise(r=>setTimeout(r,10));const st=p1.load();
 ok(st.status==='lobby'&&st.players.length===2&&st.players.every(p=>p.score===0),'online: gleiche Spieler, Punkte 0, Lobby (auch beim Spieler)');
 ok(!st.scoredQuestionIds.length&&st.currentRoundIndex===0&&st.currentQuestionIndex===0&&!st.questionStartedAt&&!st.finishedAt&&!Object.keys(host.load().answers||{}).some(k=>Object.keys(host.load().answers[k]||{}).length),'online: Antworten und Fortschritt zurückgesetzt');
 await host.startGame();await new Promise(r=>setTimeout(r,5));ok(p2.load().status==='playing','online: neue Runde startet');
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
