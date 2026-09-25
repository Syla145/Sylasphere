// v24: Rückmeldungen vom Quizabend – Schätzfrage-Wertung, Hotspot-Kreis, Buzzer ohne Gewinner,
// Antworten für alle sichtbar, automatisches Speichern, Higher/Lower ausgeblendet, Passen im Zeitduell, Musik-Lautstärke
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,S=ctx.window.SchmobinSession,T=ctx.window.SylasphereTypes;

// 1) Schätzfrage: Standard = nur der/die Nächste bekommt Punkte
function playEstimate(extra){
  const q=Object.assign({id:'e',type:'estimate',text:'Wie hoch?',category:'x',points:100,min:0,max:500,step:1,correctAnswer:206},extra);
  const e=S.create({quiz:{title:'t',rounds:[{questions:[q]}]}});
  const ids=['A','B','C'].map(n=>e.joinPlayer(n,'🦊'));e.startGame();e.startQuestion();
  e.submitAnswer(ids[0],201);e.submitAnswer(ids[1],150);e.submitAnswer(ids[2],210);e.lockQuestion();e.resolveQuestion();
  const st=e.load();return ids.map(id=>st.players.find(p=>p.id===id).score);
}
ok(JSON.stringify(playEstimate({}))==='[0,0,100]','closest: only nearest player scores ('+playEstimate({})+')');
ok(JSON.stringify(playEstimate({tolerance:5}))==='[100,0,100]','tolerance: everyone inside ±5 scores');
const prop=playEstimate({scoring:'proportional'});ok(prop[1]>0&&prop[1]<prop[2],'proportional keeps old behaviour');
const tie=(()=>{const q={id:'t',type:'estimate',text:'x',category:'x',points:50,min:0,max:10,correctAnswer:5};const e=S.create({quiz:{title:'t',rounds:[{questions:[q]}]}});const a=e.joinPlayer('A','🦊'),b=e.joinPlayer('B','🐼');e.startGame();e.startQuestion();e.submitAnswer(a,4);e.submitAnswer(b,6);e.lockQuestion();e.resolveQuestion();return e.load().players.map(p=>p.score)})();
ok(JSON.stringify(tie)==='[50,50]','closest: ties share full points');

// 2) Hotspot: Kreis im echten Seitenverhältnis
const hs={id:'h',type:'hotspot',text:'x',category:'x',points:100,image:'a.png',targetX:50,targetY:50,radius:10,imageRatio:0.5};
ok(Q.scoreAnswer(hs,{x:50,y:69},1).points===100,'hotspot: 19% vertical on a wide image is inside (ratio 0.5)');
ok(Q.scoreAnswer(hs,{x:61,y:50},1).points===0,'hotspot: 11% horizontal is outside');
ok(Q.scoreAnswer(Object.assign({},hs,{imageRatio:undefined}),{x:50,y:69,r:0.5},1).points===100,'hotspot: ratio from the answer as fallback');
ok(code('js/question-types/types/hotspot.js').includes('aspect-ratio')||code('css/main.css').includes('.hotspot-zone{aspect-ratio:1/1'),'hotspot zone drawn as a circle');

// 3) Buzzer mündlich ohne Gewinner auflösen (lokal)
{const q={id:'b',type:'buzzer',category:'x',text:'?',points:100,timer:0,buzzerMode:'spoken',solution:'x'};const e=S.create({quiz:{title:'t',rounds:[{questions:[q]}]}});e.joinPlayer('A','🦊');e.startGame();e.startQuestion();
 let err=null;try{e.resolveQuestion({})}catch(x){err=x}ok(!err,'buzzer resolves without winner ('+(err&&err.message)+')');ok(e.load().questionOpen===false&&e.load().scoredQuestionIds.includes('b'),'buzzer closed and scored');}
ok(!code('js/core/online-session-engine.js').includes('Noch kein Buzzer-Ergebnis vorhanden'),'online engine no longer blocks resolve without buzzer');

// 4) Antworten für alle sichtbar
['multiple-choice','estimate','fight-list','sort','image-quiz','gap-text','hotspot'].forEach(t=>ok(Q.publishesAnswers({type:t}),`${t} publishes answers to spectators`));
ok(!Q.publishesAnswers({type:'buzzer'})&&!Q.publishesAnswers({type:'time-duel'}),'buzzer/duel keep their own display');

// 5) Automatisches Speichern
const pv=code('js/views/player-view.js');
ok(pv.includes('scheduleAutoSave')&&pv.includes('Deine Antwort wird automatisch gespeichert'),'player answers autosave');
ok(pv.includes("els['submit-answer'].hidden = !manual"),'submit button only where answers lock');
ok(Q.locksOnSubmit({type:'song-reveal'})&&!Q.locksOnSubmit({type:'multiple-choice'}),'song reveal keeps explicit submit');

// 6) Higher/Lower ausgeblendet, läuft aber weiter
ok(T.get('higher-lower').hidden===true&&Q.SUPPORTED_TYPES.includes('higher-lower'),'higher/lower hidden but supported');
ok(code('js/editor/editor.js').includes('usableType')&&code('js/editor/editor.js').includes('typeDef(t)?.hidden'),'editor filters hidden types');

// 7) Zeitduell: Spieler passt selbst
const td=code('js/question-types/types/time-duel.js'),mv=code('js/views/moderator-view.js');
ok(td.includes('duel-self-pass')&&td.includes('onPass'),'duel renders pass button for the active player');
ok(pv.includes('onPass')&&pv.includes('pass: true'),'player sends pass');
ok(mv.includes('answer.pass')&&mv.includes('Game.pass(game, q'),'moderator applies player pass (both modes)');
{const G=Q.gameOf({type:'time-duel'});const q={id:'d',type:'time-duel',items:[{image:'a',answer:'Hund'},{image:'b',answer:'Katze'}],clockSeconds:30,passPenalty:3,placePoints:'100,50',answerMode:'spoken'};
 let g=G.start(q,['A','B'],1000);const first=g.active;g=G.pass(g,q,2000);ok(g.phase==='reveal'&&g.reveal.reason==='pass'&&g.clocks[first]<=27000,'pass costs penalty');}

// 8) Musik
const mp=code('js/core/media-player.js'),sr=code('js/question-types/types/song-reveal.js');
ok(mp.includes('TARGET_RMS')&&mp.includes('createDynamicsCompressor'),'loudness normalisation + limiter');
ok(mp.includes('firstSound')&&sr.includes('skipSilence'),'leading silence skipped for snippets');
{const q={id:'s',type:'song-reveal',text:'x',audio:'a.mp3',songTitle:'X'};T.get('song-reveal').normalize(q,{});ok(q.volume===70&&q.skipSilence===true,'song defaults volume 70 %, skip silence');
 const clip=T.get('song-reveal').mediaClip(q,{kind:'snippet',stage:0});ok(clip.volume===0.7&&clip.skipSilence===true,'clip carries volume');
 const rev=T.get('song-reveal').mediaClip(q,{kind:'reveal'});ok(!rev.skipSilence,'reveal plays exactly from its second');}

// 9) Avatare
ok(pv.includes("'🐐'"),'goat avatar');

console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
