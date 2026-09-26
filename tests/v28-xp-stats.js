// v28: Statistiken + XP & Stufen – Formel, Stufenkurve, Emotes, Statistik, Firebase-Regeln, Speichern am Spielende
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
const {RULES,canWrite,canRead,setIn,split,clone}=require('./lib/rules-eval.js');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const NOW=Date.UTC(2026,8,26,18,0,0),DAY=86400000;
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,navigator:{},document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[],body:{dataset:{role:'moderator'}}},location:{href:'http://x/',pathname:'/moderator.html'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');load('js/core/highlights.js');load('js/core/reactions.js');load('js/core/progress.js');
ctx.window.JHQuizFirebase={serverNow:()=>NOW,config:{databaseURL:'https://example'}};
load('js/core/progress-store.js');
const P=ctx.window.SylasphereProgress,PS=ctx.window.SylasphereProgressStore,S=ctx.window.SchmobinSession,H=ctx.window.SylasphereHighlights;

// ---------- Stufenkurve ----------
ok(P.xpForLevel(1)===0&&P.xpForLevel(2)===50&&P.xpForLevel(3)===150&&P.xpForLevel(5)===500&&P.xpForLevel(10)===2250&&P.xpForLevel(20)===9500,'level thresholds 50·n');
ok(P.levelFor(0)===1&&P.levelFor(49)===1&&P.levelFor(50)===2&&P.levelFor(149)===2&&P.levelFor(150)===3&&P.levelFor(499)===4&&P.levelFor(500)===5&&P.levelFor(9499)===19&&P.levelFor(9500)===20,'levelFor boundaries');
{let okAll=true;for(let x=0;x<30000;x+=37){const l=P.levelFor(x);if(!(P.xpForLevel(l)<=x&&P.xpForLevel(l+1)>x))okAll=false}ok(okAll,'levelFor consistent for many values');}
{const i=P.levelInfo(230);ok(i.level===3&&i.from===150&&i.to===300&&Math.abs(i.progress-80/150)<1e-9&&i.missing===70,'levelInfo 230 XP');}
ok(P.levelFor(-5)===1&&P.levelFor('abc')===1,'invalid XP → level 1');
// ---------- Emotes ----------
ok(JSON.stringify(P.unlockedEmotes(0))==='[]'&&JSON.stringify(P.unlockedEmotes(150))===JSON.stringify(['🥳','🤔']),'emotes unlock by level');
ok(P.emoteTable()['👑']===2250&&P.emoteTable()['🐐']===9500&&P.minXpFor('🔥')===0,'emote table in XP');
ok(P.EMOTES.every(x=>!ctx.window.SylasphereReactions.EMOJIS.includes(x.e)),'unlockable emotes differ from base set');
ok(P.badge({account:true,xp:500}).includes('⭐5')&&P.badge({account:false,xp:500})==='','badge only for accounts');

// ---------- Ein lokales Spiel: 4 Spieler, 5 Fragen ----------
const mc=(id,correct='a')=>({id,type:'multiple-choice',text:`Frage ${id}`,category:id==='m5'?'Geschichte':'Geografie',points:100,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:correct});
const quiz={id:'demo.quiz',title:'Demo',rounds:[{questions:['m1','m2','m3','m4','m5'].map(id=>mc(id))}]};
function play(names,answers){const e=S.create({quiz});const ids=names.map(n=>e.joinPlayer(n,'🦊'));e.startGame();
 for(let q=0;q<5;q++){e.startQuestion();ids.forEach((id,i)=>{const a=answers[i][q];if(a)e.submitAnswer(id,a)});e.lockQuestion();e.resolveQuestion();if(q<4)e.move(1)}
 e.finish({highlights:H.compute(e.load())});return {e,ids,state:e.load()}}
const g=play(['Anna','Ben','Cleo','Dan'],[['a','a','a','a','a'],['a','a','b','b','a'],['b','b','b','a',null],[null,null,null,null,null]]);
{const [a,b,c,d]=g.ids;const r=P.gameResults(g.state);
 ok(r.eligible&&r.questions===5&&r.reason==='','4 players + 5 questions → eligible');
 const A=r.players[a],B=r.players[b],C=r.players[c],D=r.players[d];
 ok(A.rank===1&&A.correct===5&&A.answered===5&&A.parts.play===20&&A.parts.correct===25&&A.parts.place===50,'Anna: all correct, 1st');
 ok(A.hl.includes('🎯')&&A.parts.highlights===A.hl.length*10&&A.xp===20+25+50+A.hl.length*10,'Anna XP incl. highlight: '+A.xp);
 ok(B.rank===2&&B.correct===3&&B.parts.place===30&&B.xp>=20+15+30,'Ben 2nd');
 ok(C.answered===4&&C.correct===1&&C.parts.play===20&&C.rank===3&&C.parts.place===15,'Cleo answered 4 → play XP, 3rd');
 ok(D.answered===0&&D.parts.play===0&&D.parts.place===0&&D.xp===D.parts.highlights,'Dan answered nothing → no play/place XP');
 ok(A.byType['multiple-choice'].a===5&&A.byTopic['Geografie'].a===4&&A.byTopic['Geschichte'].c===1,'stats per type and topic');
 const hl=g.state.highlights;ok(hl.length&&hl.every(c=>Array.isArray(c.ids)&&c.ids.length),'highlight cards carry player ids');}
// zu wenige Spieler / Fragen
{const two=play(['Anna','Ben'],[['a','a','a','a','a'],['a','b','a','b','a']]);const r=P.gameResults(two.state);
 ok(!r.eligible&&/3 Spielern/.test(r.reason)&&Object.values(r.players).every(p=>p.xp===0),'2 players → no XP');}
{const st=clone(g.state);st.scoredQuestionIds=st.scoredQuestionIds.slice(0,4);const r=P.gameResults(st);ok(!r.eligible&&/5 gewerteten Fragen/.test(r.reason),'4 scored questions → no XP');}
{const r=P.gameResults(g.state,{ownerUid:g.ids[0]});ok(!r.players[g.ids[0]],'room owner never gets XP');}
// Obergrenze pro Spiel
{const qs=Array.from({length:60},(_,i)=>({id:'q'+i,type:'multiple-choice',category:'x'}));const players=[{id:'a',score:900},{id:'b',score:1},{id:'c',score:0}];
 const answers=Object.fromEntries(qs.map(q=>[q.id,{a:{awardedPoints:10}}]));
 const r=P.gameResults({quiz:{quiz:{rounds:[{questions:qs}]}},players,scoredQuestionIds:qs.map(q=>q.id),answers,highlights:[{icon:'🎯',ids:['a']}]});
 ok(r.players.a.xp===250,'game cap 250 XP');ok(r.players.c.parts.place===0,'0 points → no place XP');}
// Tageslimit
{let c=P.applyDayCap(null,110,NOW,'R1');ok(c.grant===110&&c.node.total===110&&c.node.day===NOW&&c.node.dayXp===110&&c.node.lastRoom==='R1','first game');
 c=P.applyDayCap({total:900,day:NOW-3600e3,dayXp:550},110,NOW,'R2');ok(c.grant===50&&c.node.total===950&&c.node.dayXp===600&&c.node.day===NOW-3600e3,'day cap 600');
 c=P.applyDayCap({total:900,day:NOW-DAY-1,dayXp:600},110,NOW,'R3');ok(c.grant===110&&c.node.day===NOW&&c.node.dayXp===110,'new day resets');}
// Moderator-Statistik
{const qs=P.questionStats(g.state);ok(qs.m1.n===3&&qs.m1.c===2&&qs.m3.c===1&&qs.m1.t==='Frage m1','question stats');
 const m=P.mergeQuestionStats(P.mergeQuestionStats(null,'Demo',qs),'Demo',qs);ok(m.games===2&&m.q.m1.n===6&&m.q.m1.c===4,'merge stats');
 const hard=P.hardestQuestions(m);ok(hard[0].rate<=hard[hard.length-1].rate&&hard[0].id==='m3','hardest first');
 ok(P.quizKey({id:'demo.quiz'})==='demo_quiz'&&P.topicKey('A/B.C')==='A B C','firebase-safe keys');}
// Spieler-Statistik
{const s=P.playerStats({R1:{at:2,rank:1,answered:5,correct:5,xp:100,byType:{mc:{a:5,c:5}}},R2:{at:3,rank:4,answered:5,correct:1,xp:30,byType:{mc:{a:5,c:1}}}});
 ok(s.games===2&&s.wins===1&&s.podiums===1&&s.rate===0.6&&s.byType.mc.a===10&&s.recent[0].code==='R2','player stats aggregate');}
// lokal: keine XP
{let res=null;g.e.saveResults().then(r=>res=r);setTimeout(()=>ok(res&&res.local===true,'local engine: saveResults → local'),0);}

// ---------- Firebase-Regeln ----------
const HOST='host_uid_1234567890',P1='p1_uid_1234567890',P2='p2_uid_1234567890',P3='p3_uid_1234567890',ADMIN='admin_uid_123456789';
const profile=n=>({name:n,avatar:'🦊',joinedAt:1,active:true});
let db={admins:{[ADMIN]:true},moderators:{[HOST]:{grantedAt:1,grantedBy:ADMIN}},rooms:{
 ROOM01:{meta:{ownerUid:HOST,createdAt:1,quizTitle:'T',schemaVersion:1},profiles:{[P1]:profile('A'),[P2]:profile('B'),[HOST]:profile('H')},public:{}},
 ROOM02:{meta:{ownerUid:HOST,createdAt:1,quizTitle:'T',schemaVersion:1},profiles:{[P1]:profile('A')}},
 ROOM03:{meta:{ownerUid:P2,createdAt:1,quizTitle:'T',schemaVersion:1},profiles:{[P1]:profile('A')}}}};
const rec=(xp,extra={})=>Object.assign({at:NOW,quizTitle:'Demo',rank:1,players:3,questions:5,answered:5,correct:4,xp},extra);
const xpNode=(total,day,dayXp,room)=>({total,day,dayXp,lastRoom:room});
const W=(d,uid,w,o={})=>canWrite(d,uid,w,Object.assign({now:NOW},o));
const save=(room,uid,xp,node)=>({[`players/${uid}/games/${room}`]:rec(xp),[`players/${uid}/xp`]:node});
ok(W(db,HOST,save('ROOM01',P1,110,xpNode(110,NOW,110,'ROOM01'))),'owner saves game + XP');
ok(!W(db,P1,save('ROOM01',P1,110,xpNode(110,NOW,110,'ROOM01'))),'player cannot award own XP');
ok(!W(db,P2,save('ROOM01',P1,110,xpNode(110,NOW,110,'ROOM01'))),'other player cannot award XP');
ok(!W(db,HOST,save('ROOM01',P1,110,xpNode(999,NOW,110,'ROOM01'))),'total must equal record XP');
ok(!W(db,HOST,save('ROOM01',P1,300,xpNode(300,NOW,300,'ROOM01'))),'record XP capped at 250');
ok(!W(db,HOST,{[`players/${P1}/xp`]:xpNode(110,NOW,110,'ROOM01')}),'XP without new game record denied');
ok(!W(db,HOST,save('ROOM01',HOST,110,xpNode(110,NOW,110,'ROOM01'))),'owner cannot award himself');
ok(!W(db,HOST,save('ROOM01',P3,110,xpNode(110,NOW,110,'ROOM01'))),'player must be in the room');
ok(!W(db,HOST,save('ROOM03',P1,110,xpNode(110,NOW,110,'ROOM03'))),'only the room owner');
ok(!W(db,HOST,save('ROOM01',P1,110,xpNode(110,NOW+5*60000,110,'ROOM01'))),'day start not in the future');
ok(W(db,HOST,{[`players/${P1}/games/ROOM01`]:rec(0)}),'record without XP (stats only) allowed');
ok(!W(db,HOST,{[`players/${P1}/games/ROOM01`]:rec(10,{correct:6})}),'correct ≤ answered');
db=setIn(db,split(`players/${P1}/games/ROOM01`),rec(110));db=setIn(db,split(`players/${P1}/xp`),xpNode(110,NOW-3600e3,110,'ROOM01'));
ok(!W(db,HOST,{[`players/${P1}/games/ROOM01`]:rec(50)}),'game record is write-once');
ok(!W(db,HOST,{[`players/${P1}/games/ROOM01`]:null}),'owner cannot delete records');
ok(W(db,HOST,save('ROOM02',P1,90,xpNode(200,NOW-3600e3,200,'ROOM02'))),'second game same day accumulates');
ok(!W(db,HOST,save('ROOM02',P1,90,xpNode(200,NOW,90,'ROOM02'))),'no day reset within 24 h');
ok(!W(db,HOST,save('ROOM02',P1,90,xpNode(200,NOW-3600e3,110,'ROOM02'))),'dayXp must grow by record');
{let d2=setIn(db,split(`players/${P1}/xp`),xpNode(700,NOW-3600e3,560,'ROOM01'));
 ok(!W(d2,HOST,save('ROOM02',P1,90,xpNode(790,NOW-3600e3,650,'ROOM02'))),'day cap 600 enforced');
 ok(W(d2,HOST,save('ROOM02',P1,40,xpNode(740,NOW-3600e3,600,'ROOM02'))),'cut to day cap allowed');
 d2=setIn(db,split(`players/${P1}/xp`),xpNode(700,NOW-DAY-10,600,'ROOM01'));
 ok(W(d2,HOST,save('ROOM02',P1,90,xpNode(790,NOW,90,'ROOM02'))),'new day after 24 h');}
ok(W(db,ADMIN,{[`players/${P1}/xp`]:{total:0,day:0,dayXp:0,lastRoom:'x'}}),'admin may correct XP');
ok(!W(db,P1,{[`players/${P1}/cheat`]:1})&&!W(db,ADMIN,{[`players/${P1}/cheat`]:1}),'no unknown player nodes');
ok(canRead(db,P2,`players/${P1}/xp`)&&!canRead(db,P2,`players/${P1}/games`)&&canRead(db,P1,`players/${P1}/games`)&&!canRead(db,null,`players/${P1}/xp`),'read rules players');
// Profil + Bestenliste (Opt-in)
ok(W(db,P1,{[`players/${P1}/profile`]:{name:'Anna',board:true}}),'own profile');
ok(!W(db,P1,{[`players/${P1}/profile`]:{name:'Anna',board:true}},{provider:'anonymous'}),'guests have no profile');
ok(!W(db,P2,{[`players/${P1}/profile`]:{name:'X',board:true}}),'foreign profile denied');
ok(W(db,P1,{[`leaderboard/${P1}`]:{name:'Anna',xp:110}}),'leaderboard entry with real XP');
ok(!W(db,P1,{[`leaderboard/${P1}`]:{name:'Anna',xp:5000}}),'leaderboard XP must match');
ok(!W(db,P2,{[`leaderboard/${P1}`]:{name:'Anna',xp:110}}),'only own leaderboard entry');
ok(W(setIn(db,split(`leaderboard/${P1}`),{name:'Anna',xp:110}),P1,{[`leaderboard/${P1}`]:null}),'opt-out removes entry');
ok(canRead(db,P2,'leaderboard')&&!canRead(db,null,'leaderboard')&&RULES.leaderboard['.indexOn'].includes('xp'),'leaderboard readable + indexed');
// Stufe im Raum + Emotes
const join=(uid,extra)=>({[`rooms/ROOM01/profiles/${uid}`]:Object.assign(profile('A'),extra)});
ok(W(db,P1,join(P1,{account:true,xp:110})),'profile with real XP');
ok(!W(db,P1,join(P1,{account:true,xp:5000})),'profile XP cannot exceed account XP');
ok(W(db,P2,join(P2,{account:true})),'new account without XP');
ok(!W(db,P2,join(P2,{xp:10})),'no XP without XP record');
{const d3=setIn(db,split('emotes'),P.emoteTable());const inRoom=setIn(d3,split(`rooms/ROOM01/reactions`),{});
 const react=(uid,e)=>W(inRoom,uid,{[`rooms/ROOM01/reactions/${uid}`]:{e,at:NOW}});
 ok(react(P1,'🔥'),'base emoji always allowed');ok(react(P1,'🥳'),'unlocked emote (110 XP ≥ 50)');ok(!react(P1,'👑'),'locked emote denied');ok(!react(P2,'🥳'),'no XP → locked');
 const rich=setIn(inRoom,split(`players/${P1}/xp/total`),9600);ok(W(rich,P1,{[`rooms/ROOM01/reactions/${P1}`]:{e:'🐐',at:NOW}}),'level 20 emote');}
ok(W(db,ADMIN,{emotes:P.emoteTable()})&&!W(db,HOST,{emotes:P.emoteTable()}),'only admin writes emote table');
// Räume löschen
ok(W(db,HOST,{'rooms/ROOM01':null}),'owner deletes own room');ok(W(db,ADMIN,{'rooms/ROOM03':null}),'admin deletes any room');
ok(!W(db,P1,{'rooms/ROOM01':null}),'player cannot delete room');ok(!W(db,HOST,{'rooms/ROOM01':{meta:{ownerUid:HOST}}}),'room-level write only for deletion');
ok(canRead(db,ADMIN,'rooms')&&!canRead(db,HOST,'rooms'),'only admin lists rooms');
// Moderator-Statistik, eigene Räume
ok(W(db,HOST,{[`modStats/${HOST}/demo`]:{title:'Demo',games:1,q:{m1:{n:3,c:2,t:'x',type:'mc'}}}}),'moderator saves own stats');
ok(!W(db,P1,{[`modStats/${P1}/demo`]:{title:'Demo',games:1}}),'non-moderator cannot save stats');
ok(!W(db,HOST,{[`modStats/${P1}/demo`]:{title:'Demo',games:1}}),'no foreign stats');
ok(W(db,HOST,{[`userRooms/${HOST}/ROOM01`]:NOW})&&!W(db,HOST,{[`userRooms/${P1}/ROOM01`]:NOW}),'own room list');

// ---------- Speichern am Spielende gegen die echten Regeln (nachgebaute Datenbank) ----------
function fakeContext(dbState,uid,anonymous=false){
 const getAt=p=>{const v=split(p).reduce((o,k)=>o==null?undefined:o[k],dbState.tree);return v===undefined?null:clone(v)};
 const apply=(updates)=>{if(!canWrite(dbState.tree,uid,updates,{now:NOW}))throw Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});for(const[p,v]of Object.entries(updates))dbState.tree=setIn(dbState.tree,split(p),v)};
 const join=(a,b)=>split(a).concat(split(b)).join('/');
 return {auth:{currentUser:{uid,isAnonymous:anonymous}},db:{},serverOffset:0,modules:{database:{
  ref:(_db,p)=>({path:p||''}),get:async r=>({val:()=>getAt(r.path),exists:()=>getAt(r.path)!=null}),
  update:async(r,u)=>apply(Object.fromEntries(Object.entries(u).map(([k,v])=>[join(r.path,k),v]))),
  set:async(r,v)=>apply({[r.path]:v}),remove:async r=>apply({[r.path]:null})}}};}
