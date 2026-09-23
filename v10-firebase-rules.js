const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const rules=JSON.parse(fs.readFileSync(path.join(root,'firebase-database.rules.json'),'utf8')).rules.rooms['$code'];
ok(Boolean(rules.buzzerClaims),'buzzerClaims rules exist');
ok(Boolean(rules.buzzerBlocked),'buzzerBlocked rules exist');
ok(String(rules.buzzerClaims['$qid']['.write']).includes('contenderId'),'buzzer claim validates contender identity');
ok(String(rules.buzzerClaims['$qid']['.write']).includes('questionOpen'),'buzzer claim requires open question');
ok(String(rules.buzzerClaims['$qid']['.write']).includes('buzzerBlocked'),'blocked player cannot reclaim buzzer');
ok(String(rules.answers['$uid']['$qid']['.write']).includes('buzzerClaims'),'buzzer answer write requires winning claim');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
