// v25: Einordnen – Spiellogik (reihum, Leben, Nachzieh-Regel, Aufdecken), Punkte, Einbindung; Avatar-Fix
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,S=ctx.window.SchmobinSession,T=ctx.window.SylasphereTypes;
const def=T.get('ranking');const G=def.game;
ok(def&&def.label==='Einordnen'&&Q.SUPPORTED_TYPES.includes('ranking')&&!def.hidden,'type registered and visible');
const mk=extra=>{const q=Object.assign({id:'r',type:'ranking',text:'x',category:'x',points:100,scale:'Einwohner',unit:'Mio.',anchor:0,items:[{name:'D',value:84},{name:'F',value:67},{name:'P',value:38},{name:'J',value:122},{name:'A',value:9}]},extra);def.normalize(q,{});return q;};
const noShuffle=()=>0.999;
const R=G.REVEAL_MS;
const place=(g,q,pid,item)=>{const vals=g.line.map(e=>q.items[e.i].value);const v=q.items[item].value;let slot=vals.findIndex(x=>x>=v);if(slot<0)slot=vals.length;return G.input(g,q,pid,{turn:g.turn,item,slot},1);};
const miss=(g,q,pid,item)=>{const vals=g.line.map(e=>q.items[e.i].value);const v=q.items[item].value;let good=vals.findIndex(x=>x>=v);if(good<0)good=vals.length;const slot=good===0?vals.length:0;return G.input(g,q,pid,{turn:g.turn,item,slot},1);};
const after=g=>G.tick(g,null,Date.now()+99999);
let q=mk();ok(q.cardPoints===10&&q.placePoints.join()==='100,60,30'&&q.revealValues==='end'&&q.showAnchor===true,'defaults: 10 per card, 100/60/30, values at the end, anchor visible');
let g=G.start(q,['a','b','c'],1000,noShuffle);
ok(g.phase==='play'&&g.line.length===1&&g.line[0].v===84&&g.pool.length===4,'start: anchor with value on the line');
const first=g.active;
let g2=place(g,q,first,1);
ok(g2.reveal.reason==='correct'&&g2.line.length===2&&g2.line[0].v===null&&g2.reveal.value===undefined,'hidden mode: correct card placed without value');
ok(G.input(g,q,'zz',{turn:1,item:1,slot:0},2000)===g&&G.input(g,q,first,{turn:2,item:1,slot:0},2000)===g,'only active player, current turn');
let g3=after(g2);ok(g3.phase==='play'&&g3.active!==first&&g3.turn===2,'next player after reveal');
const second=g3.active;let g4=miss(g3,q,second,3);
ok(g4.reveal.reason==='wrong'&&g4.lives[second]===2&&g4.pool.includes(3),'wrong: life lost, card back');
// sofort-Modus
const qi=mk({revealValues:'instant'});let gi=place(G.start(qi,['a'],0,noShuffle),qi,'a',1);ok(gi.line[0].v===67&&gi.reveal.value===67,'instant mode shows value');
// Öffentliche Frage
ok(Q.publicQuestion(q,false).items.every(i=>!('value' in i))&&Q.publicQuestion(q,false).anchorValue===84,'public: values hidden, anchor visible');
const qa=mk({showAnchor:false});ok(Q.publicQuestion(qa,false).anchorValue===null&&G.start(qa,['a'],0,noShuffle).line[0].v===null,'anchor value can be hidden too');
// Letzte Chance → Sieg
q=mk({lives:1});g=G.start(q,['a','b'],0,noShuffle);const A=g.active,B=g.order.find(x=>x!==A);
g=after(miss(g,q,A,3));ok(g.lastChance&&g.active===B&&g.eliminated.includes(A),'last chance for the remaining player');
let w=after(place(g,q,B,1));ok(w.phase==='done'&&w.winner===B&&w.endReason==='last-chance-won','hit on last chance = win');
// Stechen
let s1=after(miss(g,q,B,3));ok(s1.shootout&&s1.active===A&&!s1.eliminated.includes(A)&&s1.phase==='play','miss on last chance → shootout, eliminated player starts');
let s2=after(miss(s1,q,A,3));ok(s2.active===B&&s2.phase==='play','shootout: other player answers');
let s3=after(place(s2,q,B,1));ok(s3.phase==='done'&&s3.winner===B&&s3.endReason==='shootout','shootout: hit while other missed wins');
let t1=after(place(s1,q,A,1));let t2=after(place(t1,q,B,2));ok(t2.phase==='play'&&t2.shootout.round===2&&t2.active===A,'both hit → next round');
let t3=after(place(t2,q,A,4));let t4=after(miss(t3,q,B,3));ok(t4.winner===A,'round 2: A hits, B misses → A wins');
ok(s2.lives[A]===0,'no lives lost in shootout');
// Karten aus
q=mk();g=G.start(q,['a'],0,noShuffle);for(const it of [4,2,1,3]) g=after(place(g,q,'a',it));
ok(g.phase==='done'&&g.endReason==='all-placed'&&g.line.map(e=>q.items[e.i].value).join()==='9,38,67,84,122','all cards placed ends the game');
const u=G.act(g,q,'uncover',1);ok(u.phase==='uncovered'&&u.uncovered[0].v===9&&u.uncovered.length===5,'uncover shows all values');
// Zeitlimit, Pause, Überspringen
q=mk({turnSeconds:10});g=G.start(q,['a','b'],0,noShuffle);const act0=g.active;
ok(G.tick(g,q,5000)===g,'no timeout before time');
let p=G.act(g,q,'pause',4000);ok(p.phase==='paused'&&p.turnLeftMs===6000,'pause keeps remaining turn time');
let r=G.act(p,q,'resume',100000);ok(r.phase==='play'&&G.turnRemaining(r,q,100000)===6000,'resume continues the clock');
let to=G.tick(r,q,106001);ok(to.reveal.reason==='timeout'&&to.lives[act0]===2,'timeout costs a life');
let sk=G.act(G.start(q,['a','b'],0,noShuffle),q,'skip',10);ok(sk.reveal.reason==='skip'&&Object.values(sk.lives).every(l=>l===3),'skip costs nothing');
// Platzierung + Punkte
q=mk({lives:1});g=G.start(q,['a','b','c'],0,noShuffle);const [p1,p2,p3]=g.order;
g=after(place(g,q,p1,1));g=after(miss(g,q,p2,3));g=after(miss(g,q,p3,3));/* p2,p3 raus → p1 Letzte Chance */g=after(place(g,q,p1,2));
const pl=G.placements(g);ok(pl.map(x=>x.playerId).join()===[p1,p3,p2].join(),'placements: winner, then last eliminated first');
ok(G.pointsFor(q,pl[0],100)===120&&G.pointsFor(q,pl[1],100)===60&&G.pointsFor(q,pl[2],100)===30,'points: 2 cards + 100 % = 120, 60 %, 30 %');
ok(G.pointsFor(q,pl[0],200)===240,'round multiplier applies to card and place points');
// Engine
{const q1=mk({lives:1});const e=S.create({quiz:{title:'t',rounds:[{questions:[q1]}]}});const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐐');e.startGame();e.startQuestion();
 let game=G.start(q1,[a,b],0,noShuffle);const x=game.active,y=game.order.find(i=>i!==x);
 game=after(place(game,q1,x,1));game=after(miss(game,q1,y,3));game=after(place(game,q1,x,2));
 e.setGame(game);e.lockQuestion();e.resolveQuestion();const st=e.load();const pts=Object.fromEntries(st.players.map(p=>[p.id,p.score]));
 ok(pts[x]===120&&pts[y]===60,'engine: winner 120, second 60 ('+JSON.stringify(pts)+')');
 ok(/1\. Platz · 2 Karten richtig · 🏆 Sieger/.test(st.answers.r[x].scoreDetail),'score detail');}