(async()=>{
 const g2=play(['Anna','Ben','Cleo','Gast'],[['a','a','a','a','a'],['a','a','b','b','a'],['b','b','b','a','a'],['a','a','a','a','a']]);
 const [a,b,c,guest]=g2.ids;const state=clone(g2.state);state.players.forEach(p=>{p.account=p.id!==guest});
 const room={meta:{ownerUid:HOST,createdAt:1,quizTitle:'Demo',schemaVersion:1},profiles:Object.fromEntries(state.players.map(p=>[p.id,profile(p.name)])),public:{}};
 const dbState={tree:{moderators:{[HOST]:{grantedAt:1,grantedBy:ADMIN}},players:{[b]:{xp:xpNode(580,NOW-3600e3,580,'OLD001')}},rooms:{ROOM09:room}}};
 const engine={context:fakeContext(dbState,HOST),code:'ROOM09',userId:HOST};
 const sum=await PS.saveGame(engine,state);
 const expected=P.gameResults(state,{ownerUid:HOST}).players;
 ok(sum.eligible&&sum.saved.length===3&&sum.skipped===1&&sum.errors===0,'saveGame: 3 accounts saved, guest skipped '+JSON.stringify(sum));
 const t=dbState.tree;
 ok(t.players[a].xp.total===expected[a].xp&&t.players[a].games.ROOM09.xp===expected[a].xp&&t.players[a].games.ROOM09.quizTitle==='Demo','Anna XP stored: '+t.players[a].xp.total);
 ok(t.players[b].xp.total===600&&t.players[b].games.ROOM09.xp===20&&t.players[b].games.ROOM09.xpEarned===expected[b].xp,'Ben hits day cap (20 of '+expected[b].xp+')');
 ok(!t.players[guest],'guest gets nothing');
 ok(t.rooms.ROOM09.host.results[a]===expected[a].xp&&t.rooms.ROOM09.host.modStatsSaved===true,'markers in room');
 ok(t.modStats[HOST].demo_quiz.games===1&&t.modStats[HOST].demo_quiz.q.m1.n===4,'moderator stats stored');
 const again=await PS.saveGame(engine,state);
 ok(again.saved.length===3&&again.errors===0&&t.players[a].xp.total===expected[a].xp&&dbState.tree.modStats[HOST].demo_quiz.games===1,'second call changes nothing');
 {const empty=clone(state);empty.scoredQuestionIds=[];const r=await PS.saveGame(Object.assign({},engine,{code:'ROOM10'}),empty);ok(r.saved.length===0&&/nichts gespeichert/.test(r.reason),'no scored question → nothing saved');}
 // Aufräumen eigener Räume
 dbState.tree=setIn(dbState.tree,split(`userRooms/${HOST}/OLD001`),NOW-2*DAY);dbState.tree=setIn(dbState.tree,split('rooms/OLD001/meta'),{ownerUid:HOST,createdAt:NOW-2*DAY,quizTitle:'x',schemaVersion:1});
 const removed=await PS.rememberRoom(engine.context,'ROOM09',NOW);
 ok(removed===1&&!dbState.tree.rooms.OLD001&&dbState.tree.rooms.ROOM09&&dbState.tree.userRooms[HOST].ROOM09===NOW&&!dbState.tree.userRooms[HOST].OLD001,'own rooms older than 24 h removed');
 // Bestenliste synchronisieren (Opt-in)
 const pctx=fakeContext(dbState,a);
 ok(await PS.syncLeaderboard(pctx,a)===false&&!dbState.tree.leaderboard,'no opt-in → not listed');
 await PS.saveProfile(pctx,a,{name:'Anna',board:true});ok(dbState.tree.leaderboard[a].xp===expected[a].xp,'opt-in → listed with real XP');
 await PS.saveProfile(pctx,a,{name:'Anna',board:false});ok(!dbState.tree.leaderboard,'opt-out → removed');
 // Admin: Emotes
 const actx=fakeContext(Object.assign(dbState,{tree:setIn(dbState.tree,split(`admins/${ADMIN}`),true)}),ADMIN);
 ok(await PS.syncEmotes(actx)===true&&await PS.syncEmotes(actx)===false&&dbState.tree.emotes['🥳']===50,'emote table synced once');
 finish();
})().catch(e=>{ok(false,'async '+e.stack);finish()});

