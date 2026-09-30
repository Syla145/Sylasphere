// v35: Spielmodi erklären – eine Textquelle (help), Neu-Karte (erste Nutzung pro Sitzung), Begriffe, Themen, Einbindung
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,URLSearchParams,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/',search:''},BroadcastChannel:class{postMessage(){}close(){}}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/core/topics.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/quiz-validator.js');load('js/core/show-formats.js');load('js/core/modes.js');
const T=ctx.window.SylasphereTypes,Q=ctx.window.SchmobinQuiz,M=ctx.window.SylasphereModes,Kit=ctx.window.SylasphereTypeKit;
// ---------- Eine Textquelle ----------
const groups=M.GROUPS.map(g=>g.id);
const checkHelp=(id,h)=>{
  ok(h&&groups.includes(h.group),`${id}: Gruppe`);
  ok(typeof h.short==='string'&&h.short.length>=10&&h.short.length<=110&&/[.?!]$/.test(h.short),`${id}: short = ein Satz (${h?.short?.length})`);
  ok(Array.isArray(h.steps)&&h.steps.length>=2&&h.steps.length<=3&&h.steps.every(s=>s.length>5),`${id}: 2–3 Schritte`);
  ok(h.scoring&&h.scoring.length>10,`${id}: Punkte erklärt`);
  ok(h.moderator&&/Vorbereiten|Nicht mehr neu/.test(h.moderator),`${id}: Moderator-Tipps mit „Vorbereiten“`);
};
T.list().forEach(def=>{checkHelp(def.type,def.help);ok(def.description===def.help.short,`${def.type}: description kommt aus help.short`);});
M.SHOW_MODES.forEach(m=>checkHelp(m.id,m.help));
const all=M.list();
ok(all.length===19&&all.some(m=>m.id==='board')&&all.some(m=>m.id==='final')&&!all.some(m=>m.id==='higher-lower'),'Galerie: 17 Spielmodi + Brett + Einsatz-Finale, versteckte nicht');
ok(groups.every(g=>all.some(m=>m.help.group===g)),'jede Gruppe hat Spielmodi');
ok(T.get('consensus').label==='Dilemma'&&!Object.values(Q.TYPE_LABELS).includes('Gleich gedacht'),'„Gleich gedacht“ heißt jetzt „Dilemma“ (Typ bleibt consensus)');
ok(Kit.modeText('consensus')===T.get('consensus').help.short&&Kit.modeText('sort','steps',1)===T.get('sort').help.steps[1],'Hinweistexte in der Frage kommen aus help');
{const src=['consensus','survey','matching','sort','hotspot','gap-text'].map(t=>code(`js/question-types/types/${t}.js`)).join('\n');
 ok(!/Ziel: Wähle die Antwort|Gesucht ist die häufigste Antwort|Wähle für jeden Begriff das passende Gegenstück\.'|Ziehe die Karten in die richtige|Tippe oder klicke auf die gesuchte Stelle|Rechtschreibung ist egal – der Moderator prüft jede/.test(src),'alte Hinweistexte ersetzt (keine Doppelungen)');}
// ---------- Neu in dieser Sitzung ----------
const quiz=Q.normalizeQuiz({quiz:{title:'T',settings:{finalWager:true},rounds:[
 {title:'R1',questions:[{id:'a',type:'multiple-choice',text:'x',category:'Geografie',options:['A','B'],correctAnswer:'a'},{id:'b',type:'multiple-choice',text:'y',category:'Geografie',options:['A','B'],correctAnswer:'a'},{id:'c',type:'consensus',text:'z',category:'Geografie',options:['A','B']}]},
 {title:'Brett',format:'board',board:{topics:['A'],values:[100,300]},questions:[{id:'d',type:'multiple-choice',text:'x',category:'A',options:['A','B'],correctAnswer:'a'},{id:'e',type:'estimate',text:'y',category:'A',min:0,max:10,correctAnswer:5,tolerance:1}]},
 {title:'Finale',questions:[{id:'f',type:'estimate',text:'y',category:'Bauwerke',min:0,max:10,correctAnswer:5,tolerance:1}]}]}});
const st=(ri,qi,scored,extra={})=>Object.assign({status:'playing',quiz,currentRoundIndex:ri,currentQuestionIndex:qi,scoredQuestionIds:scored,show:null},extra);
const cur=s=>({question:quiz.quiz.rounds[s.currentRoundIndex].questions[s.currentQuestionIndex]});
ok(quiz.quiz.settings.explainModes===true&&Q.normalizeQuiz({quiz:{title:'x',settings:{explainModes:false},rounds:[]}}).quiz.settings.explainModes===false,'Einstellung „Spielmodi erklären“: Standard an, abschaltbar');
{let s=st(0,0,[]);ok(M.newTarget(s,cur(s))==='multiple-choice','erste MC-Frage: Neu-Karte');
 s=st(0,1,['a']);ok(M.newTarget(s,cur(s))==='','zweite MC-Frage: keine Karte mehr');
 s=st(0,2,['a','b']);ok(M.newTarget(s,cur(s))==='consensus','Dilemma zum ersten Mal: Karte');
 s=st(1,0,['a','b','c'],{show:{kind:'board',current:null}});ok(M.target(s,cur(s))==='board'&&M.newTarget(s,cur(s))==='board','Brett beim Wählen: Brett-Karte');
 s=st(1,1,['a','b','c'],{show:{kind:'board',current:{qid:'e'}}});ok(M.newTarget(s,cur(s))==='estimate','im Brett-Feld: Karte für den Spielmodus des Felds (Schätzfrage neu)');
 s=st(1,0,['a','b','c','e'],{show:{kind:'board',current:null}});ok(M.newTarget(s,cur(s))==='','Brett schon gespielt: keine Karte');
 s=st(2,0,['a','b','c','d','e'],{show:{kind:'final',qid:'f',phase:'wager'}});ok(M.newTarget(s,cur(s))==='final','Einsatz-Finale beim Setzen: Finale-Karte');
 s=st(2,0,['a','b','c','d','e'],{show:{kind:'final',qid:'f',phase:'ready'}});ok(M.target(s,cur(s))==='estimate'&&M.newTarget(s,cur(s))==='','Finale-Frage: Schätzfrage war schon dran');
 const off=Q.normalizeQuiz({quiz:Object.assign({},quiz.quiz,{settings:{explainModes:false}})});s=Object.assign(st(0,0,[]),{quiz:off});ok(M.newTarget(s,{question:off.quiz.rounds[0].questions[0]})==='','ausgeschaltet: keine Neu-Karte');
 ok(M.inQuiz(quiz).join()==='multiple-choice,consensus,board,estimate,final','Spielmodi eines Quiz (für „Heute im Quiz“)');}
ok(/Neu<\/?|Neu' : 'Spielmodus'/.test(code('js/core/modes.js'))&&M.cardHTML('consensus',{dismiss:'✓ Verstanden'}).includes('data-mode-dismiss')&&M.detailHTML('board').includes('Für Moderatoren'),'Karten-HTML: Neu-Karte mit Wegtippen, Details mit Moderator-Tipps');
// ---------- Themen ----------
{const Topics=ctx.window.SylasphereTopics;const names=Topics.LIBRARY?Topics.LIBRARY.map(t=>t.name):code('js/core/topics.js');
 ok(!/name: 'Bilderrätsel'|name: 'Schätzfragen'|name: 'Dilemma'/.test(code('js/core/topics.js')),'Themen-Bibliothek ohne „Bilderrätsel“, „Schätzfragen“, „Dilemma“');
 const bad=[];fs.readdirSync(path.join(root,'data')).filter(f=>/^quiz-.*\.json$/.test(f)&&f!=='quiz-list.json').forEach(f=>{const d=JSON.parse(code(`data/${f}`));d.quiz.rounds.forEach(r=>r.questions.forEach(q=>{if(['Bilderrätsel','Schätzfragen','Dilemma','Speed & Wissen'].includes(q.category))bad.push(`${f}:${q.id}`)}));(d.quiz.categories||[]).forEach(c=>{if(['Bilderrätsel','Schätzfragen','Dilemma'].includes(typeof c==='string'?c:c.name))bad.push(`${f}:categories`)})});
 ok(!bad.length,'Demo-Quizze ohne Themen, die wie Spielmodi klingen '+bad.join(','));
 const old=Q.normalizeQuiz({quiz:{title:'alt',rounds:[{questions:[{id:'z',type:'multiple-choice',text:'x',category:'Bilderrätsel',options:['A','B'],correctAnswer:'a'}]}]}});
 ok(old.quiz.rounds[0].questions[0].category==='Bilderrätsel'&&Q.topic('Bilderrätsel').name==='Bilderrätsel','alte Quizze behalten ihr Thema');}
// ---------- Begriffe in der Oberfläche ----------
{const ui=['js/views/moderator-view.js','js/views/player-view.js','js/views/spectator-view.js','js/views/profile-view.js','js/views/home-view.js','js/views/modes-view.js','js/views/mode-demo.js','js/editor/editor.js','js/core/quiz-validator.js','js/question-types/renderers.js','js/core/settings.js'];
 const hits=[];ui.forEach(f=>code(f).split('\n').forEach((line,i)=>{const t=line.trim();if(t.startsWith('//')||t.startsWith('*'))return;const strings=line.match(/(['`"])(?:\\.|(?!\1).)*\1/g)||[];strings.forEach(s=>{if(/Fragetyp|Kategorie|Gleich gedacht|\bThemes?\b/.test(s))hits.push(`${f}:${i+1} ${s.slice(0,60)}`)})}));
 ok(!hits.length,'keine „Fragetyp“, „Kategorie“, „Theme“ in Oberflächen-Texten\n'+hits.join('\n'));
 const html=['index.html','moderator.html','spieler.html','zuschauer.html','editor.html','spielmodi.html','profil.html','admin.html'].map(code).join('');ok(!/Fragetyp|Kategorie|>[^<]*\bTheme\b/.test(html),'HTML ohne alte Begriffe');
 ok(/Welcher Spielmodus\?/.test(code('js/editor/editor.js'))&&/Spielmodus ändern/.test(code('js/editor/editor.js'))&&/Nach Spielmodus/.test(code('js/views/profile-view.js')),'Editor + Profil sagen „Spielmodus“');}
// ---------- Einbindung ----------
{const ed=code('js/editor/editor.js'),pv=code('js/views/player-view.js'),sv=code('js/views/spectator-view.js'),mv=code('js/views/moderator-view.js');
 ok(ed.includes('Mehr erfahren')&&ed.includes('showTypeInfo')&&ed.includes('Spielmodi erklären')&&ed.includes('explainModes'),'Editor: „Mehr erfahren“ + Schalter');
 ok(sv.includes('renderModeCard')&&sv.includes("'Escape'")&&/position:fixed/.test(code('css/main.css').match(/\.beamer-mode-card\{[^}]*\}/)?.[0]||''),'Beamer: Neu-Karte schwebt (kein Scrollen), Leertaste blendet aus');
 ok(pv.includes('renderModeHelp')&&pv.includes('data-mode-open')&&pv.includes('✓ Verstanden')&&code('spieler.html').includes('id="mode-help"'),'Handy: Karte zum Wegtippen + „?“');
 ok(mv.includes('modeNoticeHTML')&&mv.includes('modesLink')&&sv.includes('modesStrip'),'Moderator-Hinweis + Lobby-Links');
 ['moderator.html','spieler.html','zuschauer.html','editor.html','spielmodi.html'].forEach(f=>ok(/js\/core\/modes\.js\?v=\d+/.test(code(f)),`${f}: modes.js eingebunden`));
 ok(code('spielmodi.html').includes('mode-demo.js')&&code('spielmodi.html').includes('modes-view.js')&&code('editor.html').includes('mode-demo.js'),'Demo/Vorschau eingebunden');
 ok(code('js/views/home-view.js').includes('./spielmodi.html'),'Startseite verlinkt spielmodi.html');
 ok(code('js/core/online-session-engine.js').includes("round.format ? { format: String(round.format) }"),'online: Spieler kennen das Runden-Format (Brett)');
 ok(/APP_VERSION = 'v(3[5-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v35'),'Version v35 + Changelog');}
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
