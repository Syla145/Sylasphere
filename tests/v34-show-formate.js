// v34: Show-Formate – Themen-Brett (Reihum, volle Runden, Mitraten, Doppel-Felder), Einsatz-Finale, Einbindung
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,URLSearchParams,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/',search:''},BroadcastChannel:class{postMessage(){}close(){}}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');load('js/core/show-formats.js');
const Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator,S=ctx.window.SylasphereShow,Local=ctx.window.SchmobinSession;
const mc=(i,t)=>({id:`b${i}`,type:'multiple-choice',text:`Frage ${i}`,category:'x',options:['A','B','C'],correctAnswer:'a',...t});
const boardQuiz=(extra={})=>({quiz:{title:'Show',settings:{finalWager:true},rounds:[
 {title:'Brett',format:'board',board:Object.assign({topics:['Geo','Musik','Film','Sport','Essen'],values:[100,300,500],doubles:0},extra),questions:Array.from({length:15},(_,i)=>mc(i))},
 {title:'Finale',questions:[mc(99,{id:'fin'})]}]}});
// ---------- Datenformat ----------
let v=V.validate(boardQuiz());let R=v.normalized.quiz.rounds[0];
ok(v.valid&&R.format==='board'&&R.board.values.join()==='100,300,500'&&R.board.coGuess===true,'Brett normalisiert (Standard 5×3, 100/300/500, Mitraten an)');
ok(R.questions.every(q=>q.cell)&&new Set(R.questions.map(q=>`${q.cell.t}:${q.cell.v}`)).size===15&&R.questions[0].points===100&&R.questions[2].points===500,'jede Frage hat ein Feld, Punkte = Feldwert');
{const bad=boardQuiz();bad.quiz.rounds[0].questions[3]={id:'x',type:'fight-list',text:'x',category:'x',correctAnswers:['a']};const r=V.validate(bad);ok(!r.valid&&r.errors.some(e=>/nur Multiple Choice, Schätzfrage und Song/.test(e.message)),'andere Fragetypen im Brett → Fehler');}
{const bad=boardQuiz();bad.quiz.rounds[1].questions[0]={id:'fin',type:'buzzer',text:'x',category:'x'};ok(V.validate(bad).errors.some(e=>/Einsatz-Finale/.test(e.message)),'Einsatz-Finale nur mit erlaubtem Typ');}
ok(Q.isFinalWager(v.normalized,1,0)&&!Q.isFinalWager(v.normalized,0,14),'letzte Frage = Einsatz-Finale');
// Richtig/falsch ohne Teilpunkte
{const est={id:'e',type:'estimate',text:'x',category:'x',min:0,max:1000,correctAnswer:206,tolerance:5};Q.typeDef('estimate').normalize(est);
 ok(Q.judge(est,210)&&!Q.judge(est,212)&&Q.judge(Object.assign({},est,{tolerance:null}),206)&&!Q.judge(Object.assign({},est,{tolerance:null}),207),'Schätzfrage: richtig nur innerhalb der Toleranz');
 const song={id:'s',type:'song-reveal',text:'x',category:'x',songTitle:'Hello',artist:'Adele',guessArtist:true,stages:[{duration:1,percent:100},{duration:2,percent:50}]};Q.typeDef('song-reveal').normalize(song);
 ok(Q.judge(song,{title:'hello',artist:'adele',stage:1})&&!Q.judge(song,{title:'hello',artist:'x',stage:0}),'Song: Titel und Interpret nötig, Stufe egal');}
