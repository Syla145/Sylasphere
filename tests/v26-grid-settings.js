// v26: 3×3-Grid (Prüfung pro Feld, Punkte, Bonus) + Einstellungen pro Gerät
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,S=ctx.window.SchmobinSession,T=ctx.window.SylasphereTypes,K=ctx.window.SylasphereTypeKit;
const def=T.get('grid');ok(def&&def.label==='3×3-Grid'&&Q.SUPPORTED_TYPES.includes('grid'),'grid registered');
const q=Object.assign({id:'g',type:'grid',category:'x'},def.defaults());def.normalize(q,{});
ok(q.rows.length===3&&q.cols.length===3&&q.cells.length===9&&q.points===20&&q.bonus===50&&q.timer===180,'defaults: 3×3, 20 per cell, bonus 50, 3 minutes');
// Treffer pro Feld
const ans=['berlin','Tokyo','Kairo','','Tokio','Dakar','Hamburg','Shanghai','Lagos'];
const m=k=>def.cellMatch(q,ans,k).kind;
ok(m(0)==='exact'&&m(1)==='fuzzy'&&m(3)==='empty'&&m(2)==='exact','exact / typo / empty');
ok(m(4)==='double','„Tokyo“ and „Tokio“ in two cells count as the same answer');
const dup=['Berlin','Tokio','Kairo','Lissabon','Tokio','Dakar','Hamburg','Shanghai','Lagos'];
ok(def.cellMatch(q,dup,4).kind==='double'&&def.cellMatch(q,dup,1).kind==='exact','same answer twice only counts once (second marked double)');
ok(Q.autoCheck(q,dup,'c0')===true&&Q.autoCheck(q,dup,'c4')===false&&Q.autoCheck(q,['Paris'],'c3')===false,'autoCheck per cell');
ok(Q.reviewParts(q).length===9&&Q.reviewParts(q)[0].label==='Hauptstadt × Europa','9 review parts with names');
// Punkte
const full=['Berlin','Tokio','Kairo','Lissabon','Colombo','Dakar','Hamburg','Shanghai','Lagos'];
ok(Q.scoreAnswer(q,full,1).points===9*20+50,'full grid: 9×20 + 50 bonus = '+Q.scoreAnswer(q,full,1).points);
ok(Q.scoreAnswer(q,dup,1).points===8*20,'8 right, no bonus');
ok(Q.scoreAnswer(q,full,2).points===2*(9*20+50),'round multiplier doubles cell points and bonus');
const verdicts={p:Object.fromEntries(Array.from({length:9},(_,k)=>[`c${k}`,k<5]))};
ok(Q.scoreAnswer(q,full,1,{verdicts},'p').points===100,'moderator verdicts override (5 right = 100)');
ok(Q.scoreAnswer(q,null,1).points===0,'no answer = 0');
// Geheim bis zur Auflösung
ok(!('cells' in Q.publicQuestion(q,false))&&Q.publicQuestion(q,true).cells.length===9,'valid answers hidden from players until reveal');
ok(def.cellMatch(Q.publicQuestion(q,false),full,0).kind==='unknown','player device cannot check answers');
// Validierung
const bad={id:'b',type:'grid',category:'x',text:'x',points:10,timer:0,rows:[{label:'A'}],cols:[],cells:[]};def.normalize(bad,{});
const rep={errors:[],warns:[],error(f,m){this.errors.push(m)},warn(f,m){this.warns.push(m)}};def.validate(bad,rep);ok(rep.errors.length>=5+9&&rep.warns.length>=1,'validator: missing headers and answers, timer tip');
// Engine: Moderator-Wertung kommt an
{const e=S.create({quiz:{title:'t',rounds:[{questions:[q]}]}});const a=e.joinPlayer('A','🦊'),b=e.joinPlayer('B','🐐');e.startGame();e.startQuestion();
 e.submitAnswer(a,full);e.submitAnswer(b,dup);e.lockQuestion();
 const v={[a]:Object.fromEntries(Array.from({length:9},(_,k)=>[`c${k}`,true])),[b]:Object.fromEntries(Array.from({length:9},(_,k)=>[`c${k}`,k!==4]))};
 e.resolveQuestion({verdicts:v});const st=e.load();const pts=Object.fromEntries(st.players.map(p=>[p.name,p.score]));
 ok(pts.A===230&&pts.B===160,'engine: A 230 (full + bonus), B 160 ('+JSON.stringify(pts)+')');}
// Kit-Vergleich (auch Fight List)
ok(K.matchTerm('Linkoln',['Abraham Lincoln']).kind==='fuzzy'&&K.matchTerm('obama',['Barack Obama']).kind==='exact'&&K.matchTerm('Bus',['George W. Bush']).kind==='none','shared fuzzy matching in kit');
// Einbindung
const mv=code('js/views/moderator-view.js');ok(mv.includes('typeDef(question.type)?.reviewPanel'),'moderator uses custom review panel');
ok(code('js/question-types/types/grid.js').includes('data-review-part="${keyOf(k)}"'),'grid review cells toggle verdicts');
ok(code('js/views/player-view.js').includes('Object.assign({ playerId }, ctx)'),'player sees own verdicts');
const demo=JSON.parse(code('data/quiz-grid-demo.json'));ok(demo.quiz.rounds[0].questions.length===2&&demo.quiz.rounds[0].questions.every(x=>x.type==='grid'),'grid demo quiz');
demo.quiz.rounds[0].questions.forEach(x=>{const d=JSON.parse(JSON.stringify(x));def.normalize(d,{});const r={errors:[],warns:[],error(f,m){this.errors.push(m)},warn(){}};def.validate(d,r);ok(!r.errors.length,`demo ${x.id} valid`);});
// Einstellungen
['spieler.html','zuschauer.html','moderator.html'].forEach(f=>ok(code(f).includes('js/core/settings.js'),`${f} has settings`));
const th=code('js/core/themes.js');ok(th.includes('setDeviceTheme')&&th.includes("'sylasphere:device-theme'"),'device theme override');
const mp=code('js/core/media-player.js');ok(mp.includes('setVolume')&&mp.includes("'sylasphere:music-volume'")&&mp.includes('master.gain.value = volume() / 100'),'music volume per device');
ok(code('js/core/app.js').includes("'v26'"),'version v26');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
