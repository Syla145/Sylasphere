const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto').webcrypto;
const root = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function assert(cond, msg){ if(!cond){ failed++; console.error('FAIL', msg); } else { passed++; } }
function load(ctx, rel){ vm.runInContext(fs.readFileSync(path.join(root, rel),'utf8'), ctx, {filename:rel}); }
class Store{ constructor(){this.m=new Map()} getItem(k){return this.m.has(k)?this.m.get(k):null} setItem(k,v){this.m.set(k,String(v))} removeItem(k){this.m.delete(k)} }
const base = {
  console, JSON, Math, Date, Number, String, Array, Object, Map, Set, Promise, Intl,
  crypto, localStorage:new Store(), sessionStorage:new Store(),
  setInterval:()=>0, clearInterval:()=>{}, setTimeout, clearTimeout,
  window:null, document:{addEventListener(){},querySelectorAll(){return[]}}, location:{search:''}, URLSearchParams,
};
base.window = base; base.window.addEventListener=()=>{}; base.window.removeEventListener=()=>{}; base.BroadcastChannel = class { postMessage(){} close(){} };
const ctx=vm.createContext(base);
load(ctx,'js/core/app.js'); load(ctx,'js/question-types/registry.js'); load(ctx,'js/question-types/kit.js'); ctx.window.SylasphereTypes.files.forEach(f=>load(ctx,`js/question-types/types/${f}.js`)); load(ctx,'js/core/quiz-utils.js'); load(ctx,'js/core/session-engine.js');
ctx.window.JHQuizFirebase = { serverNow:()=>Date.now(), toLocalTime:(_,v)=>v };
load(ctx,'js/core/online-session-engine.js');

const quiz = JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8'));
const normalized = ctx.window.SchmobinQuiz.normalizeQuiz(quiz);
const all = ctx.window.SchmobinQuiz.allQuestions(normalized);
assert(all.length >= 10, 'showtime quiz has at least 10 questions');
assert(new Set(all.map(x=>x.question.type)).size === ctx.window.SchmobinQuiz.SUPPORTED_TYPES.length, 'all question types are represented');

// Local transport regression: two players must remain independent.
const Local = ctx.window.SchmobinSession;
const eng = Local.create(normalized);
const p1 = eng.joinPlayer('Anna','🦊');
const p2 = eng.joinPlayer('Ben','🐼');
assert(p1 !== p2, 'local players receive distinct ids');
assert(eng.load().players.length === 2, 'local session keeps both players');
eng.startGame();
let st=eng.load(); assert(st.status==='playing','local game starts');
eng.startQuestion(); st=eng.load(); assert(st.questionOpen===true,'local question opens');
eng.submitAnswer(p1,'a'); eng.submitAnswer(p2,'b');
eng.lockQuestion(); st=eng.load(); assert(st.questionOpen===false && st.scoredQuestionIds.length===0,'timer/lock does not reveal');
eng.resolveQuestion(); st=eng.load(); assert(st.scoredQuestionIds.length===1,'manual reveal scores once');
const scoresAfter=st.players.map(p=>p.score);
eng.resolveQuestion(); assert(JSON.stringify(eng.load().players.map(p=>p.score))===JSON.stringify(scoresAfter),'double reveal does not double-score');
eng.adjustPlayerScore(p1,1); assert(eng.load().players.find(p=>p.id===p1).score===scoresAfter[0]+1,'manual +1 works');
eng.setPlayerScore(p2,137); assert(eng.load().players.find(p=>p.id===p2).score===137,'exact score works');

// Online payload security helpers.
const H = ctx.window.JHQuizOnlineSession._helpers;
const outline = H.makeOutline(normalized);
assert(outline.rounds.length===normalized.quiz.rounds.length,'online outline keeps rounds');
assert(!('text' in outline.rounds[0].questions[0]),'outline does not leak question text before start');
for (const {question:q} of all) {
  const pub = H.publicQuestion(q,false);
  if (['multiple-choice','image-quiz','audio-quiz','estimate'].includes(q.type)) assert(!('correctAnswer' in pub),`${q.type}: correct answer hidden`);
  if (q.type==='sort') assert(!('correctOrder' in pub),'sort: correct order hidden');
  if (q.type==='fight-list') assert(!('correctAnswers' in pub),'fight-list: solutions hidden');
  if (q.type==='hotspot') assert(!('targetX' in pub)&&!('targetY' in pub)&&!('radius' in pub),'hotspot: target hidden');
  if (q.type==='survey') assert((pub.options||[]).every(o=>!('value' in o)),'survey: percentages hidden');
  const reveal = H.publicQuestion(q,true);
  assert(reveal.id===q.id,`${q.type}: reveal payload keeps question`);
}
const trans = H.answersByQuestion({u1:{q1:{answer:'a'}},u2:{q1:{answer:'b'},q2:{answer:5}}});
assert(Object.keys(trans.q1).length===2 && trans.q2.u2.answer===5,'online answer shape transforms correctly');

console.log(`PASS ${passed} / FAIL ${failed}`);
process.exit(failed ? 1 : 0);
