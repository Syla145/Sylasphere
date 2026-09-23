(function () {
  'use strict';

  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Firebase = window.JHQuizFirebase;
  const LAST_ONLINE_SESSION_KEY = 'jhquiz:last-online-session';

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clean(value) { return JSON.parse(JSON.stringify(value)); }
  function roomCode(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
  function playerSort(a, b) { return (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0); }
  function assertOnlineSafeIds(normalized) {
    const invalid = Quiz.allQuestions(normalized)
      .map(({ question }) => String(question.id || ''))
      .filter(id => /[.#$\[\]\/]/.test(id));
    if (invalid.length) {
      throw new Error(`Online-Modus: Fragen-IDs dürfen keine Zeichen . # $ [ ] / enthalten. Bitte ID „${invalid[0]}“ im Editor anpassen.`);
    }
  }

  function previewQuestion(question) {
    return {
      id: String(question.id),
      type: String(question.type),
      category: String(question.category || ''),
      points: Number(question.points) || 0,
      timer: Number(question.timer) || 0
    };
  }

  function makeOutline(normalized) {
    const q = normalized.quiz;
    return {
      id: q.id,
      title: q.title,
      description: q.description || '',
      settings: clone(q.settings || {}),
      categories: clone(q.categories || []),
      rounds: q.rounds.map(round => ({
        id: round.id,
        title: round.title,
        pointsMultiplier: Number(round.pointsMultiplier),
        questions: round.questions.map(previewQuestion)
      }))
    };
  }

  // Lösungsfelder vor Spielern verstecken – Details regelt jedes Fragetyp-Modul (hideSolution)
  function publicQuestion(question, reveal = false) { return Quiz.publicQuestion(question, reveal); }

  function initialBuzzerState(question) {
    return {
      kind: 'buzzer',
      mode: String(question?.buzzerMode || 'spoken'),
      status: 'open',
      contenderId: '',
      contenderName: '',
      contenderAnswer: null,
      winnerId: '',
      winnerName: '',
      winnerAnswer: null,
      eliminatedIds: [],
      reopenedCount: 0,
      lastIncorrectId: '',
      lastIncorrectAnswer: null,
      resolvedAt: null
    };
  }

  function answersByQuestion(rawAnswers) {
    const result = {};
    Object.entries(rawAnswers || {}).forEach(([uid, byQuestion]) => {
      Object.entries(byQuestion || {}).forEach(([questionId, record]) => {
        result[questionId] = result[questionId] || {};
        result[questionId][uid] = clone(record);
      });
    });
    return result;
  }

  function aggregateStats(question, answers, questionResult) { return Quiz.aggregateStats(question, answers, questionResult); }

  class OnlineSessionEngine {
    constructor(code, role, context) {
      this.code = roomCode(code);
      this.role = role || 'player';
      this.context = context;
      this.modules = context.modules;
      this.db = context.db;
      this.userId = context.auth.currentUser?.uid || '';
      this.roomRef = this.modules.database.ref(this.db, `rooms/${this.code}`);
      this.listeners = new Set();
      this.unsubscribers = [];
      this.cachedState = null;
      this.raw = { meta: null, public: null, outline: null, profiles: {}, scores: {}, answers: {}, buzzerClaims: {}, buzzerBlocked: {}, hostQuiz: null };
      this.playerDisconnect = null;
      this.destroyed = false;
    }

    static generateCode() {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const arr = new Uint32Array(6);
      if (window.crypto?.getRandomValues) window.crypto.getRandomValues(arr);
      else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
      return Array.from(arr, n => alphabet[n % alphabet.length]).join('');
    }

    static lastCode() { return localStorage.getItem(LAST_ONLINE_SESSION_KEY) || ''; }

    static async create(quizInput) {
      const context = await Firebase.ready('moderator');
      const normalized = Quiz.normalizeQuiz(quizInput);
      assertOnlineSafeIds(normalized);
      const dbm = context.modules.database;
      const uid = context.auth.currentUser.uid;
      let code = '';
      let claimed = false;
      for (let attempt = 0; attempt < 24 && !claimed; attempt++) {
        code = OnlineSessionEngine.generateCode();
        const metaRef = dbm.ref(context.db, `rooms/${code}/meta`);
        const now = Firebase.serverNow(context);
        const tx = await dbm.runTransaction(metaRef, current => {
          if (current != null) return;
          return {
            ownerUid: uid,
            createdAt: now,
            updatedAt: now,
            status: 'lobby',
            quizTitle: normalized.quiz.title,
            appVersion: App.version,
            schemaVersion: 1
          };
        }, { applyLocally: false });
        claimed = tx.committed;
      }
      if (!claimed) throw new Error('Es konnte kein freier Raumcode erzeugt werden. Bitte erneut versuchen.');

      const now = Firebase.serverNow(context);
      const outline = makeOutline(normalized);
      const initialPublic = {
        status: 'lobby',
        currentRoundIndex: 0,
        currentQuestionIndex: 0,
        questionOpen: false,
        questionStartedAt: null,
        questionEndsAt: null,
        currentQuestionId: outline.rounds[0]?.questions[0]?.id || '',
        currentQuestion: null,
        questionResult: null,
        publicStats: null,
        scoreDeltas: null,
        resolved: {},
        roundSummaries: [],
        finishedAt: null,
        updatedAt: now
      };

      try {
        await dbm.update(dbm.ref(context.db, `rooms/${code}`), {
          outline: clean(outline),
          public: clean(initialPublic),
          [`host/quiz`]: clean(normalized),
          [`host/createdBy`]: uid
        });
      } catch (error) {
        // The multi-location update above is atomic. If it fails, only the previously
        // claimed meta node can exist. Remove that owner-controlled node rather than
        // relying on a broad parent delete that our production rules intentionally deny.
        try { await dbm.remove(dbm.ref(context.db, `rooms/${code}/meta`)); } catch (_) {}
        throw error;
      }

      localStorage.setItem(LAST_ONLINE_SESSION_KEY, code);
      const engine = new OnlineSessionEngine(code, 'moderator', context);
      await engine.attach();
      return engine;
    }

    static async connect(code, role = 'player') {
      const normalizedCode = roomCode(code);
      if (normalizedCode.length !== 6) throw new Error('Bitte einen gültigen 6-stelligen Raumcode eingeben.');
      const context = await Firebase.ready(role);
      const dbm = context.modules.database;
      const metaSnap = await dbm.get(dbm.ref(context.db, `rooms/${normalizedCode}/meta`));
      if (!metaSnap.exists()) throw new Error('Online-Sitzung nicht gefunden.');
      const meta = metaSnap.val();
      if (role === 'moderator' && meta.ownerUid !== context.auth.currentUser.uid) {
        throw new Error('Diese Online-Sitzung gehört zu einer anderen Moderator-Identität. Öffne sie im ursprünglichen Moderator-Browser.');
      }
      const engine = new OnlineSessionEngine(normalizedCode, role, context);
      engine.raw.meta = meta;
      await engine.attach();
      if (role === 'moderator') localStorage.setItem(LAST_ONLINE_SESSION_KEY, normalizedCode);
      return engine;
    }

    static async exists(code, role = 'player') {
      try {
        const context = await Firebase.ready(role);
        const snap = await context.modules.database.get(context.modules.database.ref(context.db, `rooms/${roomCode(code)}/meta`));
        return snap.exists();
      } catch (_) { return false; }
    }

    async rotatePlayerIdentity() {
      if (this.role !== 'player') return this.userId;
      const user = await Firebase.rotateAnonymous('player');
      this.userId = user.uid;
      return this.userId;
    }

    async attach() {
      const dbm = this.modules.database;
      const watch = (path, key) => {
        const ref = dbm.ref(this.db, `rooms/${this.code}/${path}`);
        const off = dbm.onValue(ref, snapshot => {
          this.raw[key] = snapshot.val();
          this.rebuild();
        }, error => {
          if (!this.destroyed) console.error(`Firebase listener ${path}:`, error);
        });
        this.unsubscribers.push(off);
      };
      watch('meta', 'meta');
      watch('public', 'public');
      watch('outline', 'outline');
      watch('profiles', 'profiles');
      watch('scores', 'scores');
      watch('buzzerClaims', 'buzzerClaims');
      watch('buzzerBlocked', 'buzzerBlocked');
      try {
        const connectionRef = dbm.ref(this.db, '.info/connected');
        const offConnection = dbm.onValue(connectionRef, snapshot => {
          this.context.connected = snapshot.val() === true;
          this.rebuild();
        });
        this.unsubscribers.push(offConnection);
      } catch (_) {}
      if (this.role === 'moderator') {
        watch('answers', 'answers');
        watch('host/quiz', 'hostQuiz');
      } else if (this.role === 'player') {
        watch(`answers/${this.userId}`, 'answers');
      }
      // Give first onValue callbacks a chance to populate state before returning.
      await new Promise(resolve => setTimeout(resolve, 0));
      return this;
    }

    rebuild() {
      if (!this.raw.meta || !this.raw.public || !this.raw.outline) return;
      if (this.role === 'moderator' && !this.raw.hostQuiz) return;
      const pub = this.raw.public || {};
      const profiles = this.raw.profiles || {};
      const scores = this.raw.scores || {};
      const players = Object.entries(profiles).map(([id, profile]) => ({
        id,
        name: String(profile?.name || 'Spieler'),
        avatar: String(profile?.avatar || '🦊'),
        joinedAt: Number(profile?.joinedAt) || 0,
        active: profile?.active !== false,
        score: Math.round(Number(scores[id]) || 0),
        lastAnsweredQuestionId: String(profile?.lastAnsweredQuestionId || '')
      })).sort(playerSort);

      let answers = {};
      if (this.role === 'moderator') answers = answersByQuestion(this.raw.answers || {});
      else if (this.role === 'player') {
        const byQuestion = this.raw.answers || {};
        Object.entries(byQuestion).forEach(([qid, record]) => {
          answers[qid] = answers[qid] || {};
          answers[qid][this.userId] = clone(record);
        });
      }

      const currentQuestionId = String(pub.currentQuestionId || '');
      if (this.role === 'spectator' && currentQuestionId) {
        answers[currentQuestionId] = answers[currentQuestionId] || {};
        players.forEach(player => {
          if (player.lastAnsweredQuestionId === currentQuestionId) answers[currentQuestionId][player.id] = { submittedAt: 1 };
        });
      }
      if (pub.scoreDeltas && currentQuestionId) {
        answers[currentQuestionId] = answers[currentQuestionId] || {};
        Object.entries(pub.scoreDeltas).forEach(([uid, points]) => {
          answers[currentQuestionId][uid] = Object.assign({}, answers[currentQuestionId][uid] || {}, { awardedPoints: Number(points) || 0 });
        });
      }

      const resolved = pub.resolved && typeof pub.resolved === 'object' ? Object.keys(pub.resolved).filter(id => pub.resolved[id]) : [];
      const questionResults = {};
      if (currentQuestionId && pub.questionResult) questionResults[currentQuestionId] = clone(pub.questionResult);
      const outlineQuestion = this.raw.outline?.rounds?.[Math.max(0, Number(pub.currentRoundIndex) || 0)]?.questions?.[Math.max(0, Number(pub.currentQuestionIndex) || 0)] || null;
      const currentType = pub.currentQuestion?.type || outlineQuestion?.type || '';
      if (currentQuestionId && currentType === 'buzzer' && !resolved.includes(currentQuestionId)) {
        const claim = this.raw.buzzerClaims?.[currentQuestionId] || null;
        const blockedRaw = this.raw.buzzerBlocked?.[currentQuestionId] || {};
        const eliminatedIds = Object.entries(blockedRaw).filter(([, value]) => value === true).map(([uid]) => uid);
        const contenderId = String(claim?.contenderId || '');
        const remaining = players.filter(player => !eliminatedIds.includes(player.id));
        const synthesized = {
          kind: 'buzzer',
          mode: String(pub.currentQuestion?.buzzerMode || 'spoken'),
          status: contenderId ? 'locked' : (remaining.length ? 'open' : 'exhausted'),
          contenderId,
          contenderName: contenderId ? String(profiles[contenderId]?.name || 'Spieler') : '',
          contenderAnswer: this.role === 'moderator' && contenderId ? clone(answers[currentQuestionId]?.[contenderId]?.answer ?? null) : null,
          eliminatedIds,
          reopenedCount: eliminatedIds.length
        };
        questionResults[currentQuestionId] = synthesized;
      }
      const rawQuiz = this.role === 'moderator' ? this.raw.hostQuiz : { quiz: clone(this.raw.outline) };
      const state = {
        version: 4,
        transport: 'online',
        online: true,
        onlineConnected: Boolean(this.context.connected),
        code: this.code,
        createdAt: Number(this.raw.meta.createdAt) || 0,
        updatedAt: Number(pub.updatedAt || this.raw.meta.updatedAt) || 0,
        status: String(pub.status || this.raw.meta.status || 'lobby'),
        quiz: rawQuiz,
        players,
        currentRoundIndex: Math.max(0, Number(pub.currentRoundIndex) || 0),
        currentQuestionIndex: Math.max(0, Number(pub.currentQuestionIndex) || 0),
        questionOpen: Boolean(pub.questionOpen),
        questionStartedAt: pub.questionStartedAt == null ? null : Firebase.toLocalTime(this.context, pub.questionStartedAt),
        questionEndsAt: pub.questionEndsAt == null ? null : Firebase.toLocalTime(this.context, pub.questionEndsAt),
        currentPublicQuestion: pub.currentQuestion ? clone(pub.currentQuestion) : null,
        stage: Math.max(0, Number(pub.stage) || 0),
        media: pub.media ? Object.assign(clone(pub.media), { at: Firebase.toLocalTime(this.context, pub.media.at) }) : null,
        answers,
        questionResults,
        scoredQuestionIds: resolved,
        roundSummaries: Array.isArray(pub.roundSummaries) ? clone(pub.roundSummaries) : [],
        finishedAt: pub.finishedAt == null ? null : Firebase.toLocalTime(this.context, pub.finishedAt),
        publicStats: pub.publicStats ? clone(pub.publicStats) : null,
        scoreDeltas: pub.scoreDeltas ? clone(pub.scoreDeltas) : null
      };
      this.cachedState = state;
      this.emit(state);
    }

    load() { return this.cachedState; }

    subscribe(callback) {
      this.listeners.add(callback);
      if (this.cachedState) callback(this.cachedState);
      return () => this.listeners.delete(callback);
    }

    waitForState(timeout = 8000) {
      if (this.cachedState) return Promise.resolve(this.cachedState);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { off(); reject(new Error('Online-Sitzung konnte nicht rechtzeitig geladen werden.')); }, timeout);
        const off = this.subscribe(state => { clearTimeout(timer); off(); resolve(state); });
      });
    }

    emit(state) {
      this.listeners.forEach(callback => {
        try { callback(state); } catch (error) { console.error(error); }
      });
    }

    getCurrent(state = this.cachedState) {
      const quiz = state?.quiz?.quiz;
      const round = quiz?.rounds?.[state.currentRoundIndex];
      let question = round?.questions?.[state.currentQuestionIndex];
      if (this.role !== 'moderator' && state?.currentPublicQuestion && (!question || state.currentPublicQuestion.id === question.id)) {
        question = state.currentPublicQuestion;
      }
      return { quiz, round, question };
    }

    async joinPlayer(name, avatar = '🦊') {
      if (this.role !== 'player') throw new Error('Nur die Spieleransicht kann einem Raum beitreten.');
      const cleanName = String(name || '').trim().slice(0, 28);
      if (!cleanName) throw new Error('Bitte einen Spielernamen eingeben.');
      const dbm = this.modules.database;
      // Read the current profiles once before joining. This avoids a race where the
      // realtime listener has delivered the room but not yet the profiles snapshot.
      const profilesSnap = await dbm.get(dbm.ref(this.db, `rooms/${this.code}/profiles`));
      const profiles = profilesSnap.val() || {};
      const used = new Set(Object.entries(profiles)
        .filter(([uid]) => uid !== this.userId)
        .map(([, profile]) => String(profile?.name || '').toLocaleLowerCase('de-DE')));
      let finalName = cleanName;
      if (used.has(finalName.toLocaleLowerCase('de-DE'))) {
        let n = 2;
        while (used.has(`${cleanName} ${n}`.toLocaleLowerCase('de-DE'))) n += 1;
        finalName = `${cleanName} ${n}`;
      }
      const now = Firebase.serverNow(this.context);
      const profileRef = dbm.ref(this.db, `rooms/${this.code}/profiles/${this.userId}`);
      const existing = profiles[this.userId] || null;
      try {
        this.playerDisconnect = dbm.onDisconnect(profileRef);
        await this.playerDisconnect.update({ active: false, updatedAt: dbm.serverTimestamp() });
      } catch (_) { this.playerDisconnect = null; }
      try {
        await dbm.set(profileRef, {
          name: finalName,
          avatar: String(avatar || existing?.avatar || '🦊'),
          joinedAt: Number(existing?.joinedAt) || now,
          active: true,
          updatedAt: now,
          lastAnsweredQuestionId: String(existing?.lastAnsweredQuestionId || '')
        });
        await dbm.runTransaction(dbm.ref(this.db, `rooms/${this.code}/scores/${this.userId}`), current => current == null ? 0 : undefined, { applyLocally: false });
      } catch (error) {
        try { await this.playerDisconnect?.cancel(); } catch (_) {}
        this.playerDisconnect = null;
        throw error;
      }
      return this.userId;
    }

    async removePlayer(playerId) {
      this.assertModerator();
      await this.modules.database.update(this.roomRef, {
        [`profiles/${playerId}`]: null,
        [`scores/${playerId}`]: null,
        [`answers/${playerId}`]: null
      });
    }

    assertModerator() {
      if (this.role !== 'moderator') throw new Error('Diese Aktion ist nur für den Moderator verfügbar.');
      if (this.raw.meta?.ownerUid !== this.userId) throw new Error('Moderator-Berechtigung fehlt.');
    }

    async patchPublic(patch) {
      this.assertModerator();
      patch.updatedAt = Firebase.serverNow(this.context);
      await this.modules.database.update(this.modules.database.ref(this.db, `rooms/${this.code}/public`), clean(patch));
    }

    async startGame() {
      await this.patchPublic({
        status: 'playing', currentRoundIndex: 0, currentQuestionIndex: 0,
        questionOpen: false, questionStartedAt: null, questionEndsAt: null,
        currentQuestion: null, questionResult: null, publicStats: null, scoreDeltas: null,
        currentQuestionId: this.raw.hostQuiz?.quiz?.rounds?.[0]?.questions?.[0]?.id || ''
      });
    }

    async startQuestion() {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (!question) throw new Error('Keine Frage verfügbar.');
      if (state.scoredQuestionIds.includes(question.id)) throw new Error('Diese Frage wurde bereits ausgewertet. Bitte zur nächsten Frage wechseln.');
      if (state.questionStartedAt) throw new Error('Diese Frage wurde bereits gestartet. Bitte erst auflösen oder zur nächsten Frage wechseln.');
      const questionTimer = Quiz.hasTimer(question) ? Number(question.timer) : 0;
      const defaultTimer = Number(this.raw.hostQuiz.quiz.settings.defaultTimer);
      const duration = Math.max(0, Number.isFinite(questionTimer) ? questionTimer : (Number.isFinite(defaultTimer) ? defaultTimer : 0));
      const now = Firebase.serverNow(this.context);
      if (question.type === 'buzzer') {
        // Firebase-Regeln erlauben Schreibzugriff auf gesperrte Spieler nur pro Spieler-Eintrag
        // (buzzerBlocked/<frage>/<uid>). Das komplette Löschen von buzzerBlocked/<frage>
        // führte zu PERMISSION_DENIED – daher jeden Eintrag einzeln zurücksetzen.
        const reset = { [`buzzerClaims/${question.id}`]: null };
        Object.keys(this.raw.buzzerBlocked?.[question.id] || {}).forEach(uid => { reset[`buzzerBlocked/${question.id}/${uid}`] = null; });
        await this.modules.database.update(this.roomRef, reset);
      }
      await this.patchPublic({
        status: 'playing', questionOpen: true, questionStartedAt: now,
        questionEndsAt: duration > 0 ? now + duration * 1000 : null,
        currentQuestionId: question.id,
        currentQuestion: publicQuestion(question, false),
        questionResult: question.type === 'buzzer' ? clean(initialBuzzerState(question)) : null, publicStats: null, scoreDeltas: null,
        // Stufen-Fragen: Stufe 1 aktiv; answerLock = Antwort nach Abgabe gesperrt (von den Firebase-Regeln geprüft)
        stage: 0, media: null, answerLock: Quiz.locksOnSubmit(question)
      });
    }

    // ---------- Stufen & Medien (Song-Enthüllung) ----------
    mediaCommand(question, kind, stage) {
      return { nonce: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, kind, stage: Number(stage) || 0, questionId: question.id, at: Firebase.serverNow(this.context) };
    }
    async playStage() {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (!question || !Quiz.stagesOf(question) || !state.questionStartedAt) throw new Error('Keine laufende Stufen-Frage.');
      await this.patchPublic({ media: this.mediaCommand(question, 'snippet', state.stage) });
    }
    async advanceStage() {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      const stages = Quiz.stagesOf(question);
      if (!question || !stages || !state.questionStartedAt) throw new Error('Keine laufende Stufen-Frage.');
      if (!state.questionOpen) throw new Error('Die Antworten sind bereits geschlossen.');
      const stage = Math.min((Number(state.stage) || 0) + 1, stages.length - 1);
      await this.patchPublic({ stage, media: this.mediaCommand(question, 'snippet', stage) });
    }
    async playReveal() {
      this.assertModerator();
      const { question } = this.getCurrent(this.load());
      if (!question || !Quiz.revealsMedia(question)) return;
      await this.patchPublic({ media: this.mediaCommand(question, 'reveal', 0) });
    }

    async lockQuestion() {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (!question || !state.questionStartedAt || state.scoredQuestionIds.includes(question.id)) return;
      await this.patchPublic({ questionOpen: false, questionEndsAt: null });
    }

    closeQuestion() { return this.lockQuestion(); }

    // options.verdicts: { uid: true|false } – Moderator-Prüfung (z. B. Lückentext)
    async resolveQuestion(options = {}) {
      this.assertModerator();
      const state = this.load();
      const { question, round } = this.getCurrent(state);
      if (!question) throw new Error('Keine Frage verfügbar.');
      if (!state.questionStartedAt) throw new Error('Die Frage wurde noch nicht gestartet.');
      if (state.questionOpen && question.type !== 'buzzer') throw new Error('Bitte zuerst die Antworten schließen.');
      if (question.type === 'buzzer') {
        const buzzerState = state.questionResults?.[question.id] || {};
        if (!buzzerState.contenderId && buzzerState.status !== 'exhausted') throw new Error('Noch kein Buzzer-Ergebnis vorhanden.');
      }
      if (state.scoredQuestionIds.includes(question.id)) return;

      const dbm = this.modules.database;
      const lockRef = dbm.ref(this.db, `rooms/${this.code}/host/resolveLocks/${question.id}`);
      const now = Firebase.serverNow(this.context);
      const lock = await dbm.runTransaction(lockRef, current => current == null ? { at: now, uid: this.userId } : undefined, { applyLocally: false });
      if (!lock.committed) return;

      try {
        const [answersSnap, scoresSnap] = await Promise.all([
          dbm.get(dbm.ref(this.db, `rooms/${this.code}/answers`)),
          dbm.get(dbm.ref(this.db, `rooms/${this.code}/scores`))
        ]);
        const allAnswers = answersByQuestion(answersSnap.val() || {});
        const answers = allAnswers[question.id] || {};
        const scores = scoresSnap.val() || {};
        const roundMultiplier = Number(round?.pointsMultiplier);
        const multiplier = Number.isFinite(roundMultiplier) ? Math.max(0, roundMultiplier) : 1;
        // Typen wie „Gleich gedacht“ berechnen ihr Ergebnis erst aus allen Antworten
        let typeResult = Quiz.isBuzzer(question) ? null : Quiz.resolveResult(question, answers, options);
        const buzzerResult = question.type === 'buzzer' ? clone(state.questionResults?.[question.id] || initialBuzzerState(question)) : null;
        const deltas = {};
        const updates = {};
        const profiles = this.raw.profiles || {};

        if (question.type === 'buzzer') {
          const winnerId = String(buzzerResult?.contenderId || '');
          const winnerProfile = winnerId ? profiles[winnerId] || {} : {};
          // Fehlt der Antwort-Datensatz des Gewinners, wird er komplett (inkl. Wertung) geschrieben.
          // Firebase verbietet in einem update() einen Pfad UND gleichzeitig dessen Unterpfade.
          let createdWinnerRecord = false;
          if (winnerId && !answers[winnerId]) {
            answers[winnerId] = { answer: clone(buzzerResult.contenderAnswer ?? ''), submittedAt: now };
            createdWinnerRecord = true;
          }
          Object.keys(profiles).forEach(uid => {
            const submission = answers[uid];
            if (!submission) return;
            const points = winnerId && uid === winnerId ? Math.round(Math.max(0, Number(question.points) || 0) * Math.max(0, Number(multiplier) || 0)) : 0;
            const scoreDetail = uid === winnerId ? 'Schnellste richtige Antwort' : 'Nicht gewertet';
            deltas[uid] = points;
            if (createdWinnerRecord && uid === winnerId) {
              updates[`answers/${uid}/${question.id}`] = clean(Object.assign({}, submission, { awardedPoints: points, scoreDetail, scoredAt: now }));
            } else {
              updates[`answers/${uid}/${question.id}/awardedPoints`] = points;
              updates[`answers/${uid}/${question.id}/scoreDetail`] = scoreDetail;
              updates[`answers/${uid}/${question.id}/scoredAt`] = now;
            }
            updates[`scores/${uid}`] = Math.round((Number(scores[uid]) || 0) + points);
          });
          buzzerResult.status = 'resolved';
          buzzerResult.winnerId = winnerId;
          buzzerResult.winnerName = String(winnerProfile?.name || '');
          buzzerResult.winnerAnswer = winnerId ? (answers[winnerId]?.answer ?? buzzerResult.contenderAnswer) : null;
          buzzerResult.resolvedAt = now;
        } else {
          Object.keys(profiles).forEach(uid => {
            const submission = answers[uid];
            if (!submission) return;
            const result = Quiz.scoreAnswer(question, submission.answer, multiplier, typeResult, uid);
            deltas[uid] = Math.round(Number(result.points) || 0);
            updates[`answers/${uid}/${question.id}/awardedPoints`] = deltas[uid];
            updates[`answers/${uid}/${question.id}/scoreDetail`] = String(result.detail || '');
            updates[`answers/${uid}/${question.id}/scoredAt`] = now;
            updates[`scores/${uid}`] = Math.round((Number(scores[uid]) || 0) + deltas[uid]);
          });
          if (Quiz.publishesAnswers(question)) {
            // Antworten aller Spieler nach der Auflösung veröffentlichen (Spieler dürfen fremde Antworten sonst nicht lesen)
            const scored = Object.fromEntries(Object.entries(answers).map(([uid, record]) => [uid, Object.assign({}, record, { awardedPoints: deltas[uid] || 0 })]));
            typeResult = Object.assign({}, typeResult || {}, { entries: Quiz.answerEntries(question, scored, uid => profiles[uid]?.name) });
          }
        }

        const statsSource = question.type === 'buzzer' ? buzzerResult : typeResult;
        const statsAnswers = Object.fromEntries(Object.entries(answers).map(([uid, record]) => [uid, Object.assign({}, record, { awardedPoints: deltas[uid] || 0 })]));
        const stats = aggregateStats(question, statsAnswers, statsSource);
        updates[`public/questionOpen`] = false;
        updates[`public/questionEndsAt`] = null;
        updates[`public/currentQuestion`] = clean(publicQuestion(question, true));
        updates[`public/questionResult`] = question.type === 'buzzer' ? clean(buzzerResult) : (typeResult ? clean(typeResult) : null);
        updates[`public/publicStats`] = clean(stats);
        updates[`public/scoreDeltas`] = clean(deltas);
        updates[`public/resolved/${question.id}`] = true;
        if (question.type === 'buzzer') updates[`buzzerClaims/${question.id}`] = null;
        if (Quiz.revealsMedia(question)) updates[`public/media`] = clean(this.mediaCommand(question, 'reveal', 0)); // z. B. Refrain auf allen Geräten
        updates[`public/updatedAt`] = now;
        await dbm.update(this.roomRef, updates);
      } catch (error) {
        try { await dbm.remove(lockRef); } catch (_) {}
        throw error;
      }
    }

    async submitAnswer(playerId, answer) {
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (question?.type === 'buzzer') return this.buzz(playerId, answer);
      if (this.role !== 'player' || String(playerId) !== this.userId) return false;
      if (!state?.questionOpen || !question) return false;
      const rawEndsAt = Number(this.raw.public?.questionEndsAt);
      if (Number.isFinite(rawEndsAt) && rawEndsAt > 0 && Firebase.serverNow(this.context) > rawEndsAt + 500) return false;
      const now = Firebase.serverNow(this.context);
      const dbm = this.modules.database;
      if (Quiz.locksOnSubmit(question) && state.answers?.[question.id]?.[this.userId]) return false; // Antwort ist gesperrt
      let value = clone(answer);
      if (Quiz.stagesOf(question) && value && typeof value === 'object') value.stage = Math.max(0, Number(this.raw.public?.stage) || 0); // Firebase prüft: = aktuelle Stufe
      await dbm.update(this.roomRef, {
        [`answers/${this.userId}/${question.id}`]: clean({ answer: value, submittedAt: now }),
        [`profiles/${this.userId}/lastAnsweredQuestionId`]: question.id,
        [`profiles/${this.userId}/updatedAt`]: now
      });
      return true;
    }

    async buzz(playerId, answer = null) {
      if (this.role !== 'player' || String(playerId) !== this.userId) return false;
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (!state?.questionOpen || !question || question.type !== 'buzzer') return false;
      const currentResult = state.questionResults?.[question.id] || {};
      if (currentResult.status !== 'open' || (currentResult.eliminatedIds || []).includes(this.userId)) return false;
      const dbm = this.modules.database;
      const claimRef = dbm.ref(this.db, `rooms/${this.code}/buzzerClaims/${question.id}`);
      const claimedAt = Firebase.serverNow(this.context);
      const tx = await dbm.runTransaction(claimRef, current => {
        if (current != null) return;
        return { contenderId: this.userId, claimedAt };
      }, { applyLocally: false });
      if (!tx.committed) return false;
      const now = Firebase.serverNow(this.context);
      try {
        // Mündlicher Buzzer hat keine Textantwort. `null` würde Firebase entfernen und die
        // Regel (answer + submittedAt erforderlich) scheitern lassen – daher leerer String.
        await dbm.update(this.roomRef, {
          [`answers/${this.userId}/${question.id}`]: clean({ answer: answer == null ? '' : clone(answer), submittedAt: now }),
          [`profiles/${this.userId}/lastAnsweredQuestionId`]: question.id,
          [`profiles/${this.userId}/updatedAt`]: now
        });
      } catch (error) {
        // The moderator can always release a claimed buzzer. Keep the atomic claim intact
        // rather than risking two simultaneous winners after a partial network failure.
        throw error;
      }
      return true;
    }

    async markBuzzerIncorrect() {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      if (!question || question.type !== 'buzzer' || !state.questionStartedAt) throw new Error('Keine aktive Buzzer-Frage.');
      const result = state.questionResults?.[question.id] || {};
      const contenderId = String(result.contenderId || '');
      if (!contenderId) throw new Error('Noch kein Spieler hat gebuzzert.');
      const remaining = state.players.filter(player => player.id !== contenderId && !(result.eliminatedIds || []).includes(player.id));
      const now = Firebase.serverNow(this.context);
      const updates = {
        [`buzzerBlocked/${question.id}/${contenderId}`]: true,
        [`buzzerClaims/${question.id}`]: null,
        'public/questionOpen': remaining.length > 0,
        'public/questionEndsAt': null,
        'public/updatedAt': now
      };
      const penalty = Math.max(0, Number(question.penalty) || 0);
      if (penalty > 0) {
        const scoreRef = this.modules.database.ref(this.db, `rooms/${this.code}/scores/${contenderId}`);
        await this.modules.database.runTransaction(scoreRef, current => Math.round((Number(current) || 0) - penalty), { applyLocally: true });
      }
      await this.modules.database.update(this.roomRef, updates);
    }

    async setPlayerScore(playerId, score) {
      this.assertModerator();
      await this.modules.database.set(this.modules.database.ref(this.db, `rooms/${this.code}/scores/${playerId}`), Math.round(Number(score) || 0));
    }

    async adjustPlayerScore(playerId, delta) {
      this.assertModerator();
      const ref = this.modules.database.ref(this.db, `rooms/${this.code}/scores/${playerId}`);
      await this.modules.database.runTransaction(ref, current => Math.round((Number(current) || 0) + (Number(delta) || 0)), { applyLocally: true });
    }

    async move(direction = 1) {
      this.assertModerator();
      const state = this.load();
      const { question } = this.getCurrent(state);
      const unresolved = Boolean(question && state.questionStartedAt && !state.scoredQuestionIds.includes(question.id));
      if (unresolved) throw new Error('Bitte die aktuelle Frage zuerst auflösen.');
      const quiz = this.raw.hostQuiz.quiz;
      let ri = state.currentRoundIndex;
      let qi = state.currentQuestionIndex + direction;
      const summaries = Array.isArray(state.roundSummaries) ? clone(state.roundSummaries) : [];
      let status = state.status;
      let finishedAt = state.finishedAt ? state.finishedAt + (Number(this.context.serverOffset) || 0) : null;

      if (direction > 0) {
        while (ri < quiz.rounds.length) {
          if (qi < quiz.rounds[ri].questions.length) break;
          const standings = state.players.slice().sort(playerSort).map(player => ({ id: player.id, name: player.name, score: player.score }));
          if (!summaries.some(summary => summary.roundId === quiz.rounds[ri].id)) summaries.push({ roundId: quiz.rounds[ri].id, title: quiz.rounds[ri].title, standings, at: Firebase.serverNow(this.context) });
          ri += 1; qi = 0;
        }
        if (ri >= quiz.rounds.length) {
          status = 'finished'; finishedAt = Firebase.serverNow(this.context);
          ri = Math.max(0, quiz.rounds.length - 1);
          qi = Math.max(0, quiz.rounds[ri]?.questions.length - 1);
        }
      } else {
        while (ri >= 0 && qi < 0) { ri -= 1; if (ri >= 0) qi = quiz.rounds[ri].questions.length - 1; }
        if (ri < 0) { ri = 0; qi = 0; }
      }
      const nextQuestion = quiz.rounds[ri]?.questions[qi] || null;
      await this.patchPublic({
        status, finishedAt, currentRoundIndex: ri, currentQuestionIndex: qi,
        questionOpen: false, questionStartedAt: null, questionEndsAt: null, stage: 0, media: null, answerLock: false,
        currentQuestionId: nextQuestion?.id || '', currentQuestion: null,
        questionResult: null, publicStats: null, scoreDeltas: null,
        roundSummaries: summaries
      });
    }

    async finish() {
      await this.patchPublic({ status: 'finished', questionOpen: false, questionEndsAt: null, finishedAt: Firebase.serverNow(this.context) });
    }

    async resetScores() {
      this.assertModerator();
      const updates = { 'public/resolved': {}, 'public/roundSummaries': [], 'public/questionResult': null, 'public/publicStats': null, 'public/scoreDeltas': null, 'host/resolveLocks': null };
      Object.keys(this.raw.profiles || {}).forEach(uid => { updates[`scores/${uid}`] = 0; updates[`answers/${uid}`] = null; });
      await this.modules.database.update(this.roomRef, updates);
    }

    async destroy() {
      // On an explicit room switch/leave, mark the player offline immediately.
      // A browser/tab crash is still covered by Firebase onDisconnect().
      if (this.role === 'player' && this.userId && this.raw?.profiles?.[this.userId]) {
        try {
          await this.modules.database.update(
            this.modules.database.ref(this.db, `rooms/${this.code}/profiles/${this.userId}`),
            { active: false, updatedAt: Firebase.serverNow(this.context) }
          );
        } catch (_) {}
      }
      this.destroyed = true;
      this.unsubscribers.forEach(off => { try { off(); } catch (_) {} });
      this.unsubscribers = [];
      this.listeners.clear();
      if (this.playerDisconnect) {
        try { await this.playerDisconnect.cancel(); } catch (_) {}
        this.playerDisconnect = null;
      }
    }
  }

  OnlineSessionEngine._helpers = { makeOutline, publicQuestion, answersByQuestion, aggregateStats };
  window.JHQuizOnlineSession = OnlineSessionEngine;
})();
