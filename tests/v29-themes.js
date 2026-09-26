// v29: Themes – Grundlage: Theme-Aufbau, vier neue Themes, Kontrast, Sound-Pakete, Übergang, Siegerehrung,
// Theme pro Runde, „Animationen reduzieren“, keine externen Ressourcen
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');const exists=f=>fs.existsSync(path.join(root,f));
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const attrs={};const docEl={setAttribute:(k,v)=>attrs[k]=String(v),removeAttribute:k=>delete attrs[k],classList:{add(){}}};
let systemReduced=false;
// Mini-Audio zum Mitschreiben der gespielten Frequenzen
const played=[];class AC{constructor(){this.currentTime=0;this.state='running';this.sampleRate=8000;this.destination={}}
 createOscillator(){return{type:'',frequency:{setValueAtTime:f=>played.push(f),exponentialRampToValueAtTime(){}},connect:g=>g,start(){},stop(){}}}
 createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect:x=>x}}
 createBuffer(){return{getChannelData:()=>new Float32Array(4)}}createBufferSource(){return{connect:x=>x,start(){}}}createBiquadFilter(){return{type:'',frequency:{value:0},connect:x=>x}}resume(){return Promise.resolve()}}
const base={crypto:require('crypto').webcrypto,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,URL,URLSearchParams,localStorage:new Store(),window:null,location:{search:'',pathname:'/zuschauer.html'},setTimeout,clearTimeout,
 matchMedia:()=>({matches:systemReduced,addEventListener(){}}),AudioContext:AC,navigator:{},
 document:{documentElement:docEl,querySelector:()=>null,addEventListener(){},querySelectorAll(){return[]},body:{dataset:{role:'spectator'}}}};base.window=base;
