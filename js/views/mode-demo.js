(function () {
  'use strict';

  /*
   * Spielmodi zeigen und ausprobieren (v35) – für den Editor („Mehr erfahren“) und spielmodi.html
   * ------------------------------------------------------------------
   *  - examples()                      Beispielfragen aus den Demo-Quizzen (Showtime + Show-Abend)
   *  - renderPreview(id, phone, beamer) Mini-Vorschau: Handy + Beamer mit Beispieldaten
   *  - mountDemo(id, host)             kleine spielbare Demo, lokal ohne Raum (mit Mitspieler-Bots, wo nötig)
   * Alles läuft nur im Browser – nichts wird gespeichert, kein Firebase.
   */
  const App = window.SchmobinApp;
  const esc = value => App.escapeHTML(value);
  const Q = () => window.SchmobinQuiz;
  const R = () => window.SchmobinRenderers;
  const clone = value => JSON.parse(JSON.stringify(value));
  const ME = { id: 'demo', name: 'Sam', avatar: '😀', score: 300, active: true };
  const BOTS = [
    { id: 'bot1', name: 'Mia', avatar: '🦊', score: 400, active: true },
    { id: 'bot2', name: 'Ben', avatar: '🐼', score: 150, active: true },
    { id: 'bot3', name: 'Ömer', avatar: '🐸', score: 90, active: true }
  ];
  const PLAYERS = [ME, ...BOTS];

  let cache = null;
  /** Beispiel pro Spielmodus: erste passende Frage aus den Demo-Quizzen */
  function examples() {
    if (!cache) {
      cache = (async () => {
        const load = async file => Q().normalizeQuiz(await (await fetch(`./data/${file}`, { cache: 'no-cache' })).json());
        const [showtime, abend] = await Promise.all([load('quiz-showtime.json'), load('quiz-show-abend.json')]);
        const map = {};
        showtime.quiz.rounds.forEach(round => round.questions.forEach(q => { if (!map[q.type]) map[q.type] = q; }));
        map.board = { round: abend.quiz.rounds.find(r => Q().isBoardRound(r)) };
        const last = abend.quiz.rounds[abend.quiz.rounds.length - 1];
        map.final = last.questions[last.questions.length - 1];
        return map;
      })().catch(error => { cache = null; throw error; });
    }
    return cache;
  }
  /** Demo-Anpassungen: getippt statt mündlich, kürzere Uhren */
  function demoQuestion(q) {
    const copy = clone(q);
    copy.id = `demo-${copy.type}`;
    if (copy.type === 'time-duel') Object.assign(copy, { answerMode: 'typed', clockSeconds: 25, passPenalty: 3, items: copy.items.slice(0, 8) });
    if (copy.type === 'ranking') Object.assign(copy, { turnSeconds: 0, lives: 2, items: copy.items.slice(0, 7) });
    if (copy.type === 'buzzer') copy.buzzerMode = 'text';
    return copy;
  }

  // ---------------------------------------------------------------- Mini-Vorschau (Handy + Beamer)
  function frames(host) {
    host.innerHTML = `<div class="mode-screens"><figure class="mode-screen mode-screen--phone"><div class="mode-screen-inner"></div><figcaption>📱 Handy</figcaption></figure><figure class="mode-screen mode-screen--beamer"><div class="mode-screen-inner"><div class="beamer mode-mini-beamer"><div class="beamer-grid"><section class="panel presenter-main"><div class="presenter"></div></section></div></div></div><figcaption>📽️ Beamer</figcaption></figure></div>`;
    return { phone: host.querySelector('.mode-screen--phone .mode-screen-inner'), beamer: host.querySelector('.mode-mini-beamer .presenter'), root: host };
  }
  /** Inhalt in feste „Bildschirm“-Breite rendern und auf die Rahmengröße verkleinern */
  function fit(root) {
    root.querySelectorAll('.mode-screen').forEach(frame => {
      const inner = frame.querySelector('.mode-screen-inner');
      const base = frame.classList.contains('mode-screen--beamer') ? 960 : 390;
      const scale = Math.min(1, frame.clientWidth / base);
      inner.style.width = `${base}px`;
      inner.style.transform = `scale(${scale})`;
      frame.style.height = `${Math.ceil(Math.min(inner.scrollHeight, frame.classList.contains('mode-screen--beamer') ? 560 : 760) * scale) + 26}px`;
    });
  }
  async function renderPreview(id, host) {
    const f = frames(host);
    try {
      const ex = await examples();
      if (id === 'board') {
        const round = ex.board.round;
        const S = window.SylasphereShow, UI = window.SylasphereShowUI;
        let show = S.startBoard(round, 0, PLAYERS.map(p => p.id), { rand: () => 0.3 });
        const used = round.questions.slice(0, 4);
        used.forEach((q, i) => { show.used[q.id] = { by: PLAYERS[i % 4].id, correct: i % 2 === 0, points: i % 2 === 0 ? q.points : 0, shared: false, double: false, alsoRight: [] }; });
        show.active = ME.id;
        f.phone.innerHTML = `<div class="show-player"><div class="notice notice--success">Du bist dran! Tippe ein Feld und bestätige.</div>${UI.boardHTML(round, show, { players: PLAYERS, clickable: true, compact: true })}</div>`;
        f.beamer.innerHTML = `<div class="show-beamer">${UI.turnHTML(show, PLAYERS)}${UI.boardHTML(round, show, { players: PLAYERS })}</div>`;
      } else if (id === 'final') {
        const q = ex.final;
        f.phone.innerHTML = `<div class="show-player"><div class="panel panel-pad show-stake"><span class="eyebrow">💰 Einsatz-Finale · Thema: ${esc(q.category)}</span><h2>Wie viel setzt du?</h2><div class="estimate-value">150 P</div><input type="range" min="0" max="300" step="10" value="150"><div class="range-labels"><span>0</span><span>300 P (alles)</span></div><button type="button" class="btn btn--primary">Einsatz geheim abgeben</button></div></div>`;
        f.beamer.innerHTML = `<div class="show-final-intro"><span class="eyebrow">💰 Einsatz-Finale</span><h1>${esc(q.category)}</h1><p>Setzt eure Einsätze – geheim auf dem Handy!</p><div class="show-wager-avatars">${PLAYERS.map((p, i) => `<span class="${i < 2 ? 'is-done' : ''}"><b>${esc(p.avatar)}</b>${esc(p.name)}${i < 2 ? ' ✓' : ''}</span>`).join('')}</div></div>`;
      } else {
        const q = demoQuestion(ex[id] || {});
        if (!ex[id]) throw new Error('Kein Beispiel vorhanden.');
        const Game = Q().gameOf(q);
        const game = Game ? Game.start(q, [ME.id, BOTS[0].id], Date.now(), () => 0.2) : null;
        const ctx = { readOnly: false, onAnswer() {}, onGuess() {}, onPass() {}, onInput() {}, playerId: ME.id, role: 'player', game, players: PLAYERS.slice(0, 2), stage: 0 };
        R().renderPlayer(q, f.phone, ctx);
        R().renderPresent(q, f.beamer, { players: PLAYERS, answers: {}, game, role: 'spectator', stage: 0 });
      }
    } catch (error) {
      f.phone.innerHTML = f.beamer.innerHTML = `<div class="empty-state">Vorschau nicht verfügbar (${esc(error.message)})</div>`;
    }
    f.root.querySelectorAll('input, button, textarea, select').forEach(el => { el.tabIndex = -1; });
    requestAnimationFrame(() => fit(f.root));
    setTimeout(() => fit(f.root), 400); // Bilder geladen
  }

  // ---------------------------------------------------------------- Spielbare Demo
  function mountDemo(id, host) {
    host.innerHTML = '<div class="mode-demo"><div class="mode-demo-phone"></div><div class="mode-demo-bar"></div></div>';
    const phone = host.querySelector('.mode-demo-phone');
    const bar = host.querySelector('.mode-demo-bar');
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; window.SylasphereMedia?.stop?.(); };
    host._stopDemo = stop;
    const restart = () => { stop(); mountDemo(id, host); };
    const setBar = html => { bar.innerHTML = html; bar.querySelector('[data-again]')?.addEventListener('click', restart); };
    const resultHTML = (points, detail, solution) => `<div class="notice ${points > 0 ? 'notice--success' : 'notice--warning'} mode-demo-result"><strong>${points > 0 ? `+${points} Punkte` : points < 0 ? `${points} Punkte` : '0 Punkte'}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}${solution ? `<span>Lösung: ${esc(solution)}</span>` : ''}</div><button type="button" class="btn btn--small" data-again>↺ Nochmal</button>`;
    examples().then(ex => {
      if (id === 'board') return boardDemo(ex.board.round, phone, setBar);
      if (id === 'final') return finalDemo(ex.final, phone, setBar, resultHTML);
      const q = demoQuestion(ex[id]);
      if (Q().gameOf(q)) return gameDemo(q, phone, setBar, resultHTML, fn => { timer = fn; });
      if (q.type === 'buzzer') return buzzerDemo(q, phone, setBar, resultHTML);
      return answerDemo(q, phone, setBar, resultHTML);
    }).catch(error => { phone.innerHTML = `<div class="empty-state">Demo nicht verfügbar (${esc(error.message)})</div>`; });
  }

  // Normale Fragen: antworten → auflösen → Punkte
  function answerDemo(q, phone, setBar, resultHTML) {
    let answer = null; let stage = 0;
    const stages = Q().stagesOf(q);
    const draw = () => R().renderPlayer(q, phone, { readOnly: false, currentAnswer: answer, stage, playerId: ME.id, onAnswer: value => { answer = value; controls(); } });
    const play = () => {
      const clip = Q().typeDef(q.type)?.mediaClip?.(q, { kind: 'stage', stage });
      if (clip?.url) window.SylasphereMedia?.play(clip.url, clip);
      else phone.querySelector('audio')?.play?.();
    };
    const controls = () => {
      const audio = q.audio && (stages || q.type === 'audio-quiz');
      setBar(`${audio ? `<button type="button" class="btn btn--small" data-play>▶ ${stages ? `Stufe ${stage + 1} anspielen` : 'Anhören'}</button>` : ''}${stages && stage < stages.length - 1 ? '<button type="button" class="btn btn--small" data-stage>⏭ Nächste Stufe</button>' : ''}<button type="button" class="btn btn--primary btn--small" data-resolve ${answer == null ? 'disabled' : ''}>✓ Auflösen</button>`);
      bar.querySelector('[data-play]')?.addEventListener('click', play);
      bar.querySelector('[data-stage]')?.addEventListener('click', () => { stage += 1; draw(); controls(); play(); });
      bar.querySelector('[data-resolve]')?.addEventListener('click', resolve);
    };
    const bar = phone.parentElement.querySelector('.mode-demo-bar');
    const resolve = () => {
      window.SylasphereMedia?.stop?.();
      const mine = stages && answer && typeof answer === 'object' ? Object.assign({}, answer, { stage }) : answer;
      const answers = { [ME.id]: { answer: mine } };
      if (q.type === 'consensus') BOTS.forEach((b, i) => { answers[b.id] = { answer: q.options[i === 2 ? 1 : 0]?.id }; }); // Mitspieler-Bots stimmen mit ab
      if (q.type === 'estimate') BOTS.forEach((b, i) => { answers[b.id] = { answer: Math.round(q.min + (q.max - q.min) * [0.3, 0.55, 0.8][i]) }; });
      const result = Q().needsReview(q) ? null : Q().resolveResult(q, answers, {});
      const scored = Q().scoreAnswer(q, mine, 1, result, ME.id);
      const entries = q.type === 'consensus' ? `Die Bots: ${BOTS.map(b => `${b.avatar} ${Q().answerLabel(q, answers[b.id].answer)}`).join(' · ')}` : '';
      R().renderPlayer(q, phone, { readOnly: true, reveal: true, currentAnswer: mine, result, stage, playerId: ME.id, players: PLAYERS, answers });
      setBar(resultHTML(Math.round(scored.points), [scored.detail, entries].filter(Boolean).join(' · '), Q().correctAnswerText(q, result)));
      if (Q().typeDef(q.type)?.revealMedia) { const clip = Q().typeDef(q.type).mediaClip(q, { kind: 'reveal' }); if (clip?.url) window.SylasphereMedia?.play(clip.url, clip); }
    };
    draw(); controls();
  }

  // Buzzer: Schnellantwort tippen, der „Moderator“ (du) entscheidet
  function buzzerDemo(q, phone, setBar, resultHTML) {
    phone.innerHTML = `<div class="question-shell"><h2 class="question-title">${esc(q.text)}</h2><button type="button" class="btn btn--primary mode-buzz" data-buzz>⚡ BUZZ!</button><p class="microcopy">Die Bots sind langsam – drück schnell!</p></div>`;
    setBar('');
    phone.querySelector('[data-buzz]').addEventListener('click', () => {
      phone.innerHTML = `<div class="question-shell"><h2 class="question-title">${esc(q.text)}</h2><div class="notice notice--success">⚡ Du warst am schnellsten! Deine Antwort:</div><input class="input" data-answer placeholder="Antwort" autocomplete="off"></div>`;
      setBar('<span class="microcopy">Im Spiel entscheidet der Moderator:</span><button type="button" class="btn btn--small" data-judge="1">✓ Richtig</button><button type="button" class="btn btn--small" data-judge="0">✗ Falsch</button>');
      phone.querySelector('[data-answer]').focus();
      phone.parentElement.querySelectorAll('[data-judge]').forEach(b => b.addEventListener('click', () => {
        const right = b.dataset.judge === '1';
        setBar(resultHTML(right ? q.points : -(Number(q.penalty) || 0), right ? 'Richtig – die Punkte gehören dir.' : 'Falsch – jetzt dürfen die anderen nochmal buzzern.', q.solution));
      }));
    });
  }

  // Zeitduell / Einordnen: echtes Spiel-Modul mit einem Bot als Gegner
  function gameDemo(q, phone, setBar, resultHTML, setTimer) {
    const Game = Q().gameOf(q);
    const ids = [ME.id, BOTS[0].id];
    let game = Game.start(q, ids, Date.now(), () => 0.9); // du fängst an
    let botAt = 0;
    const draw = () => R().renderPlayer(q, phone, {
      readOnly: false, playerId: ME.id, role: 'player', game, players: PLAYERS.slice(0, 2),
      onGuess: text => { if (game.active === ME.id) apply(Game.guess(game, q, ME.id, text, Date.now())); },
      onPass: () => { if (game.active === ME.id) apply(Game.pass(game, q, Date.now())); },
      onInput: answer => { if (game.active === ME.id) apply(Game.input(game, q, ME.id, answer, Date.now())); }
    });
    const apply = next => { if (next && next !== game) { game = next; draw(); status(); } };
    const over = () => (Game.isOver ? Game.isOver(game) : game.phase === 'done');
    const status = () => {
      if (over()) {
        clearInterval(loop);
        const place = Game.placements(game).find(p => String(p.playerId) === ME.id);
        const points = Game.pointsFor ? Game.pointsFor(q, place, Number(q.points) || 0) : Math.round(q.points * (Game.parsePlaces(q.placePoints)[(place?.rank || 9) - 1] || 0) / 100);
        setBar(resultHTML(Math.round(Number(points) || 0), place ? `Platz ${place.rank} von 2` : '', ''));
        return;
      }
      setBar(`<span class="microcopy">${game.active === ME.id ? '👉 Du bist dran!' : `${BOTS[0].avatar} ${BOTS[0].name} ist dran …`}</span>`);
    };
    // Bot: im Zeitduell nach ~3 s richtig, beim Einordnen legt er eine Karte zufällig
    const loop = setInterval(() => {
      if (over()) return;
      const now = Date.now();
      const ticked = Game.tick(game, q, now);
      if (ticked !== game) { game = ticked; draw(); status(); return; }
      if (game.active !== BOTS[0].id || game.phase !== 'play') { botAt = 0; return; }
      if (!botAt) botAt = now + 2500;
      if (now < botAt) return;
      botAt = 0;
      if (Game.correct) apply(Game.correct(game, q, now));
      else if (Game.input) {
        const item = (game.pool || [])[0];
        const slot = Math.floor(Math.random() * ((game.line || []).length + 1));
        apply(Game.input(game, q, BOTS[0].id, { turn: game.turn, item, slot }, now));
      }
    }, 150);
    setTimer(loop);
    draw(); status();
  }

  // Themen-Brett: Feld wählen, antworten, Feldwert
  function boardDemo(round, phone, setBar) {
    const S = window.SylasphereShow, UI = window.SylasphereShowUI;
    let show = S.startBoard(round, 0, [ME.id], { rand: () => 0.4 });
    let points = 0;
    const pickView = () => {
      phone.innerHTML = `<div class="show-player"><div class="notice notice--success">Du bist dran! Tippe ein Feld an.</div>${UI.boardHTML(round, show, { players: [ME], clickable: true, compact: true })}</div>`;
      setBar(`<span class="microcopy">Deine Punkte: <b>${points}</b></span>`);
      phone.querySelectorAll('[data-qid]').forEach(b => b.addEventListener('click', () => play(b.dataset.qid)));
    };
    const play = qid => {
      show = S.pick(show, round, ME.id, qid, { force: true });
      if (show.phase === 'wager') show = S.setStake(show, round, ME.id, Math.max(points, 100), points, { force: true });
      const q = round.questions.find(x => x.id === qid);
      let answer = null;
      phone.innerHTML = `${UI.zoomHTML(round, show, [ME], { me: ME.id })}<div class="mode-demo-q"></div>`;
      const box = phone.querySelector('.mode-demo-q');
      const bar = () => {
        setBar(`<button type="button" class="btn btn--primary btn--small" data-resolve ${answer == null ? 'disabled' : ''}>✓ Auflösen</button>`);
        phone.parentElement.querySelector('[data-resolve]')?.addEventListener('click', () => {
          const right = Q().judge(q, answer, { playerId: ME.id });
          const gain = right ? (show.current.double ? show.current.stake : show.current.value) : 0;
          points += gain;
          R().renderPlayer(q, box, { readOnly: true, reveal: true, currentAnswer: answer, playerId: ME.id });
          show = S.finishCell(show, round, { correct: right, points: gain }, [ME.id]);
          setBar(`<div class="notice ${right ? 'notice--success' : 'notice--warning'} mode-demo-result"><strong>${right ? `✓ +${gain} Punkte` : '✗ Leider falsch – 0 Punkte'}</strong><span>Lösung: ${esc(Q().correctAnswerText(q))}</span></div><button type="button" class="btn btn--small" data-back>▦ Zurück zum Brett</button>`);
          phone.parentElement.querySelector('[data-back]').addEventListener('click', () => (S.freeCells(show, round).length ? pickView() : setBar(`<div class="notice notice--success mode-demo-result"><strong>Brett fertig: ${points} Punkte</strong></div><button type="button" class="btn btn--small" data-again>↺ Nochmal</button>`)));
        });
      };
      R().renderPlayer(q, box, { readOnly: false, playerId: ME.id, onAnswer: v => { answer = v; bar(); } });
      bar();
    };
    pickView();
  }

  // Einsatz-Finale: setzen → Frage → ± Einsatz
  function finalDemo(q, phone, setBar, resultHTML) {
    const score = ME.score;
    phone.innerHTML = `<div class="show-player"><div class="panel panel-pad show-stake"><span class="eyebrow">💰 Einsatz-Finale · Thema: ${esc(q.category)}</span><h2>Wie viel setzt du?</h2><p class="microcopy">Du hast ${score} Punkte.</p><div class="estimate-value" data-out>100 P</div><input type="range" min="0" max="${score}" step="10" value="100" data-stake><div class="range-labels"><span>0</span><span>${score} P (alles)</span></div></div></div>`;
    const range = phone.querySelector('[data-stake]');
    range.addEventListener('input', () => { phone.querySelector('[data-out]').textContent = `${range.value} P`; });
    setBar('<button type="button" class="btn btn--primary btn--small" data-go>Einsatz geheim abgeben</button>');
    phone.parentElement.querySelector('[data-go]').addEventListener('click', () => {
      const stake = Number(range.value) || 0;
      let answer = null;
      const controls = () => {
        setBar(`<span class="microcopy">Einsatz: ${stake} P</span><button type="button" class="btn btn--primary btn--small" data-resolve ${answer == null ? 'disabled' : ''}>✓ Auflösen</button>`);
        phone.parentElement.querySelector('[data-resolve]')?.addEventListener('click', () => {
          const right = Q().judge(q, answer, { playerId: ME.id });
          R().renderPlayer(q, phone, { readOnly: true, reveal: true, currentAnswer: answer, playerId: ME.id });
          setBar(resultHTML(right ? stake : -stake, `${score} → ${score + (right ? stake : -stake)} Punkte`, Q().correctAnswerText(q)));
        });
      };
      R().renderPlayer(q, phone, { readOnly: false, playerId: ME.id, onAnswer: v => { answer = v; controls(); } });
      controls();
    });
  }

  window.SylasphereModeDemo = { examples, renderPreview, mountDemo, fit };
})();