// ---------- Reihum + volle Runden ----------
const ids4=['a','b','c','d'];
let s=S.startBoard(R,0,ids4,{rand:()=>0});
ok(s.phase==='pick'&&s.active==='a'&&s.cycle.join()==='a,b,c,d'&&S.nextUp(s)==='b','Lobby-Reihenfolge, a beginnt, danach b');
const judgeAll=ok=>()=>ok;
function play(st,who,qid,right){st=S.pick(st,R,who,qid);const sc=S.scoreCell(st,R,ids4.map(id=>({id})),{[who]:{answer:'a'}},judgeAll(right));return S.finishCell(st,R,sc.result.board,ids4);}
const qids=R.questions.map(q=>q.id);
ok(S.pick(s,R,'b',qids[0])===s,'nur wer dran ist, darf wählen');
let n=0;for(let c=0;c<3;c++)for(const id of ids4){s=play(s,id,qids[n++],true);}
ok(s.phase==='shared'&&s.shared&&S.freeCells(s,R).length===3,'4 Spieler, 15 Felder: nach 12 Wahlen bleiben 3 Felder für alle');
s=S.openShared(s,R);ok(s.current.shared&&s.phase==='play','gemeinsames Feld geöffnet');
{const sc=S.scoreCell(s,R,ids4.map(id=>({id})),{a:{answer:'a'},b:{answer:'b'},c:{answer:'a'}},(id,ans)=>ans==='a');
 ok(sc.scores.a.points===s.current.value&&sc.scores.b.points===0&&sc.scores.c.points>0&&!sc.scores.d,'gemeinsames Feld: normale Wertung für alle');
 s=S.finishCell(s,R,sc.result.board,ids4);}
s=S.openShared(s,R);s=S.finishCell(s,R,{correct:false},ids4);s=S.openShared(s,R);s=S.finishCell(s,R,{correct:false},ids4);
ok(s.phase==='done'&&S.freeCells(s,R).length===0,'alle Felder gespielt → Brett fertig');
// 3 Spieler: 15 Felder = 5 volle Runden, nichts für alle
{let t=S.startBoard(R,0,['a','b','c'],{rand:()=>0});let k=0;for(let c=0;c<5;c++)for(const id of ['a','b','c']){t=S.pick(t,R,id,qids[k++]);t=S.finishCell(t,R,{correct:true,points:100},['a','b','c']);}
 ok(t.phase==='done'&&!t.shared,'3 Spieler: 5 volle Wahl-Runden, keine Restfelder');}
// Mitraten + Wertung des Wählenden
{let t=S.startBoard(R,0,ids4,{rand:()=>0});t=S.pick(t,R,'a',qids[2]);
 const sc=S.scoreCell(t,R,ids4.map(id=>({id})),{a:{answer:'a'},b:{answer:'a'},c:{answer:'c'}},(id,ans)=>ans==='a',2);
 ok(sc.scores.a.points===1000&&sc.scores.b.points===0&&sc.result.board.alsoRight.join()==='b'&&sc.result.board.correct,'Wählender bekommt Feldwert × Multiplikator, Mitrater 0 → „hätten es auch gewusst“');
 const wrong=S.scoreCell(t,R,ids4.map(id=>({id})),{},()=>true);ok(wrong.scores.a.points===0&&!wrong.result.board.correct,'ohne Antwort: falsch, keine Minuspunkte');}
// Überspringen + Spieler weg
{let t=S.startBoard(R,0,ids4,{rand:()=>0});t=S.skipTurn(t,R,ids4);ok(t.active==='b'&&S.freeCells(t,R).length===15,'Moderator überspringt a (Feld bleibt frei)');
 t=S.pick(t,R,'b',qids[0]);t=S.finishCell(t,R,{correct:true,points:100},['a','b','d']);ok(t.active==='d','entfernter Spieler c wird übersprungen');
 t=S.pick(t,R,'x',qids[1],{force:true});ok(t.current.by==='d','Moderator wählt für den, der dran ist');}
// Doppel-Felder
{const RD=V.validate(boardQuiz({doubles:2})).normalized.quiz.rounds[0];let t=S.startBoard(RD,0,ids4,{rand:()=>0.5});
 ok(t.doubles.length===2&&t.doubles.every(id=>RD.questions.find(q=>q.id===id).cell.v>0),'2 Doppel-Felder, nie in der untersten Zeile');
 t=S.pick(t,RD,'a',t.doubles[0]);ok(t.phase==='wager'&&t.current.double,'Doppel-Feld: erst Einsatz');
 ok(S.maxDoubleStake(120,RD)===500&&S.maxDoubleStake(800,RD)===800,'Einsatz bis eigene Punkte, mindestens bis zum höchsten Feldwert');
 const t2=S.setStake(t,RD,'a',9999,120);ok(t2.current.stake===500&&t2.phase==='play','Einsatz wird begrenzt');
 const sc=S.scoreCell(t2,RD,ids4.map(id=>({id})),{a:{answer:'a'}},()=>true);ok(sc.scores.a.points===500,'richtig → +Einsatz');
 const sc2=S.scoreCell(t2,RD,ids4.map(id=>({id})),{a:{answer:'b'}},()=>false);ok(sc2.scores.a.points===0,'falsch → 0 (keine Minuspunkte)');}
