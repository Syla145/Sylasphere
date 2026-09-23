// Mini-Auswerter für firebase-database.rules.json: führt die echten Regel-Ausdrücke aus.
// Deckt .write (kaskadierend von oben) und .validate (für geänderte, nicht-leere Knoten) ab.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const RULES=JSON.parse(fs.readFileSync(path.join(root,'firebase-database.rules.json'),'utf8')).rules;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const split=p=>String(p).split('/').filter(Boolean);
function get(tree,parts){return parts.reduce((o,k)=>o==null||typeof o!=='object'?undefined:o[k],tree)}
function strip(v){if(v===null||v===undefined)return undefined;if(typeof v!=='object')return v;const o={};for(const[k,x]of Object.entries(v)){const y=strip(x);if(y!==undefined)o[k]=y}return Object.keys(o).length?o:undefined}
function setIn(tree,parts,value){tree=clone(tree)||{};if(!parts.length)return strip(value)||{};let o=tree;for(let i=0;i<parts.length-1;i++){if(typeof o[parts[i]]!=='object'||o[parts[i]]===null)o[parts[i]]={};o=o[parts[i]]}const v=strip(value);if(v===undefined)delete o[parts.at(-1)];else o[parts.at(-1)]=v;return strip(tree)||{}}
class Snap{constructor(tree,parts){this.t=tree;this.p=parts}_v(){return get(this.t,this.p)}
 child(p){if(p===null||p===undefined)throw new Error('child(null)');return new Snap(this.t,[...this.p,...split(String(p))])}
 parent(){return new Snap(this.t,this.p.slice(0,-1))}
 val(){const v=this._v();return v===undefined?null:clone(v)} exists(){return this._v()!==undefined}
 isString(){return typeof this._v()==='string'} isNumber(){return typeof this._v()==='number'} isBoolean(){return typeof this._v()==='boolean'}
 hasChild(p){return this.child(p).exists()} hasChildren(a){const v=this._v();if(!a)return !!v&&typeof v==='object';return a.every(k=>this.hasChild(k))}}
function evalRule(expr,vars){const names=Object.keys(vars);try{return Boolean(new Function(...names,`return (${expr});`)(...names.map(n=>vars[n])))}catch(e){return false}}
// Liefert für einen Pfad die Regelknoten entlang des Weges plus $-Variablen
function walk(parts){const nodes=[{node:RULES,depth:0,vars:{}}];let cur=RULES,vars={};for(let i=0;i<parts.length;i++){if(!cur)break;const k=parts[i];let next=cur[k];if(next===undefined){const w=Object.keys(cur).find(x=>x.startsWith('$'));if(w){next=cur[w];vars=Object.assign({},vars,{[w]:k})}}cur=next;nodes.push({node:cur,depth:i+1,vars:clone(vars)})}return nodes}
function canWrite(db,uid,writes){ // writes: {path:value} (multi-path update)
 let after=clone(db);for(const[p,v]of Object.entries(writes))after=setIn(after,split(p),v);
 const auth=uid?{uid}:null;const now=Date.now();
 for(const p of Object.keys(writes)){const parts=split(p);const nodes=walk(parts);let allowed=false;
  for(const {node,depth,vars} of nodes){if(!node)break;if(node['.write']!==undefined){const r=node['.write'];const res=typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now,root:new Snap(db,[]),data:new Snap(db,parts.slice(0,depth)),newData:new Snap(after,parts.slice(0,depth))},vars));if(res){allowed=true;break}}}
  if(!allowed)return false;
  // .validate an Pfad + Vorfahren + Nachfahren mit nicht-leeren neuen Daten
  const checkValidate=(parts2)=>{const nodes2=walk(parts2);const last=nodes2[nodes2.length-1];if(!last||!last.node||last.depth!==parts2.length)return true;const r=last.node['.validate'];if(r===undefined)return true;const nd=new Snap(after,parts2);if(!nd.exists())return true;return typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now,root:new Snap(db,[]),data:new Snap(db,parts2),newData:nd},last.vars))};
  for(let d=1;d<=parts.length;d++)if(!checkValidate(parts.slice(0,d)))return false;
  const visit=(val,pp)=>{if(val&&typeof val==='object')for(const[k,x]of Object.entries(val)){const np=[...pp,k];if(!checkValidate(np))throw 0;visit(x,np)}};
  try{visit(strip(writes[p]),parts)}catch(_){return false}
 }
 return true}

