// v30: Editor-Umbau – Datenlogik (Gliederung, Verschieben, Duplizieren, Typwechsel, ⚠️), Antwort-Kennungen, Einbindung
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={crypto:require('crypto').webcrypto,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,URL,URLSearchParams,localStorage:new Store(),window:null,location:{search:''},document:{documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){}}},querySelector:()=>null,addEventListener(){},querySelectorAll(){return[]}}};base.window=base;
const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/core/themes.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/topics.js');load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/editor/editor-model.js');
const M=ctx.window.SylasphereEditorModel,Q=ctx.window.SchmobinQuiz,V=ctx.window.SchmobinValidator,Kit=ctx.window.SylasphereTypeKit;
const fresh=()=>V.validate(JSON.parse(code('data/quiz-showtime.json'))).normalized;
const ids=s=>s.quiz.rounds.map(r=>r.questions.map(q=>q.id));
const byId=s=>Object.fromEntries(M.flat(s).map(x=>[x.question.id,JSON.stringify(x.question)]).sort((a,b)=>a[0].localeCompare(b[0])));
// ---------- Grundlagen ----------
let s=fresh();const n=M.total(s);
ok(n===21&&M.flat(s)[20].n===21,'Showtime: 21 Fragen in der Gliederung (v37: +4 Enthüllungen)');
ok(new Set(M.flat(s).map(x=>x.question.type)).size===19,'Showtime enthält alle 19 Spielmodi');
ok(M.numberOf(s,1,0)===s.quiz.rounds[0].questions.length+1,'laufende Nummer über Runden hinweg');
ok(JSON.stringify(M.step(s,{kind:'question',ri:0,qi:s.quiz.rounds[0].questions.length-1},1))===JSON.stringify({kind:'question',ri:1,qi:0}),'› springt in die nächste Runde');
ok(JSON.stringify(M.step(s,{kind:'question',ri:0,qi:0},-1))===JSON.stringify({kind:'question',ri:0,qi:0}),'‹ bleibt bei der ersten Frage');
ok(M.step(s,{kind:'quiz'},1).kind==='question'&&M.step(s,{kind:'round',ri:2},1).ri===2,'‹ › von Quiz/Runde aus → erste Frage');
ok(M.preview('  Sehr   lange Frage '.repeat(10),20).length===20&&M.preview('')==='(ohne Fragetext)','Textanfang für die Zeile');
// ---------- Verschieben (auch zwischen Runden), nichts geht verloren ----------
s=fresh();const before=byId(s);const first=s.quiz.rounds[0].questions[0].id;
let sel=M.moveQuestion(s,0,0,1,1);
ok(sel.ri===1&&sel.qi===1&&s.quiz.rounds[1].questions[1].id===first&&M.total(s)===21,'Frage in andere Runde gezogen');
ok(JSON.stringify(byId(s))===JSON.stringify(before),'beim Verschieben geht nichts verloren');
s=fresh();sel=M.moveQuestion(s,0,0,0,3);ok(s.quiz.rounds[0].questions[2].id===first&&sel.qi===2,'innerhalb der Runde nach unten (Index vor dem Entfernen)');
s=fresh();const lastInR0=s.quiz.rounds[0].questions.length-1;const mover=s.quiz.rounds[0].questions[lastInR0].id;
sel=M.nudgeQuestion(s,0,lastInR0,1);ok(sel.ri===1&&sel.qi===0&&s.quiz.rounds[1].questions[0].id===mover,'Alt+↓ am Rundenende → erste Frage der nächsten Runde');
sel=M.nudgeQuestion(s,1,0,-1);ok(sel.ri===0&&s.quiz.rounds[0].questions.at(-1).id===mover,'Alt+↑ zurück');
sel=M.nudgeQuestion(s,0,0,-1);ok(sel.ri===0&&sel.qi===0,'Alt+↑ ganz oben bleibt');
s=fresh();const r0=s.quiz.rounds[0].id;sel=M.moveRound(s,0,2);ok(s.quiz.rounds[1].id===r0&&sel.ri===1,'Runde gezogen');
ok(JSON.stringify(byId(s))===JSON.stringify(before),'Runde verschieben: nichts verloren');
// ---------- Duplizieren, Löschen, Einfügen ----------
s=fresh();sel=M.duplicateQuestion(s,0,1);const orig=s.quiz.rounds[0].questions[1],copy=s.quiz.rounds[0].questions[2];
ok(M.total(s)===22&&copy.id!==orig.id&&copy.text===`${orig.text} (Kopie)`&&sel.qi===2,'Frage duplizieren (Strg+D)');
{s.quiz.rounds[3].questions.push({id:'hl1',type:'higher-lower',text:'x',category:'x',points:1,timer:1,cards:[{id:'k1',label:'A',value:1},{id:'k2',label:'B',value:2}]});
 const d=M.duplicateQuestion(s,3,s.quiz.rounds[3].questions.length-1);const c=s.quiz.rounds[d.ri].questions[d.qi];
 ok(c.cards.every(card=>!['k1','k2'].includes(card.id)),'Duplikat bekommt neue Karten-IDs (Higher/Lower)');s.quiz.rounds[3].questions.splice(-2,2);}
