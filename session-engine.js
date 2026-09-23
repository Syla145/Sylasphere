(function () {
  'use strict';
  const Quiz = window.SchmobinQuiz;
  const STORAGE_PREFIX = 'schmobin:session:';
  const LAST_SESSION_KEY = 'schmobin:last-session';

  class SessionEngine {
    constructor(code) {
      this.code = String(code || '').toUpperCase();
      this.key = `${STORAGE_PREFIX}${this.code}`;
      this.listeners = new Set();
      this.channel = null;
      this.storageHandler = null;
      this.poll = null;
      this.lastSerialized = '';
      this.attach();
    }
    static generateCode() {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      if (window.crypto?.getRandomValues) {
        const arr = new Uint32Array(6); crypto.getRandomValues(arr);
        for (const n of arr) code += alphabet[n % alphabet.length];
      } else for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      return code;
    }
    static create(quizInput) {
      let code;
      do { code = SessionEngine.generateCode(); } while (localStorage.getItem(`${STORAGE_PREFIX}${code}`));
      const quiz = Quiz.normalizeQuiz(quizInput);
      const now = Date.now();
      const state = {
        version: 3,
        code,
        createdAt: now,
        updatedAt: now,
        status: 'lobby',
        quiz,
        players: [],
        currentRoundIndex: 0,
        currentQuestionIndex: 0,
        questionOpen: false,
        questionStartedAt: null,
        questionEndsAt: null,
        answers: {},
        questionResults: {},
        scoredQuestionIds: [],
        roundSummaries: [],
        finishedAt: null
      };
      localStorage.setItem(`${STORAGE_PREFIX}${code}`, JSON.stringify(state));
      localStorage.setItem(LAST_SESSION_KEY, code);
      return new SessionEngine(code);
    }
    static lastCode() { return localStorage.getItem(LAST_SESSION_KEY) || ''; }
    static exists(code) { return Boolean(localStorage.getItem(`${STORAGE_PREFIX}${String(code || '').toUpperCase()}`)); }
    attach() {
      if (!this.code) return;
      try {
        this.channel = new BroadcastChannel(`schmobin:${this.code}`);
        this.channel.onmessage = event => { if (event.data?.type === 'state') this.emit(event.data.state); else this.emit(this.load()); };
      } catch (_) { this.channel = null; }
      this.storageHandler = event => { if (event.key === this.key) this.emit(this.load()); };
      window.addEventListener('storage', this.storageHandler);
      this.poll = setInterval(() => {
        const raw = localStorage.getItem(this.key) || '';
        if (raw && raw !== this.lastSerialized) this.emit(this.load());
      }, 1200);
    }
    destroy() {
      this.channel?.close();
      if (this.storageHandler) window.removeEventListener('storage', this.storageHandler);
      if (this.poll) clearInterval(this.poll);
      this.listeners.clear();
    }
    ensureState(state) {
      if (!state || typeof state !== 'object') return state;
      state.version = Math.max(Number(state.version) || 1, 3);
      state.players = Array.isArray(state.players) ? state.players : [];
      state.answers = state.answers && typeof state.answers === 'object' ? state.answers : {};
      state.questionResults = state.questionResults && typeof state.questionResults === 'object' ? state.questionResults : {};
      state.scoredQuestionIds = Array.isArray(state.scoredQuestionIds) ? state.scoredQuestionIds : [];
      state.roundSummaries = Array.isArray(state.roundSummaries) ? state.roundSummaries : [];
      return state;
    }
    load() {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      try { this.lastSerialized = raw; return this.ensureState(JSON.parse(raw)); }
      catch (_) { return null; }
    }
    save(state) {
      this.ensureState(state);
      state.updatedAt = Date.now();
      const raw = JSON.stringify(state);
      localStorage.setItem(this.key, raw);
      localStorage.setItem(LAST_SESSION_KEY, this.code);
      this.lastSerialized = raw;
      try { this.channel?.postMessage({ type: 'state', state }); } catch (_) {}
      this.emit(state);
      return state;
    }
    mutate(mutator) {
      const state = this.load();
      if (!state) throw new Error('Sitzung nicht gefunden.');
      mutator(state);
      return this.save(state);
    }
    subscribe(callback) {
      this.listeners.add(callback);
      const state = this.load();
      if (state) callback(state);
      return () => this.listeners.delete(callback);
    }
    emit(state) {
      if (!state) return;
      this.listeners.forEach(fn => { try { fn(state); } catch (error) { console.error(error); } });
    }
    getCurrent(state = this.load()) {
      const quiz = state?.quiz?.quiz;
      const round = quiz?.rounds?.[state.currentRoundIndex];
      const question = round?.questions?.[state.currentQuestionIndex];
      return { quiz, round, question };
    }
    initialBuzzerState(question) {
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
    joinPlayer(name, avatar = '🦊', preferredId = '') {
      const cleanName = String(name || '').trim().slice(0, 28);
      if (!cleanName) throw new Error('Bitte einen Spielernamen eingeben.');
      let playerId = preferredId;
      this.mutate(state => {
        let player = state.players.find(p => p.id === playerId);
        if (!player) {
          const used = new Set(state.players.map(p => p.name.toLocaleLowerCase('de-DE')));
          let finalName = cleanName;
          if (used.has(finalName.toLocaleLowerCase('de-DE'))) {
            let n = 2; while (used.has(`${cleanName} ${n}`.toLocaleLowerCase('de-DE'))) n++;
            finalName = `${cleanName} ${n}`;
          }
          playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          state.players.push({ id: playerId, name: finalName, avatar: String(avatar || '🦊'), score: 0, joinedAt: Date.now(), active: true });
        } else {
          player.name = cleanName;
          player.avatar = String(avatar || player.avatar || '🦊');
          player.active = true;
        }
      });
      return playerId;
    }
    removePlayer(playerId) { this.mutate(state => { state.players = state.players.filter(p => p.id !== playerId); }); }
    startGame() { this.mutate(state => { state.status = 'playing'; state.currentRoundIndex = 0; state.currentQuestionIndex = 0; state.questionOpen = false; state.questionStartedAt = null; state.questionEndsAt = null; }); }
    startQuestion() {
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        if (!question) throw new Error('Keine Frage verfügbar.');
        if (state.scoredQuestionIds?.includes(question.id)) throw new Error('Diese Frage wurde bereits ausgewertet. Bitte zur nächsten Frage wechseln.');
        if (state.questionStartedAt) throw new Error('Diese Frage wurde bereits gestartet. Bitte erst auflösen oder zur nächsten Frage wechseln.');
        const questionTimer = question.type === 'buzzer' ? 0 : Number(question.timer);
        const defaultTimer = Number(state.quiz.quiz.settings.defaultTimer);
        const duration = Math.max(0, Number.isFinite(questionTimer) ? questionTimer : (Number.isFinite(defaultTimer) ? defaultTimer : 0));
        state.status = 'playing';
        state.questionOpen = true;
        state.questionStartedAt = Date.now();
        state.questionEndsAt = duration > 0 ? Date.now() + duration * 1000 : null;
        state.answers[question.id] = state.answers[question.id] || {};
        if (question.type === 'buzzer') state.questionResults[question.id] = this.initialBuzzerState(question);
      });
    }
    lockQuestion() {
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        if (!question || !state.questionStartedAt) return;
        if (state.scoredQuestionIds.includes(question.id)) return;
        state.questionOpen = false;
        state.questionEndsAt = null;
      });
    }
    // Backwards-compatible name: "close" now only closes the answer phase.
    closeQuestion() { return this.lockQuestion(); }
    resolveQuestion() {
      this.mutate(state => {
        const { question, round } = this.getCurrent(state);
        if (!question) return;
        if (!state.questionStartedAt) throw new Error('Die Frage wurde noch nicht gestartet.');
        if (state.questionOpen) throw new Error('Bitte zuerst die Antworten schließen.');
        if (state.scoredQuestionIds.includes(question.id)) return;
        const answers = state.answers[question.id] || {};
        const roundMultiplier = Number(round?.pointsMultiplier);
        const multiplier = Number.isFinite(roundMultiplier) ? Math.max(0, roundMultiplier) : 1;
        let consensusResult = null;
        if (question.type === 'consensus') {
          consensusResult = Quiz.computeConsensusResult(question, answers);
          state.questionResults[question.id] = consensusResult;
        }
        if (question.type === 'buzzer') {
          const result = state.questionResults[question.id] && state.questionResults[question.id].kind === 'buzzer' ? state.questionResults[question.id] : this.initialBuzzerState(question);
          const winnerId = String(result.contenderId || '');
          const winnerPlayer = winnerId ? state.players.find(player => player.id === winnerId) : null;
          if (winnerId && !answers[winnerId]) answers[winnerId] = { answer: Quiz.clone(result.contenderAnswer), submittedAt: Date.now() };
          state.players.forEach(player => {
            const submission = answers[player.id];
            if (!submission) return;
            const points = winnerId && player.id === winnerId ? Math.round(Math.max(0, Number(question.points) || 0) * Math.max(0, Number(multiplier) || 1)) : 0;
            submission.awardedPoints = points;
            submission.scoreDetail = player.id === winnerId ? 'Schnellste richtige Antwort' : 'Nicht gewertet';
            submission.scoredAt = Date.now();
            player.score = Math.round((Number(player.score) || 0) + points);
          });
          result.status = 'resolved';
          result.winnerId = winnerId;
          result.winnerName = winnerPlayer?.name || '';
          result.winnerAnswer = winnerId ? (answers[winnerId]?.answer ?? result.contenderAnswer) : null;
          result.resolvedAt = Date.now();
          state.questionResults[question.id] = result;
        } else {
          state.players.forEach(player => {
            const submission = answers[player.id];
            if (!submission) return;
            let result;
            if (question.type === 'consensus') {
              const won = consensusResult.winningOptionIds.includes(String(submission.answer));
              const points = won ? Math.round(Math.max(0, Number(question.points) || 0) * Math.max(0, Number(multiplier) || 1)) : 0;
              const tie = consensusResult.winningOptionIds.length > 1 ? ' · Gleichstand' : '';
              result = { points, detail: won ? `Mehrheit getroffen · ${consensusResult.maxVotes}/${consensusResult.totalVotes} Stimmen${tie}` : `Nicht in der Mehrheit · ${consensusResult.maxVotes}/${consensusResult.totalVotes} Stimmen${tie}` };
            } else {
              result = Quiz.scoreAnswer(question, submission.answer, multiplier);
            }
            submission.awardedPoints = result.points;
            submission.scoreDetail = result.detail;
            submission.scoredAt = Date.now();
            player.score = Math.round((Number(player.score) || 0) + result.points);
          });
        }
        state.scoredQuestionIds.push(question.id);
      });
    }
    submitAnswer(playerId, answer) {
      const current = this.getCurrent(this.load());
      if (current.question?.type === 'buzzer') return this.buzz(playerId, answer);
      let accepted = false;
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        if (!state.questionOpen || !question) return;
        if (state.questionEndsAt && Date.now() > state.questionEndsAt + 500) return;
        if (!state.players.some(p => p.id === playerId)) return;
        state.answers[question.id] = state.answers[question.id] || {};
        state.answers[question.id][playerId] = { answer: Quiz.clone(answer), submittedAt: Date.now() };
        accepted = true;
      });
      return accepted;
    }
    buzz(playerId, answer = null) {
      let accepted = false;
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        if (!state.questionOpen || !question || question.type !== 'buzzer') return;
        const player = state.players.find(p => p.id === playerId);
        if (!player) return;
        const result = state.questionResults[question.id] && state.questionResults[question.id].kind === 'buzzer' ? state.questionResults[question.id] : this.initialBuzzerState(question);
        if (result.status !== 'open') return;
        if ((result.eliminatedIds || []).includes(playerId)) return;
        state.answers[question.id] = state.answers[question.id] || {};
        state.answers[question.id][playerId] = { answer: Quiz.clone(answer), submittedAt: Date.now() };
        result.status = 'locked';
        result.contenderId = playerId;
        result.contenderName = player.name;
        result.contenderAnswer = Quiz.clone(answer);
        state.questionResults[question.id] = result;
        state.questionOpen = false;
        state.questionEndsAt = null;
        accepted = true;
      });
      return accepted;
    }
    markBuzzerIncorrect() {
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        if (!question || question.type !== 'buzzer' || !state.questionStartedAt) throw new Error('Keine aktive Buzzer-Frage.');
        const result = state.questionResults[question.id] && state.questionResults[question.id].kind === 'buzzer' ? state.questionResults[question.id] : this.initialBuzzerState(question);
        if (!result.contenderId) throw new Error('Noch kein Spieler hat gebuzzert.');
        if (!result.eliminatedIds.includes(result.contenderId)) result.eliminatedIds.push(result.contenderId);
        const wrongPlayerId = result.contenderId;
        const penalty = Math.max(0, Number(question.penalty) || 0);
        if (penalty > 0) {
          const wrongPlayer = state.players.find(player => player.id === wrongPlayerId);
          if (wrongPlayer) wrongPlayer.score = Math.round((Number(wrongPlayer.score) || 0) - penalty);
        }
        result.lastIncorrectId = result.contenderId;
        result.lastIncorrectAnswer = result.contenderAnswer;
        result.contenderId = '';
        result.contenderName = '';
        result.contenderAnswer = null;
        const remaining = state.players.filter(player => !result.eliminatedIds.includes(player.id));
        if (remaining.length) {
          result.status = 'open';
          result.reopenedCount = Number(result.reopenedCount || 0) + 1;
          state.questionOpen = true;
        } else {
          result.status = 'exhausted';
          state.questionOpen = false;
        }
        state.questionEndsAt = null;
        state.questionResults[question.id] = result;
      });
    }
    setPlayerScore(playerId, score) {
      this.mutate(state => {
        const player = state.players.find(p => p.id === playerId);
        if (player) player.score = Math.round(Number(score) || 0);
      });
    }
    adjustPlayerScore(playerId, delta) {
      this.mutate(state => {
        const player = state.players.find(p => p.id === playerId);
        if (player) player.score = Math.round((Number(player.score) || 0) + (Number(delta) || 0));
      });
    }
    move(direction = 1) {
      this.mutate(state => {
        const { question } = this.getCurrent(state);
        const unresolved = Boolean(question && state.questionStartedAt && !state.scoredQuestionIds.includes(question.id));
        if (unresolved) throw new Error('Bitte die aktuelle Frage zuerst auflösen.');
        state.questionOpen = false;
        state.questionEndsAt = null;
        state.questionStartedAt = null;
        const quiz = state.quiz.quiz;
        let ri = state.currentRoundIndex;
        let qi = state.currentQuestionIndex + direction;
        if (direction > 0) {
          while (ri < quiz.rounds.length) {
            if (qi < quiz.rounds[ri].questions.length) break;
            if (quiz.rounds[ri]) {
              const standings = state.players.slice().sort((a, b) => b.score - a.score).map(p => ({ id: p.id, name: p.name, score: p.score }));
              if (!state.roundSummaries.some(s => s.roundId === quiz.rounds[ri].id)) state.roundSummaries.push({ roundId: quiz.rounds[ri].id, title: quiz.rounds[ri].title, standings, at: Date.now() });
            }
            ri++; qi = 0;
          }
          if (ri >= quiz.rounds.length) {
            state.status = 'finished'; state.finishedAt = Date.now();
            ri = Math.max(0, quiz.rounds.length - 1); qi = Math.max(0, quiz.rounds[ri]?.questions.length - 1);
          }
        } else {
          while (ri >= 0 && qi < 0) { ri--; if (ri >= 0) qi = quiz.rounds[ri].questions.length - 1; }
          if (ri < 0) { ri = 0; qi = 0; }
        }
        state.currentRoundIndex = ri;
        state.currentQuestionIndex = qi;
      });
    }
    finish() { this.mutate(state => { state.status = 'finished'; state.questionOpen = false; state.questionEndsAt = null; state.finishedAt = Date.now(); }); }
    resetScores() { this.mutate(state => { state.players.forEach(p => p.score = 0); state.answers = {}; state.questionResults = {}; state.scoredQuestionIds = []; state.roundSummaries = []; }); }
  }

  window.SchmobinSession = SessionEngine;
})();
