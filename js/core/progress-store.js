(function () {
  'use strict';

  /*
   * XP & Statistiken in Firebase (v28)
   * ------------------------------------------------------------------
   * Pfade (Regeln in firebase-database.rules.json, Beschreibung in FIREBASE_SETUP.md):
   *   players/<uid>/profile          { name, board }        – der Spieler selbst (board = in der Bestenliste zeigen)
   *   players/<uid>/games/<Raum>     Ergebnis eines Spiels  – nur der Besitzer des Raums, nur einmal
   *   players/<uid>/xp               { total, day, dayXp, lastRoom } – der Raumbesitzer, zusammen mit games/<Raum>
   *   leaderboard/<uid>              { name, xp }           – der Spieler selbst (nur mit Opt-in)
   *   modStats/<uid>/<Quiz>          { title, games, q: { <Frage>: { n, c, t, type } } } – der Moderator selbst
   *   userRooms/<uid>/<Raum>         createdAt              – eigene Räume zum Aufräumen
   *   emotes/<Emoji>                 nötige XP              – der Admin (admin.html)
   * Rechenlogik: js/core/progress.js
   */
  const Progress = () => window.SylasphereProgress;
  const Firebase = () => window.JHQuizFirebase;
  const ROOM_MAX_AGE_OWN = 24 * 3600 * 1000;
  const ROOM_MAX_AGE_ALL = 48 * 3600 * 1000;
  const clean = value => JSON.parse(JSON.stringify(value));

  const dbOf = context => context.modules.database;
  const refOf = (context, path) => dbOf(context).ref(context.db, path);
  async function read(context, path) {
    try { return (await dbOf(context).get(refOf(context, path))).val(); }
    catch (_) { return null; }
  }
  const isAccount = context => Boolean(context?.auth?.currentUser && !context.auth.currentUser.isAnonymous);

  // ---------- Spielende (Moderator-Gerät, online) ----------
  /**
   * Ergebnisse eines beendeten Online-Spiels speichern. Mehrfacher Aufruf ist harmlos:
   * bereits gespeicherte Spieler stehen in rooms/<Raum>/host/results.
   * → { eligible, reason, saved: [{ id, name, xp }], skipped, errors }
   */
  async function saveGame(engine, state) {
    const context = engine.context;
    const dbm = dbOf(context);
    const code = engine.code;
    const ownerUid = engine.userId;
    const highlights = state.highlights || window.SylasphereHighlights?.compute(state) || [];
    const results = Progress().gameResults(Object.assign({}, state, { highlights }), { ownerUid });
    const done = (await read(context, `rooms/${code}/host/results`)) || {};
    const quiz = state.quiz?.quiz || {};
    const summary = { eligible: results.eligible, reason: results.reason, saved: [], skipped: 0, errors: 0 };
    if (!results.questions) return Object.assign(summary, { reason: 'Keine Frage gewertet – es wurde nichts gespeichert.' });

    for (const player of state.players || []) {
      const rec = results.players[player.id];
      if (!rec) continue;
      if (!player.account) { summary.skipped += 1; continue; } // Gast
      if (done[player.id] != null) { summary.saved.push({ id: player.id, name: player.name, xp: Math.max(0, Number(done[player.id]) || 0) }); continue; }
      let granted = -1;
      for (let attempt = 0; attempt < 2 && granted < 0; attempt++) {
        try {
          const prev = await read(context, `players/${player.id}/xp`);
          const now = Firebase().serverNow(context);
          const cap = Progress().applyDayCap(prev, rec.xp, now, code);
          const record = {
            at: Math.round(now), quizId: Progress().quizKey(quiz), quizTitle: String(quiz.title || 'Quiz').slice(0, 160),
            rank: rec.rank, players: rec.players, score: rec.score, questions: rec.questions, answered: rec.answered, correct: rec.correct,
            xp: cap.grant, xpEarned: rec.xp, parts: rec.parts, hl: rec.hl, byType: rec.byType, byTopic: rec.byTopic
          };
          const updates = { [`players/${player.id}/games/${code}`]: clean(record) };
          if (cap.grant > 0) updates[`players/${player.id}/xp`] = cap.node;
          await dbm.update(refOf(context, '/'), updates);
          granted = cap.grant;
        } catch (error) {
          if (attempt === 1) { console.warn('XP konnten nicht gespeichert werden', player.name, error); summary.errors += 1; }
        }
      }
      if (granted < 0) continue; // beim nächsten Aufruf erneut versuchen
      try { await dbm.set(refOf(context, `rooms/${code}/host/results/${player.id}`), granted); } catch (_) {}
      summary.saved.push({ id: player.id, name: player.name, xp: granted });
    }

    // Moderator-Statistik (schwerste Fragen) – nur einmal pro Raum und nur mit Konto
    if (isAccount(context) && !(await read(context, `rooms/${code}/host/modStatsSaved`))) {
      try {
        const key = Progress().quizKey(quiz);
        const previous = await read(context, `modStats/${ownerUid}/${key}`);
        const merged = Progress().mergeQuestionStats(previous, quiz.title, Progress().questionStats(state, { ownerUid }));
        await dbm.update(refOf(context, '/'), { [`modStats/${ownerUid}/${key}`]: clean(merged), [`rooms/${code}/host/modStatsSaved`]: true });
      } catch (error) { console.warn('Moderator-Statistik nicht gespeichert', error); }
    }
    return summary;
  }

  // ---------- Spieler ----------
  const readXp = (context, uid) => read(context, `players/${uid}/xp`);

  /** Live: eigener XP-Stand und (optional) das Ergebnis eines Raums. cb({ xp, game }) */
  function watchPlayer(context, uid, code, cb) {
    const dbm = dbOf(context);
    const data = { xp: null, game: null };
    const offs = [dbm.onValue(refOf(context, `players/${uid}/xp`), snap => { data.xp = snap.val(); cb(Object.assign({}, data)); }, () => {})];
    if (code) offs.push(dbm.onValue(refOf(context, `players/${uid}/games/${code}`), snap => { data.game = snap.val(); cb(Object.assign({}, data)); }, () => {}));
    return () => offs.forEach(off => { try { off(); } catch (_) {} });
  }

  async function loadProfile(context, uid) {
    const [profile, xp, games] = await Promise.all([read(context, `players/${uid}/profile`), readXp(context, uid), read(context, `players/${uid}/games`)]);
    return { profile: profile || null, xp: xp || null, games: games || {} };
  }

  /** Spielername + Opt-in für die Bestenliste speichern */
  async function saveProfile(context, uid, { name, board }) {
    await dbOf(context).set(refOf(context, `players/${uid}/profile`), { name: String(name || '').trim().slice(0, 28) || 'Spieler', board: Boolean(board) });
    return syncLeaderboard(context, uid);
  }

  /** Eintrag in der Bestenliste an den aktuellen XP-Stand angleichen (oder entfernen) */
  async function syncLeaderboard(context, uid) {
    if (!isAccount(context)) return false;
    const [profile, xp, entry] = await Promise.all([read(context, `players/${uid}/profile`), readXp(context, uid), read(context, `leaderboard/${uid}`)]);
    const total = xp ? Number(xp.total) : null;
    try {
      if (!profile?.board || total == null) { if (entry) await dbOf(context).remove(refOf(context, `leaderboard/${uid}`)); return false; }
      if (entry?.xp === total && entry?.name === profile.name) return true;
      await dbOf(context).set(refOf(context, `leaderboard/${uid}`), { name: String(profile.name).slice(0, 28), xp: total });
      return true;
    } catch (error) { console.warn('Bestenliste nicht aktualisiert', error); return false; }
  }

  async function leaderboard(context, limit = 50) {
    const dbm = dbOf(context);
    const snap = await dbm.get(dbm.query(refOf(context, 'leaderboard'), dbm.orderByChild('xp'), dbm.limitToLast(limit)));
    return Object.entries(snap.val() || {}).map(([uid, e]) => ({ uid, name: String(e?.name || 'Spieler'), xp: Number(e?.xp) || 0 })).sort((a, b) => b.xp - a.xp);
  }

  const loadModStats = (context, uid) => read(context, `modStats/${uid}`).then(v => v || {});

  // ---------- Räume aufräumen ----------
  /** Eigenen Raum merken und eigene Räume löschen, die älter als 24 h sind (außer dem aktuellen). */
  async function rememberRoom(context, code, createdAt) {
    const uid = context.auth.currentUser?.uid;
    if (!uid) return 0;
    const dbm = dbOf(context);
    try { await dbm.set(refOf(context, `userRooms/${uid}/${code}`), Math.round(Number(createdAt) || Firebase().serverNow(context))); } catch (_) { return 0; }
    const rooms = (await read(context, `userRooms/${uid}`)) || {};
    const cutoff = Firebase().serverNow(context) - ROOM_MAX_AGE_OWN;
    let removed = 0;
    for (const [other, at] of Object.entries(rooms)) {
      if (other === code || Number(at) > cutoff) continue;
      try {
        await dbm.remove(refOf(context, `rooms/${other}`));
        await dbm.remove(refOf(context, `userRooms/${uid}/${other}`));
        removed += 1;
      } catch (error) { console.warn('Alter Raum nicht gelöscht', other, error); }
    }
    return removed;
  }

  /** Admin: alle Räume löschen, die älter als 2 Tage sind. → { checked, removed } */
  async function cleanupAllRooms(context, maxAge = ROOM_MAX_AGE_ALL) {
    const dbm = dbOf(context);
    let codes = [];
    try {
      // Nur die Raumcodes laden (shallow), nicht die kompletten Räume
      const token = await context.auth.currentUser.getIdToken();
      const url = `${Firebase().config.databaseURL}/rooms.json?shallow=true&auth=${encodeURIComponent(token)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      codes = Object.keys((await response.json()) || {});
    } catch (error) {
      console.warn('Shallow-Abfrage fehlgeschlagen, lade Raumliste komplett', error);
      codes = Object.keys((await dbm.get(refOf(context, 'rooms'))).val() || {});
    }
    const cutoff = Firebase().serverNow(context) - maxAge;
    let removed = 0;
    for (const code of codes) {
      const meta = await read(context, `rooms/${code}/meta`);
      if (meta && Number(meta.createdAt) > cutoff) continue;
      try { await dbm.remove(refOf(context, `rooms/${code}`)); removed += 1; }
      catch (error) { console.warn('Raum nicht gelöscht', code, error); }
    }
    return { checked: codes.length, removed };
  }

  /** Admin: Emote-Liste (nötige XP) für die Firebase-Regeln schreiben */
  async function syncEmotes(context) {
    const table = Progress().emoteTable();
    const current = (await read(context, 'emotes')) || {};
    const same = Object.keys(current).length === Object.keys(table).length && Object.entries(table).every(([e, xp]) => current[e] === xp);
    if (same) return false;
    await dbOf(context).set(refOf(context, 'emotes'), table);
    return true;
  }

  window.SylasphereProgressStore = {
    saveGame, readXp, watchPlayer, loadProfile, saveProfile, syncLeaderboard, leaderboard, loadModStats,
    rememberRoom, cleanupAllRooms, syncEmotes, ROOM_MAX_AGE_OWN, ROOM_MAX_AGE_ALL
  };
})();