const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/topics.js');load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/sfx.js');
const Th=ctx.window.SylasphereThemes,Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator,Sfx=ctx.window.SylasphereSfx;
const NEW=['kart','legends','geo','tactical'];
// ---------- Katalog ----------
const list=Th.list();
ok(list.length===8&&new Set(list.map(t=>t.id)).size===8,'8 themes with unique ids');
ok(JSON.stringify(NEW.map(id=>Th.get(id)?.name))==='["Mario Kart","League of Legends","GeoGuessr","Valorant"]','new theme names as approved');
ok(NEW.every(id=>Th.get(id).fx===true&&Th.get(id).swatch.length===4&&/^#[0-9a-f]{6}$/i.test(Th.get(id).meta)),'catalog entries complete');
// ---------- Dateien pro Theme ----------
const index=code('css/themes/index.css');
NEW.forEach(id=>{ok(exists(`css/themes/${id}.css`)&&index.includes(`@import url("${id}.css`),`${id}: CSS file imported`);ok(exists(`js/themes/${id}.js`),`${id}: effect file`);load(`js/themes/${id}.js`);});
ok(['index.html','moderator.html','spieler.html','zuschauer.html','editor.html','admin.html','profil.html','vorschau.html'].every(f=>code(f).includes('css/themes/index.css?v=29')),'all pages load theme CSS');
// ---------- Effekte ----------
const SOUND_NAMES=new Set(Sfx.SOUNDS);
NEW.forEach(id=>{const fx=Th.fx(id);
 ok(Array.isArray(fx.decor)&&fx.decor.length>0,`${id}: decor`);
 const keys=Object.keys(fx.sounds||{});ok(keys.length>=8&&keys.every(k=>SOUND_NAMES.has(k)&&typeof fx.sounds[k]==='function'),`${id}: sound pack uses known sound names (${keys.filter(k=>!SOUND_NAMES.has(k))})`);
 const html=fx.transition.html({kind:'round',kicker:'Runde 2 von 3',title:'<Geo>',sub:'Frage 5 von 12',round:2,question:5,total:12},s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'));
 ok(typeof html==='string'&&html.includes('Runde')&&!html.includes('<Geo>'),`${id}: transition escapes text`);
 ok(Number(fx.transition.duration)>=600&&Number(fx.transition.duration)<=1800,`${id}: short transition`);
 ok(['confetti','rays','none'].includes(fx.ceremony.effect)&&typeof fx.ceremony.title==='function',`${id}: ceremony`);});
ok(Th.fx('neon').sounds===null&&Th.fx('neon').transition===null,'old themes keep defaults');
// Sound-Paket wird gespielt
Th.apply('kart');played.length=0;Sfx.play('correct');ok(played[0]===1047,'kart correct sound: '+played[0]);
Th.apply('neon');played.length=0;Sfx.play('turn');ok(played[0]===880,'neon uses default sound');
Th.apply('geo');played.length=0;ok(Sfx.play('transition')&&played.length>0,'transition sound exists');
Th.apply('legends');played.length=0;Sfx.play('pop');ok(played[0]===600,'missing sound in pack falls back to default');
// Siegerehrung
const ranked=[{id:'a',name:'Anna <b>',avatar:'🦊',score:300},{id:'b',name:'Ben',avatar:'🐼',score:200},{id:'c',name:'Cleo',avatar:'🐸',score:100}];
Th.apply('tactical');let h=Th.ceremony(ranked,{role:'moderator',title:'x'});
ok(h.includes('ceremony--tactical')&&h.includes('tactical-mvp')&&h.includes('Anna &lt;b&gt;')&&!h.includes('Anna <b>'),'tactical ceremony with MVP, names escaped');
ok(h.includes('podium-place--1')&&h.includes('Ben')&&h.includes('Cleo'),'podium kept');
Th.apply('kart');h=Th.ceremony(ranked,{role:'player',place:2});ok(h.includes('2. Platz')&&h.includes('ceremony-fx--confetti')&&h.includes('kart-finish'),'kart player ceremony');
Th.apply('geo');h=Th.ceremony(ranked,{role:'spectator'});ok(h.includes('geo-bars')&&h.includes('<h1>'),'geo ceremony with bars, h1 on beamer');
Th.apply('neon');h=Th.ceremony(ranked,{role:'moderator',title:'🏆 Anna gewinnt!',after:'<i data-after></i>'});ok(h.includes('🏆 Anna gewinnt!')&&h.includes('data-after')&&!h.includes('ceremony-fx'),'default ceremony unchanged look');
// Animationen reduzieren
ok(Th.motionSetting()===''&&Th.reducedMotion()===false&&attrs['data-motion']==='full','default: full motion');
systemReduced=true;ok(Th.reducedMotion()===true,'follows system setting');
Th.setMotion('full');ok(Th.reducedMotion()===false&&attrs['data-motion']==='full'&&ctx.localStorage.getItem('sylasphere:motion')==='full','own choice overrides system');
Th.setMotion('reduced');ok(attrs['data-motion']==='reduced','reduced sets attribute');
Th.apply('kart');ok(!Th.ceremony(ranked,{role:'player',place:1}).includes('ceremony-fx'),'no confetti with reduced motion');
systemReduced=false;Th.setMotion('');ok(Th.motionSetting()===''&&attrs['data-motion']==='full','reset to system');
ok(code('js/core/settings.js').includes('data-motion-toggle')&&code('css/main.css').includes('html[data-motion="reduced"]'),'⚙️ switch + CSS');
// Übergang zwischen Fragen
{const quiz={quiz:{rounds:[{title:'Warm-up',questions:[{id:'1',category:'A'},{id:'2',category:'B'}]},{title:'Finale',questions:[{id:'3',category:'C'}]}]}};
 const st=(status,r,q,open=false)=>({code:'ABC',status,currentRoundIndex:r,currentQuestionIndex:q,questionOpen:open,quiz});
 ok(Th.observe(st('lobby',0,0))===null,'first call: nothing');
 const start=Th.observe(st('playing',0,0));ok(start&&start.kind==='round'&&start.title==='Warm-up'&&start.kicker==='Runde 1 von 2','game start → round transition');
 ok(Th.observe(st('playing',0,0,true))===null,'opening the question → no transition');
 const next=Th.observe(st('playing',0,1));ok(next&&next.kind==='question'&&next.title==='Frage 2 / 3'&&next.sub==='B','next question');
 const round=Th.observe(st('playing',1,0));ok(round&&round.kind==='round'&&round.title==='Finale'&&round.sub==='Frage 3 von 3','new round');
 ok(Th.observe(st('playing',1,0))===null,'same position → nothing');
 ok(Th.observe(Object.assign(st('playing',0,0),{code:'XYZ'}))===null,'other room (reload) → nothing');}
// Theme pro Runde
{const quiz=Q.normalizeQuiz({quiz:{title:'x',settings:{theme:'neon'},rounds:[{title:'A',questions:[]},{title:'B',theme:'geo',questions:[]}]}});
 ok(quiz.quiz.rounds[1].theme==='geo'&&!('theme' in quiz.quiz.rounds[0]),'normalize keeps round theme');
 Th.applyQuiz(quiz,0);ok(Th.current()==='neon','round without theme → quiz theme');
 Th.applyQuiz(quiz,1);ok(Th.current()==='geo'&&attrs['data-theme']==='geo','round theme applied');
 Th.applyQuiz(quiz);ok(Th.current()==='neon','no round index → quiz theme');
 ctx.window.JHQuizFirebase={};load('js/core/online-session-engine.js');
 const outline=ctx.window.JHQuizOnlineSession._helpers.makeOutline(quiz);ok(outline.rounds[1].theme==='geo'&&!('theme' in outline.rounds[0]),'online outline carries round theme');
 const w=V.validate({quiz:{title:'x',rounds:[{theme:'disco',questions:[{type:'true-false',text:'a',correctAnswer:'true',category:'x'}]}]}});
 ok(w.warnings.some(x=>x.path==='quiz.rounds[0].theme'),'validator warns about unknown round theme');}
ok(code('js/editor/editor.js').includes('round-theme')&&code('js/editor/editor.js').includes('vorschau.html'),'editor: round theme + preview');
['player-view','spectator-view','moderator-view'].forEach(v=>{const c=code(`js/views/${v}.js`);ok(c.includes('applyQuiz(state.quiz, state.currentRoundIndex)')&&c.includes('SylasphereThemes?.observe(state)')&&c.includes('SylasphereThemes.ceremony('),`${v}: round theme, transition, ceremony`);});
// ---------- CSS: Variablen vollständig, Kontrast, keine externen Ressourcen ----------
const main=code('css/main.css');
const rootBlock=main.slice(main.indexOf(':root{'),main.indexOf('}',main.indexOf(':root{')));
const vars=[...new Set([...rootBlock.matchAll(/(--[a-z0-9-]+):/g)].map(m=>m[1]))].filter(v=>!['--max','--font-body','--font-display','--font-title','--display-transform','--display-spacing','--radius','--radius-sm'].includes(v));
const hex=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const lum=rgb=>{const c=rgb.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const blockOf=(css,id)=>{const start=css.indexOf(`html[data-theme="${id}"]{`);return start<0?'':css.slice(start,css.indexOf('\n}',start))};
const token=(block,name)=>{const m=block.match(new RegExp(`${name}:(#[0-9a-fA-F]{3,6})\\b`));return m?hex(m[1]):null};
const report=[];
function contrast(id,block,min){
 const panel=token(block,'--panel'),bg=token(block,'--bg');
 const checks=[['--text','--panel',7],['--text','--bg',7],['--text-soft','--panel',4.5],['--muted','--panel',4.5],['--accent-text','--panel',4.5],['--accent2-text','--panel',4.5],['--success-text','--panel',4.5],['--danger-text','--panel',4.5],['--warning-text','--panel',4.5],['--on-accent','--accent',4.5],['--on-success','--success',4.5]];
 checks.forEach(([fg,bgName,need])=>{const a=token(block,fg),b=token(block,bgName);const r=a&&b?ratio(a,b):0;report.push(`${id} ${fg}/${bgName} ${r.toFixed(2)}`);ok(r>=Math.min(need,min??need),`${id}: contrast ${fg} on ${bgName} = ${r.toFixed(2)} (≥ ${need})`);});
}
NEW.forEach(id=>{const css=code(`css/themes/${id}.css`);const block=blockOf(css,id);ok(block.length>0,`${id}: token block`);
 const missing=vars.filter(v=>!block.includes(v+':'));ok(!missing.length,`${id}: defines all variables (missing: ${missing.join(', ')})`);
 contrast(id,block);
 const external=(css.match(/https?:\/\/[^'")\s]+/g)||[]).filter(u=>!u.startsWith('http://www.w3.org/2000/svg'));ok(!external.length,`${id}: no external resources (${external})`);
 const fonts=[...css.matchAll(/url\("\.\.\/\.\.\/(assets\/fonts\/[^"]+)"\)/g)].map(m=>m[1]);ok(fonts.length>0&&fonts.every(exists),`${id}: font files bundled (${fonts})`);
 ok(!/@import/.test(css),`${id}: no nested imports`);});
ok(!/https?:\/\//.test(index),'theme index: local only');
NEW.forEach(id=>{const js=code(`js/themes/${id}.js`);ok(!/https?:\/\/|\.mp3|\.wav|\.ogg|new Audio/.test(js),`${id}: sounds are synthesized, no files or URLs`);});
for(const f of ['luckiest-guy-400.woff2','cinzel-variable.woff2','rubik-variable.woff2','teko-variable.woff2','LICENSE-luckiest-guy.txt','LICENSE-cinzel.txt','LICENSE-rubik.txt','LICENSE-teko.txt'])ok(exists(`assets/fonts/${f}`),`font ${f} bundled`);
ok(/Open Font License/.test(code('assets/fonts/LICENSE-cinzel.txt'))&&/Apache License/.test(code('assets/fonts/LICENSE-luckiest-guy.txt')),'font licenses are free licenses');
// Bühne liegt hinter dem Inhalt, Übergang blockiert nichts
ok(/\.theme-stage\{position:fixed;inset:0;z-index:-1;[^}]*pointer-events:none/.test(main)&&/\.theme-transition\{[^}]*pointer-events:none/.test(main),'stage behind content, transition not clickable');
// Version + Doku
ok(code('js/core/app.js').includes("APP_VERSION = 'v29'"),'version v29');
ok(code('CHANGELOG.md').includes('## v29')&&code('README.md').includes('vorschau.html'),'docs updated');
if(process.env.VERBOSE)console.log(report.join('\n'));
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
