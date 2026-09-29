// v32: Fragetypen verfeinern – Einordnen (Runden + Stechen), Dilemma (Mehrheit ab 2 Stimmen), Präsentation, Grid-Einfügen
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
const names=['A','B','C','D','E','F','G','H','I'];
const mk9=extra=>{const q=Object.assign({id:'r9',type:'ranking',text:'x',category:'x',points:100,anchor:0,items:names.map((n,i)=>({name:n,value:(i+1)*10}))},extra);def.normalize(q,{});return q;};
const pick=g=>g.pool[0];
const hit=(g,q,pid)=>place(g,q,pid,pick(g)), no=(g,q,pid)=>miss(g,q,pid,pick(g));
// ---------- Beispiel aus der Vorgabe ----------
{const q=mk9({lives:2});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(no(g,q,A));g=after(hit(g,q,B));ok(g.round===2&&g.active===A,'Runde 2 beginnt wieder bei A');
 g=after(no(g,q,A));ok(g.eliminated.includes(A)&&g.phase==='play'&&g.active===B,'A fällt auf 0 – Runde wird zu Ende gespielt');
 g=after(no(g,q,B));ok(g.phase==='done'&&g.winner===B&&!g.shootout&&g.endReason==='last-standing','A (1 Leben) falsch → 0, B (2 Leben) falsch → 1 → B gewinnt ohne Stechen');
 const pl=G.placements(g);ok(pl[0].playerId===B&&pl[0].rank===1&&pl[1].rank===2,'B Platz 1, A Platz 2');}
// ---------- Runden: jeder mit Leben genau einmal ----------
{const q=mk9({lives:2});let g=G.start(q,['a','b','c'],0,noShuffle);const O=g.order;const seen=[];
 for(let i=0;i<3;i++){seen.push(g.active);g=after(hit(g,q,g.active));}
 ok(seen.join()===O.join()&&g.round===2&&g.active===O[0],'eine Runde = jeder einmal in fester Reihenfolge');
 ok(g.roundLeft.join()===O.slice(1).join(),'„noch dran“ in der Runde');}
// ---------- Stechen mit 3 Spielern, Falsche fliegen raus ----------
{const q=mk9({lives:1});let g=G.start(q,['a','b','c'],0,noShuffle);const [A,B,C]=g.order;
 g=after(no(g,q,A));g=after(no(g,q,B));g=after(no(g,q,C));
 ok(g.shootout&&g.shootout.players.join()===[A,B,C].join()&&g.active===A,'alle drei in Runde 1 raus → Stechen zu dritt');
 g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(no(g,q,C));
 ok(g.phase==='play'&&g.shootout.players.join()===[A,B].join()&&g.shootout.dropped[C]===1&&g.shootout.round===2,'A, B richtig, C falsch → C fliegt raus');
 g=after(no(g,q,A));g=after(hit(g,q,B));ok(g.phase==='done'&&g.winner===B&&g.endReason==='shootout','Stechrunde 2: nur B richtig → B gewinnt');
 const pl=G.placements(g);ok(pl.map(p=>p.playerId+p.rank).join()===[B+1,A+2,C+3].join(),'Platz: B, dann A (länger im Stechen), dann C');}
