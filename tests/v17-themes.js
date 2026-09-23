// v17: Designs – Einstellung im Quiz, Prüfung, Übertragung online, CSS-Variablen vollständig
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const attrs={};const docEl={setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k]};
const crypto=require('crypto').webcrypto;const base={crypto,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,localStorage:new Store(),window:null,URLSearchParams,location:{search:''},document:{documentElement:docEl,querySelector:()=>null,addEventListener(){},querySelectorAll(){return[]}}};base.window=base;
const ctx=vm.createContext(base);const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/topics.js');load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');
const Th=ctx.window.SylasphereThemes,Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator;
ok(JSON.stringify(Th.list().map(t=>t.id))==='["neon","retro","light","pub"]','four designs available');
ok(!('data-theme' in attrs),'default neon = no data-theme attribute');
Th.apply('retro');ok(attrs['data-theme']==='retro'&&ctx.localStorage.getItem('sylasphere:last-theme')==='retro','apply sets attribute and remembers');
Th.apply('neon');ok(!('data-theme' in attrs),'neon removes attribute');
Th.apply('gibtsnicht');ok(Th.current()==='neon','unknown design falls back to neon');
Th.applyQuiz({quiz:{settings:{theme:'pub'}}});ok(attrs['data-theme']==='pub','applyQuiz uses quiz.settings.theme');
ok(Q.normalizeQuiz({quiz:{title:'x',rounds:[]}}).quiz.settings.theme==='neon','normalize default theme');
ok(Q.normalizeQuiz({quiz:{title:'x',settings:{theme:'light'},rounds:[]}}).quiz.settings.theme==='light','normalize keeps theme');
const w=V.validate({quiz:{title:'x',settings:{theme:'disco'},rounds:[{questions:[{type:'true-false',text:'a',correctAnswer:'true',category:'x'}]}]}});
ok(w.warnings.some(x=>x.path==='quiz.settings.theme'),'validator warns about unknown design');
// Online: Übersicht (outline) enthält das Design → Spieler bekommen es
ctx.window.JHQuizFirebase={};load('js/core/online-session-engine.js');
const outline=ctx.window.JHQuizOnlineSession._helpers.makeOutline(Q.normalizeQuiz({quiz:{title:'x',settings:{theme:'retro'},rounds:[]}}));
ok(outline.settings.theme==='retro','online outline carries design to players/spectators');
// CSS: jedes Design setzt alle Variablen, die Neon (Standard) definiert
const css=fs.readFileSync(path.join(root,'css/main.css'),'utf8');
const rootBlock=css.slice(css.indexOf(':root{'),css.indexOf('}',css.indexOf(':root{')));
const vars=new Set([...rootBlock.matchAll(/(--[a-z0-9-]+):/g)].map(m=>m[1]).filter(v=>!['--max','--font-body','--font-display','--font-title','--display-transform','--display-spacing','--radius','--radius-sm'].includes(v)));
for(const id of ['retro','light','pub']){
  const start=css.indexOf(`html[data-theme="${id}"]{`);ok(start>0,`${id}: CSS block exists`);
  const block=css.slice(start,css.indexOf('\n}',start));
  const missing=[...vars].filter(v=>!block.includes(v+':'));
  ok(!missing.length,`${id}: defines all color variables (missing: ${missing.join(', ')})`);
}
// Keine festen Farben mehr außerhalb der Design-Blöcke (außer Kommentaren/Design-Definitionen)
const body=css.slice(css.indexOf('}',css.indexOf(':root{'))+1,css.indexOf('v17 – Designs'));
const hex=(body.match(/#[0-9a-fA-F]{6}\b/g)||[]);
ok(hex.length===0,`no hard-coded hex colors in component styles (${hex.slice(0,5).join(',')})`);
const rgbaFixed=(body.match(/rgba\(\d+,\d+,\d+/g)||[]).filter(x=>x!=='rgba(0,0,0');
ok(rgbaFixed.length===0,`no hard-coded rgba colors in component styles (${rgbaFixed.slice(0,5).join(',')})`);
for(const f of ['bungee-400.woff2','patrick-hand-400.woff2','nunito-400.woff2','nunito-800.woff2','LICENSE-bungee.txt','LICENSE-patrick-hand.txt','LICENSE-nunito.txt'])ok(fs.existsSync(path.join(root,'assets/fonts',f)),`font file ${f} bundled`);
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
