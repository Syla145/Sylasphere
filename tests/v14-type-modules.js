// v14: Fragetypen als Module – Vertrag der Registry und Erweiterbarkeit
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},querySelectorAll(){return[]}},location:{search:''},URLSearchParams};base.window=base;base.window.addEventListener=()=>{};
const ctx=vm.createContext(base);const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');
const T=ctx.window.SylasphereTypes;
T.files.forEach(f=>load(`js/question-types/types/${f}.js`));
load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator,Session=ctx.window.SchmobinSession;

// 1. Jede Datei in TYPE_FILES registriert genau ihren Typ, Datei liegt im Ordner
const dir=fs.readdirSync(path.join(root,'js/question-types/types')).filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3)).sort();
ok(JSON.stringify(dir)===JSON.stringify(T.files.slice().sort()),'every type file is listed in registry (and vice versa): '+dir.join(','));
T.files.forEach(f=>ok(T.has(f),`${f}: registered under its file name`));
ok(JSON.stringify(Q.SUPPORTED_TYPES)===JSON.stringify(T.files),'SUPPORTED_TYPES follows registry order');
// 2. Vertrag: Pflichtfelder + sinnvolle Rückgaben
T.list().forEach(def=>{
 ['label','icon','description'].forEach(k=>ok(typeof def[k]==='string'&&def[k].length,`${def.type}: has ${k}`));
 ['normalize','score','solutionText','render','answerLabel','validate','defaults'].forEach(k=>ok(typeof def[k]==='function',`${def.type}: ${k}()`));
 ok(typeof def.editor==='function',`${def.type}: has editor fields`);
 // Neue Frage aus defaults() ist direkt gültig
 const q=Q.normalizeQuiz({quiz:{title:'t',rounds:[{questions:[Object.assign({id:'q1',type:def.type,text:'Frage',category:'Test'},def.defaults())]}]}});
 const v=V.validate(q);ok(v.valid,`${def.type}: defaults() produce a valid question ${JSON.stringify(v.errors)}`);
 const nq=q.quiz.rounds[0].questions[0];
 const s=Q.scoreAnswer(nq,null,1);ok(Number.isFinite(s.points)&&typeof s.detail==='string',`${def.type}: score() handles missing answer`);
 ok(typeof Q.correctAnswerText(nq)==='string',`${def.type}: solution text is a string`);
 // Online: Lösungsfelder nie im öffentlichen Objekt
 const pub=Q.publicQuestion(nq,false);
 ['correctAnswer','correctAnswers','correctOrder','solution','tolerance','targetX','targetY','radius'].forEach(k=>ok(!(k in pub),`${def.type}: public question hides ${k}`));
});
// 3. Erweiterbarkeit: neuer Typ nur per register()
T.register({
 type:'true-false',label:'Wahr oder falsch',icon:'✓✗',description:'Test-Typ',
 defaults:()=>({correctAnswer:true}),
 normalize(q){q.correctAnswer=q.correctAnswer===true||q.correctAnswer==='true'},
 validate(q,report){if(typeof q.correctAnswer!=='boolean')report.error('correctAnswer','fehlt')},
 score(q,answer,{base}){const hit=answer===q.correctAnswer;return{points:hit?base:0,detail:hit?'Richtig':'Falsch'}},
 solutionText:q=>q.correctAnswer?'Wahr':'Falsch',
 answerLabel:(q,a)=>a===true?'Wahr':a===false?'Falsch':'–',
 render(){},editor(){}
});
ok(Q.SUPPORTED_TYPES.includes('true-false'),'new type appears in SUPPORTED_TYPES');
ok(Q.TYPE_LABELS['true-false']==='Wahr oder falsch','new type label available');
const tf={quiz:{title:'TF',rounds:[{pointsMultiplier:2,questions:[{id:'tf1',type:'true-false',text:'Die Erde ist rund.',category:'Test',points:50,correctAnswer:'true'}]}]}};
const tv=V.validate(tf);ok(tv.valid,'new type validates without core changes');
const tq=tv.normalized.quiz.rounds[0].questions[0];
ok(Q.scoreAnswer(tq,true,2).points===100,'new type scored with round multiplier');
ok(!('correctAnswer' in Q.publicQuestion(tq,false)),'new type solution hidden online automatically');
// Spielbar in der lokalen Engine
const e=Session.create(tf);const p1=e.joinPlayer('Anna','🦊');const p2=e.joinPlayer('Ben','🐼');e.startGame();e.startQuestion();
e.submitAnswer(p1,true);e.submitAnswer(p2,false);e.lockQuestion();e.resolveQuestion();
const st=e.load();ok(st.players.find(p=>p.id===p1).score===100&&st.players.find(p=>p.id===p2).score===0,'new type playable end-to-end in local engine');
// 4. Konsens über generischen resolve()-Hook
const cq={quiz:{title:'C',rounds:[{questions:[{id:'c1',type:'consensus',text:'?',category:'x',points:80,options:['A','B','C']}]}]}};
const ce=Session.create(cq);const a=ce.joinPlayer('A','🦊'),b=ce.joinPlayer('B','🐼'),c=ce.joinPlayer('C','🐸');ce.startGame();ce.startQuestion();
ce.submitAnswer(a,'b');ce.submitAnswer(b,'b');ce.submitAnswer(c,'a');ce.lockQuestion();ce.resolveQuestion();
const cs=ce.load();ok(cs.players.find(p=>p.id===a).score===80&&cs.players.find(p=>p.id===c).score===0,'consensus majority scored via resolve hook');
ok(cs.questionResults.c1.winningOptionIds.join()==='b','consensus result stored for reveal');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
