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
const mk=extra=>{const q=Object.assign({id:'r',type:'ranking',text:'x',category:'x',points:50,scale:'Einwohner',unit:'Mio.',anchor:0,items:[{name:'D',value:84},{name:'F',value:67},{name:'P',value:38},{name:'J',value:122},{name:'A',value:9}]},extra);def.normalize(q,{});return q;};
const noShuffle=()=>0.999; // rand≈1 → Reihenfolge bleibt fast gleich
let q=mk();let g=G.start(q,['a','b','c'],1000,noShuffle);
ok(g.phase==='play'&&g.line.length===1&&g.line[0].v===84&&g.pool.length===4&&!g.pool.includes(0),'start: anchor on line, rest in pool');
ok(Object.values(g.lives).every(l=>l===3),'3 lives each');
const first=g.active;
// richtig: F (67) links vom Anker
let g2=G.input(g,q,first,{turn:1,item:1,slot:0},2000);
ok(g2.phase==='reveal'&&g2.reveal.reason==='correct'&&g2.line.map(e=>e.v).join()==='67,84'&&!g2.pool.includes(1),'correct placement stays on line');
ok(g2.earned[first]===1&&g2.correct[first]===1,'correct counted');
ok(G.input(g,q,'zz',{turn:1,item:1,slot:0},2000)===g,'only active player may move');
ok(G.input(g,q,first,{turn:2,item:1,slot:0},2000)===g,'stale turn ignored');
// Anzeige läuft ab → nächster Spieler
let g3=G.tick(g2,q,2000+G.REVEAL_MS.correct+1);
ok(g3.phase==='play'&&g3.active!==first&&g3.turn===2,'next player after reveal');
// falsch: J (122) ganz links → Leben weg, Karte zurück
const second=g3.active;let g4=G.input(g3,q,second,{turn:2,item:3,slot:0},9000);
ok(g4.reveal.reason==='wrong'&&g4.lives[second]===2&&g4.pool.includes(3)&&g4.line.length===2&&g4.reveal.value===undefined,'wrong: life lost, card back, value stays secret');
// Werte bleiben für Spieler geheim
const pq=Q.publicQuestion(q,false);ok(pq.items.every(i=>!('value' in i))&&pq.anchorValue===84,'public question hides values except anchor');
// Nachzieh-Regel: 2 Spieler, a verliert letztes Leben → b zieht noch einmal
q=mk({lives:1});g=G.start(q,['a','b'],0,noShuffle);const A=g.active,B=g.order.find(x=>x!==A);
g=G.input(g,q,A,{turn:1,item:3,slot:0},10);g=G.tick(g,q,10+G.REVEAL_MS.wrong+1);
ok(g.phase==='play'&&g.active===B&&g.lastChance===true&&g.eliminated.includes(A),'last chance for the remaining player');
let win=G.input(g,q,B,{turn:g.turn,item:1,slot:0},20000);win=G.tick(win,q,20000+G.REVEAL_MS.correct+1);
ok(win.phase==='done'&&win.winner===B&&win.endReason==='last-chance-won','right on last chance = winner');
let lose=G.input(g,q,B,{turn:g.turn,item:3,slot:0},20000);lose=G.tick(lose,q,20000+G.REVEAL_MS.wrong+1);
ok(lose.phase==='done'&&!lose.winner&&lose.endReason==='last-chance-lost','wrong on last chance = no winner');
// alle Karten gelegt
q=mk();g=G.start(q,['a'],0,noShuffle);let t=0;
const order=[4,2,1,3];// A9,P38,F67,J122 → richtige Slots nacheinander
for(const item of order){const line=g.line.map(e=>e.v);const v=q.items[item].value;let slot=line.findIndex(x=>x>=v);if(slot<0)slot=line.length;g=G.input(g,q,'a',{turn:g.turn,item,slot},t+=1);g=G.tick(g,q,t+=5000);}
ok(g.phase==='done'&&g.endReason==='all-placed'&&g.line.map(e=>e.v).join()==='9,38,67,84,122','all cards placed ends the game');
// Aufdecken
const u=G.act(g,q,'uncover',t+1);ok(u.phase==='uncovered'&&u.uncovered.length===5&&u.uncovered[0].v===9,'uncover shows full order');
// Zeitlimit, Pause, Überspringen
q=mk({turnSeconds:10});g=G.start(q,['a','b'],0,noShuffle);const act0=g.active;
ok(G.tick(g,q,5000)===g,'no timeout before time');
let p=G.act(g,q,'pause',4000);ok(p.phase==='paused'&&p.turnLeftMs===6000,'pause keeps remaining turn time');
let r=G.act(p,q,'resume',100000);ok(r.phase==='play'&&G.turnRemaining(r,q,100000)===6000,'resume continues the clock');
let to=G.tick(r,q,106001);ok(to.reveal.reason==='timeout'&&to.lives[act0]===2,'timeout costs a life');
let sk=G.act(G.start(q,['a','b'],0,noShuffle),q,'skip',10);ok(sk.reveal.reason==='skip'&&Object.values(sk.lives).every(l=>l===3),'skip costs nothing');
// Punkte: steigend
q=mk({scoring:'growing',growth:1.5});ok([1,2,3].map(n=>G.factorFor(q,n)).join()==='1,1.5,2','growing factor 1 / 1.5 / 2');
// Engine: Auflösen vergibt Punkte nach eingeordneten Karten
{const q1=mk();const e=S.create({quiz:{title:'t',rounds:[{questions:[q1]}]}});const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐐');e.startGame();e.startQuestion();
 let s=e.load();let game=G.start(s.quiz.quiz.rounds[0].questions[0],[a,b],0,noShuffle);const who=game.active;
 game=G.input(game,q1,who,{turn:1,item:1,slot:0},1);game=G.tick(game,q1,9999);game=G.act(G.normalize(Object.assign(game,{})),q1,'stop',10000);
 e.setGame(game);e.lockQuestion();e.resolveQuestion();s=e.load();
 const pts=Object.fromEntries(s.players.map(p=>[p.id,p.score]));ok(pts[who]===50&&Object.values(pts).reduce((x,y)=>x+y,0)===50,'engine awards 50 per correct card');
 const rec=s.answers.r?.[who];ok(rec&&/1 Karte richtig/.test(rec.scoreDetail),'score detail');}
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
ok(qs.length===2&&qs.every(x=>x.type==='ranking')&&qs[0].items.length===18,'demo: population + area');
qs.forEach(x=>x.items.forEach(i=>ok(fs.existsSync(path.join(root,i.image.replace('./',''))),`flag exists ${i.image}`)));
ok(JSON.parse(code('data/quiz-list.json')).some(x=>x.file==='quiz-einordnen-demo.json'),'demo listed');
// Avatar-Fix
ok(code('css/main.css').includes('.leader-row{display:grid;grid-template-columns:28px auto minmax(0,1fr) auto;'),'leader row avatar column fits the avatar');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
