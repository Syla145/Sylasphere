const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto').webcrypto;
const root=path.resolve(__dirname,'..'); let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
function getAt(rootObj,pathStr){return pathStr.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],rootObj)}
function stripNulls(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(stripNulls);const o={};for(const[k,x]of Object.entries(v)){const y=stripNulls(x);if(y!==null&&y!==undefined&&!(typeof y==='object'&&!Array.isArray(y)&&!Object.keys(y).length))o[k]=y}return o}
const violations=[];
function setAt(rootObj,pathStr,value){value=stripNulls(value);const parts=pathStr.split('/').filter(Boolean); let o=rootObj; for(let i=0;i<parts.length-1;i++)o=o[parts[i]]??={}; const k=parts.at(-1); if(value===null||value===undefined) delete o[k]; else o[k]=JSON.parse(JSON.stringify(value));}
function snap(v){return{exists:()=>v!==undefined&&v!==null,val:()=>v===undefined?null:JSON.parse(JSON.stringify(v))}}
const data={}; const listeners=[];
function notify(changed){for(const l of listeners){if(changed===l.path||changed.startsWith(l.path+'/')||l.path.startsWith(changed+'/')) queueMicrotask(()=>l.cb(snap(getAt(data,l.path))))}}
const dbm={
 ref:(db,p='')=>({db,path:p.replace(/^\/+|\/+$/g,'')}),
 get:async r=>snap(getAt(data,r.path)),
 set:async(r,v)=>{setAt(data,r.path,v);notify(r.path)},
 remove:async r=>{setAt(data,r.path,null);notify(r.path)},
 update:async(r,patch)=>{const keys=Object.keys(patch).map(k=>[r.path,k].filter(Boolean).join('/'));for(const a of keys)for(const b of keys)if(a!==b&&b.startsWith(a+'/'))throw new Error('update failed: values argument contains a path '+a+' that is ancestor of another path '+b);
  for(const k of keys){const m=k.match(/^rooms\/[^/]+\/buzzerBlocked\/[^/]+$/);if(m)violations.push('moderator deletes whole '+k+' (PERMISSION_DENIED with v10 rules)')}
  for(const [k,v] of Object.entries(patch)){const p=[r.path,k].filter(Boolean).join('/');const m=p.match(/^rooms\/[^/]+\/answers\/([^/]+)\/([^/]+)$/);if(m&&v!==null&&r.writer!=='host'){const rec=stripNulls(v);if(!('answer' in rec)||!('submittedAt' in rec))throw new Error('PERMISSION_DENIED: answer record needs answer+submittedAt at '+p)}}
  for(const [k,v] of Object.entries(patch)){const p=[r.path,k].filter(Boolean).join('/');setAt(data,p,v);notify(p)}},
 runTransaction:async(r,fn)=>{const cur=getAt(data,r.path);const next=fn(cur===undefined?null:JSON.parse(JSON.stringify(cur)));if(next===undefined)return{committed:false,snapshot:snap(cur)};setAt(data,r.path,next);notify(r.path);return{committed:true,snapshot:snap(next)}},
 onValue:(r,cb)=>{const x={path:r.path,cb};listeners.push(x);queueMicrotask(()=>cb(snap(getAt(data,r.path))));return()=>{const i=listeners.indexOf(x);if(i>=0)listeners.splice(i,1)}},
 onDisconnect:()=>({update:async()=>{},cancel:async()=>{}}),
 serverTimestamp:()=>Date.now()
};
function context(uid,role){return{role,modules:{database:dbm},db:{},auth:{currentUser:{uid}},serverOffset:0,connected:true}}
const modCtx=context('host_uid_123456789','moderator'), p1Ctx=context('p1_uid_123456789','player'), p2Ctx=context('p2_uid_123456789','player'), specCtx=context('spec_uid_123456789','spectator');
let playerCall=0;
const Firebase={
 ready:async role=>role==='moderator'?modCtx:role==='spectator'?specCtx:(playerCall++===0?p1Ctx:p2Ctx),
 serverNow:()=>Date.now(),toLocalTime:(ctx,v)=>v,
 rotateAnonymous:async()=>({uid:'rotated_uid_123456789'})
};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval:()=>{},setTimeout,clearTimeout,window:null,document:{addEventListener(){},querySelectorAll(){return[]}},location:{search:''},URLSearchParams};base.window=base;base.window.addEventListener=()=>{};base.window.removeEventListener=()=>{};base.JHQuizFirebase=Firebase;
const ctx=vm.createContext(base); const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/core/quiz-utils.js');ctx.window.JHQuizFirebase=Firebase;load('js/core/online-session-engine.js');
const Online=ctx.window.JHQuizOnlineSession; const quiz=JSON.parse(fs.readFileSync(path.join(root,'data/quiz-showtime.json'),'utf8'));

const buzzQuiz={quiz:{id:'bz',title:'Buzzer Online',settings:{defaultTimer:30,defaultPoints:100},rounds:[{id:'r1',title:'R1',pointsMultiplier:1,questions:[
 {id:'show_buzz',type:'buzzer',category:'Speed',text:'Welche Hauptstadt liegt an der Themse?',points:150,timer:0,buzzerMode:'spoken',solution:'London',penalty:0},
 {id:'show_buzz2',type:'buzzer',category:'Speed',text:'Zweite',points:100,timer:0,buzzerMode:'spoken',solution:'X',penalty:0}]}]}};
(async()=>{
 try{
 const host=await Online.create(buzzQuiz); await host.waitForState(); const code=host.code;
 const p1=new Online(code,'player',p1Ctx);p1.raw.meta=getAt(data,`rooms/${code}/meta`);await p1.attach();await p1.waitForState();
 const p2=new Online(code,'player',p2Ctx);p2.raw.meta=getAt(data,`rooms/${code}/meta`);await p2.attach();await p2.waitForState();
 await p1.joinPlayer('fsg','🦊');await p2.joinPlayer('hgf','🐼');const tick=()=>new Promise(r=>setTimeout(r,5));await tick();
 await host.startGame();await tick();await host.startQuestion();await tick();
 ok(await p1.buzz(p1.userId,null)===true,'player 1 buzzes (spoken)');await tick();
 ok(getAt(data,`rooms/${code}/answers/${p1.userId}/show_buzz`)?.answer==='','spoken buzz answer stored (not dropped as null)');
 await host.markBuzzerIncorrect();await tick();
 ok(host.load().questionResults.show_buzz.eliminatedIds.includes(p1.userId),'player 1 blocked after wrong answer');
 ok(await p2.buzz(p2.userId,null)===true,'player 2 buzzes after reopen');await tick();
 await host.resolveQuestion();await tick();
 const s=host.load();
 ok(s.scoredQuestionIds.includes('show_buzz'),'buzzer question resolves without update conflict');
 ok(s.players.find(p=>p.id===p2.userId).score===150,'player 2 gets the points');
 ok(s.players.find(p=>p.id===p1.userId).score===0,'player 1 gets no points');
 // winner without stored answer record (e.g. from older clients) must not cause ancestor conflict
 await host.move(1);await tick();await host.startQuestion();await tick();
 await dbm.runTransaction(dbm.ref({},`rooms/${code}/buzzerClaims/show_buzz2`),()=>({contenderId:p1.userId,claimedAt:Date.now()}));await tick();
 await host.resolveQuestion();await tick();
 ok(host.load().players.find(p=>p.id===p1.userId).score===100,'winner without answer record is scored in one consistent write');
 ok(violations.length===0,'no whole-node buzzerBlocked deletes: '+violations.join('; '));
 }catch(e){fail++;console.error('FAIL',e.message)}
 console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})();
