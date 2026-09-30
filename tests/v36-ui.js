// v36: UI-Modernisierung – nur Aussehen: zentrale Bausteine in css/ui.css, lokale Schriften, IDs/Abläufe unverändert
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
const pages=['index','spieler','moderator','zuschauer','editor','profil','admin','spielmodi','vorschau'].map(p=>p+'.html');
const ui=code('css/ui.css');
// Einbindung: nach main.css, vor den Designs (die Designs dürfen Bausteine weiter anpassen)
pages.forEach(f=>{const h=code(f);const a=h.indexOf('css/main.css'),b=h.indexOf('css/ui.css'),c=h.indexOf('css/themes/index.css');
 ok(a>0&&b>a&&(c<0||c>b),`${f}: ui.css nach main.css und vor den Designs`);});
// Schriften lokal + frei lizenziert, keine externen Ressourcen
ok(!/https?:\/\//.test(ui.replace(/\/\*[\s\S]*?\*\//g,'')),'ui.css lädt nichts von außen');
[['geist-variable.woff2','LICENSE-geist.txt'],['bricolage-grotesque-variable.woff2','LICENSE-bricolage-grotesque.txt']].forEach(([font,lic])=>{
 ok(fs.existsSync(path.join(root,'assets/fonts',font))&&ui.includes(`../assets/fonts/${font}`),`Schrift ${font} lokal`);
 ok(/SIL Open Font License/.test(code(`assets/fonts/${lic}`)),`Lizenz ${lic} (OFL)`);});
// Designs regeln Farben: ui.css setzt keine festen Farbwerte für Flächen/Text (nur Variablen)
const noComments=ui.replace(/\/\*[\s\S]*?\*\//g,'');
ok(!/#[0-9a-f]{3,8}\b/i.test(noComments),'ui.css ohne feste Hex-Farben (Farben kommen aus dem Design)');
ok(/--font-body:"Geist"/.test(ui)&&/:root\{/.test(ui),'Standard-Schrift nur auf :root (Designs mit eigener Schrift behalten sie)');
// Feste Regeln
ok(/@media \(pointer:coarse\)\{[\s\S]*min-height:var\(--ui-tap\)/.test(ui)&&/--ui-tap:44px/.test(ui),'Tippflächen am Touch-Gerät mind. 44px');
ok(/prefers-reduced-motion:reduce/.test(ui)&&/html\[data-motion="reduced"\]/.test(ui),'Animationen reduzieren: System + ⚙️');
ok(/\.eyebrow,\.hero-badge\{text-transform:none/.test(ui),'ruhigere kleine Überschriften');
ok(/\.answer-btn:nth-child\(4n\+1\) \.answer-index/.test(ui)&&/\.home-content \.role-card:nth-child\(4n\+1\)/.test(ui),'Show-Akzente: Antwort-Marker + Startseiten-Kacheln');
ok(!/[—]/.test(ui),'keine Geviertstriche in ui.css');
ok(code('js/views/spectator-view.js').includes('document.fonts?.ready?.then(scheduleFit)'),'Beamer misst nach dem Laden der Schriften neu (scrollt nie)');
// Nur Aussehen: IDs, data-Attribute und Klassen der HTML-Seiten bleiben (Vergleich mit v35)
let base='';try{base=execSync('git rev-list -n1 --grep="^v35:" HEAD',{cwd:root}).toString().trim()}catch(e){}
if(base){pages.forEach(f=>{let old='';try{old=execSync(`git show ${base}:${f}`,{cwd:root,stdio:['pipe','pipe','ignore']}).toString()}catch(e){return}
 const grab=(h,re)=>new Set([...h.matchAll(re)].map(m=>m[1]));const now=code(f);
 const lost=[...grab(old,/\sid="([^"]+)"/g)].filter(x=>!grab(now,/\sid="([^"]+)"/g).has(x));
 const lostData=[...grab(old,/\s(data-[a-z-]+)/g)].filter(x=>!grab(now,/\s(data-[a-z-]+)/g).has(x));
 const cls=h=>new Set([...h.matchAll(/class="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/)));const lostCls=[...cls(old)].filter(x=>!cls(now).has(x));
 ok(!lost.length&&!lostData.length&&!lostCls.length,`${f}: alle IDs/data-/Klassen erhalten ${[...lost,...lostData,...lostCls].join(',')}`);});
 let v36='';try{v36=execSync('git rev-list -n1 --grep="^v36:" HEAD',{cwd:root}).toString().trim()}catch(e){} // v37: spätere Versionen dürfen JS ändern – geprüft wird der v36-Stand
 const jsFiles=execSync(`git diff --name-only ${base} ${v36} -- js`,{cwd:root}).toString().trim().split('\n').filter(Boolean).sort();ok(jsFiles.join()==='js/core/app.js,js/views/spectator-view.js','JS: nur Versionsnummer + Beamer-Neumessung geändert ('+jsFiles.join()+')');
 const rules=execSync(`git diff --name-only ${base} -- firebase-database.rules.json storage.rules firestore.rules`,{cwd:root}).toString().trim();ok(rules==='','keine Änderung an den Firebase-Regeln');}
ok(/APP_VERSION = 'v(3[6-9]|[4-9]\d)'/.test(code('js/core/app.js'))&&code('CHANGELOG.md').includes('## v36'),'Version v36 + Changelog');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