sel=M.deleteQuestion(s,0,2);ok(M.total(s)===21&&sel.kind==='question'&&sel.qi===2,'Frage löschen, Auswahl bleibt sinnvoll');
s=fresh();sel=M.duplicateRound(s,1);ok(s.quiz.rounds.length===6&&s.quiz.rounds[2].title.endsWith('(Kopie)')&&new Set(M.flat(s).map(x=>x.question.id)).size===M.total(s),'Runde duplizieren mit neuen IDs');
sel=M.deleteRound(s,2);ok(s.quiz.rounds.length===5&&sel.kind==='round','Runde löschen');
sel=M.addRound(s,0);ok(s.quiz.rounds[1].questions.length===0&&sel.ri===1,'neue Runde nach der gewählten');
const q=V.validate({quiz:{title:'x',rounds:[{questions:[{type:'estimate',text:'neu',category:''}]}]}}).normalized.quiz.rounds[0].questions[0];
sel=M.insertQuestion(s,{kind:'question',ri:0,qi:1},q);ok(sel.ri===0&&sel.qi===2&&s.quiz.rounds[0].questions[2]===q&&q.category===s.quiz.rounds[0].questions[1].category,'+ Frage landet hinter der gewählten und übernimmt das Thema');
sel=M.insertQuestion(s,{kind:'round',ri:1},{id:'x2',type:'true-false'});ok(sel.ri===1&&sel.qi===0,'+ Frage in leere Runde');
ok(M.clampSelection(s,{kind:'question',ri:9,qi:9}).kind==='question'&&M.clampSelection({quiz:{rounds:[]}},{kind:'round',ri:0}).kind==='quiz','Auswahl bleibt gültig');
// ---------- Typwechsel: nur Grundfelder bleiben ----------
s=fresh();{const mc=M.flat(s).find(x=>x.question.type==='multiple-choice');const old=JSON.parse(JSON.stringify(mc.question));
 const next=V.validate({quiz:{title:'x',rounds:[{questions:[{type:'estimate',text:'x',category:'x'}]}]}}).normalized.quiz.rounds[0].questions[0];
 M.changeType(s,mc.ri,mc.qi,next);const now=s.quiz.rounds[mc.ri].questions[mc.qi];
 ok(now.type==='estimate'&&['id','category','text','points','timer'].every(k=>now[k]===old[k])&&!now.options,'Typwechsel behält Text, Thema, Punkte, Timer, ID');}
// ---------- Prüfung → ⚠️ ----------
s=fresh();s.quiz.rounds[1].questions[0].text='';s.quiz.rounds[2].theme='disco';
{const iss=M.issues(V.validate(s));ok(iss.questions.get('1:0')?.some(x=>x.kind==='error'&&/Fragetext/.test(x.message)),'⚠️ an der richtigen Frage');ok(iss.rounds.get(2)?.length===1,'⚠️ an der Runde');ok(!iss.questions.has('0:0'),'keine falschen Markierungen');}
// ---------- Antwort-Kennungen automatisch ----------
ok(M.nextOptionId([{id:'a'},{id:'c'}])==='b'&&Kit.nextOptionId([{id:'a'},{id:'b'},{id:'c'}])==='d','freie Kennung (auch nach Löschen, keine Doppelten)');
{const all=Array.from({length:26},(_,i)=>({id:String.fromCharCode(97+i)}));ok(Kit.nextOptionId(all)==='a2','nach z geht es weiter');}
ok(!code('js/question-types/kit.js').includes("input('text', opt.id")&&code('js/question-types/kit.js').includes('option-letter'),'Kennungs-Feld ausgeblendet, Buchstabe stattdessen');
// ---------- Einbindung ----------
const ed=code('js/editor/editor.js'),html=code('editor.html'),css=code('css/main.css');
ok(html.includes('id="ed-outline"')&&html.includes('id="ed-detail"')&&html.includes('id="ed-menu"')&&html.includes('editor-model.js'),'neue Arbeitsfläche');
ok(['JSON exportieren','JSON importieren','Neues Quiz','Anderes Quiz öffnen'].every(t=>html.includes(t)),'⋯-Menü mit Import/Export/Neu/Öffnen');
ok(ed.includes("key.toLowerCase() === 'd'")&&ed.includes("e.altKey && (e.key === 'ArrowUp'")&&ed.includes('onGripDown')&&ed.includes('pointermove'),'Tastenkürzel und Ziehen (Maus + Finger)');
ok(ed.includes('openTypePicker')&&ed.includes('ed-type-tile')&&ed.includes('changeTypeDialog')&&ed.includes('confirm('),'Typ-Auswahl als Kacheln, Typwechsel mit Rückfrage');
ok(ed.includes("summary.textContent = 'Experten'")&&ed.includes('Technische Fragen-ID'),'Fragen-ID nur unter „Experten“');
ok(ed.includes('queueCloudSave')&&/if \(!state \|\| !Cloud\(\)\?\.available\(\) \|\| accountHint\(\)\) return;/.test(ed),'automatisch online speichern (auch ohne vorheriges Anlegen)');
ok(ed.includes('is-detail')&&css.includes('.ed-shell:not(.is-detail) .ed-detail{display:none}')&&html.includes('← Übersicht'),'Handy: Übersicht ↔ Frage');
ok(code('js/editor/media-library.js').includes('media-input-row--compact')&&css.includes('.media-thumb'),'Bilder mit Vorschaubild');
ok(css.includes('.btn.btn--success{background:var(--success)'),'Export-Knopf lesbar');
ok(/APP_VERSION = 'v(3\d|[4-9]\d)'/.test(code('js/core/app.js')),'Version v30+');
ok(code('CHANGELOG.md').includes('## v30'),'Changelog v30');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
