// v23: Fight List mit Trefferzählung (Tippfehler-tolerant, Moderator passt an), QR-Code, Editor-Knöpfe
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/session-engine.js');
const Q=ctx.window.SchmobinQuiz,S=ctx.window.SchmobinSession;
const q={id:'fl',type:'fight-list',text:'Präsidenten',category:'x',points:100,correctAnswers:['George Washington','Abraham Lincoln','Ronald Reagan','George W. Bush','Barack Obama','Donald Trump','Joe Biden'],pointsPerAnswer:20,maxEntries:20};
ok(Q.reviewMode(q)==='count'&&Q.needsReview(q),'fight list uses count review');
const m=Q.countMatches(q,['Obama','obama','Linkoln','Ronald Regan','Trumpf','Merkel','washington']);
ok(m.count===5,'tolerant count (surname, typos, case, duplicates) = '+m.count);
ok(m.items.find(i=>i.term==='Linkoln').kind==='fuzzy'&&m.items.find(i=>i.term==='Merkel').kind==='none'&&m.items.find(i=>i.term==='obama').kind==='double','marks exact/fuzzy/none/double');
ok(Q.countMatches(q,['Bus']).count===0,'short words need exact match');
ok(Q.scoreAnswer(q,['Obama','Biden'],1).points===40,'without review: suggestion used');
ok(Q.scoreAnswer(q,['Obama'],1,{verdicts:{p:4}},'p').points===80,'moderator count overrides');
ok(Q.scoreAnswer(q,['Obama'],1,{verdicts:{p:9}},'p').points===100,'points field is the cap');
ok(Q.scoreAnswer(Object.assign({},q,{points:0}),['Obama'],1,{verdicts:{p:9}},'p').points===180,'points 0 = no cap');
// lokale Engine: Moderator-Zählung kommt an
const e=S.create({quiz:{title:'t',rounds:[{questions:[q]}]}});const a=e.joinPlayer('A','🦊');e.startGame();e.startQuestion();e.submitAnswer(a,['Obama','Linkoln']);e.lockQuestion();e.resolveQuestion({verdicts:{[a]:3}});
ok(e.load().players[0].score===60,'engine scores moderator-adjusted count');
// Einbindung
const mv=code('js/views/moderator-view.js'),ed=code('js/editor/editor.js');
ok(mv.includes('countPanel')&&mv.includes('data-count-player'),'moderator count panel');
ok(ed.includes('insertBar')&&ed.includes('+ Frage hier einfügen')&&ed.includes('+ Neue Runde danach'),'editor insert buttons');
ok(code('js/question-types/types/higher-lower.js').includes('Einheit (optional)'),'higher/lower fields labelled');
ok(code('css/main.css').includes('.editor-sidebar{overflow-x:hidden}'),'sidebar without horizontal scroll');
['moderator.html','spieler.html','zuschauer.html'].forEach(f=>ok(code(f).includes('js/vendor/qrcode.js')&&code(f).includes('js/core/join-qr.js'),`${f} loads QR/wake lock`));
ok(code('js/vendor/qrcode.js').includes('MIT license'),'QR library license kept');
ok(code('js/views/player-view.js').includes('keepAwake(true)')&&code('js/views/spectator-view.js').includes('keepAwake(true)')&&mv.includes('keepAwake(true)'),'wake lock on all game screens');
// QR erzeugen
vm.runInContext(code('js/vendor/qrcode.js'),ctx);ctx.window.qrcode=ctx.qrcode;load('js/core/join-qr.js');
const J=ctx.window.SylasphereJoin;ok(J.joinUrl('ab1234','online')==='http://x/spieler.html?code=AB1234&mode=online','join url');
ok(/^<svg/.test(J.svg(J.joinUrl('AB1234','online'))),'QR svg generated');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
