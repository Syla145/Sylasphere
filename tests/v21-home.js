// v21: Startseite (Anmelden/Gast, Bereiche je Rolle), Editor nur für Moderatoren, Moderator-Code entfernt
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
const idx=code('index.html'),home=code('js/views/home-view.js'),ed=code('editor.html'),mod=code('moderator.html'),gate=code('js/core/moderator-gate.js'),sp=code('spieler.html');
ok(idx.includes('home-view.js')&&idx.includes('account.js')&&idx.includes('id="home-content"'),'start page loads accounts + home view');
ok(!/href="\.\/moderator\.html"/.test(idx)&&!/href="\.\/editor\.html"/.test(idx),'start page has no hardcoded moderator/editor links');
ok(home.includes("['moderator', 'play', 'watch', 'editor']")&&home.includes("['play', 'watch']")&&home.includes("keys.push('admin')"),'role → cards mapping');
ok(home.includes("GUEST_KEY")&&home.includes("data-choice=\"guest\"")&&home.includes("data-choice=\"login\""),'choice login/guest, guest remembered');
ok(ed.includes('class="moderator-locked"')&&ed.includes('id="moderator-gate"')&&ed.includes('moderator-gate.js')&&ed.includes('data-gate-page="editor"'),'editor gated for moderators');
ok(code('css/main.css').includes('html.moderator-locked #editor-start'),'editor content hidden until unlocked');
ok(!mod.includes('moderator-code')&&!mod.includes('guest-code')&&!mod.includes('btn-lock-moderator'),'moderator page without guest code');
ok(!gate.includes('MODERATOR_CODE_HASH')&&!gate.includes('moderatorGrants')&&gate.includes('canModerate()'),'gate is account-only');
ok(!fs.existsSync(path.join(root,'tools/moderator-code.html')),'code tool removed');
const rules=code('firebase-database.rules.json');ok(!rules.includes('moderatorGrants')&&!rules.includes('moderatorKeys'),'rules without code grants');
ok(sp.includes('account.js')&&code('js/views/player-view.js').includes("els['player-name'].value = String(user.name"),'player name prefilled from account');
ok(!sp.includes('moderator-gate'),'player page never gated (invite links work for guests)');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