// ---------- 3 Stechrunden ohne Entscheidung → richtige Karten ----------
{const q=mk9({lives:1});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(hit(g,q,A));g=after(no(g,q,B));/* Runde 2: A richtig, B raus → A allein → Sieg? */
 ok(g.phase==='done'&&g.winner===A,'Kontrolle: A gewinnt, wenn B allein ausscheidet');
 g=G.start(q,['a','b'],0,noShuffle);g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(no(g,q,A));g=after(no(g,q,B));
 ok(g.shootout&&g.round===2,'beide in Runde 2 raus → Stechen');
 g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(no(g,q,A));g=after(no(g,q,B));g=after(hit(g,q,A));g=after(hit(g,q,B));
 ok(g.phase==='done'&&g.endReason==='shootout-cards'&&g.winners.length===2&&!g.winner,'3 Stechrunden ohne Entscheidung, gleich viele Karten → geteilter Sieg');
 const pl=G.placements(g);ok(pl[0].rank===1&&pl[1].rank===1&&pl[0].tied,'geteilter 1. Platz');
 ok(G.pointsFor(q,pl[0],100)===G.pointsFor(q,pl[1],100),'geteilte Plätze = gleiche Punkte');
 let h=G.start(q,['a','b'],0,noShuffle);h=after(hit(h,q,A));h=after(no(h,q,B));/* B raus in R1, A lebt → A Sieg */ok(h.winner===A,'Kontrolle 2');
 h=G.start(q,['a','b'],0,noShuffle);h=after(hit(h,q,A));h=after(hit(h,q,B));h=after(hit(h,q,A));h=after(hit(h,q,B));h=after(no(h,q,A));h=after(no(h,q,B));
 h=after(no(h,q,A));h=after(no(h,q,B));h=after(no(h,q,A));h=after(no(h,q,B));h=after(no(h,q,A));h=after(no(h,q,B));
 ok(h.phase==='done'&&h.endReason==='shootout-cards'&&h.winners.length===2,'3× beide falsch → Entscheidung nach Karten (hier gleich → geteilt)');
 let k=G.start(q,['a','b'],0,noShuffle);k=after(hit(k,q,A));k=after(hit(k,q,B));k=after(hit(k,q,A));k=after(hit(k,q,B));k=after(hit(k,q,A));k=after(hit(k,q,B));
 /* R4 */k=after(hit(k,q,A));k=after(no(k,q,B));ok(k.winner===A,'Kontrolle 3');}
{const q=mk9({lives:1});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(hit(g,q,A));g=after(no(g,q,B));ok(g.winner===A,'B raus, A lebt → A');
 g=G.start(q,['a','b'],0,noShuffle);g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(hit(g,q,A));g=after(no(g,q,B));ok(g.winner===A,'ok');
 g=G.start(q,['a','b'],0,noShuffle);g=after(hit(g,q,A));g=after(no(g,q,B));
 let s=G.start(q,['a','b'],0,noShuffle);s=after(hit(s,q,A));s=after(hit(s,q,B));s=after(no(s,q,A));s=after(no(s,q,B));
 s=after(no(s,q,A));s=after(no(s,q,B));s=after(no(s,q,A));s=after(no(s,q,B));s=after(hit(s,q,A));s=after(no(s,q,B));
 ok(s.winner===A&&s.endReason==='shootout','Stechrunde 3: A richtig, B falsch → A');
 let u=G.start(q,['a','b'],0,noShuffle);u=after(hit(u,q,A));u=after(no(u,q,B));
 let v=G.start(q,['a','b'],0,noShuffle);v=after(hit(v,q,A));v=after(hit(v,q,B));v=after(hit(v,q,A));v=after(no(v,q,B));
 let x=G.start(q,['a','b'],0,noShuffle);x=after(hit(x,q,A));x=after(hit(x,q,B));x=after(no(x,q,A));x=after(no(x,q,B));/*Stechen*/x=after(no(x,q,A));x=after(no(x,q,B));x=after(no(x,q,A));x=after(no(x,q,B));x=after(no(x,q,A));x=after(no(x,q,B));
 ok(x.endReason==='shootout-cards'&&x.winners.length===2,'Karten gleich → geteilt');
 let y=G.start(q,['a','b'],0,noShuffle);y=after(hit(y,q,A));y=after(hit(y,q,B));y=after(hit(y,q,A));y=after(no(y,q,B));
 let z=G.start(q,['a','b'],0,noShuffle);z=after(hit(z,q,A));z=after(hit(z,q,B));z=after(hit(z,q,A));/* B no */
 let m=G.start(q,['a','b','c'],0,noShuffle);const [M1,M2,M3]=m.order;m=after(hit(m,q,M1));m=after(no(m,q,M2));m=after(hit(m,q,M3));
 m=after(no(m,q,M1));m=after(no(m,q,M3));ok(m.shootout&&m.shootout.players.join()===[M1,M3].join(),'Stechen nur zwischen den in dieser Runde Ausgeschiedenen');
 m=after(no(m,q,M1));m=after(no(m,q,M3));m=after(no(m,q,M1));m=after(no(m,q,M3));m=after(no(m,q,M1));m=after(no(m,q,M3));
 ok(m.endReason==='shootout-cards'&&m.winners.length===2,'Stechen 3× ohne Entscheidung, beide 1 Karte → geteilt');
 const pl=G.placements(m);ok(pl.find(p=>p.playerId===M2).rank===3,'früher Ausgeschiedener hinter den Stechern');}
{const q=mk9({lives:1});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(hit(g,q,A));g=after(no(g,q,B));ok(g.winner===A,'x');
 let s=G.start(q,['a','b'],0,noShuffle);s=after(hit(s,q,A));s=after(no(s,q,B));
 let t=G.start(q,['a','b'],0,noShuffle);t=after(no(t,q,A));t=after(hit(t,q,B));ok(t.winner===B,'Reihenfolge egal: am Rundenende zählt, wer noch Leben hat');
 let c=G.start(q,['a','b'],0,noShuffle);c=after(hit(c,q,A));c=after(hit(c,q,B));c=after(no(c,q,A));c=after(no(c,q,B));
 c=after(hit(c,q,A));c=after(hit(c,q,B));c=after(no(c,q,A));c=after(no(c,q,B));c=after(hit(c,q,A));c=after(no(c,q,B));ok(c.winner===A,'3. Stechrunde entscheidet noch');}
