// v19: Konten, Rollen (Admin vergibt Moderator-Rechte) und Online-Quizspeicher – Regeln + Module
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
// Regel-Auswerter aus v13 wiederverwenden (auth als Objekt mit provider)
let src=fs.readFileSync(path.join(root,'tests/v13-rules-eval.js'),'utf8');
src=src.slice(0,src.indexOf("const HOST="));
src=src.replace("const auth=uid?{uid}:null;","const auth=uid&&typeof uid==='object'?uid:(uid?{uid,provider:'anonymous'}:null);");
src+=`
function canRead(db,who,p){const auth=who&&typeof who==='object'?who:(who?{uid:who,provider:'anonymous'}:null);const parts=split(p);for(const {node,depth,vars} of walk(parts)){if(!node)break;const r=node['.read'];if(r===undefined)continue;const res=typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now:Date.now(),root:new Snap(db,[]),data:new Snap(db,parts.slice(0,depth))},vars));if(res)return true}return false}
module.exports={canWrite,canRead,setIn,split,RULES,get ok(){return ok},counts:()=>[pass,fail]};`;
String.prototype.matches=function(re){return re.test(String(this))};
const m={exports:{}};new Function('require','module','__dirname',src)(require,m,path.join(root,'tests'));
const {canWrite,canRead,setIn,split}=m.exports;let pass=0,fail=0;const ok=(c,msg)=>{if(c)pass++;else{fail++;console.error('FAIL',msg)}};

const ADMIN={uid:'admin_uid_1234567890',provider:'google.com'};
const MOD={uid:'mod_uid_12345678901',provider:'password'};
const NEW={uid:'new_uid_12345678901',provider:'google.com'};
const ANON={uid:'anon_uid_1234567890',provider:'anonymous'};
let db={config:{moderatorKeys:{'Geheim-2026':true}},admins:{[ADMIN.uid]:true},moderators:{[MOD.uid]:{name:'Mo',email:'mo@x.de',grantedAt:1,grantedBy:ADMIN.uid}}};

// --- Admin-Knoten: niemand kann sich selbst zum Admin machen
ok(!canWrite(db,NEW,{[`admins/${NEW.uid}`]:true}),'cannot make yourself admin');
ok(!canWrite(db,ADMIN,{[`admins/${NEW.uid}`]:true}),'admins only via console');
ok(canRead(db,ADMIN,`admins/${ADMIN.uid}`)&&!canRead(db,NEW,`admins/${ADMIN.uid}`),'admin flag only readable by self');

// --- Anmelden allein gibt keine Rechte
const req={name:'Neu',email:'neu@x.de',note:'Hi',requestedAt:5};
ok(!canWrite(db,NEW,{[`moderators/${NEW.uid}`]:{grantedAt:1,grantedBy:NEW.uid}}),'account cannot grant itself moderator');
ok(canWrite(db,NEW,{[`moderatorRequests/${NEW.uid}`]:req}),'account can request access');
ok(!canWrite(db,ANON,{[`moderatorRequests/${ANON.uid}`]:req}),'guest (anonymous) cannot request access');
ok(!canWrite(db,NEW,{[`moderatorRequests/${MOD.uid}`]:req}),'cannot request for another account');
ok(!canWrite(db,NEW,{[`moderatorRequests/${NEW.uid}`]:{name:'x'.repeat(61),email:'a',requestedAt:1}}),'request validated');
ok(canRead(db,NEW,`moderatorRequests/${NEW.uid}`)&&!canRead(db,NEW,'moderatorRequests'),'own request readable, list not');
ok(canRead(db,ADMIN,'moderatorRequests')&&canRead(db,ADMIN,'moderators'),'admin can list requests and moderators');
ok(!canRead(db,MOD,'moderators'),'moderator cannot list all moderators');

// --- Admin schaltet frei (Multi-Pfad wie in account.js approve)
db=setIn(db,split(`moderatorRequests/${NEW.uid}`),req);
ok(canWrite(db,ADMIN,{[`moderators/${NEW.uid}`]:{name:'Neu',email:'neu@x.de',grantedAt:9,grantedBy:ADMIN.uid},[`moderatorRequests/${NEW.uid}`]:null}),'admin approves request');
ok(!canWrite(db,MOD,{[`moderators/${NEW.uid}`]:{grantedAt:9,grantedBy:MOD.uid}}),'moderator cannot approve others');
ok(!canWrite(db,ADMIN,{[`moderators/${NEW.uid}`]:{grantedAt:9,grantedBy:MOD.uid}}),'grantedBy must be the approving admin');
ok(canWrite(db,ADMIN,{[`moderatorRequests/${NEW.uid}`]:null}),'admin can reject');
ok(canWrite(db,ADMIN,{[`moderators/${MOD.uid}`]:null}),'admin can revoke');

