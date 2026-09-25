(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * Einordnen (v25, Regeln überarbeitet in v25.2) – Ranking-Spiel reihum
   * ------------------------------------------------------------------
   * Oben liegt eine Leiste von niedrig nach hoch (z. B. „Einwohner“) mit der Anker-Karte.
   * Darunter liegt ein Pool mit Karten, deren Werte geheim sind.
   *
   * Reihum (Startspieler zufällig) wählt der Spieler, der dran ist, eine Karte aus dem Pool
   * und legt sie auf seinem Handy an eine Stelle der Leiste (ziehen oder antippen), dann „✓ Hier einordnen“.
   *  ✓ richtig → Karte bleibt liegen, der Nächste ist dran
   *  ✗ falsch  → Karte geht zurück in den Pool, −1 Leben, der Nächste ist dran
   *  ⏰ Zeit um → (nur mit Zeitlimit pro Zug) −1 Leben
   * Wer keine Leben mehr hat, scheidet aus.
   *
   * Ende (v25.2, „Stechen“ wie beim Elfmeterschießen):
   *  - Verliert der Vorletzte sein letztes Leben, muss der Letzte EINE Karte richtig legen → Sieg.
   *  - Vergibt er auch, beginnt das Stechen: beide abwechselnd, der zuletzt Ausgeschiedene zuerst.
   *    Wer in einer Runde vergibt, während der andere trifft, verliert. Leben zählen dann nicht mehr.
   *  - Gehen die Karten aus, entscheidet die Rangfolge (richtige Karten, dann Leben).
   * Danach darf der Sieger mündlich weiterraten, „👁 Aufdecken“ zeigt allen die komplette Reihenfolge.
   *
   * Werte (v25.2, im Editor): sofort beim richtigen Einordnen zeigen – oder erst beim Aufdecken/Auflösen.
   * Der Anker-Wert ist standardmäßig sichtbar (abschaltbar). Versteckte Werte stehen gar nicht erst
   * im Spielstand – geprüft wird auf dem Moderator-Gerät mit der vollständigen Frage.
   *
   * Punkte (v25.2): Punkte pro richtiger Karte + Platzierung in % der Fragenpunkte (Standard 100/60/30).
   */
  const REVEAL_MS = { correct: 2600, wrong: 2600, timeout: 2400, skip: 1500 };
  const DEFAULT_PLACES = [100, 60, 30];
  const toNumber = (v, f) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const list = v => (Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
  function shuffle(items, rand = Math.random) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  function fmtValue(value, unit) {
    if (value == null || !Number.isFinite(Number(value))) return '?';
    return `${numberFormat.format(Number(value))}${unit ? ` ${unit}` : ''}`;
  }
  function parsePlaces(value) {
    const out = (Array.isArray(value) ? value : String(value ?? '').split(/[,;\s]+/).filter(Boolean)).map(Number).filter(n => Number.isFinite(n) && n >= 0).map(n => Math.min(100, n));
    return out.length ? out : DEFAULT_PLACES.slice();
  }
  const livesOf = q => Math.max(1, Math.min(9, Math.round(toNumber(q.lives, 3))));
  const turnMs = q => Math.round(Math.max(0, Math.min(300, toNumber(q.turnSeconds, 0))) * 1000);
  const anchorOf = q => { const n = Math.round(toNumber(q.anchor, 0)); return n >= 0 && n < (q.items || []).length ? n : 0; };
  const instant = q => q.revealValues === 'instant';           // Werte sofort zeigen?
  const anchorVisible = q => q.showAnchor !== false;             // Anker-Wert zeigen?
  const cardPointsOf = q => Math.max(0, toNumber(q.cardPoints, 10));

  // ---------------------------------------------------------------- Spiellogik (rein, ohne DOM – testbar)
  function normalizeGame(game) {
    if (!game || typeof game !== 'object') return null;
    const g = JSON.parse(JSON.stringify(game));
    const entry = e => ({ i: Number(e?.i), v: e?.v == null || !Number.isFinite(Number(e.v)) ? null : Number(e.v) });
    g.order = list(g.order).map(String);
    g.eliminated = list(g.eliminated).map(String);
    g.pool = list(g.pool).map(Number);
    g.line = list(g.line).map(entry);
    g.uncovered = g.uncovered ? list(g.uncovered).map(entry) : null;
    ['lives', 'correct'].forEach(key => { g[key] = g[key] && typeof g[key] === 'object' ? g[key] : {}; });
    g.turn = toNumber(g.turn, 1);
    g.turnStartedAt = g.turnStartedAt == null ? null : Number(g.turnStartedAt);
    g.turnLeftMs = g.turnLeftMs == null ? null : Number(g.turnLeftMs);
    g.reveal = g.reveal || null;
    g.lastChance = g.lastChance === true;
    g.lastChanceAgainst = String(g.lastChanceAgainst || '');
    if (g.shootout && typeof g.shootout === 'object') {
      g.shootout = { players: list(g.shootout.players).map(String), round: toNumber(g.shootout.round, 1), results: g.shootout.results && typeof g.shootout.results === 'object' ? g.shootout.results : {} };
    } else g.shootout = null;
    g.winner = String(g.winner || '');
    return g;
  }
  function alive(game) { return (game?.order || []).filter(id => !(game.eliminated || []).includes(id)); }
  function turnRemaining(game, q, now = Date.now()) {
    const total = turnMs(q);
    if (!total || !game) return null;
    if (game.phase === 'paused') return Math.max(0, toNumber(game.turnLeftMs, total));
    if (game.phase !== 'play' || game.turnStartedAt == null) return total;
    return Math.max(0, total - (now - game.turnStartedAt));
  }
  const valueAt = (q, i) => toNumber(q.items?.[i]?.value, NaN);

  function start(q, playerIds, now = Date.now(), rand = Math.random) {
    const order = shuffle(playerIds.map(String), rand);
    const anchor = anchorOf(q);
    const pool = shuffle((q.items || []).map((_, i) => i).filter(i => i !== anchor), rand);
    const lives = Object.fromEntries(order.map(id => [id, livesOf(q)]));
    const playable = order.length && pool.length;
    return {
      kind: 'ranking', questionId: String(q.id || ''), phase: playable ? 'play' : 'done', order, active: playable ? order[0] : '',
      lives, correct: Object.fromEntries(order.map(id => [id, 0])), eliminated: [],
      line: (q.items || []).length ? [{ i: anchor, v: anchorVisible(q) || instant(q) ? valueAt(q, anchor) : null }] : [], pool,
      turn: 1, turnStartedAt: now, turnLeftMs: null, reveal: null, lastChance: false, lastChanceAgainst: '', shootout: null, winner: '',
      endReason: playable ? '' : (order.length ? 'no-cards' : 'no-players'), uncovered: null, startedAt: now, seq: 1
    };
  }
  function beginReveal(game, now, data) {
    game.reveal = Object.assign({ until: now + REVEAL_MS[data.reason] }, data);
    game.phase = 'reveal';
    game.turnStartedAt = null; game.turnLeftMs = null;
    game.seq = (game.seq || 0) + 1;
    return game;
  }
  /** Zug des aktiven Spielers prüfen. answer: { turn, item, slot } – Werte kommen aus der vollständigen Frage */
  function input(inputGame, q, playerId, answer, now = Date.now()) {
    const game = normalizeGame(inputGame);
    if (!game || game.phase !== 'play' || game.active !== String(playerId) || !answer || typeof answer !== 'object') return inputGame;
    if (toNumber(answer.turn, -1) !== game.turn) return inputGame;
    const item = Math.round(toNumber(answer.item, -1));
    const slot = Math.round(toNumber(answer.slot, -1));
    if (!game.pool.includes(item) || slot < 0 || slot > game.line.length) return inputGame;
    const v = valueAt(q, item);
    const left = slot > 0 ? valueAt(q, game.line[slot - 1].i) : -Infinity;
    const right = slot < game.line.length ? valueAt(q, game.line[slot].i) : Infinity;
    const ok = Number.isFinite(v) && left <= v && v <= right;
    const by = game.active;
    if (ok) {
      game.line.splice(slot, 0, { i: item, v: instant(q) ? v : null });
      game.pool = game.pool.filter(i => i !== item);
      game.correct[by] = toNumber(game.correct[by], 0) + 1;
      const data = { reason: 'correct', by, item, slot };
      if (instant(q)) data.value = v;
      return beginReveal(game, now, data);
    }
    if (!game.shootout) game.lives[by] = Math.max(0, toNumber(game.lives[by], 0) - 1);
    return beginReveal(game, now, { reason: 'wrong', by, item, slot });
  }
  function nextPlayer(game, from) {
    const start = game.order.indexOf(from);
    for (let step = 1; step <= game.order.length; step++) {
      const candidate = game.order[(start + step) % game.order.length];
      if (!game.eliminated.includes(candidate)) return candidate;
    }
    return '';
  }
  function finish(game, reason, winner = '') {
    game.phase = 'done'; game.active = ''; game.turnStartedAt = null; game.turnLeftMs = null;
    game.endReason = reason; game.winner = winner; game.lastChance = false;
    game.seq = (game.seq || 0) + 1;
    return game;
  }
  function nextTurn(game, active, now) {
    game.active = active;
    game.phase = 'play'; game.turn += 1; game.turnStartedAt = now; game.turnLeftMs = null;
    game.seq = (game.seq || 0) + 1;
    return game;
  }
  /** Nach der Anzeige: Ausscheiden, letzte Chance, Stechen, Ende oder nächster Spieler */
  function advance(game, q, now) {
    const r = game.reveal || {};
    const by = r.by || game.active;
    const hit = r.reason === 'correct';
    const skipped = r.reason === 'skip';
    game.reveal = null;
    const topOnEmpty = () => finish(game, 'all-placed', placements(game)[0]?.playerId || '');

    // Stechen: pro Runde je ein Versuch; trifft genau einer, gewinnt er
    if (game.shootout) {
      const so = game.shootout;
      if (!skipped) so.results[by] = hit;
      const [a, b] = so.players;
      if (so.results[a] !== undefined && so.results[b] !== undefined) {
        if (so.results[a] !== so.results[b]) return finish(game, 'shootout', so.results[a] ? a : b);
        so.round += 1; so.results = {};
      }
      if (!game.pool.length) return topOnEmpty();
      return nextTurn(game, skipped ? by : (so.results[a] === undefined ? a : b), now);
    }

    if (toNumber(game.lives[by], 0) <= 0 && !game.eliminated.includes(by)) game.eliminated.push(by);

    // Letzte Chance des Übriggebliebenen
    if (game.lastChance) {
      if (skipped) return nextTurn(game, by, now);
      if (hit) return finish(game, 'last-chance-won', by);
      const other = game.lastChanceAgainst;
      game.lastChance = false;
      if (!game.pool.length || !other) return topOnEmpty();
      // Stechen: der zuletzt Ausgeschiedene kommt zurück und beginnt
      game.eliminated = game.eliminated.filter(id => id !== other);
      game.shootout = { players: [other, by], round: 1, results: {} };
      return nextTurn(game, other, now);
    }

    if (!game.pool.length) return topOnEmpty();
    const left = alive(game);
    if (!left.length) return finish(game, 'no-lives', game.order.length === 1 ? '' : '');
    if (game.order.length > 1 && left.length === 1) {
      if (left[0] === by) return finish(game, 'last-standing', by);
      game.lastChance = true;
      game.lastChanceAgainst = by;
      return nextTurn(game, left[0], now);
    }
    return nextTurn(game, nextPlayer(game, by), now);
  }
  function tick(inputGame, q, now = Date.now()) {
    const game = normalizeGame(inputGame);
    if (!game) return inputGame;
    if (game.phase === 'play' && turnMs(q) && turnRemaining(game, q, now) <= 0) {
      const by = game.active;
      if (!game.shootout) game.lives[by] = Math.max(0, toNumber(game.lives[by], 0) - 1);
      return beginReveal(game, now, { reason: 'timeout', by });
    }
    if (game.phase === 'reveal' && game.reveal && now >= Number(game.reveal.until)) return advance(game, q, now);
    return inputGame;
  }
  /** Moderator-Knöpfe: pause, resume, skip, stop, uncover */
  function act(inputGame, q, action, now = Date.now()) {
    const game = normalizeGame(inputGame);
    if (!game) return inputGame;
    if (action === 'pause' && game.phase === 'play') {
      game.turnLeftMs = turnRemaining(game, q, now); game.phase = 'paused'; game.seq++; return game;
    }
    if (action === 'resume' && game.phase === 'paused') {
      const total = turnMs(q);
      game.phase = 'play'; game.turnStartedAt = total ? now - (total - toNumber(game.turnLeftMs, total)) : now; game.turnLeftMs = null; game.seq++; return game;
    }
    if (action === 'skip' && (game.phase === 'play' || game.phase === 'paused')) return beginReveal(game, now, { reason: 'skip', by: game.active });
    if (action === 'stop' && !['done', 'uncovered'].includes(game.phase)) { game.reveal = null; return finish(game, 'stopped'); }
    if (action === 'uncover' && game.phase === 'done') {
      game.uncovered = (q.items || []).map((item, i) => ({ i, v: valueAt(q, i) })).sort((a, b) => a.v - b.v || a.i - b.i);
      game.phase = 'uncovered'; game.seq++; return game;
    }
    return inputGame;
  }
  const isOver = game => Boolean(game && (game.phase === 'done' || game.phase === 'uncovered'));
  /** Rangfolge: Sieger, dann alle noch im Spiel (mehr richtige Karten, mehr Leben), dann Ausgeschiedene (zuletzt raus = besser) */
  function placements(inputGame) {
    const game = normalizeGame(inputGame);
    if (!game) return [];
    const outIndex = id => { const k = game.eliminated.indexOf(id); return k < 0 ? Infinity : k; };
    return game.order.slice().sort((a, b) =>
      (b === game.winner) - (a === game.winner) ||
      outIndex(b) - outIndex(a) ||
      toNumber(game.correct[b], 0) - toNumber(game.correct[a], 0) ||
      toNumber(game.lives[b], 0) - toNumber(game.lives[a], 0)
    ).map((playerId, k) => ({ playerId, rank: k + 1, correct: toNumber(game.correct[playerId], 0), lives: toNumber(game.lives[playerId], 0), out: game.eliminated.includes(playerId), winner: playerId === game.winner }));
  }
  /** Punkte eines Platzes: Karten × Kartenpunkte + Platz-% der Fragenpunkte (base enthält den Runden-Multiplikator) */
  function pointsFor(q, place, base) {
    if (!place) return 0;
    const mult = Number(q.points) > 0 ? base / Number(q.points) : 1;
    return Math.round(place.correct * cardPointsOf(q) * mult + base * (parsePlaces(q.placePoints)[place.rank - 1] || 0) / 100);
  }

  const Game = { start, input, tick, act, advance, placements, pointsFor, alive, isOver, turnRemaining, parsePlaces, normalize: normalizeGame, REVEAL_MS, panel, playerStatus, host: true };

  // ---------------------------------------------------------------- Texte
  const REASON = { correct: '✓ Richtig!', wrong: '✗ Falsch!', timeout: '⏰ Zeit abgelaufen', skip: '⏭ Zug übersprungen' };
  const END = {
    'last-chance-won': w => `🏆 ${w} gewinnt!`, 'last-standing': w => `🏆 ${w} gewinnt!`, shootout: w => `🏆 ${w} gewinnt das Stechen!`,
    'last-chance-lost': () => 'Spiel vorbei – kein Sieger.',
    'all-placed': w => (w ? `🎉 Alle Karten liegen – ${w} gewinnt!` : '🎉 Alle Karten liegen!'), 'no-lives': () => 'Spiel vorbei – keine Leben mehr.', stopped: () => 'Spiel beendet.',
    'no-cards': () => 'Keine Karten im Pool.', 'no-players': () => 'Keine Spieler im Raum.'
  };
  const hearts = (n, max) => '❤'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, max - n));
  function endText(game, name) { return (END[game.endReason] || END.stopped)(game.winner ? name(game.winner) : ''); }
  /** Hinweis zur Spielphase (letzte Chance / Stechen) */
  function phaseNote(game, name) {
    if (game?.lastChance) return `Letzte Chance für ${name(game.active)}: richtig = Sieg!`;
    if (game?.shootout) return `⚔️ Stechen, Runde ${game.shootout.round}: ${game.shootout.players.map(name).join(' gegen ')} – wer vergibt, während der andere trifft, verliert.`;
    return '';
  }

  /** Status und Hinweis für das Spieler-Handy (Kopfzeile + Kasten unter der Frage) */
  function playerStatus(inputGame, playerId) {
    const g = normalizeGame(inputGame);
    const esc = window.SchmobinApp.escapeHTML;
    if (!g) return { status: 'Gleich geht’s los', html: '' };
    const inGame = g.order.includes(String(playerId));
    const out = g.eliminated.includes(String(playerId));
    const status = isOver(g) ? 'Spiel vorbei' : g.phase === 'reveal' ? 'Auswertung' : g.phase === 'paused' ? 'Pause' : g.active === playerId ? 'Du bist dran!' : g.shootout ? 'Stechen' : 'Einordnen';
    let html = '';
    if (!inGame) html = '<div class="notice">Du bist nach dem Start beigetreten und schaust bei dieser Runde zu.</div>';
    else if (out && !isOver(g)) html = '<div class="notice">Keine Leben mehr – du bist raus und schaust den anderen zu.</div>';
    else if (isOver(g)) html = `<div class="notice notice--warning reveal-wait"><strong>🏁 ${esc(g.winner === String(playerId) ? 'Du hast gewonnen! Du darfst jetzt mündlich weiterraten.' : 'Spiel vorbei.')}</strong><span>Der Moderator deckt gleich auf und vergibt die Punkte.</span></div>`;
    return { status, html };
  }

  /** Steuerung auf dem Moderator-Gerät (Knöpfe mit data-duel) */
  function panel(q, inputGame, h) {
    const game = normalizeGame(inputGame);
    const esc = h.esc;
    const unit = q.unit || '';
    if (!game) {
      return `<div class="duel-control"><div class="duel-control-info"><strong>${h.count} Spieler · ${(q.items || []).length - 1} Karten im Pool · ${livesOf(q)} Leben</strong><span>Reihum wählt jeder eine Karte und ordnet sie auf seinem Handy ein. ${turnMs(q) ? `${q.turnSeconds} s pro Zug.` : 'Ohne Zeitlimit pro Zug.'} Werte ${instant(q) ? 'werden sofort gezeigt' : 'bleiben bis zum Aufdecken verborgen'}.</span></div><button type="button" class="btn btn--primary duel-big" data-duel="start" ${h.count ? '' : 'disabled'}>🎲 Spiel starten</button></div>`;
    }
    const inShootout = id => game.shootout?.players.includes(id);
    const chips = placements(game).map(p => `<div><span>${p.rank}. ${esc(h.name(p.playerId))}${p.winner ? ' 🏆' : ''}</span><span>${inShootout(p.playerId) && !isOver(game) ? '⚔️ Stechen' : p.out ? 'raus' : hearts(p.lives, livesOf(q))} · ✓ ${p.correct}</span><strong>${pointsFor(q, p, Number(q.points) || 0)} P</strong></div>`).join('');
    if (isOver(game)) {
      const uncover = game.phase === 'done'
        ? `<p class="microcopy">${game.winner ? `${esc(h.name(game.winner))} darf die restlichen Karten jetzt mündlich einordnen. ` : ''}Mit „👁 Aufdecken“ sehen alle die komplette Reihenfolge${instant(q) ? '' : ' mit allen Werten'}.</p><div class="duel-buttons"><button type="button" class="btn duel-big" data-duel="uncover">👁 Aufdecken</button></div>`
        : '<p class="microcopy">Die komplette Reihenfolge ist für alle sichtbar.</p>';
      return `<div class="duel-control"><div class="notice notice--success"><strong>${esc(endText(game, h.name))}</strong> Tippe auf „✨ Frage auflösen“, dann gibt es die Punkte (Vorschau unten, ohne Runden-Multiplikator).</div>${uncover}<div class="answer-review">${chips}</div></div>`;
    }
    const remaining = game.pool.map(i => ({ i, v: valueAt(q, i) })).sort((a, b) => a.v - b.v);
    const secret = remaining.map(e => `<span class="chip">${esc(q.items[e.i]?.name || '?')} · ${esc(fmtValue(e.v, unit))}</span>`).join('');
    const placed = game.line.map(e => `<span class="chip">${esc(q.items[e.i]?.name || '?')} · ${esc(fmtValue(valueAt(q, e.i), unit))}</span>`).join('');
    const playing = game.phase === 'play' || game.phase === 'paused';
    const note = phaseNote(game, h.name);
    const who = game.phase === 'reveal' ? `${esc(REASON[game.reveal?.reason] || '')} · ${esc(h.name(game.reveal?.by))}` : `${esc(h.name(game.active))} ist dran`;
    return `<div class="duel-control">
      <div class="reveal-box moderator-solution"><span>Zug ${game.turn} · ${game.pool.length} Karten im Pool</span><strong>${who}</strong><small>${note ? esc(note) : 'Der Spieler legt die Karte auf seinem Handy – das System prüft automatisch.'}</small></div>
      <details class="rank-secret"><summary>🔒 Werte (nur für dich)</summary><p class="microcopy">Auf der Leiste:</p><div class="chip-row">${placed || '–'}</div><p class="microcopy">Im Pool:</p><div class="chip-row">${secret || '–'}</div></details>
      <div class="duel-secondary">${turnMs(q) ? (game.phase === 'paused' ? '<button type="button" class="btn btn--small" data-duel="resume">▶ Weiter</button>' : `<button type="button" class="btn btn--small" data-duel="pause" ${playing ? '' : 'disabled'}>⏸ Pause</button>`) : ''}<button type="button" class="btn btn--small" data-duel="skip" ${playing ? '' : 'disabled'}>⏭ Zug überspringen</button><button type="button" class="btn btn--ghost btn--small" data-duel="stop">🏁 Spiel beenden</button></div>
      <div class="answer-review">${chips}</div></div>`;
  }

  // ---------------------------------------------------------------- Anzeige
  /*
   * Idempotent wie das Zeitduell: wird bei jeder Änderung erneut aufgerufen.
   * ctx: { game, players, playerId, role, reveal, result, onInput(answer) }
   */
  function render(q, container, ctx) {
    let root = container.querySelector(`.rank[data-qid="${CSS.escape(String(q.id))}"]`);
    if (!root) {
      const wrap = Kit.baseQuestion(q);
      root = Kit.el('div', 'rank');
      root.dataset.qid = String(q.id);
      root.innerHTML = `
        <div class="rank-scale"><strong class="rank-scale-title"></strong><span class="rank-scale-dir">niedrig → hoch</span></div>
        <div class="rank-banner" hidden></div>
        <div class="rank-line" aria-label="Leiste von niedrig nach hoch"></div>
        <div class="rank-action" hidden><span class="rank-action-text"></span><button type="button" class="btn btn--primary rank-confirm">✓ Hier einordnen</button></div>
        <div class="rank-pool-head"><strong>Pool</strong><span class="rank-pool-count"></span></div>
        <div class="rank-pool"></div>
        <div class="rank-players"></div>`;
      wrap.append(root);
      container.replaceChildren(wrap);
      root._sel = { turn: -1, item: null, slot: null, sent: false };
      bindInteractions(root);
    }
    root._ctx = ctx;
    root._q = q;
    paint(root);
    if (!root._loop) root._loop = setInterval(() => { if (!root.isConnected) { clearInterval(root._loop); root._loop = null; return; } paintTimer(root); }, 250);
  }

  function choosing(root) {
    const ctx = root._ctx || {};
    const game = normalizeGame(ctx.game);
    return Boolean(game && game.phase === 'play' && ctx.playerId && game.active === ctx.playerId && ctx.onInput && !ctx.reveal && !root._sel.sent);
  }

  function cardHTML(q, i, value, cls = '', tag = 'div', extra = '') {
    const App = window.SchmobinApp;
    const esc = App.escapeHTML;
    const item = q.items?.[i] || {};
    const src = App.sanitizeURL(item.image || '');
    const media = src ? `<img src="${esc(src)}" alt="" draggable="false" loading="lazy">` : `<span class="rank-initial">${esc(String(item.name || '?').slice(0, 2))}</span>`;
    const val = value == null ? '' : `<b class="rank-value">${esc(fmtValue(value, q.unit))}</b>`;
    return `<${tag} class="rank-card ${cls}" data-item="${i}" ${extra}>${media}<span class="rank-name">${esc(item.name || '?')}</span>${val}</${tag}>`;
  }

  function fullOrder(q, game) {
    if (game?.uncovered?.length) return game.uncovered;
    const values = (q.items || []).map((item, i) => ({ i, v: toNumber(item.value, NaN) }));
    if (values.every(e => Number.isFinite(e.v))) return values.sort((a, b) => a.v - b.v || a.i - b.i);
    return null;
  }

  function paint(root) {
    const ctx = root._ctx || {};
    const q = root._q;
    const game = normalizeGame(ctx.game);
    const App = window.SchmobinApp;
    const esc = App.escapeHTML;
    const players = new Map((ctx.players || []).map(p => [p.id, p]));
    const name = id => players.get(id)?.name || 'Spieler';
    const sel = root._sel;
    if (game && sel.turn !== game.turn) { sel.turn = game.turn; sel.item = null; sel.slot = null; sel.sent = false; }
    const me = ctx.playerId || '';
    const canChoose = choosing(root);
    root.classList.toggle('is-choosing', canChoose);

    root.querySelector('.rank-scale-title').textContent = [q.scale, q.unit ? `(${q.unit})` : ''].filter(Boolean).join(' ') || 'Von niedrig nach hoch';

    // Banner
    const banner = root.querySelector('.rank-banner');
    let text = ''; let tone = 'info';
    if (!game) text = ctx.reveal ? '' : (ctx.role === 'moderator' ? 'Tippe auf „🎲 Spiel starten“ – der Zufall bestimmt, wer beginnt.' : 'Der Moderator startet gleich das Spiel.');
    else if (game.phase === 'reveal' && game.reveal) {
      const r = game.reveal;
      const card = r.item != null ? esc(q.items?.[r.item]?.name || '') : '';
      const outNow = !game.shootout && r.reason !== 'correct' && r.reason !== 'skip' && toNumber(game.lives[r.by], 0) <= 0;
      const loss = game.shootout ? `${esc(name(r.by))} vergibt` : `${esc(name(r.by))} ❤ −1`;
      tone = r.reason === 'correct' ? 'correct' : r.reason === 'skip' ? 'info' : 'wrong';
      if (r.reason === 'correct') text = `<strong>${REASON.correct}</strong> ${esc(name(r.by))}: ${card}${r.value != null ? ` · <b>${esc(fmtValue(r.value, q.unit))}</b>` : ' liegt richtig'}`;
      else if (r.reason === 'wrong') text = `<strong>${REASON.wrong}</strong> ${card} geht zurück in den Pool · ${loss}`;
      else if (r.reason === 'timeout') text = `<strong>${REASON.timeout}</strong> ${loss}`;
      else text = `<strong>${REASON.skip}</strong> ${esc(name(r.by))}`;
      if (outNow) text += ` · <em>${esc(name(r.by))} ist raus!</em>`;
    } else if (game.phase === 'paused') text = '<strong>⏸ Pause</strong>';
    else if (game.phase === 'play') {
      const note = phaseNote(game, name);
      const last = note ? ` <em>${esc(note)}</em>` : '';
      text = game.active === me
        ? `<strong>Du bist dran!</strong> ${sel.sent ? 'Wird geprüft …' : 'Wähle eine Karte und leg sie an die richtige Stelle.'}${last}`
        : `<strong>${esc(name(game.active))}</strong> ist dran.${last}`;
      tone = game.active === me ? 'me' : 'info';
    } else if (isOver(game)) { text = `<strong>${esc(endText(game, name))}</strong>${game.phase === 'uncovered' ? ' · Komplette Reihenfolge' : ''}`; tone = game.winner ? 'correct' : 'info'; }
    if (ctx.reveal && !game) text = '<strong>Komplette Reihenfolge</strong>';
    text += '<span class="rank-timer"></span>';
    banner.hidden = !text.replace('<span class="rank-timer"></span>', '');
    banner.className = `rank-banner is-${tone}`;
    if (banner.dataset.html !== text) { banner.dataset.html = text; banner.innerHTML = text; }

    // Leiste
    const lineBox = root.querySelector('.rank-line');
    const showAll = ctx.reveal || game?.phase === 'uncovered';
    let entries;
    if (showAll) entries = (fullOrder(q, game) || game?.line || []).map(e => ({ i: e.i, v: e.v, uncovered: game ? !game.line.some(l => l.i === e.i) : false }));
    else if (game) entries = game.line.map(e => ({ i: e.i, v: e.v }));
    else entries = [{ i: anchorOf(q), v: anchorVisible(q) || instant(q) ? (q.anchorValue ?? q.items?.[anchorOf(q)]?.value ?? null) : null }];
    const parts = [];
    const reveal = game?.phase === 'reveal' ? game.reveal : null;
    const slotHTML = k => (canChoose ? `<button type="button" class="rank-slot${sel.slot === k ? ' is-selected' : ''}" data-slot="${k}" aria-label="Hier einordnen"><span>+</span></button>` : '');
    for (let k = 0; k <= entries.length; k++) {
      if (canChoose && sel.slot === k && sel.item != null) parts.push(cardHTML(q, sel.item, undefined, 'is-preview'));
      else parts.push(slotHTML(k));
      if (reveal?.reason === 'wrong' && reveal.slot === k && !showAll) parts.push(cardHTML(q, reveal.item, undefined, 'is-wrong'));
      if (k < entries.length) {
        const e = entries[k];
        const cls = [e.i === anchorOf(q) ? 'is-anchor' : '', reveal?.reason === 'correct' && reveal.item === e.i ? 'is-new' : '', e.uncovered ? 'is-uncovered' : ''].filter(Boolean).join(' ');
        parts.push(cardHTML(q, e.i, e.v, cls));
      }
    }
    const lineHTML = parts.join('');
    if (lineBox.dataset.html !== lineHTML) { lineBox.dataset.html = lineHTML; lineBox.innerHTML = lineHTML; }

    // Bestätigen
    const action = root.querySelector('.rank-action');
    action.hidden = !canChoose;
    if (canChoose) {
      const ready = sel.item != null && sel.slot != null;
      root.querySelector('.rank-action-text').textContent = sel.item == null ? 'Wähle eine Karte aus dem Pool (antippen oder ziehen).' : sel.slot == null ? `„${q.items?.[sel.item]?.name || ''}“ – tippe jetzt auf ein ＋ in der Leiste.` : `„${q.items?.[sel.item]?.name || ''}“ hier einordnen?`;
      root.querySelector('.rank-confirm').disabled = !ready;
    }

    // Pool
    const pool = showAll ? [] : game ? game.pool : (q.items || []).map((_, i) => i).filter(i => i !== anchorOf(q));
    root.querySelector('.rank-pool-count').textContent = showAll ? '' : `${pool.length} ${pool.length === 1 ? 'Karte' : 'Karten'}`;
    root.querySelector('.rank-pool-head').hidden = showAll;
    const poolHTML = pool.map(i => {
      const hidden = canChoose && sel.slot != null && sel.item === i;
      const wrongNow = reveal?.reason === 'wrong' && reveal.item === i;
      return canChoose
        ? cardHTML(q, i, undefined, `rank-card--pool${sel.item === i ? ' is-selected' : ''}${hidden ? ' is-placed' : ''}`, 'button', 'type="button"')
        : cardHTML(q, i, undefined, `rank-card--pool${wrongNow ? ' is-back' : ''}`);
    }).join('');
    const poolBox = root.querySelector('.rank-pool');
    poolBox.hidden = showAll;
    if (poolBox.dataset.html !== poolHTML) { poolBox.dataset.html = poolHTML; poolBox.innerHTML = poolHTML; }

    // Spieler
    const order = game?.order?.length ? game.order : (ctx.players || []).map(p => p.id);
    const maxLives = livesOf(q);
    const playersHTML = order.map(id => {
      const p = players.get(id) || { name: 'Spieler', avatar: '🙂' };
      const out = game?.eliminated?.includes(id);
      const active = game && game.active === id && !isOver(game);
      const lives = game ? toNumber(game.lives[id], 0) : maxLives;
      return `<div class="rank-player${active ? ' is-active' : ''}${out ? ' is-out' : ''}${id === me ? ' is-me' : ''}${game?.winner === id ? ' is-winner' : ''}"><span class="rank-avatar">${esc(App.avatar(p.avatar))}</span><span class="rank-pname">${esc(p.name)}${id === me ? ' <small>(du)</small>' : ''}</span><span class="rank-lives" aria-label="${lives} Leben">${game?.shootout?.players.includes(id) && !isOver(game) ? '⚔️ Stechen' : out ? 'raus' : hearts(lives, maxLives)}</span><b class="rank-score">✓ ${game ? toNumber(game.correct[id], 0) : 0}</b></div>`;
    }).join('');
    const playersBox = root.querySelector('.rank-players');
    if (playersBox.dataset.html !== playersHTML) { playersBox.dataset.html = playersHTML; playersBox.innerHTML = playersHTML; }
    paintTimer(root);
  }

  function paintTimer(root) {
    const ctx = root._ctx || {};
    const q = root._q;
    const game = normalizeGame(ctx.game);
    const node = root.querySelector('.rank-timer');
    if (!node) return;
    const ms = game && (game.phase === 'play' || game.phase === 'paused') ? turnRemaining(game, q) : null;
    const text = ms == null ? '' : `⏱ ${Math.ceil(ms / 1000)} s`;
    if (node.textContent !== text) node.textContent = text;
    node.classList.toggle('is-critical', ms != null && ms <= 5000);
  }

  function send(root) {
    const ctx = root._ctx || {};
    const sel = root._sel;
    const game = normalizeGame(ctx.game);
    if (!choosing(root) || sel.item == null || sel.slot == null || !game) return;
    sel.sent = true;
    ctx.onInput({ turn: game.turn, item: sel.item, slot: sel.slot, at: Date.now() });
    paint(root);
  }

  function bindInteractions(root) {
    root.addEventListener('click', event => {
      if (!choosing(root) || root._dragged) return;
      const sel = root._sel;
      const confirm = event.target.closest('.rank-confirm');
      if (confirm) { send(root); return; }
      const slot = event.target.closest('.rank-slot, .rank-card.is-preview');
      if (slot) {
        if (slot.classList.contains('is-preview')) { sel.slot = null; paint(root); return; }
        if (sel.item == null) { root.querySelector('.rank-action-text').textContent = 'Wähle zuerst eine Karte aus dem Pool.'; return; }
        sel.slot = Number(slot.dataset.slot); paint(root); return;
      }
      const card = event.target.closest('.rank-card--pool');
      if (card) {
        const i = Number(card.dataset.item);
        sel.item = sel.item === i ? null : i;
        if (sel.item == null) sel.slot = null;
        paint(root);
      }
    });
    // Ziehen: Karte aus dem Pool auf ein ＋ in der Leiste (Maus und Finger)
    let drag = null;
    root.addEventListener('pointerdown', event => {
      const card = event.target.closest('.rank-card--pool');
      if (!card || !choosing(root) || event.button > 0) return;
      drag = { card, i: Number(card.dataset.item), x: event.clientX, y: event.clientY, ghost: null, id: event.pointerId };
      root._dragged = false;
    });
    root.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
        root._sel.item = drag.i; root._sel.slot = null; paint(root);
        const source = root.querySelector(`.rank-card--pool[data-item="${drag.i}"]`) || drag.card;
        drag.ghost = source.cloneNode(true);
        drag.ghost.classList.add('rank-ghost');
        document.body.append(drag.ghost);
        root.classList.add('is-dragging');
        try { source.setPointerCapture(event.pointerId); } catch (_) {}
      }
      event.preventDefault();
      drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`;
      const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.rank-slot');
      root.querySelectorAll('.rank-slot.is-hover').forEach(s => { if (s !== under) s.classList.remove('is-hover'); });
      under?.classList.add('is-hover');
    });
    const end = event => {
      if (!drag || event.pointerId !== drag.id) return;
      const wasDrag = Boolean(drag.ghost);
      if (wasDrag) {
        drag.ghost.remove();
        root.classList.remove('is-dragging');
        const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.rank-slot');
        if (under && root.contains(under)) root._sel.slot = Number(under.dataset.slot);
        root._dragged = true; setTimeout(() => { root._dragged = false; }, 50);
        paint(root);
      }
      drag = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }

  // ---------------------------------------------------------------- Editor
  function editor(q, ui, box) {
    const { div, input, labelField, button } = ui;
    box.append(div('editor-help', 'Reihum ordnet jeder Spieler eine Karte aus dem Pool auf der Leiste ein (von niedrig nach hoch). Falsch = Karte zurück in den Pool und ein Leben weniger. Bleiben zwei übrig, entscheidet ein Stechen. Punkte: pro richtiger Karte + Platzierung in % der „Punkte“ oben.'));
    const grid = div('dynamic-grid');
    const scale = input('text', q.scale || '', 'input'); scale.placeholder = 'z. B. Einwohner';
    scale.addEventListener('input', e => { q.scale = e.target.value; ui.queueSave(); });
    const unit = input('text', q.unit || '', 'input'); unit.placeholder = 'z. B. Mio.'; unit.maxLength = 20;
    unit.addEventListener('input', e => { q.unit = e.target.value; ui.queueSave(); });
    const lives = input('number', q.lives, 'input'); lives.min = '1'; lives.max = '9';
    lives.addEventListener('input', e => { q.lives = Math.max(1, Math.min(9, Number(e.target.value) || 3)); ui.queueSave(); });
    const turn = input('number', q.turnSeconds, 'input'); turn.min = '0'; turn.max = '300'; turn.step = '5';
    turn.addEventListener('input', e => { q.turnSeconds = Math.max(0, Math.min(300, Number(e.target.value) || 0)); ui.queueSave(); });
    grid.append(labelField('Leiste (Messgröße)', scale), labelField('Einheit', unit), labelField('Leben pro Spieler', lives), labelField('Zeit pro Zug in s (0 = ohne)', turn));
    // Werte sichtbar?
    const reveal = document.createElement('select'); reveal.className = 'select';
    reveal.innerHTML = '<option value="end">Erst beim Aufdecken / bei der Auflösung</option><option value="instant">Sofort, wenn eine Karte richtig liegt</option>';
    reveal.value = instant(q) ? 'instant' : 'end';
    reveal.addEventListener('change', e => { q.revealValues = e.target.value; ui.queueSave(); });
    const anchorShow = document.createElement('select'); anchorShow.className = 'select';
    anchorShow.innerHTML = '<option value="true">Ja – als Orientierung</option><option value="false">Nein – auch der Anker bleibt verborgen</option>';
    anchorShow.value = String(anchorVisible(q));
    anchorShow.addEventListener('change', e => { q.showAnchor = e.target.value === 'true'; ui.queueSave(); });
    grid.append(labelField('Werte zeigen', reveal), labelField('Wert der Anker-Karte zeigen?', anchorShow));
    // Punkte
    const card = input('number', cardPointsOf(q), 'input'); card.min = '0'; card.step = '5';
    const places = input('text', parsePlaces(q.placePoints).join(', '), 'input'); places.placeholder = '100, 60, 30';
    const preview = div('field-hint rank-points-preview');
    const updatePreview = () => {
      const base = Number(q.points) || 0;
      const pl = parsePlaces(q.placePoints);
      const ex = (cards, rank) => cards * cardPointsOf(q) + Math.round(base * (pl[rank - 1] || 0) / 100);
      preview.textContent = `Beispiel bei ${base} Punkten: Sieger mit 4 Karten = ${ex(4, 1)} P · 2. Platz mit 3 Karten = ${ex(3, 2)} P · früh raus mit 1 Karte = ${ex(1, pl.length + 1)} P`;
    };
    card.addEventListener('input', e => { q.cardPoints = Math.max(0, Number(e.target.value) || 0); updatePreview(); ui.queueSave(); });
    places.addEventListener('change', e => { q.placePoints = parsePlaces(e.target.value); e.target.value = q.placePoints.join(', '); updatePreview(); ui.queueSave(); });
    grid.append(labelField('Punkte pro richtiger Karte', card), labelField('Platzierung in % der Punkte (1., 2., 3. …)', places));
    box.append(grid, preview);
    updatePreview();
    // Änderungen im allgemeinen Feld „Punkte“ ebenfalls in der Vorschau zeigen
    setTimeout(() => box.closest('.question-editor')?.addEventListener('input', event => { if (event.target.type === 'number') updatePreview(); }), 0);

    const head = div('duel-items-head');
    const count = Kit.el('strong', '');
    head.append(count);
    const rows = div('rank-items');
    box.append(head, rows);
    function renderItems() {
      count.textContent = `${q.items.length} Karten · ⚓ = Anker (liegt am Anfang offen auf der Leiste)`;
      rows.replaceChildren(...q.items.map((item, index) => {
        const row = div(`rank-item${index === anchorOf(q) ? ' is-anchor' : ''}`);
        const anchor = button(index === anchorOf(q) ? '⚓' : '○', 'icon-btn rank-anchor-btn', () => { q.anchor = index; renderItems(); ui.queueSave(); });
        anchor.title = 'Als Anker festlegen';
        const nameInput = input('text', item.name || '', 'input'); nameInput.placeholder = 'Name, z. B. Frankreich';
        nameInput.addEventListener('input', e => { item.name = e.target.value; ui.queueSave(); });
        const value = input('number', Number.isFinite(Number(item.value)) ? item.value : '', 'input'); value.step = 'any'; value.placeholder = 'Wert';
        value.addEventListener('input', e => { item.value = e.target.value === '' ? null : Number(e.target.value); ui.queueSave(); });
        const img = input('text', item.image || '', 'input'); img.placeholder = './assets/flaggen/frankreich.svg (optional)';
        img.addEventListener('input', e => { item.image = e.target.value; ui.queueSave(); });
        const remove = button('✕', 'icon-btn', () => {
          q.items.splice(index, 1);
          if (q.anchor >= q.items.length || q.anchor === index) q.anchor = 0; else if (index < q.anchor) q.anchor -= 1;
          renderItems(); ui.queueSave();
        });
        remove.title = 'Karte entfernen';
        row.append(anchor, labelField('Name', nameInput), labelField(`Wert${q.unit ? ` (${q.unit})` : ''}`, value), labelField('Bild', img), remove);
        window.SylasphereMediaLibrary?.enhance(img, 'image');
        return row;
      }));
    }
    renderItems();
    const actions = div('duel-item-actions');
    actions.append(
      button('+ Karte', 'btn btn--small', () => { q.items.push({ name: '', value: null, image: '' }); renderItems(); ui.queueSave(); }),
      button('↕ Nach Wert sortieren', 'btn btn--small btn--ghost', () => {
        const anchorItem = q.items[anchorOf(q)];
        q.items.sort((a, b) => toNumber(a.value, Infinity) - toNumber(b.value, Infinity));
        q.anchor = Math.max(0, q.items.indexOf(anchorItem));
        renderItems(); ui.queueSave();
      })
    );
    // v25.1: viele Bilder auf einmal hochladen – Name aus dem Dateinamen, Wert danach eintragen
    const Cloud = window.SylasphereCloudMedia;
    if (Cloud?.available()) {
      const note = Kit.el('span', 'field-hint', '');
      actions.append(button('⬆ Bilder hochladen', 'btn btn--small btn--primary', async () => {
        await Cloud.pickAndUpload({
          kind: 'image', multiple: true, folder: 'einordnen',
          onProgress: text => { note.textContent = text; },
          onEach: r => { q.items = q.items.filter(i => String(i.name || '').trim() || Number.isFinite(Number(i.value)) || i.image); q.items.push({ name: Cloud.labelFromName(r.name), value: null, image: r.url }); renderItems(); ui.queueSave(); }
        });
      }), note);
    }
    box.append(actions);
    // Liste einfügen: eine Karte pro Zeile – „Name; Wert; Bild (optional)“
    const paste = document.createElement('details'); paste.className = 'rank-paste';
    const summary = document.createElement('summary'); summary.textContent = '📋 Liste einfügen (z. B. aus Excel)';
    const area = document.createElement('textarea'); area.className = 'input'; area.rows = 5;
    area.placeholder = 'Frankreich; 66,7; ./assets/flaggen/frankreich.svg\nItalien; 58,9\nPolen; 37,8';
    const take = button('Karten übernehmen', 'btn btn--small', () => {
      const parsed = parseList(area.value);
      if (!parsed.length) { window.SchmobinApp.toast('Keine Zeile erkannt. Format: Name; Wert; Bild (optional)', 'error'); return; }
      q.items = q.items.filter(i => String(i.name || '').trim() || Number.isFinite(Number(i.value))).concat(parsed);
      area.value = ''; paste.open = false; renderItems(); ui.queueSave();
      window.SchmobinApp.toast(`${parsed.length} Karten übernommen.`, 'success');
    });
    paste.append(summary, area, take);
    box.append(paste);
  }
  /** „Name; Wert; Bild“ oder Tabulator (Excel). Deutsches Komma als Dezimaltrenner, Tausenderpunkte erlaubt. */
  function parseList(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const cells = line.split(/\t|;/).map(c => c.trim());
      if (cells.length < 2) return null;
      const raw = cells[1].replace(/\s/g, '');
      const normalized = /,\d+$/.test(raw) || (raw.includes(',') && !raw.includes('.')) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
      const value = Number(normalized);
      if (!cells[0] || !Number.isFinite(value)) return null;
      return { name: cells[0], value, image: cells[2] || '' };
    }).filter(Boolean);
  }

  // ---------------------------------------------------------------- Registrierung
  window.SylasphereTypes.register({
    type: 'ranking',
    label: 'Einordnen',
    icon: '📶',
    description: 'Reihum Karten auf einer Leiste von niedrig nach hoch einordnen. Falsch kostet ein Leben, wer keine mehr hat, ist raus.',
    solutionLabel: 'Ergebnis',
    noTimer: true,
    scoresAllPlayers: true,
    game: Game,
    defaults: () => ({
      text: 'Ordne die Länder nach Einwohnern ein!', points: 100, cardPoints: 10, placePoints: DEFAULT_PLACES.slice(), scale: 'Einwohner', unit: 'Mio.', lives: 3, turnSeconds: 0, revealValues: 'end', showAnchor: true, timer: 0, anchor: 0,
      items: [
        { name: 'Deutschland', value: 83.6, image: './assets/flaggen/deutschland.svg' },
        { name: 'Frankreich', value: 66.7, image: './assets/flaggen/frankreich.svg' },
        { name: 'Polen', value: 37.8, image: './assets/flaggen/polen.svg' },
        { name: 'Japan', value: 122.4, image: './assets/flaggen/japan.svg' },
        { name: 'Österreich', value: 9.1, image: './assets/flaggen/oesterreich.svg' }
      ]
    }),
    normalize(q) {
      q.items = list(q.items).map(item => ({ name: String(item?.name ?? item?.label ?? ''), value: item?.value === '' || item?.value == null ? null : toNumber(item.value, null), image: String(item?.image ?? '') }));
      q.anchor = anchorOf(q);
      q.scale = String(q.scale ?? '');
      q.unit = String(q.unit ?? '');
      q.lives = livesOf(q);
      q.turnSeconds = Math.max(0, Math.min(300, toNumber(q.turnSeconds, 0)));
      // v25.2: Punkte pro Karte + Platzierung (alte Fragen: bisherige Punkte galten pro Karte)
      if (q.cardPoints == null && q.scoring != null) q.cardPoints = toNumber(q.points, 10);
      q.cardPoints = cardPointsOf(q);
      q.placePoints = parsePlaces(q.placePoints);
      delete q.scoring; delete q.growth;
      q.revealValues = q.revealValues === 'instant' ? 'instant' : 'end';
      q.showAnchor = q.showAnchor !== false && q.showAnchor !== 'false';
      q.timer = 0;
    },
    validate(q, report) {
      const items = q.items || [];
      if (items.length < 3) report.error('items', 'Einordnen braucht mindestens 3 Karten (Anker + 2 im Pool).');
      items.forEach((item, i) => {
        if (!String(item.name || '').trim()) report.error('items', `Karte ${i + 1}: Name fehlt.`);
        if (!Number.isFinite(Number(item.value)) || item.value === null) report.error('items', `Karte ${i + 1}${item.name ? ` (${item.name})` : ''}: Wert fehlt.`);
        if (String(item.image || '').trim()) Kit.mediaAdvice(item.image, 'image').forEach(a => { if (a.level === 'error') report.error('items', `Karte ${i + 1}: ${a.text}`); else if (a.level === 'warn') report.warn('items', `Karte ${i + 1}: ${a.text}`); });
      });
      const names = items.map(i => String(i.name || '').trim().toLowerCase()).filter(Boolean);
      if (new Set(names).size !== names.length) report.warn('items', 'Zwei Karten haben denselben Namen.');
      if (items.length >= 3 && items.length < 8) report.warn('items', 'Tipp: Mit 10–20 Karten wird es spannender.');
    },
    // Werte bleiben geheim – höchstens der Anker ist offen
    hideSolution(pq) {
      const anchor = anchorOf(pq);
      pq.anchorValue = anchorVisible(pq) || instant(pq) ? toNumber(pq.items?.[anchor]?.value, null) : null;
      pq.items = (pq.items || []).map(item => ({ name: item.name, image: item.image }));
    },
    resolve(q, answers, options = {}) {
      const names = options.names || {};
      const game = normalizeGame(options.game);
      const players = placements(game).map(p => Object.assign(p, { name: String(names[p.playerId] || 'Spieler') }));
      return { kind: 'ranking', players, winner: game?.winner || '', winnerName: game?.winner ? String(names[game.winner] || 'Spieler') : '', endReason: game?.endReason || '' };
    },
    score(q, answer, { base, result, playerId }) {
      const p = (result?.players || []).find(x => x.playerId === playerId);
      if (!p) return { points: 0, detail: 'Nicht am Spiel beteiligt' };
      return { points: pointsFor(q, p, base), detail: `${p.rank}. Platz · ${p.correct} ${p.correct === 1 ? 'Karte' : 'Karten'} richtig${p.winner ? ' · 🏆 Sieger' : ''}` };
    },
    solutionText(q, result) {
      if (result?.winnerName) return `🏆 ${result.winnerName}`;
      const top = (result?.players || []).slice(0, 3);
      return top.length ? top.map(p => `${p.rank}. ${p.name}`).join(' · ') : `${(q.items || []).length} Karten`;
    },
    moderatorSolution(q) {
      const order = (q.items || []).slice().filter(i => Number.isFinite(Number(i.value))).sort((a, b) => a.value - b.value);
      return { text: order.map(i => i.name).join(' < ') || '–', extra: `${q.lives} Leben · ${q.turnSeconds ? `${q.turnSeconds} s pro Zug` : 'ohne Zeitlimit'} · ${cardPointsOf(q)} P pro Karte + Platz ${parsePlaces(q.placePoints).join('/')} % · Werte ${instant(q) ? 'sofort' : 'erst am Ende'}` };
    },
    answerLabel(q, answer) { return answer && typeof answer === 'object' && answer.item != null ? String(q.items?.[answer.item]?.name || '') : '–'; },
    render,
    update: render,
    editor
  });
  Game.parseList = parseList;
  Game.cardPointsOf = cardPointsOf;
  Game.fmtValue = fmtValue;
})();