// Stechen: mehr richtige Karten gewinnt nach 3 Runden
{const q=mk9({lives:2});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(hit(g,q,A));g=after(no(g,q,B));/*R2*/g=after(no(g,q,A));g=after(hit(g,q,B));/*R3*/g=after(no(g,q,A));g=after(no(g,q,B));
 ok(g.shootout&&g.round===3,'beide in Runde 3 raus');
 g=after(no(g,q,A));g=after(no(g,q,B));g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(no(g,q,A));g=after(no(g,q,B));
 ok(g.phase==='done'&&g.endReason==='shootout-cards'&&g.winners.length===2,'gleich viele → geteilt');
 const q1=mk9({lives:1});let h=G.start(q1,['a','b'],0,noShuffle);h=after(G.act(h,q1,'skip',1));h=after(hit(h,q1,B));h=after(no(h,q1,A));h=after(no(h,q1,B));
 ok(h.shootout&&h.correct[A]===0&&h.correct[B]===1,'Stechen (A 0 Karten, B 1 Karte – A wurde einmal übersprungen)');
 h=after(no(h,q1,A));h=after(no(h,q1,B));h=after(no(h,q1,A));h=after(no(h,q1,B));h=after(no(h,q1,A));h=after(no(h,q1,B));
 ok(h.phase==='done'&&h.winner===B&&h.endReason==='shootout-cards','3 Stechrunden ohne Entscheidung → B mit mehr richtigen Karten gewinnt');}