// --- Online-Räume: Moderator/Admin per Rolle, Gastmodus per Code weiter möglich, neues Konto nicht
const meta=uid=>({ownerUid:uid,createdAt:1,updatedAt:1,status:'lobby',quizTitle:'T',appVersion:'v19',schemaVersion:1});
ok(canWrite(db,MOD,{'rooms/AAA111/meta':meta(MOD.uid)}),'moderator creates room');
ok(canWrite(db,ADMIN,{'rooms/AAA112/meta':meta(ADMIN.uid)}),'admin creates room');
ok(!canWrite(db,NEW,{'rooms/AAA113/meta':meta(NEW.uid)}),'unapproved account cannot create room');
const guest=setIn(db,split(`moderatorGrants/${ANON.uid}`),'Geheim-2026');
ok(canWrite(guest,ANON,{'rooms/AAA114/meta':meta(ANON.uid)}),'guest mode with code still works');
const revoked=setIn(db,split(`moderators/${MOD.uid}`),null);
ok(!canWrite(revoked,MOD,{'rooms/AAA115/meta':meta(MOD.uid)}),'revoked moderator cannot create rooms');

// --- Meine Quizze
const qid='qabc123def';
const save=uid=>({[`userQuizzes/${uid}/data/${qid}`]:{json:'{"quiz":{}}',updatedAt:1},[`userQuizzes/${uid}/index/${qid}/title`]:'Quiz',[`userQuizzes/${uid}/index/${qid}/updatedAt`]:1,[`userQuizzes/${uid}/index/${qid}/questionCount`]:3});
ok(canWrite(db,MOD,save(MOD.uid)),'moderator saves quiz');
ok(canWrite(db,ADMIN,save(ADMIN.uid)),'admin saves quiz');
ok(!canWrite(db,NEW,save(NEW.uid)),'unapproved account cannot save quizzes');
ok(!canWrite(guest,ANON,save(ANON.uid)),'guest cannot save quizzes');
ok(!canWrite(db,MOD,save(ADMIN.uid)),'cannot write into another users quizzes');
const withQuiz=setIn(db,split(`userQuizzes/${MOD.uid}/data/${qid}`),{json:'{}',updatedAt:1});
ok(canRead(withQuiz,MOD,`userQuizzes/${MOD.uid}/data/${qid}`),'owner reads own quiz');
ok(!canRead(withQuiz,ADMIN,`userQuizzes/${MOD.uid}/data/${qid}`),'even admin cannot read others quizzes');
ok(!canRead(withQuiz,NEW,`userQuizzes/${MOD.uid}/index`),'others cannot list quizzes');
ok(!canRead(setIn(withQuiz,split(`moderators/${MOD.uid}`),null),MOD,`userQuizzes/${MOD.uid}/index`),'revoked moderator loses access (data kept)');
ok(!canWrite(db,MOD,{[`userQuizzes/${MOD.uid}/data/bad.id`]:{json:'{}'}}),'invalid quiz id rejected');
ok(!canWrite(db,MOD,{[`userQuizzes/${MOD.uid}/data/${qid}`]:{json:'x'.repeat(4000001)}}),'too large quiz rejected');
ok(!canWrite(db,MOD,{[`userQuizzes/${MOD.uid}/junk`]:'x'}),'no other data under userQuizzes');
ok(canWrite(withQuiz,MOD,{[`userQuizzes/${MOD.uid}/data/${qid}`]:null,[`userQuizzes/${MOD.uid}/index/${qid}`]:null}),'owner deletes quiz');

// --- Module im Browser-Ersatz laden
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
const sandbox={window:{},console,crypto:require('crypto').webcrypto,Date,JSON,Math,Promise,setTimeout,clearTimeout};sandbox.window.window=sandbox.window;
vm.createContext(sandbox);vm.runInContext(code('js/core/account.js')+';'+code('js/core/cloud-quizzes.js'),sandbox);
const Cloud=sandbox.window.SylasphereCloud,Acc=sandbox.window.SylasphereAccount;
ok(Acc&&typeof Acc.requestAccess==='function'&&Acc.admin&&typeof Acc.admin.approve==='function','account module exposes request/approve API');
ok(!Acc.canModerate(),'not moderator before sign-in');
const sum=Cloud.summary({quiz:{title:'T',rounds:[{questions:[1,2]},{questions:[3]}],settings:{theme:'retro'}}});
ok(sum.questionCount===3&&sum.roundCount===2&&sum.theme==='retro','summary counts');
ok(Cloud.validId('qabc123def')&&!Cloud.validId('a.b')&&!Cloud.validId(''),'id validation');
ok(Acc.errorText({code:'auth/invalid-credential'}).includes('Passwort'),'german auth errors');

// --- Einbindung
const mod=code('moderator.html'),ed=code('editor.html'),adm=code('admin.html');
ok(mod.includes('account.js')&&mod.includes('cloud-quizzes.js')&&mod.includes('id="account-gate"')&&mod.includes('id="moderator-code"'),'moderator page: account login + guest code');
ok(ed.includes('account.js')&&ed.includes('cloud-quizzes.js')&&ed.includes('firebase-service.js')&&ed.includes('cloud-panel'),'editor has cloud storage');
ok(adm.includes('admin-view.js')&&adm.includes('request-list'),'admin page exists');
ok(code('js/core/moderator-gate.js').includes("MODERATOR_CODE_HASH = '3324cb69664921bc390d821b2c47f6c67e8c4e0937476fba9af69da58df53f17'"),'user moderator hash kept');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