// nächstes Brett
{let t=S.startBoard(R,0,ids4,{rand:()=>0});t=S.pick(t,R,'a',qids[0]);t=S.finishCell(t,R,{correct:true,points:100},ids4);
 ok(S.nextStartIndex(t,ids4)===1,'nächstes Brett beginnt beim Nächsten');
 const t2=S.startBoard(R,0,ids4,{startIndex:1,rand:()=>0});ok(t2.active==='b'&&t2.order.join()==='b,c,d,a','Reihenfolge rotiert');}
// ---------- Einsatz-Finale ----------
{const players=[{id:'a',score:400,joinedAt:1},{id:'b',score:-50,joinedAt:2},{id:'c',score:700,joinedAt:3}];
 const stakes=S.collectStakes(players,{a:{answer:{stake:1000}},b:{answer:{stake:80}}});
 ok(stakes.a===400&&stakes.b===80&&stakes.c===0,'Einsätze: max. eigene Punkte, bei ≤ 0 bis 100, ohne Einsatz 0');
 ok(S.clampFinal(150,-50)===100,'bei ≤ 0 Punkten höchstens 100');
 const r=S.scoreFinal(players,{a:{answer:'a'},b:{answer:'b'}},stakes,(id,ans)=>ans==='a');
 ok(r.scores.a.points===400&&r.scores.b.points===-80&&r.scores.c.points===0,'richtig +Einsatz, falsch −Einsatz');
 ok(r.rows.map(x=>x.id).join()==='b,a,c'&&r.rows[0].after===-130&&r.rows[1].after===800,'Auflösung vom Letzten zum Ersten, neue Punkte');
 ok(S.wagerId('fin')==='fin__einsatz','private Einsatz-Antwort');}
// Firebase lässt leere Objekte/Listen weg → normalize stellt sie wieder her
{const t=S.startBoard(R,0,ids4,{rand:()=>0});const stripped=JSON.parse(JSON.stringify(t));delete stripped.used;delete stripped.doubles;
 const n=S.normalize(stripped);ok(n.used&&typeof n.used==='object'&&Array.isArray(n.doubles)&&S.freeCells(n,R).length===15,'Brett-Stand ohne leere Felder (wie aus Firebase) bleibt spielbar');
 ok(code('js/core/online-session-engine.js').includes('SylasphereShow.normalize(pub.show)'),'online: Brett-Stand wird beim Laden normalisiert');}
// ---------- Einbindung ----------
{const pages=['moderator.html','spieler.html','zuschauer.html'];ok(pages.every(f=>code(f).includes('js/core/show-formats.js?v=34')&&code(f).includes('js/views/show-ui.js?v=34')),'Show-Module in Moderator, Spieler, Beamer eingebunden');
 const mv=code('js/views/moderator-view.js'),pv=code('js/views/player-view.js'),sv=code('js/views/spectator-view.js'),ed=code('js/editor/editor.js'),ui=code('js/views/show-ui.js');
 ok(ed.includes('function boardEditor')&&ed.includes('Letzte Frage als Einsatz-Finale')&&ed.includes('Themen-Brett'),'Editor: Raster + Einsatz-Finale');
 ok(pv.includes('data-pick-send')&&pv.includes('data-wager-send')&&pv.includes('Die Rangliste gibt es nach der Finale-Auflösung'),'Handy: Feld wählen, Einsatz, Rangliste im Finale verborgen');
 ok(mv.includes('Zurück zum Brett')&&mv.includes('Einsätze einsammeln')&&mv.includes('mitgeraten'),'Moderator: Brett-Schritte, Einsätze, Mitraten-Status');
 ok(sv.includes('leider falsch')&&ui.includes('Hätten es auch gewusst')&&ui.includes('vom Letzten zum Ersten'),'Beamer: Ergebnis, Mitraten, Finale-Auflösung');
 ok(/APP_VERSION = 'v(3[4-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v34'),'Version v34 + Changelog');}
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
