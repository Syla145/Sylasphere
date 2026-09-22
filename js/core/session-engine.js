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
        version: 2,
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
    load() {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      try { this.lastSerialized = raw; return JSON.parse(raw); }
      catch (_) { return null; }
    }
    save(state) {
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
        const duration = Math.max(0, Number(question.timer) || Number(state.quiz.quiz.settings.defaultTimer) || 0);
        state.status = 'playing';
        state.questionOpen = true;
        state.questionStartedAt = Date.now();
        state.questionEndsAt = duration > 0 ? Date.now() + duration * 1000 : null;
        state.answers[question.id] = state.answers[question.id] || {};
      });
    }
    closeQuestion() {
      this.mutate(state => {
        const { question, round } = this.getCurrent(state);
        if (!question) return;
        state.questionOpen = false;
        state.questionEndsAt = null;
        if (!state.scoredQuestionIds.includes(question.id)) {
          const answers = state.answers[question.id] || {};
          state.players.forEach(player => {
            const submission = answers[player.id];
            if (!submission) return;
            const result = Quiz.scoreAnswer(question, submission.answer, round?.pointsMultiplier || 1);
            submission.awardedPoints = result.points;
            submission.scoreDetail = result.detail;
            submission.scoredAt = Date.now();
            player.score = Math.round((Number(player.score) || 0) + result.points);
          });
          state.scoredQuestionIds.push(question.id);
        }
      });
    }
    submitAnswer(playerId, answer) {
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
    resetScores() { this.mutate(state => { state.players.forEach(p => p.score = 0); state.answers = {}; state.scoredQuestionIds = []; state.roundSummaries = []; }); }
  }

  window.SchmobinSession = SessionEngine;
})();