// alte Fragen (v25)
const old={id:'o',type:'ranking',text:'x',category:'x',points:50,scoring:'fixed',growth:1.5,items:[{name:'A',value:1},{name:'B',value:2},{name:'C',value:3}]};def.normalize(old,{});
ok(old.cardPoints===50&&!('scoring' in old)&&old.revealValues==='end','v25 questions migrate (old points become points per card)');
// Liste einfügen
const parsed=G.parseList('Frankreich; 66,7; ./a.svg\nPolen\t37,8\nIndien; 1.476,6\nkaputt');
ok(parsed.length===3&&parsed[0].value===66.7&&parsed[1].value===37.8&&parsed[2].value===1476.6&&parsed[0].image==='./a.svg','paste list (German numbers, tabs)');
ok(G.fmtValue(1476.6,'Mio.')==='1.476,6 Mio.','German number format');
// Validierung
const bad={id:'b',type:'ranking',text:'x',category:'x',points:10,items:[{name:'A',value:1},{name:'',value:null}]};def.normalize(bad,{});
const rep={errors:[],warns:[],error(f,m){this.errors.push(m)},warn(f,m){this.warns.push(m)}};def.validate(bad,rep);ok(rep.errors.length>=3,'validator: too few cards, missing name/value');
// Einbindung
const mv=code('js/views/moderator-view.js'),pv=code('js/views/player-view.js');
ok(mv.includes('Game.host')&&mv.includes('Game.input(game, q, game.active, answer')&&mv.includes('Game.panel'),'moderator hosts the game');
ok(pv.includes('onInput')&&pv.includes('playerStatus'),'player sends moves');
ok(code('js/core/online-session-engine.js').includes('turnStartedAt'),'online time sync for turn timer');
// Demo + Flaggen
const demo=JSON.parse(code('data/quiz-einordnen-demo.json'));const qs=demo.quiz.rounds[0].questions;
ok(qs.length===2&&qs.every(x=>x.type==='ranking')&&qs[0].items.length===18&&qs[0].revealValues==='end'&&qs[1].revealValues==='instant','demo: population (values at end) + area (instant)');
qs.forEach(x=>x.items.forEach(i=>ok(fs.existsSync(path.join(root,i.image.replace('./',''))),`flag exists ${i.image}`)));
ok(JSON.parse(code('data/quiz-list.json')).some(x=>x.file==='quiz-einordnen-demo.json'),'demo listed');
// Avatar-Fix
ok(code('css/main.css').includes('.leader-row{display:grid;grid-template-columns:28px auto minmax(0,1fr) auto;'),'leader row avatar column fits the avatar');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
