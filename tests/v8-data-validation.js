const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..');let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},querySelectorAll(){return[]}},location:{search:''},URLSearchParams};base.window=base;base.window.addEventListener=()=>{};base.window.removeEventListener=()=>{};
const ctx=vm.createContext(base);const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');
const Quiz=ctx.window.SchmobinQuiz,Validator=ctx.window.SchmobinValidator;
const list=JSON.parse(fs.readFileSync(path.join(root,'data/quiz-list.json'),'utf8'));const entries=Array.isArray(list)?list:list.quizzes||[];
ok(entries.length>=4,'quiz list contains reference quizzes');
const types=new Set();
for(const item of entries){
 const file=item.file||item.filename;const full=path.join(root,'data',file);ok(fs.existsSync(full),`${file}: exists`);if(!fs.existsSync(full))continue;
 const raw=JSON.parse(fs.readFileSync(full,'utf8'));const v=Validator.validate(raw);ok(v.valid,`${file}: validates (${v.errors.map(e=>e.message).join('; ')})`);
 const roundtrip=Validator.validate(JSON.parse(JSON.stringify(v.normalized)));ok(roundtrip.valid,`${file}: normalized roundtrip validates`);
 Quiz.allQuestions(v.normalized).forEach(({question:q})=>types.add(q.type));
}
for(const type of Quiz.SUPPORTED_TYPES.filter(t=>!Quiz.typeDef(t)?.hidden))ok(types.has(type),`${type}: represented in bundled quizzes`);
const show=Validator.validate(JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8'))).normalized;
for(const {question:q} of Quiz.allQuestions(show)){
 let answer;
 if(['multiple-choice','image-quiz','audio-quiz'].includes(q.type)) answer=Quiz.correctOption(q)?.id;
 else if(q.type==='estimate') answer=q.correctAnswer;
 else if(q.type==='sort') answer=q.correctOrder.slice();
 else if(q.type==='fight-list') answer=q.correctAnswers.slice(0,q.maxEntries||q.correctAnswers.length);
 else if(q.type==='higher-lower') answer=q.cards.slice(0,-1).map((c,i)=>q.cards[i+1].value>=c.value?'higher':'lower');
 else if(q.type==='survey') answer=Quiz.surveyWinnerIds(q)[0];
 else if(q.type==='hotspot') answer={x:q.targetX,y:q.targetY};
 else if(q.type==='buzzer') answer=q.solution;
 else if(q.type==='true-false') answer=q.correctAnswer;
 else if(q.type==='gap-text') answer=q.correctAnswers[0];
 else if(q.type==='matching') answer=q.pairs.map(p=>p.right);
 else if(q.type==='song-reveal') answer={title:q.songTitle,artist:q.artist,stage:0};
 if(q.type==='consensus'){
   const submissions={a:{answer:q.options[0].id},b:{answer:q.options[0].id},c:{answer:q.options[1].id}};
   const r=Quiz.computeConsensusResult(q,submissions);ok(r.winningOptionIds.includes(String(q.options[0].id)),'consensus: majority computed');
 }else{
   const r=q.type==='ranking'?Quiz.scoreAnswer(q,null,1,{players:[{playerId:'p',rank:1,earned:2,correct:2}]},'p'):q.type==='time-duel'?Quiz.scoreAnswer(q,null,1,{placements:[{playerId:'p',rank:1,remainingMs:1000}]},'p'):Quiz.scoreAnswer(q,answer,1);ok(r.points>0,`${q.type}: canonical correct answer scores`);
 }
}
const cats=Quiz.extractCategories(show);ok(cats.length>0,'categories extract');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