const HOST='host_uid_1234567890',P1='p1_uid_1234567890',P2='p2_uid_1234567890';
const base={config:{moderatorKeys:{'Geheim-2026':true}}};
// --- v21: Moderator-Code (moderatorGrants) entfernt – Räume nur noch mit Moderator-Rolle
ok(!canWrite(base,HOST,{[`moderatorGrants/${HOST}`]:'Geheim-2026'}),'legacy code grants no longer writable');
ok(RULES.moderatorGrants===undefined,'moderatorGrants rules removed');
ok(!canWrite(base,HOST,{'config/moderatorKeys/neu':true}),'nobody can write config from client');
// --- Raum anlegen
const meta=uid=>({ownerUid:uid,createdAt:1,updatedAt:1,status:'lobby',quizTitle:'T',appVersion:'v21',schemaVersion:1});
ok(!canWrite(base,P1,{'rooms/ABC123/meta':meta(P1)}),'room creation without moderator role denied');
const legacyGrant=setIn(base,split(`moderatorGrants/${P1}`),'Geheim-2026');
ok(!canWrite(legacyGrant,P1,{'rooms/ABC123/meta':meta(P1)}),'old code grant no longer allows rooms');
const granted=setIn(base,split(`moderators/${HOST}`),{grantedAt:1,grantedBy:'admin'});
ok(canWrite(granted,HOST,{'rooms/ABC123/meta':meta(HOST)}),'room creation with moderator role allowed');
const revoked=setIn(granted,split(`moderators/${HOST}`),null);
ok(!canWrite(revoked,HOST,{'rooms/ABC123/meta':meta(HOST)}),'revoking moderator blocks new rooms');
ok(!canWrite(granted,HOST,{'rooms/ABC123/meta':meta(P1)}),'cannot create room owned by someone else');
const withRoom=setIn(granted,split('rooms/ABC123/meta'),meta(HOST));
ok(canWrite(setIn(withRoom,split(`moderators/${HOST}`),null),HOST,{'rooms/ABC123/meta/status':'playing'}),'existing owner can still update own room after revocation');
ok(!canWrite(withRoom,P1,{'rooms/ABC123/meta/status':'playing'}),'player cannot update room meta');
ok(!canWrite(withRoom,P1,{'rooms/ABC123/meta':meta(P1)}),'player cannot take over existing room');
// --- Buzzer (Regressionen aus v12)
const game=setIn(withRoom,split('rooms/ABC123/public'),{questionOpen:true,currentQuestionId:'q1',currentQuestion:{type:'buzzer'}});
ok(canWrite(game,HOST,{'rooms/ABC123/buzzerBlocked/q1':null,'rooms/ABC123/buzzerClaims/q1':null}),'moderator may reset buzzer on question level');
ok(!canWrite(game,P1,{'rooms/ABC123/buzzerBlocked/q1':null}),'player may not reset buzzer blocks');
const claimed=setIn(game,split('rooms/ABC123/buzzerClaims/q1'),{contenderId:P1,claimedAt:1});
ok(canWrite(claimed,P1,{[`rooms/ABC123/answers/${P1}/q1`]:{answer:'',submittedAt:1}}),'spoken buzz answer ("") accepted');
ok(!canWrite(claimed,P1,{[`rooms/ABC123/answers/${P1}/q1`]:{answer:null,submittedAt:1}}),'null answer rejected (v12.1 bug reproduced)');
ok(!canWrite(claimed,P2,{[`rooms/ABC123/answers/${P2}/q1`]:{answer:'',submittedAt:1}}),'non-contender cannot answer buzzer');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
