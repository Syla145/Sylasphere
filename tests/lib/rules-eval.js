// Mini-Auswerter für firebase-database.rules.json (aus v13-rules-eval.js), für neuere Tests wiederverwendbar.
// canWrite(db, uid, { pfad: wert }, { now, provider }) und canRead(db, uid, pfad)
const fs=require('fs'),path=require('path');
const RULES=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','firebase-database.rules.json'),'utf8')).rules;
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
function canWrite(db,uid,writes,opts={}){ // writes: {path:value} (multi-path update)
 let after=clone(db);for(const[p,v]of Object.entries(writes))after=setIn(after,split(p),v);
 const auth=uid?{uid,provider:opts.provider||'google.com'}:null;const now=opts.now??Date.now();
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
function canRead(db,uid,p,opts={}){const parts=split(p);const auth=uid?{uid,provider:opts.provider||'google.com'}:null;const now=opts.now??Date.now();
 for(const {node,depth,vars} of walk(parts)){if(!node)break;const r=node['.read'];if(r===undefined)continue;const res=typeof r==='boolean'?r:evalRule(r,Object.assign({auth,now,root:new Snap(db,[]),data:new Snap(db,parts.slice(0,depth))},vars));if(res)return true}
 return false}
module.exports={RULES,canWrite,canRead,setIn,split,clone};