// ---------- Karten gehen aus ----------
{const q=mk({lives:3});let g=G.start(q,['a','b'],0,noShuffle);const [A,B]=g.order;
 g=after(hit(g,q,A));g=after(no(g,q,B));g=after(hit(g,q,A));g=after(hit(g,q,B));g=after(hit(g,q,A));
 ok(g.phase==='done'&&g.endReason==='all-placed'&&g.winner===A,'Karten aus: mehr Leben gewinnt (A 3 ❤, B 2 ❤)');
 let h=G.start(q,['a','b'],0,noShuffle);h=after(hit(h,q,A));h=after(hit(h,q,B));h=after(hit(h,q,A));h=after(hit(h,q,B));
 ok(h.endReason==='all-placed'&&h.winners.length===2,'Karten aus, gleiche Leben und Karten → geteilt');}
{const q3=Object.assign({id:'r3',type:'ranking',text:'x',category:'x',points:100,anchor:0,lives:1,items:[{name:'A',value:1},{name:'B',value:2},{name:'C',value:3}]});def.normalize(q3,{});
 let g=G.start(q3,['a','b'],0,noShuffle);const [A,B]=g.order;g=after(no(g,q3,A));g=after(no(g,q3,B));ok(g.shootout,'Stechen');
 g=after(hit(g,q3,A));g=after(hit(g,q3,B));ok(g.phase==='done'&&g.endReason==='shootout-cards'&&g.winners.length===2,'Karten gehen im Stechen aus → richtige Karten, sonst geteilt');}
{const q3=Object.assign({id:'r4',type:'ranking',text:'x',category:'x',points:100,anchor:0,lives:1,items:[{name:'A',value:1},{name:'B',value:2},{name:'C',value:3}]});def.normalize(q3,{});
 let g=G.start(q3,['a','b'],0,noShuffle);const [A,B]=g.order;g=after(hit(g,q3,A));g=after(no(g,q3,B));ok(g.winner===A,'k');}
// ---------- Anzeige ----------
{const q=mk9({lives:1});let g=G.start(q,['a','b','c'],0,noShuffle);const nm=id=>id.toUpperCase();
 const panel=G.panel(q,g,{esc:x=>String(x),name:nm,count:3});ok(/Runde 1/.test(panel)&&/noch dran/.test(panel),'Moderator-Panel: „Runde 1 · noch dran: …“');
 g=after(no(g,q,g.active));g=after(no(g,q,g.active));g=after(no(g,q,g.active));const p2=G.panel(q,g,{esc:x=>String(x),name:nm,count:3});ok(/Stechen · Runde 1\/3/.test(p2),'Moderator-Panel: Stechen · Runde 1/3');}
ok(!code('js/question-types/types/ranking.js').includes('lastChance'),'„letzte Chance“ entfernt');

// ---------- Dilemma: Mehrheit ab 2 Stimmen ----------
{const C=T.get('consensus');const q={id:'c',type:'consensus',text:'?',category:'x',points:80,options:['A','B','C']};C.normalize(q,{});const [a,b,c]=q.options.map(o=>o.id);
 const sub=arr=>Object.fromEntries(arr.map((x,i)=>['p'+i,{answer:x}]));
 const sc=(arr,ans)=>{const r=C.resolve(q,sub(arr));return C.score(q,ans,{base:80,result:r});};
 let r=C.resolve(q,sub([a,b,c]));ok(r.noMajority&&!r.winningOptionIds.length&&C.solutionText(q,r)==='Keine Mehrheit','1:1:1 → keine Mehrheit');
 ok(sc([a,b,c],a).points===0&&/Keine Mehrheit/.test(sc([a,b,c],a).detail),'1:1:1 → niemand bekommt Punkte');
 ok(sc([a,b],a).points===0,'1:1 bei 2 Spielern → keine Punkte');
 ok(sc([a],a).points===0,'1 Spieler → nie Punkte');
 ok(sc([a,a,b],a).points===80&&sc([a,a,b],b).points===0,'2:1 → Mehrheit bekommt Punkte');
 ok(sc([a,a,b,b],a).points===80&&sc([a,a,b,b],b).points===80,'2:2 → beide Mehrheitsgruppen');
 ok(sc([a,a,b,b,c],c).points===0,'2:2:1 → Einzelstimme leer');}