// ---------- Einbindung ----------
ok(code('js/core/app.js').includes("APP_VERSION = 'v28'"),'version v28');
ok(fs.existsSync(path.join(root,'profil.html'))&&['progress.js','progress-store.js','profile-view.js','account-ui.js'].every(f=>code('profil.html').includes(f)),'profil.html');
ok(['progress.js','progress-store.js','account-ui.js'].every(f=>code('spieler.html').includes(f))&&code('spieler.html').includes('id="join-account"'),'player page: account + XP');
ok(code('moderator.html').includes('progress-store.js')&&code('zuschauer.html').includes('progress.js')&&code('admin.html').includes('progress-store.js')&&code('admin.html').includes('id="cleanup-rooms"'),'other pages load v28 modules');
ok(['index.html','moderator.html','spieler.html','zuschauer.html','editor.html','admin.html','profil.html'].every(f=>!code(f).includes('?v=27')),'cache version bumped');
ok(code('js/views/moderator-view.js').includes('engine.saveResults')&&code('js/core/online-session-engine.js').includes('saveResults')&&code('js/core/session-engine.js').includes('saveResults'),'both engines: saveResults');
ok(code('FIREBASE_SETUP.md').includes('v28')&&code('CHANGELOG.md').includes('## v28'),'docs updated');
let finished=false;function finish(){if(finished)return;finished=true;setTimeout(()=>{console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0)},10)}
