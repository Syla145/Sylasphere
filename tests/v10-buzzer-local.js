const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
class BC{constructor(){this.onmessage=null}postMessage(){}close(){}}
const base={console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,BroadcastChannel:BC,window:null,document:{addEventListener(){},querySelectorAll(){return[]}},location:{search:''},URLSearchParams};base.window=base;base.window.addEventListener=()=>{};base.window.removeEventListener=()=>{};
const ctx=vm.createContext(base);const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/session-engine.js');
const Session=ctx.window.SchmobinSession;
const quiz={quiz:{id:'buzzer_test',title:'Buzzer Test',settings:{defaultTimer:30,defaultPoints:100},rounds:[{id:'r1',title:'R1',pointsMultiplier:1,questions:[{id:'buzz1',type:'buzzer',category:'Speed',text:'Hauptstadt?',points:100,timer:0,buzzerMode:'spoken',solution:'London',penalty:5}]}]}};
const e=Session.create(quiz);const p1=e.joinPlayer('Anna','🦊');const p2=e.joinPlayer('Ben','🐼');e.startGame();e.startQuestion();
ok(e.load().questionOpen===true,'buzzer opens without timer');
ok(e.load().questionEndsAt===null,'buzzer has no deadline');
ok(e.submitAnswer(p1,null)===true,'first local buzzer accepted');
ok(e.submitAnswer(p2,null)===false,'second local buzzer rejected while locked');
ok(e.load().questionResults.buzz1.contenderId===p1,'first player owns buzzer');
e.markBuzzerIncorrect();
ok(e.load().players.find(p=>p.id===p1).score===-5,'wrong buzzer penalty applied');
ok(e.load().questionResults.buzz1.eliminatedIds.includes(p1),'wrong player blocked for question');
ok(e.load().questionOpen===true,'buzzer reopened for remaining player');
ok(e.submitAnswer(p1,null)===false,'blocked player cannot buzz again');
ok(e.submitAnswer(p2,null)===true,'remaining player can buzz');
e.resolveQuestion();
ok(e.load().players.find(p=>p.id===p2).score===100,'correct buzzer winner receives points');
ok(e.load().scoredQuestionIds.includes('buzz1'),'buzzer question resolves exactly once');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