// ---------- Präsentation (Beamer/Moderator) ----------
{const need=['estimate','hotspot','song-reveal','matching','fight-list','sort'];ok(need.every(t=>typeof T.get(t).present==='function'),'Präsentations-Render pro Typ in der Registry');
 ok(T.get('song-reveal').presentLive&&T.get('song-reveal').presentShowsSolution&&T.get('estimate').presentShowsSolution,'Song: live + Lösung nicht doppelt');
 ok(T.get('multiple-choice').present===null,'andere Typen fallen auf render (schreibgeschützt) zurück');
 const E=T.get('estimate');const eq={id:'e',type:'estimate',text:'x',category:'x',points:100,min:150,max:250,correctAnswer:206};E.normalize(eq);
 const entries=Q.answerEntries(eq,{a:{answer:200,awardedPoints:0},b:{answer:206,awardedPoints:100},c:{answer:''}},id=>id);
 ok(entries.find(e=>e.playerId==='a').mark===200&&entries.find(e=>e.playerId==='b').mark===206&&!('mark' in entries.find(e=>e.playerId==='c')),'Schätzwerte der Spieler landen im Ergebnis (für Avatare auf der Skala)');
 const H=T.get('hotspot');ok(JSON.stringify(H.mark({},{x:50,y:14,r:1}))==='{"x":50,"y":14}'&&H.mark({},null)===null,'Hotspot: Klickpunkte im Ergebnis');
 ok(Q.answerEntries({id:'m',type:'multiple-choice',options:[{id:'a',text:'A'}]},{a:{answer:'a'}},id=>id).every(e=>!('mark' in e)),'andere Typen ohne mark');}
const sv=code('js/views/spectator-view.js'),mv=code('js/views/moderator-view.js'),css=code('css/main.css');
ok(sv.includes('Renderers.renderPresent')&&mv.includes('Renderers.renderPresent'),'Beamer und Moderator-Mitte nutzen die Präsentation');
ok(sv.includes("'eingeloggt'")&&sv.includes('presentShowsSolution'),'Song: „x von y eingeloggt“, Lösung nicht doppelt');
ok(sv.includes('function fitBeamer')&&css.includes('zoom:var(--fit,1)')&&css.includes('.beamer[data-phase="resolved"] .question-image'),'Beamer scrollt nie: Bild an Höhe, notfalls verkleinert');
ok(/els\['timer-ring'\]\.hidden = \(?pendingReveal \|\| resolved/.test(mv)&&!/Frage auflösen“/.test(mv),'Moderator: Ring nach dem Schließen weg, Hinweis passt zum Knopf');
ok(code('js/views/player-view.js').includes('function fieldError')&&css.includes('.input.is-invalid'),'Beitreten: Fehler am Feld, rot markiert');
// Online: Stufe für den Beamer im Profil (ohne Regeländerung erlaubt)
{const {canWrite}=require('./lib/rules-eval.js');const db={rooms:{R1:{meta:{ownerUid:'host'},public:{currentQuestionId:'q1'},profiles:{u1:{name:'A',avatar:'🦊',joinedAt:1,active:true}}}}};
 ok(canWrite(db,'u1',{'rooms/R1/profiles/u1/lastAnsweredQuestionId':'q1','rooms/R1/profiles/u1/lastAnswerStage':2,'rooms/R1/profiles/u1/updatedAt':5}),'Firebase-Regeln erlauben lastAnswerStage (keine Regeländerung nötig)');
 ok(code('js/core/online-session-engine.js').includes('lastAnswerStage'),'Online-Engine überträgt die Stufe');}
// ---------- 3×3-Grid: alle Felder einfügen ----------
{const Gd=T.get('grid');const nine=Array.from({length:9},(_,k)=>`A${k}, B${k}`).join('\n');
 let r=Gd.parseCells('\n'+nine+'\n\n');ok(r.ok&&r.cells.length===9&&r.cells[0].join()==='A0,B0'&&r.cells[8].join()==='A8,B8','9 Zeilen → 9 Felder (oben links → unten rechts)');
 r=Gd.parseCells('Berlin;Paris\tRom');ok(!r.ok&&r.count===1&&r.cells[0].length===3,'Komma, Semikolon, Tab trennen Antworten; zu wenig Zeilen → keine Übernahme');
 ok(!Gd.parseCells(nine.replace('A4, B4','')).ok,'leere Zeile mitten drin → nicht übernehmbar');
 ok(code('js/question-types/types/grid.js').includes('Alle Felder einfügen')&&code('js/question-types/types/grid.js').includes('grid9-paste-preview'),'Editor mit Vorschau');}
ok(/APP_VERSION = 'v(3[2-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v32'),'Version v32 + Changelog');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
