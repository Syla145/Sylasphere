(function () {
  'use strict';

  /*
   * Show-Formate (v34) – Spiellogik ohne DOM (in tests/v34 geprüft)
   * ------------------------------------------------------------------
   * THEMEN-BRETT (Runde mit format: 'board', siehe quiz-utils.normalizeBoard)
   *  - Feste Reihenfolge (Lobby). Pro Wahl-Runde ist jeder genau einmal dran: Feld wählen, allein antworten.
   *    Richtig → Feldwert (× Runden-Multiplikator), falsch → 0. Keine Teilpunkte.
   *  - Vor jeder Wahl-Runde: Reichen die freien Felder nicht mehr für alle, spielen alle die Restfelder
   *    gemeinsam (normale Wertung für alle).
   *  - Mitraten: Wer nicht dran ist, darf ohne Punkte mitraten → „Hätten es auch gewusst“.
   *  - Versteckte Doppel-Felder: der Wählende setzt 0 bis eigene Punkte (mindestens bis zum höchsten Feldwert);
   *    richtig → +Einsatz, falsch → 0.
   *  - Der Moderator-Rechner führt den Stand (state.show). Spieler melden ihre Wahl/ihren Einsatz über
   *    ihr Profil (pick: { key, qid } bzw. { key, stake }).
   * EINSATZ-FINALE (settings.finalWager, letzte Frage)
   *  - Jeder setzt geheim 0 bis alle eigenen Punkte (bei ≤ 0 Punkten bis 100). Richtig +Einsatz, falsch −Einsatz.
   *  - Auflösung Spieler für Spieler vom Letzten zum Ersten.
   */
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const list = v => (Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
  const num = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };

  // ---------------------------------------------------------------- Brett
  function cells(round) {
    return (round?.questions || []).map((q, qi) => (q.cell ? { qid: String(q.id), qi, t: q.cell.t, v: q.cell.v, value: num(round.board?.values?.[q.cell.v]) } : null)).filter(Boolean);
  }
  const freeCells = (show, round) => cells(round).filter(c => !show.used[c.qid]);
  function normalize(input) {
    if (!input || typeof input !== 'object' || input.kind !== 'board') return input ? clone(input) : null;
    const s = clone(input);
    s.order = list(s.order).map(String); s.cycle = list(s.cycle).map(String); s.doubles = list(s.doubles).map(String);
    s.used = s.used && typeof s.used === 'object' ? s.used : {};
    Object.values(s.used).forEach(u => { u.alsoRight = list(u.alsoRight).map(String); });
    s.current = s.current || null; s.active = String(s.active || ''); s.pickNo = num(s.pickNo, 1); s.seq = num(s.seq, 1);
    return s;
  }
  const bump = s => { s.seq = (s.seq || 0) + 1; return s; };
  /** Neue Wahl-Runde oder gemeinsame Restfelder */
  function beginCycle(s, round, activeIds) {
    const present = s.order.filter(id => !activeIds || activeIds.includes(id));
    const left = freeCells(s, round).length;
    s.current = null; s.cycle = []; s.active = '';
    if (!left) { s.phase = 'done'; return bump(s); }
    if (s.shared || left < present.length || !present.length) { s.shared = true; s.phase = 'shared'; return bump(s); }
    s.cycle = present.slice(); s.active = s.cycle[0]; s.phase = 'pick'; s.pickNo += 1;
    return bump(s);
  }
  /**
   * Brett starten. playerIds in Lobby-Reihenfolge, startIndex = wer beginnt (nach einem früheren Brett: der Nächste).
   * rand für die zufällige Lage der Doppel-Felder (nie in der untersten Zeile).
   */
  function startBoard(round, ri, playerIds, { startIndex = 0, rand = Math.random } = {}) {
    const ids = playerIds.map(String);
    const k = ids.length ? ((startIndex % ids.length) + ids.length) % ids.length : 0;
    const order = ids.slice(k).concat(ids.slice(0, k));
    const candidates = cells(round).filter(c => c.v > 0 || (round.board?.values || []).length === 1);
    const doubles = [];
    const pool = candidates.slice();
    for (let i = 0; i < Math.min(num(round.board?.doubles), pool.length); i++) doubles.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].qid);
    const s = { kind: 'board', ri, roundId: String(round.id), order, cycle: [], active: '', phase: 'pick', shared: false, used: {}, doubles, current: null, pickNo: 0, seq: 1 };
    return beginCycle(s, round, ids);
  }
  const pickKey = s => `${s.roundId}:${s.pickNo}`;
  const isDouble = (s, qid) => s.doubles.includes(String(qid)) && !s.shared;
  /** Feld wählen (Spieler, der dran ist – oder der Moderator mit force) */
  function pick(input, round, playerId, qid, { force = false } = {}) {
    const s = normalize(input);
    if (!s || s.phase !== 'pick' || (!force && String(playerId) !== s.active)) return input;
    const cell = cells(round).find(c => c.qid === String(qid));
    if (!cell || s.used[cell.qid]) return input;
    const double = isDouble(s, cell.qid);
    s.current = { qid: cell.qid, by: s.active, value: cell.value, double, stake: null, shared: false };
    s.phase = double ? 'wager' : 'play';
    return bump(s);
  }
  /** Höchster Einsatz beim Doppel-Feld: eigene Punkte, mindestens der höchste Feldwert */
  const maxDoubleStake = (score, round) => Math.max(Math.round(num(score)), ...(round?.board?.values || [0]).map(num));
  function setStake(input, round, playerId, stake, score, { force = false } = {}) {
    const s = normalize(input);
    if (!s || s.phase !== 'wager' || !s.current || (!force && String(playerId) !== s.current.by)) return input;
    s.current.stake = Math.max(0, Math.min(maxDoubleStake(score, round), Math.round(num(stake))));
    s.phase = 'play';
    return bump(s);
  }
  /** Gemeinsame Restfelder: nächstes freies Feld (niedrigster Wert zuerst) für alle öffnen */
  function openShared(input, round) {
    const s = normalize(input);
    if (!s || s.phase !== 'shared') return input;
    const next = freeCells(s, round).sort((a, b) => a.v - b.v || a.t - b.t)[0];
    if (!next) { s.phase = 'done'; return bump(s); }
    s.current = { qid: next.qid, by: '', value: next.value, double: false, stake: null, shared: true };
    s.phase = 'play';
    return bump(s);
  }
  /**
   * Wertung eines Feldes. judge(playerId, answer) → true/false. Rückgabe:
   *  scores: { playerId: { points, detail } } (für engine.resolveQuestion({ override })), result: Zusatz fürs Ergebnis
   */
  function scoreCell(input, round, players, answers, judge, multiplier = 1) {
    const s = normalize(input);
    const cur = s?.current;
    if (!cur) return { scores: {}, result: null };
    const value = Math.round(num(cur.value) * num(multiplier, 1));
    const scores = {}; const alsoRight = []; const rightAll = [];
    players.forEach(p => {
      const record = answers?.[p.id];
      const ok = record ? Boolean(judge(p.id, record.answer)) : false;
      if (cur.shared) {
        if (!record) return;
        scores[p.id] = { points: ok ? value : 0, detail: ok ? `Brett · ${value} P für alle` : 'Brett · falsch' };
        if (ok) rightAll.push(p.id);
      } else if (p.id === cur.by) {
        const points = ok ? (cur.double ? Math.round(num(cur.stake)) : value) : 0;
        scores[p.id] = { points, detail: `${cur.double ? `💎 Doppel-Feld (Einsatz ${Math.round(num(cur.stake))})` : `Feld ${value}`} · ${ok ? 'richtig' : 'falsch'}` };
      } else if (record) {
        scores[p.id] = { points: 0, detail: `Mitgeraten (ohne Punkte) · ${ok ? 'hätte gestimmt' : 'falsch'}` };
        if (ok) alsoRight.push(p.id);
      }
    });
    const byOk = cur.shared ? rightAll.length > 0 : Boolean(scores[cur.by]?.points > 0 || (answers?.[cur.by] && judge(cur.by, answers[cur.by].answer)));
    return { scores, result: { board: { qid: cur.qid, by: cur.by, shared: cur.shared, double: cur.double, stake: cur.stake, value, correct: byOk, points: cur.shared ? value : (scores[cur.by]?.points || 0), alsoRight: cur.shared ? rightAll : alsoRight } } };
  }
  /** Nach der Auflösung: Feld als gespielt markieren und zum Nächsten weitergehen */
  function finishCell(input, round, boardResult, activeIds) {
    const s = normalize(input);
    if (!s?.current) return input;
    const cur = s.current;
    s.used[cur.qid] = { by: cur.by, shared: cur.shared, correct: Boolean(boardResult?.correct), points: Math.round(num(boardResult?.points)), double: cur.double, alsoRight: list(boardResult?.alsoRight).map(String) };
    s.current = null;
    if (cur.shared) { s.phase = freeCells(s, round).length ? 'shared' : 'done'; return bump(s); }
    return advanceTurn(s, round, activeIds);
  }
  function advanceTurn(s, round, activeIds) {
    if (s.active) s.lastActive = s.active;
    s.cycle = s.cycle.filter(id => id !== s.active && (!activeIds || activeIds.includes(id)));
    if (s.cycle.length && freeCells(s, round).length) { s.active = s.cycle[0]; s.phase = 'pick'; s.pickNo += 1; return bump(s); }
    return beginCycle(s, round, activeIds);
  }
  /** Moderator: wer dran ist, wird übersprungen (Feld bleibt frei) */
  function skipTurn(input, round, activeIds) {
    const s = normalize(input);
    if (!s || !['pick', 'wager'].includes(s.phase)) return input;
    s.current = null;
    return advanceTurn(s, round, activeIds);
  }
  /** Wer als Nächstes wählt (für „danach: …“) */
  function nextUp(input) {
    const s = normalize(input);
    if (!s || s.phase === 'shared' || s.phase === 'done') return '';
    const after = s.cycle.slice(1);
    if (after.length) return after[0];
    const i = s.order.indexOf(s.active);
    return s.order.length > 1 ? s.order[(i + 1) % s.order.length] : '';
  }
  /** Punkte pro Spieler auf dem Brett (für das Highlight „Brett-König“) */
  function boardPoints(input) {
    const s = normalize(input);
    const out = {};
    Object.values(s?.used || {}).forEach(u => { if (u.by && !u.shared && u.points > 0) out[u.by] = (out[u.by] || 0) + u.points; });
    return out;
  }
  /** Beim nächsten Brett beginnt, wer als Nächstes dran gewesen wäre */
  function nextStartIndex(input, lobbyIds) {
    const s = normalize(input);
    if (!s || s.kind !== 'board') return 0;
    const last = s.lastActive || s.active || s.order[s.order.length - 1];
    const i = lobbyIds.indexOf(last);
    return i < 0 ? 0 : i + 1;
  }

  // ---------------------------------------------------------------- Einsatz-Finale
  const WAGER_SUFFIX = '__einsatz';
  const wagerId = qid => `${qid}${WAGER_SUFFIX}`;
  const finalMaxStake = score => (num(score) > 0 ? Math.round(num(score)) : 100);
  const clampFinal = (stake, score) => Math.max(0, Math.min(finalMaxStake(score), Math.round(num(stake))));
  function startFinal(qid) { return { kind: 'final', qid: String(qid), phase: 'wager', stakes: {}, reveal: null, seq: 1 }; }
  /** Einsätze einsammeln (aus den privaten Antworten) und prüfen */
  function collectStakes(players, wagerAnswers) {
    const stakes = {};
    players.forEach(p => { stakes[p.id] = clampFinal(wagerAnswers?.[p.id]?.answer?.stake ?? wagerAnswers?.[p.id]?.answer ?? 0, p.score); });
    return stakes;
  }
  /** Wertung: richtig +Einsatz, falsch/keine Antwort −Einsatz. Reihenfolge der Auflösung: vom Letzten zum Ersten */
  function scoreFinal(players, answers, stakes, judge, answerLabel = a => String(a ?? '–')) {
    const scores = {}; const rows = [];
    players.slice().sort((a, b) => num(a.score) - num(b.score) || num(b.joinedAt) - num(a.joinedAt)).forEach(p => {
      const stake = Math.round(num(stakes?.[p.id]));
      const record = answers?.[p.id];
      const ok = record ? Boolean(judge(p.id, record.answer)) : false;
      const points = ok ? stake : -stake;
      scores[p.id] = { points, detail: `Einsatz-Finale · Einsatz ${stake} · ${ok ? 'richtig' : 'falsch'}` };
      rows.push({ id: p.id, answer: record ? answerLabel(record.answer) : '– keine Antwort', stake, before: Math.round(num(p.score)), after: Math.round(num(p.score)) + points, correct: ok });
    });
    return { scores, rows };
  }

  window.SylasphereShow = {
    cells, freeCells, normalize, startBoard, beginCycle, pickKey, isDouble, pick, maxDoubleStake, setStake, openShared, scoreCell, finishCell, skipTurn, nextUp, boardPoints, nextStartIndex,
    WAGER_SUFFIX, wagerId, finalMaxStake, clampFinal, startFinal, collectStakes, scoreFinal
  };
})();
