// v20: Medien-Hinweise (Formate, Namen, Links), Einbindung der Dateiauswahl, Demo-Audio als MP3
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.error('FAIL',m)}};
const code=f=>fs.readFileSync(path.join(root,f),'utf8');
const sandbox={window:{},console};sandbox.window.window=sandbox.window;vm.createContext(sandbox);
vm.runInContext(code('js/question-types/kit.js'),sandbox);const K=sandbox.window.SylasphereTypeKit;
const lv=(p,k,o)=>K.mediaAdvice(p,k,o).map(i=>i.level);
ok(lv('./assets/bilder/eiffel.webp','image').length===0,'webp image is fine');
ok(lv('./assets/musik/song-01.mp3','audio').length===0,'mp3 audio is fine');
ok(lv('./assets/a.m4a','audio').length===0,'m4a ok');
ok(lv('./assets/foto.heic','image').includes('error'),'heic is an error');
ok(lv('./assets/foto.HEIC','image').includes('error'),'extension case-insensitive');
ok(lv('./assets/song.wav','audio').includes('warn'),'wav warns');
ok(lv('./assets/song.ogg','audio').includes('error'),'ogg flagged (iPhone)');
ok(lv('./assets/song.mp3','image').includes('error'),'audio file in image field');
ok(lv('./assets/bild.jpg','audio').includes('error'),'image file in audio field');
ok(lv('./assets/mein bild.jpg','image').includes('warn'),'spaces warn');
ok(lv('./assets/bär.jpg','image').includes('warn'),'umlauts warn');
ok(lv('https://drive.google.com/file/d/x','image').includes('warn'),'google drive warns');
ok(lv('https://youtu.be/abc','audio').includes('error'),'youtube is error');
ok(lv('https://cdn.example.com/a.mp3','audio',{needsCors:true}).includes('warn'),'external audio for song reveal warns');
ok(lv('https://cdn.example.com/a.mp3','audio').length===0,'external audio for audio quiz ok');
ok(lv('C:\\Users\\me\\bild.jpg','image').includes('error'),'local computer path is error');
ok(lv('http://example.com/a.jpg','image').includes('warn'),'http warns');
ok(lv('','image').length===0,'empty gives nothing');
ok(K.mediaKindOf('x/y.WEBP')==='image'&&K.mediaKindOf('a.mp3')==='audio'&&K.mediaKindOf('a.mp4')==='video'&&K.mediaKindOf('a.txt')==='','kind detection');
// Validierung meldet Formatfehler
const errors=[],warns=[];const report={error:(k,m)=>errors.push(k),warn:(k,m)=>warns.push(k)};
K.validateMedia({image:'./assets/x.heic'},'image','image',report);K.validateMedia({audio:'./assets/x.wav'},'audio','audio',report);
ok(errors.includes('image')&&warns.includes('audio'),'validateMedia reports errors and warnings');
// Einbindung
ok(code('editor.html').includes('js/editor/media-library.js'),'editor loads media library');
ok(!code('moderator.html').includes('media-library.js'),'moderator does not need media library');
['image-quiz','audio-quiz','hotspot','song-reveal'].forEach(t=>{const s=code(`js/question-types/types/${t}.js`);ok(/mediaField|SylasphereMediaLibrary\?\.enhance/.test(s)&&s.includes('validateMedia'),`${t} uses media picker + checks`)});
const lib=code('js/editor/media-library.js');
ok(lib.includes('api.github.com/repos/')&&lib.includes('/upload/'),'media library lists GitHub files and links to upload');
ok(lib.includes("result.ok === false || !result.size ? await list()"),'GitHub list only fetched when needed (rate limit)');
// Demo-Audio als MP3
ok(fs.existsSync(path.join(root,'assets/demo-song.mp3'))&&fs.existsSync(path.join(root,'assets/demo-tone.mp3')),'demo audio converted to mp3');
const all=['data','js'].flatMap(d=>{const out=[];const walk=p=>fs.readdirSync(p,{withFileTypes:true}).forEach(e=>e.isDirectory()?walk(path.join(p,e.name)):out.push(path.join(p,e.name)));walk(path.join(root,d));return out});
ok(!all.some(f=>/demo-(song|tone)\.wav/.test(fs.readFileSync(f,'utf8'))),'no references to old wav demos');
// Beispiel-Quizze enthalten keine Medienfehler
['quiz-showtime.json','quiz-party-mix.json'].forEach(f=>{const d=JSON.parse(code('data/'+f));d.quiz.rounds.flatMap(r=>r.questions).forEach(q=>{[['image','image'],['audio','audio'],['cover','image']].forEach(([k,kind])=>{if(q[k])ok(!K.mediaAdvice(q[k],kind,{needsCors:q.type==='song-reveal'}).some(i=>i.level!=='info'),`${f} ${q.id} ${k} clean`)})})});
// README enthält die Formatübersicht
const readme=code('README.md');
ok(readme.includes('Welche Dateiformate')&&readme.includes('HEIC')&&readme.includes('MP3')&&readme.includes('25 MB'),'README documents media formats');
console.log(`PASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
