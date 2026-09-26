(function () {
  'use strict';

  /*
   * XP, Stufen und Statistiken (v28) – reine Rechenlogik ohne Firebase
   * ------------------------------------------------------------------
   * XP pro Spiel (nur angemeldete Spieler, nur online):
   *   Mitspielen             20 XP (wenn mindestens die Hälfte der Fragen beantwortet)
   *   Richtige Antwort        5 XP (Frage mit mehr als 0 Punkten)
   *   Platz 1 / 2 / 3        50 / 30 / 15 XP
   *   Highlight              10 XP pro Auszeichnung
   *   höchstens 250 XP pro Spiel, höchstens 600 XP pro Tag (24 h ab dem ersten Spiel)
   * XP gibt es nur, wenn mindestens 3 Spieler dabei waren und 5 Fragen gewertet wurden.
   *
   * Stufen: Von Stufe n auf n+1 braucht man 50 × n XP.
   *   Gesamt-XP für Stufe n = 25 × n × (n − 1) → Stufe 2: 50, 3: 150, 5: 500, 10: 2250, 20: 9500
   *
   * Emotes: SylasphereReactions.EMOJIS ist die Grundausstattung (auch für Gäste),
   * EMOTES unten wird mit der Stufe freigeschaltet. Neues Emote: einfach ergänzen
   * und auf admin.html einmal „Emotes abgleichen“ (die Firebase-Regeln lesen die Liste).
   *
   * Die Grenzen (250 pro Spiel, 600 pro Tag) prüfen zusätzlich die Firebase-Regeln.
   */
  const RULES = Object.freeze({
    PLAY: 20, PER_CORRECT: 5, PLACES: [50, 30, 15], PER_HIGHLIGHT: 10,
    GAME_CAP: 250, DAY_CAP: 600, DAY_MS: 86400000,
    MIN_PLAYERS: 3, MIN_QUESTIONS: 5
  });

  const EMOTES = Object.freeze([
    { e: '🥳', level: 2 }, { e: '🤔', level: 3 }, { e: '😎', level: 4 }, { e: '💯', level: 5 },
    { e: '🙈', level: 7 }, { e: '👑', level: 10 }, { e: '🌈', level: 15 }, { e: '🐐', level: 20 }
  ]);

  const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

  // ---------- Stufen ----------
  function xpForLevel(level) { const n = Math.max(1, Math.floor(num(level))); return 25 * n * (n - 1); }
  function levelFor(xp) {
    const total = Math.max(0, num(xp));
    let n = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * total) / 25)) / 2));
    while (xpForLevel(n + 1) <= total) n += 1; // Rundungsfehler abfangen
    while (n > 1 && xpForLevel(n) > total) n -= 1;
    return n;
  }
  /** { level, xp, from, to, progress (0–1), missing } */
  function levelInfo(xp) {
    const total = Math.max(0, Math.round(num(xp)));
    const level = levelFor(total);
    const from = xpForLevel(level), to = xpForLevel(level + 1);
    return { level, xp: total, from, to, progress: Math.min(1, (total - from) / (to - from)), missing: to - total };
  }

  // ---------- Emotes ----------
  const minXpFor = e => { const item = EMOTES.find(x => x.e === e); return item ? xpForLevel(item.level) : 0; };
  function unlockedEmotes(xp) { const level = levelFor(xp); return EMOTES.filter(x => x.level <= level).map(x => x.e); }
  /** Tabelle für Firebase (emotes/<emoji> = nötige XP) */
  function emoteTable() { return Object.fromEntries(EMOTES.map(x => [x.e, xpForLevel(x.level)])); }

  // ---------- Abzeichen neben dem Namen ----------
  function badge(player) {
    if (!player?.account) return '';
    const level = levelFor(player.xp);
    const esc = window.SchmobinApp?.escapeHTML || (v => String(v));
    return ` <span class="level-badge" title="Stufe ${esc(level)}">⭐${esc(level)}</span>`;
  }

  // ---------- Ergebnis eines Spiels ----------
  /** Firebase-taugliche Schlüssel für Themen (keine . # $ [ ] /) */
  function topicKey(value) { return String(value || 'Ohne Thema').replace(/[.#$[\]/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Ohne Thema'; }
  /** Schlüssel für ein Quiz (modStats) */
  function quizKey(quiz) { return String(quiz?.id || quiz?.title || 'quiz').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'quiz'; }

  function questionsOf(state) {
    const quiz = state?.quiz?.quiz || state?.quiz || {};
    return (quiz.rounds || []).flatMap(round => round.questions || []);
  }
  function highlightIds(cards) {
    const counts = {};
    const list = Array.isArray(cards) ? cards : (cards && typeof cards === 'object' ? Object.values(cards) : []);
    list.forEach(card => {
      const ids = Array.isArray(card?.ids) ? card.ids : Object.values(card?.ids || {});
      ids.forEach(id => { counts[id] = counts[id] || []; counts[id].push(String(card.icon || '⭐')); });
    });
    return counts;
  }

  /**
   * Rechnet für jeden Spieler das Ergebnis aus.
   * → { eligible, reason, questions, players: { <id>: record } }
   * record: { rank, players, score, questions, answered, correct, xp, parts, hl, byType, byTopic }
   */
  function gameResults(state, options = {}) {
    const players = (state?.players || []).filter(p => p && p.id !== options.ownerUid);
    const scored = new Set(state?.scoredQuestionIds || []);
    const questions = questionsOf(state).filter(q => scored.has(q.id));
    const eligible = players.length >= RULES.MIN_PLAYERS && questions.length >= RULES.MIN_QUESTIONS;
    const reason = eligible ? '' : players.length < RULES.MIN_PLAYERS
      ? `XP gibt es erst ab ${RULES.MIN_PLAYERS} Spielern.`
      : `XP gibt es erst ab ${RULES.MIN_QUESTIONS} gewerteten Fragen.`;
    const hl = highlightIds(state?.highlights);
    const out = {};
    players.forEach(p => {
      const rank = 1 + players.filter(o => num(o.score) > num(p.score)).length;
      const rec = { rank, players: players.length, score: Math.round(num(p.score)), questions: questions.length, answered: 0, correct: 0, byType: {}, byTopic: {}, hl: hl[p.id] || [] };
      questions.forEach(q => {
        const answer = state.answers?.[q.id]?.[p.id];
        if (!answer) return;
        const hit = num(answer.awardedPoints) > 0;
        rec.answered += 1; if (hit) rec.correct += 1;
        [[rec.byType, String(q.type || 'unbekannt')], [rec.byTopic, topicKey(q.category)]].forEach(([map, key]) => {
          map[key] = map[key] || { a: 0, c: 0 };
          map[key].a += 1; if (hit) map[key].c += 1;
        });
      });
      const parts = {
        play: rec.answered * 2 >= questions.length && rec.answered > 0 ? RULES.PLAY : 0,
        correct: rec.correct * RULES.PER_CORRECT,
        place: rec.rank <= 3 && rec.score > 0 ? RULES.PLACES[rec.rank - 1] : 0,
        highlights: rec.hl.length * RULES.PER_HIGHLIGHT
      };
      rec.parts = parts;
      rec.xp = eligible ? Math.min(RULES.GAME_CAP, parts.play + parts.correct + parts.place + parts.highlights) : 0;
      out[p.id] = rec;
    });
    return { eligible, reason, questions: questions.length, players: out };
  }

  /**
   * Tageslimit anwenden. prev = bisheriger XP-Stand { total, day, dayXp } oder null.
   * → { grant, node: { total, day, dayXp, lastRoom } }
   */
  function applyDayCap(prev, gain, now, room) {
    const sameDay = Boolean(prev && Number.isFinite(Number(prev.day)) && now - Number(prev.day) < RULES.DAY_MS);
    const before = sameDay ? Math.max(0, num(prev.dayXp)) : 0;
    const grant = Math.max(0, Math.min(Math.round(num(gain)), RULES.DAY_CAP - before));
    return { grant, node: { total: Math.round(num(prev?.total)) + grant, day: sameDay ? Number(prev.day) : Math.round(now), dayXp: before + grant, lastRoom: String(room || '') } };
  }

  /** Moderator-Statistik: pro Frage { n: beantwortet, c: richtig, t: Text, type } */
  function questionStats(state, options = {}) {
    const scored = new Set(state?.scoredQuestionIds || []);
    const ids = new Set((state?.players || []).filter(p => p.id !== options.ownerUid).map(p => p.id));
    const out = {};
    questionsOf(state).filter(q => scored.has(q.id)).forEach(q => {
      const answers = Object.entries(state.answers?.[q.id] || {}).filter(([pid]) => ids.has(pid));
      out[q.id] = { n: answers.length, c: answers.filter(([, a]) => num(a?.awardedPoints) > 0).length, t: String(q.text || q.id).replace(/\s+/g, ' ').trim().slice(0, 160), type: String(q.type || '') };
    });
    return out;
  }
  /** Bisherige Moderator-Statistik eines Quiz mit einem neuen Spiel zusammenführen */
  function mergeQuestionStats(previous, title, stats) {
    const next = { title: String(title || 'Quiz').slice(0, 160), games: num(previous?.games) + 1, q: Object.assign({}, previous?.q || {}) };
    Object.entries(stats).forEach(([id, s]) => {
      const old = next.q[id] || { n: 0, c: 0 };
      next.q[id] = { n: num(old.n) + s.n, c: num(old.c) + s.c, t: s.t, type: s.type };
    });
    return next;
  }
  /** Schwerste Fragen zuerst (niedrigste Trefferquote, mindestens minAnswers Antworten) */
  function hardestQuestions(quizStats, minAnswers = 1) {
    return Object.entries(quizStats?.q || {})
      .map(([id, s]) => ({ id, n: num(s.n), c: num(s.c), t: s.t || id, type: s.type || '', rate: num(s.n) ? num(s.c) / num(s.n) : 0 }))
      .filter(s => s.n >= minAnswers)
      .sort((a, b) => a.rate - b.rate || b.n - a.n);
  }

  // ---------- Spieler-Statistik aus allen gespeicherten Spielen ----------
  function playerStats(games) {
    const list = Object.entries(games || {}).map(([code, g]) => Object.assign({ code }, g)).sort((a, b) => num(b.at) - num(a.at));
    const sum = { games: list.length, wins: 0, podiums: 0, answered: 0, correct: 0, xp: 0, byType: {}, byTopic: {}, recent: list.slice(0, 10) };
    list.forEach(g => {
      if (num(g.rank) === 1) sum.wins += 1;
      if (num(g.rank) <= 3) sum.podiums += 1;
      sum.answered += num(g.answered); sum.correct += num(g.correct); sum.xp += num(g.xp);
      [['byType', g.byType], ['byTopic', g.byTopic]].forEach(([key, map]) => Object.entries(map || {}).forEach(([k, v]) => {
        const t = sum[key][k] = sum[key][k] || { a: 0, c: 0 };
        t.a += num(v?.a); t.c += num(v?.c);
      }));
    });
    sum.rate = sum.answered ? sum.correct / sum.answered : 0;
    return sum;
  }

  window.SylasphereProgress = {
    RULES, EMOTES, xpForLevel, levelFor, levelInfo, unlockedEmotes, minXpFor, emoteTable, badge,
    topicKey, quizKey, gameResults, applyDayCap, questionStats, mergeQuestionStats, hardestQuestions, playerStats
  };
})();
