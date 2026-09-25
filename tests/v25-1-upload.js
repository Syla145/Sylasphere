// v25.1: Datei-Upload (Firebase Storage) – Hilfsfunktionen, Regeln, Einbindung
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const base={URL,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Intl,crypto:require('crypto').webcrypto,localStorage:new Store(),sessionStorage:new Store(),setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,window:null,document:{addEventListener(){},readyState:'complete',querySelectorAll:()=>[]},location:{href:'http://x/'},BroadcastChannel:class{postMessage(){}close(){}},addEventListener(){}};
base.window=base;const ctx=vm.createContext(base);const load=f=>vm.runInContext(code(f),ctx,{filename:f});
load('js/core/app.js');load('js/core/firebase-service.js');load('js/question-types/registry.js');load('js/question-types/kit.js');ctx.window.SylasphereTypes.files.forEach(f=>load(`js/question-types/types/${f}.js`));load('js/core/quiz-utils.js');load('js/core/cloud-media.js');
const C=ctx.window.SylasphereCloudMedia,K=ctx.window.SylasphereTypeKit;
ok(C&&typeof C.upload==='function'&&typeof C.syncUploaders==='function','cloud media module');
ok(!C.available(),'not available without account');
ok(C.slug('Zeitduell: Tiere & Ähren')==='zeitduell-tiere-aehren','folder slug');
ok(C.labelFromName('katze_2.webp')==='Katze 2'&&C.labelFromName('eiffel-turm.JPG')==='Eiffel turm','label from filename');
ok(C.kindOf({name:'a.mp3',type:''})==='audio'&&C.kindOf({name:'b.HEIC',type:''})==='image'&&C.kindOf({name:'c.pdf',type:'application/pdf'})==='','kind detection');
const url='https://firebasestorage.googleapis.com/v0/b/jh-quiz.firebasestorage.app/o/media%2Fu%2Faudio%2Fm1.mp3?alt=media&token=x';
ok(C.isStorageUrl(url)&&!C.isStorageUrl('https://example.com/a.mp3')&&!C.isStorageUrl('https://firebasestorage.googleapis.com/v0/b/other.appspot.com/o/x.mp3'),'own storage URL detection');
ok(!K.mediaAdvice(url,'audio',{needsCors:true}).some(a=>a.level!=='info'),'no CORS warning for own storage audio');
ok(K.mediaAdvice('https://example.com/a.mp3','audio',{needsCors:true}).some(a=>a.level==='warn'),'foreign links still warned');
// Regeln
const rules=JSON.parse(code('firebase-database.rules.json')).rules;
const um=rules.userMedia.$uid;ok(um['.write'].includes("moderators")&&um.$id['.validate'].includes("beginsWith('media/' + $uid + '/')")&&um.$id['.validate'].includes('firebasestorage.googleapis.com'),'RTDB rules for userMedia');
const sr=code('storage.rules');ok(sr.includes('firestore.exists(/databases/(default)/documents/uploaders/$(uid))')&&sr.includes('20 * 1024 * 1024')&&sr.includes("image/.*|audio/.*"),'storage rules check uploader list, size and type');
const fr=code('firestore.rules');ok(fr.includes("DEINE_ADMIN_UID")&&fr.includes('match /uploaders/{uid}'),'firestore rules template');
// Einbindung
['editor.html','admin.html'].forEach(f=>ok(code(f).includes('js/core/cloud-media.js'),`${f} loads cloud media`));
const ml=code('js/editor/media-library.js');ok(ml.includes('media-upload-btn')&&ml.includes('data-source="cloud"')&&ml.includes('Cloud().remove'),'editor: upload button, uploads tab, delete');
ok(code('js/views/admin-view.js').includes('syncUploaders'),'admin syncs uploader list');
ok(code('js/question-types/types/time-duel.js').includes("folder: 'zeitduell'")&&code('js/question-types/types/ranking.js').includes("folder: 'einordnen'"),'bulk upload in duel and ranking editors');
ok(code('FIREBASE_SETUP.md').includes('v25.1'),'setup guide');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
