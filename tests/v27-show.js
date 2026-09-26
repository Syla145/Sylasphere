// v27: Spielerlebnis – Soundeffekte/Vibration (abschaltbar), Emoji-Reaktionen, Highlights, Aufstiegs-Animation
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const vibrations=[];
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,navigator:{vibrate:p=>{vibrations.push(p);return true}},document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[],body:{dataset:{role:'player'}}},location:{href:'http://x/',pathname:'/spieler.html'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');load('js/core/sfx.js');load('js/core/highlights.js');
const S=ctx.window.SchmobinSession,X=ctx.window.SylasphereSfx,H=ctx.window.SylasphereHighlights;
// Soundeffekte + Vibration
ok(X.enabled()===true&&X.vibrationEnabled()===true&&X.volume()===70,'defaults: sfx on for players, vibration on, 70 %');
X.setVibration(false);ok(X.vibrate('turn')===false&&vibrations.length===0,'vibration can be switched off');
X.setVibration(true);ok(X.vibrate('turn')!==false&&vibrations.length===1,'vibration works when on');
X.setEnabled(false);ok(X.enabled()===false&&ctx.localStorage.getItem('sylasphere:sfx:player')==='0','sfx off per page');X.setEnabled(true);
ok(X.setVolume(140)===100&&X.setVolume(-5)===0,'volume clamped');X.setVolume(70);
ok(X.SOUNDS.includes('correct')&&X.SOUNDS.includes('fanfare')&&X.SOUNDS.includes('buzz'),'synthesized sound set');
// Auslöser: „Du bist dran“ vibriert nur beim aktiven Spieler
vibrations.length=0;
const q={id:'d',type:'time-duel'};const st=g=>({status:'running',questionOpen:true,questionStartedAt:1,scoredQuestionIds:[],players:[{id:'me'},{id:'b'}],answers:{},game:g});
X.observe(st({questionId:'d',phase:'play',active:'b',pos:0}),{current:{question:q},playerId:'me'});
X.observe(st({questionId:'d',phase:'play',active:'me',pos:1}),{current:{question:q},playerId:'me'});
ok(JSON.stringify(vibrations[0])==='[120,60,120]','your turn → vibration pattern');
vibrations.length=0;X.observe(st({questionId:'d',phase:'play',active:'b',pos:2}),{current:{question:q},playerId:'me'});ok(!vibrations.length,'others turn → no vibration');
// Moderator-Seite: standardmäßig aus
{const c2=vm.createContext(Object.assign({},base,{localStorage:new Store(),document:{addEventListener(){},querySelectorAll:()=>[],body:{dataset:{role:'moderator'}}}}));c2.window=c2;vm.runInContext(code('js/core/sfx.js'),c2);ok(c2.window.SylasphereSfx.enabled()===false,'moderator page: sfx off by default');}
// Reaktionen (lokal)
{const e=S.create({quiz:{title:'t',rounds:[{questions:[{id:'q',type:'multiple-choice',text:'x',category:'x',points:10,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]}]}});const got=[];e.onReaction(r=>got.push(r));
 ok(e.sendReaction('p1','🔥')===true&&got.length===1&&got[0].emoji==='🔥'&&got[0].playerId==='p1','local reaction delivered');ok(e.sendReaction('p1','')===false,'empty reaction ignored');}
const rules=JSON.parse(code('firebase-database.rules.json')).rules.rooms.$code.reactions.$uid;
ok(rules['.write'].includes("now - data.child('at').val() >= 700")&&rules['.validate'].includes("newData.child('at').val() === now")&&rules['.write'].includes("child('profiles').child($uid).exists()"),'rules: only room players, rate limit, server time');
ok(code('js/core/online-session-engine.js').includes('sendReaction')&&code('js/core/online-session-engine.js').includes('onChildChanged'),'online reactions');
// Highlights
{const quiz={title:'t',rounds:[{questions:[
  {id:'m1',type:'multiple-choice',text:'Frage eins',category:'x',points:100,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'},
  {id:'e1',type:'estimate',text:'Wie hoch ist der Turm?',category:'x',points:100,min:0,max:500,correctAnswer:300,unit:'m'},
  {id:'b1',type:'buzzer',text:'Schnell!',category:'x',points:50,timer:0,buzzerMode:'spoken',solution:'x'},
  {id:'m2',type:'multiple-choice',text:'Frage zwei',category:'x',points:100,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]}]};
 const e=S.create({quiz});const a=e.joinPlayer('Anna','🦊'),b=e.joinPlayer('Ben','🐐');e.startGame();
 e.startQuestion();e.submitAnswer(a,'a');e.submitAnswer(b,'b');e.lockQuestion();e.resolveQuestion();e.move(1);
 e.startQuestion();e.submitAnswer(a,280);e.submitAnswer(b,305);e.lockQuestion();e.resolveQuestion();e.move(1);
 e.startQuestion();e.submitAnswer(b,null);e.resolveQuestion();e.move(1);
 e.startQuestion();e.submitAnswer(a,'b');e.submitAnswer(b,'b');e.lockQuestion();e.resolveQuestion();
 const h=H.compute(e.load());const by=t=>h.find(c=>c.title===t);
 ok(by('Buzzer-König')?.names.join()==='Ben','buzzer king');
 ok(by('Knappste Schätzung')?.names.join()==='Ben'&&/305 statt 300 m/.test(by('Knappste Schätzung').detail),'closest estimate: '+by('Knappste Schätzung')?.detail);
 ok(by('Punkte-Rakete')&&by('Treffsicher'),'rocket + accuracy cards');
 ok(by('Pechvogel des Abends')?.names.includes('Anna'),'unlucky player (Anna 2× zero)');
 e.finish({highlights:h});ok(e.load().status==='finished'&&e.load().highlights.length===h.length,'finish stores highlights');}
// Einbindung
const set=code('js/core/settings.js');ok(set.includes('data-vibrate')&&set.includes('data-sfx-on')&&set.includes('data-sfx-volume')&&set.includes('data-reactions'),'settings: sfx, volume, vibration, reactions');
['spieler.html','zuschauer.html','moderator.html'].forEach(f=>ok(['sfx.js','reactions.js','highlights.js'].every(x=>code(f).includes(`js/core/${x}`)),`${f} loads v27 modules`));
ok(code('spieler.html').includes('id="reaction-bar"'),'reaction bar on player page');
ok(code('js/views/moderator-view.js').includes('SylasphereHighlights?.compute(state)'),'moderator computes highlights on finish');
ok(code('js/core/app.js').includes('renderRanking')&&code('js/views/spectator-view.js').includes('App.renderRanking')&&code('js/views/player-view.js').includes('App.renderRanking'),'ranking climb animation');
ok(/const APP_VERSION = 'v(2[7-9]|[3-9][0-9])/.test(code('js/core/app.js')),'version v27 or later');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
