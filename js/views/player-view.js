(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Session = window.SchmobinSession;
  const Online = window.JHQuizOnlineSession;
  const Firebase = window.JHQuizFirebase;
  const Renderers = window.SchmobinRenderers;
  const Timer = window.SchmobinTimer;
  const PlayerIdentity = window.JHQuizPlayerIdentity;

  let engine = null, identity = null, state = null, playerId = '', currentQuestionId = '', draftAnswer = null, timer = null, joining = false, transport = 'local';
  // v28: XP & Stufen – Konto-Stand (accountXp) und Live-Ergebnis des Raums (progress)
  let accountXp = 0, progress = { xp: null, game: null }, stopProgress = null, lastBoardSync = null;
  const Progress = window.SylasphereProgress, Store = window.SylasphereProgressStore;
  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['join-panel','game-panel','room-code','player-name','join-btn','join-error','avatar-options','game-code','game-status','game-mode','game-question','submit-answer','answer-feedback','player-score','leaderboard','player-timer','player-progress','player-identity','player-progress-bar','player-timebar','player-timebar-fill','player-topbar','mode-help'].forEach(id => els[id] = document.getElementById(id));
    els['game-question'].addEventListener('quiz:interaction-end', () => { if (deferredState) render(deferredState); });
    const code = (App.getParam('code') || Session.lastCode() || Online?.lastCode?.() || '').toUpperCase(); if (code) els['room-code'].value = code;
    if (App.getParam('code') && !els['player-name'].value) setTimeout(() => els['player-name'].focus({ preventScroll: true }), 50); // v31: von der Startseite – direkt Namen eingeben
    renderAvatars();
    els['join-btn'].addEventListener('click', join);
    els['room-code'].addEventListener('input', () => els['room-code'].value = els['room-code'].value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
    // v21: Angemeldete Spieler – Name aus dem Konto vorausfüllen; v28: mit Konto XP sammeln
    window.SylasphereAccount?.init().then(state => {
      const user = state?.user;
      if (user && !user.isAnonymous && !els['player-name'].value.trim()) els['player-name'].value = String(user.name || '').slice(0, 28);
      window.SylasphereAccount.onChange(renderJoinAccount);
      renderJoinAccount();
    }).catch(() => {});
    [els['room-code'], els['player-name']].forEach(input => input.addEventListener('keydown', e => { if (e.key === 'Enter') join(); }));
    tryRejoin();
    els['submit-answer'].addEventListener('click', submit);
  }

  // v31: Standard-Avatar zufällig; beim Beitreten wird – falls nicht selbst gewählt – einer genommen, den im Raum noch niemand hat
  const AVATARS = ['🦊','🐼','🦁','🐸','🐙','🦄','🤖','👾','🐧','🦖','🐐','🐻','🐯','🐵','🦉','🐢'];
  let avatarPicked = false;
  function renderAvatars() {
    const start = Math.floor(Math.random() * AVATARS.length);
    els['avatar-options'].innerHTML = AVATARS.map((a,i)=>`<button type="button" class="avatar-choice ${i===start?'is-selected':''}" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join('');
    els['avatar-options'].addEventListener('click', e => {
      const b=e.target.closest('.avatar-choice'); if(!b)return; avatarPicked = true; els['avatar-options'].querySelectorAll('.avatar-choice').forEach(x=>x.classList.toggle('is-selected',x===b));
    });
  }
  /** Freien Avatar wählen (ohne DOM, in tests/v31 geprüft): bevorzugt `preferred`, sonst zufällig einer, den noch niemand hat */
  function pickAvatar(preferred, players, ownId, random = Math.random) {
    const taken = new Set((players || []).filter(p => p && p.id !== ownId).map(p => p.avatar));
    if (preferred && !taken.has(preferred)) return preferred;
    const free = AVATARS.filter(a => !taken.has(a));
    const pool = free.length ? free : AVATARS;
    return pool[Math.floor(random() * pool.length)] || preferred || AVATARS[0];
  }
  window.SylasphereAvatarPick = pickAvatar;
  function chooseAvatar(chosen, players, ownId) {
    const own = (players || []).find(p => p.id === ownId);
    if (avatarPicked) return chosen; // selbst gewählt → so lassen (Doppelte erlaubt)
    if (own?.avatar) return own.avatar; // Wiederbeitritt: bisherigen Avatar behalten
    return pickAvatar(chosen, players, ownId);
  }

  // ---------- v28: Konto beim Beitreten ----------
  function accountUser() {
    const user = window.SylasphereAccount?.state()?.user;
    return user && !user.isAnonymous ? user : null;
  }
  const useAccount = () => Boolean(accountUser() && document.getElementById('use-account')?.checked !== false);
  let accountKey = '';
  async function renderJoinAccount() {
    const box = document.getElementById('join-account');
    if (!box || !window.SylasphereAccount) return;
    const user = accountUser();
    const key = user ? user.uid : '-';
    if (key === accountKey) return;
    accountKey = key;
    box.hidden = false;
    if (!user) {
      accountXp = 0;
      box.innerHTML = '<div class="join-account-row"><span>⭐ Mit Konto spielen, XP sammeln und Emotes freischalten</span><button type="button" class="link-btn" data-login>Anmelden</button></div>';
      box.querySelector('[data-login]').addEventListener('click', openLogin);
      return;
    }
    box.innerHTML = `<label class="join-account-row"><input type="checkbox" id="use-account" checked><span>Als <strong>${App.escapeHTML(user.name)}</strong> spielen <span data-level></span></span></label><a class="link-btn" href="./profil.html">Profil ↗</a>`;
    try { accountXp = Number((await Store?.readXp(window.SylasphereAccount.context(), user.uid))?.total) || 0; } catch (_) { accountXp = 0; }
    const level = box.querySelector('[data-level]');
    if (level && Progress) level.innerHTML = `· <span class="level-badge">⭐${Progress.levelFor(accountXp)}</span>`;
  }
  function openLogin() {
    const UI = window.SylasphereAccountUI;
    if (!UI) { location.href = './profil.html'; return; }
    const dialog = UI.dialog(UI.loginCard({ title: 'Anmelden', intro: 'Mit Konto sammelst du XP, steigst Stufen auf und schaltest neue Emotes frei. Spielen geht auch weiter als Gast.' }), { onClose: () => off() });
    const off = window.SylasphereAccount.onChange(st => { if (st.user && !st.user.isAnonymous) { dialog.close(); App.toast(`Angemeldet als ${st.user.name}.`, 'success'); } });
  }

  function startProgress(code) {
    stopProgress?.(); stopProgress = null; progress = { xp: null, game: null };
    const bar = document.getElementById('reaction-bar');
    if (!engine?.isAccount || !Store || !Progress) { window.SylasphereReactions?.setExtra(bar, []); return; }
    const context = window.SylasphereAccount.context();
    window.SylasphereReactions?.setExtra(bar, Progress.unlockedEmotes(accountXp));
    stopProgress = Store.watchPlayer(context, playerId, code, data => {
      progress = data;
      const total = Number(data.xp?.total) || 0;
      window.SylasphereReactions?.setExtra(bar, Progress.unlockedEmotes(total));
      if (data.xp && lastBoardSync !== total) { lastBoardSync = total; Store.syncLeaderboard(context, playerId); engine?.updateOwnXp?.(total); }
      renderXpResult();
    });
  }

  /** Kasten „+110 XP“ unter dem Podest (nur online, nach Spielende) */
  function renderXpResult() {
    const box = els['game-question']?.querySelector('[data-xp-result]');
    if (!box || !Progress) return;
    let html = '';
    if (transport !== 'online') html = '';
    else if (!engine?.isAccount) html = accountUser() ? '<div class="notice">Du hast als Gast gespielt – dafür gibt es keine XP.</div>' : '<a class="notice xp-hint" href="./profil.html">⭐ Mit Konto sammelst du XP und schaltest Emotes frei. <strong>Anmelden →</strong></a>';
    else if (!progress.game) html = '<div class="notice xp-pending">⭐ XP werden gespeichert …</div>';
    else {
      const g = progress.game, info = Progress.levelInfo(progress.xp?.total), p = g.parts || {};
      const parts = [[p.play, 'Mitspielen'], [p.correct, 'richtige Antworten'], [p.place, `Platz ${g.rank}`], [p.highlights, 'Highlights']].filter(([v]) => Number(v) > 0).map(([v, t]) => `+${v} ${t}`).join(' · ');
      const capped = Number(g.xpEarned) > Number(g.xp) ? '<small>Tageslimit erreicht – der Rest zählt nicht.</small>' : '';
      const none = Number(g.xpEarned) === 0 && Number(g.players) < Progress.RULES.MIN_PLAYERS ? `<small>XP gibt es erst ab ${Progress.RULES.MIN_PLAYERS} Spielern.</small>` : Number(g.xpEarned) === 0 && Number(g.questions) < Progress.RULES.MIN_QUESTIONS ? `<small>XP gibt es erst ab ${Progress.RULES.MIN_QUESTIONS} gewerteten Fragen.</small>` : '';
      html = `<div class="xp-result-card"><div class="xp-gain">+${Math.round(Number(g.xp) || 0)} XP</div><span>${App.escapeHTML(parts || 'Diesmal keine XP')}</span>${capped}${none}${levelBar(info)}<a class="link-btn" href="./profil.html">Statistik ansehen ↗</a></div>`;
    }
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function levelBar(info) {
    return `<div class="level-row"><span class="level-badge">⭐${info.level}</span><div class="xp-track"><span style="width:${Math.round(info.progress * 100)}%"></span></div><small>${info.xp - info.from} / ${info.to - info.from} XP bis Stufe ${info.level + 1}</small></div>`;
  }

  async function resolveTransport(code) {
    const hint = String(App.getParam('mode') || '').toLowerCase();
    if (hint === 'local') {
      if (!Session.exists(code)) throw new Error('Lokale Sitzung nicht gefunden.');
      return 'local';
    }
    if (hint === 'online') return 'online';
    try { if (await Online.exists(code, 'player')) return 'online'; } catch (_) {}
    if (Session.exists(code)) return 'local';
    throw new Error('Sitzung nicht gefunden. Prüfe den 6-stelligen Code.');
  }

  // v32: Fehlermeldung direkt am Feld, Feld rot markiert; verschwindet beim Tippen
  function fieldError(id, message) {
    const input = els[id];
    if (!input) { els['join-error'].textContent = message; return; }
    input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true');
    let hint = input.parentElement.querySelector('.field-error');
    if (!hint) { hint = document.createElement('span'); hint.className = 'field-error'; hint.id = `${id}-error`; hint.setAttribute('role', 'alert'); input.insertAdjacentElement('afterend', hint); input.setAttribute('aria-describedby', hint.id); }
    hint.textContent = message;
    input.focus();
    input.addEventListener('input', () => { input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); hint.remove(); }, { once: true });
  }
  function clearFieldErrors() {
    ['room-code', 'player-name'].forEach(id => { els[id]?.classList.remove('is-invalid'); els[id]?.removeAttribute('aria-invalid'); els[id]?.parentElement.querySelector('.field-error')?.remove(); });
  }

  // ---------- v33: Wiederverbinden – nach kurzem Verbindungsabbruch/Neuladen automatisch zurück in den Raum
  const REJOIN_KEY = 'sylasphere:rejoin';
  const REJOIN_MAX_AGE = 12 * 60 * 60 * 1000;
  const rejoinStore = {
    // pro Tab (sessionStorage): Neuladen/kurz weg klappt, weitere Tabs im selben Browser (lokaler Test) treten nicht als dieselbe Person bei
    get() { try { return JSON.parse(sessionStorage.getItem(REJOIN_KEY) || 'null'); } catch (_) { return null; } },
    set(value) { try { if (value) sessionStorage.setItem(REJOIN_KEY, JSON.stringify(value)); else sessionStorage.removeItem(REJOIN_KEY); } catch (_) {} }
  };
  let autoJoin = false;
  function tryRejoin() {
    const saved = rejoinStore.get();
    const param = String(App.getParam('code') || '').toUpperCase();
    if (!saved?.code || Date.now() - Number(saved.at || 0) > REJOIN_MAX_AGE || (param && param !== saved.code)) return;
    els['room-code'].value = saved.code;
    els['player-name'].value = saved.name || '';
    const button = els['avatar-options'].querySelector(`[data-avatar="${CSS.escape(saved.avatar || '')}"]`);
    if (button) { els['avatar-options'].querySelectorAll('.avatar-choice').forEach(x => x.classList.toggle('is-selected', x === button)); avatarPicked = true; }
    autoJoin = true;
    join().finally(() => { autoJoin = false; });
  }

  async function join() {
    if (joining) return;
    const code = els['room-code'].value.trim().toUpperCase(); const name = els['player-name'].value.trim();
    els['join-error'].textContent=''; clearFieldErrors();
    if (code.length !== 6) { fieldError('room-code', 'Bitte gib den 6-stelligen Raumcode ein.'); return; }
    if (!name) { fieldError('player-name', 'Bitte gib deinen Namen ein.'); return; }
    const joinButton = els['join-btn'];
    joining = true; joinButton.disabled = true; joinButton.textContent = 'Raum wird gesucht …';
    try {
      const selected = await resolveTransport(code);
      try { await engine?.destroy?.(); } catch (_) {}
      identity?.destroy(); engine = null; identity = null;
      const avatar=els['avatar-options'].querySelector('.is-selected')?.dataset.avatar || '🦊';

      if (selected === 'online') {
        joinButton.textContent = 'Beitreten …';
        identity = new PlayerIdentity(`ONLINE${code}`);
        // v28: Mit Konto beitreten (XP). Spielt das Konto schon in einem anderen Tab, geht es hier als Gast weiter.
        let account = useAccount() ? window.SylasphereAccount.context() : null;
        if (account && await identity.inUseElsewhere(accountUser().uid)) { account = null; App.toast('Dein Konto spielt schon in einem anderen Tab – hier trittst du als Gast bei.', 'info'); }
        if (!account) {
          const stored = identity.storedPlayerId();
          const reusable = await identity.reusablePlayerId();
          const context = await Firebase.ready('player');
          if (stored && !reusable && context.auth.currentUser?.uid === stored) await Firebase.rotateAnonymous('player');
        }
        engine = await Online.connect(code, 'player', { account });
        if (account && !engine.isAccount) App.toast('Das ist dein eigener Raum – du spielst als Gast (ohne XP).', 'info');
        await engine.waitForState();
        if (autoJoin && (engine.load()?.removedIds || []).includes(engine.userId)) throw new Error('removed');
        playerId = await engine.joinPlayer(name, chooseAvatar(avatar, engine.load()?.players, engine.userId), { xp: accountXp });
        identity.activate(playerId);
        transport = 'online';
        startProgress(code);
      } else {
        engine = new Session(code);
        identity = new PlayerIdentity(code);
        const previous = await identity.reusablePlayerId();
        if (autoJoin && previous && (engine.load()?.removedIds || []).includes(previous)) throw new Error('removed');
        playerId = engine.joinPlayer(name, chooseAvatar(avatar, engine.load()?.players, previous), previous);
        identity.activate(playerId);
        transport = 'local';
        startProgress(code);
      }

      rejoinStore.set({ code, mode: transport, name, avatar: els['avatar-options'].querySelector('.is-selected')?.dataset.avatar || '', at: Date.now() });
      startHeartbeat();
      els['join-panel'].hidden=true; els['game-panel'].hidden=false;
      window.SylasphereJoin?.keepAwake(true); // Handy geht während des Quiz nicht in den Standby
      history.replaceState(null,'',`?code=${code}&mode=${transport}`);
      engine.subscribe(render);
      // v27: Emoji-Reaktionen (Leiste unter der Frage)
      window.SylasphereReactions?.attachBar(document.getElementById('reaction-bar'), emoji => Promise.resolve(engine.sendReaction?.(playerId, emoji)));
    } catch(error) {
      if (autoJoin) { // stilles Wiederverbinden hat nicht geklappt (Raum weg, entfernt …) → normales Formular
        rejoinStore.set(null);
        els['join-error'].textContent = error?.message === 'removed' ? 'Der Moderator hat dich aus dem Raum entfernt.' : 'Die letzte Runde ist vorbei – gib einen Raumcode ein.';
        identity?.destroy(); identity = null; try { await engine?.destroy?.(); } catch (_) {} engine = null;
        return;
      }
      const message = /Firebase|auth|permission|network/i.test(String(error?.message || '')) ? Firebase.friendlyError(error) : (error.message || 'Beitritt fehlgeschlagen.');
      if (/nicht gefunden|Raumcode|Code/i.test(message)) fieldError('room-code', message);        // v32: Fehler am betroffenen Feld
      else if (/Name/i.test(message)) fieldError('player-name', message);
      else els['join-error'].textContent = message;
      identity?.destroy(); identity = null;
      try { await engine?.destroy?.(); } catch (_) {}
      engine = null;
    } finally {
      joining = false; joinButton.disabled = false; joinButton.textContent = 'Beitreten';
    }
  }

  // Während eine Sortier-Karte gezogen wird, keine Neu-Renderings (z. B. durch Antworten
  // anderer Spieler) durchlassen – sonst würde die Karte mitten im Ziehen ersetzt.
  let deferredState = null;
  function render(next) {
    if (els['game-question']?.querySelector('.is-sorting')) { deferredState = next; return; }
    deferredState = null;
    state=next; window.SylasphereTopics?.use(state.quiz?.quiz?.categories); // eigene Themen des Quiz
    window.SylasphereThemes?.applyQuiz(state.quiz, state.currentRoundIndex); // Design des Quiz (v29: optional pro Runde)
    window.SylasphereThemes?.observe(state); // v29: Übergang zwischen Fragen
    const player=state.players.find(p=>p.id===playerId);
    if(!player){ const removed = (state.removedIds || []).includes(playerId); rejoinStore.set(null); return disconnect(removed ? 'Der Moderator hat dich aus dem Raum entfernt.' : 'Du bist nicht mehr Teil dieser Sitzung.'); }
    { const saved = rejoinStore.get(); if (saved && saved.code === state.code && saved.name !== player.name) rejoinStore.set(Object.assign(saved, { name: player.name, at: Date.now() })); } // Umbenennen durch den Moderator merken
    renderPause();
    const current=engine.getCurrent(state); App.setText(els['game-code'],state.code); App.setText(els['player-score'],App.formatPoints(player.score));
    if (els['game-mode']) { const offline = transport === 'online' && state.onlineConnected === false; els['game-mode'].hidden = !offline; els['game-mode'].textContent = offline ? '↻ Verbindung …' : ''; els['game-mode'].classList.toggle('is-offline', offline); } // v31: kein Lokal/Online-Hinweis mehr, nur bei Verbindungsproblemen
    els['player-identity'].innerHTML=`<span class="avatar">${App.escapeHTML(App.avatar(player.avatar))}</span><span>${App.escapeHTML(player.name)}</span>`;
    renderLeaderboard(); renderStatus(current); augmentShow(current); renderModeHelp(current); renderTimer(current);
    if (state.paused && state.status === 'playing') App.setText(els['game-status'], 'Pause'); // v33
    window.SylasphereSfx?.observe(state, { current, playerId }); // v27: Soundeffekte + Vibration
  }

  // ================================================================ v34: Show-Formate
  const Show = () => window.SylasphereShow;
  const ShowUI = () => window.SylasphereShowUI;
  let boardSel = '', showKey = '';
  const roundOf = () => state.quiz.quiz.rounds[state.currentRoundIndex];
  const myScore = () => state.players.find(p => p.id === playerId)?.score || 0;
  function boardShow() {
    const round = roundOf();
    return state.status === 'playing' && Quiz.isBoardRound(round) && state.show?.kind === 'board' && state.show.roundId === round.id ? state.show : null;
  }
  function finalShow(current) {
    return state.status === 'playing' && Quiz.isFinalWager(state.quiz, state.currentRoundIndex, state.currentQuestionIndex) && state.show?.kind === 'final' && state.show.qid === current.question?.id ? state.show : null;
  }
  /** Brett-Bildschirm bzw. Einsatz-Eingabe; true = gezeichnet */
  function renderShow(current) {
    const host = els['game-question'];
    const q = current.question;
    const show = boardShow();
    if (show) {
      const round = roundOf();
      const onCell = q && show.current?.qid === q.id;
      if (onCell && state.questionStartedAt) return false; // Frage läuft → normale Ansicht (+ Mitraten-Hinweis)
      const me = show.current?.by || show.active;
      const mine = me === playerId;
      const key = JSON.stringify([show.seq, show.phase, mine, boardSel, myScore(), state.players.map(p => [p.id, p.name, p.avatar])]);
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = '';
      App.setText(els['game-status'], show.phase === 'pick' ? (mine ? 'Du bist dran!' : 'Brett') : show.phase === 'wager' ? 'Doppel-Feld' : 'Brett');
      if (showKey === key && host.querySelector('.show-player')) return true;
      showKey = key; host.dataset.renderKey = '';
      const esc = App.escapeHTML;
      const name = ShowUI().who(state.players, me);
      let top = '';
      if (show.phase === 'pick' && mine) top = '<div class="notice notice--success"><strong>Du bist dran!</strong> Tippe ein Feld und bestätige.</div>';
      else if (show.phase === 'pick') top = `<div class="waiting-card show-waiting"><h2>${name} wählt …</h2>${Show().nextUp(show) === playerId ? '<p>Du bist als Nächstes dran.</p>' : ''}</div>`;
      else if (show.phase === 'wager' && mine) {
        const max = Show().maxDoubleStake(myScore(), round);
        top = `${ShowUI().zoomHTML(round, show, state.players, { me: playerId })}<div class="panel panel-pad show-stake"><span class="eyebrow">💎 Doppel-Feld – dein Einsatz</span><div class="estimate-value" data-stake-out>${Math.min(max, 100)} P</div><input type="range" min="0" max="${max}" step="10" value="${Math.min(max, 100)}" data-stake><div class="range-labels"><span>0</span><span>${max} P</span></div><button type="button" class="btn btn--primary" data-stake-send>Einsatz setzen</button><span class="microcopy">Richtig: +Einsatz · Falsch: 0 (keine Minuspunkte)</span></div>`;
      } else if (show.phase === 'wager' || show.phase === 'play') top = ShowUI().zoomHTML(round, show, state.players, { me: playerId }) + (show.phase === 'play' && !mine && !show.current?.shared ? `<p class="microcopy show-hint">${round.board.coGuess ? '👀 Gleich kommt die Frage – du kannst ohne Punkte mitraten.' : 'Gleich kommt die Frage – schau zu.'}</p>` : '');
      else if (show.phase === 'shared') top = '<div class="notice">👥 Die letzten Felder spielen alle zusammen – normale Wertung.</div>';
      else top = '<div class="notice notice--success">✓ Brett fertig.</div>';
      const clickable = show.phase === 'pick' && mine;
      host.innerHTML = `<div class="show-player">${top}${ShowUI().boardHTML(round, show, { players: state.players, clickable, selected: boardSel, compact: true })}${clickable ? `<button type="button" class="btn btn--primary show-pick-btn" data-pick-send ${boardSel ? '' : 'disabled'}>${boardSel ? `${esc(cellLabel(round, boardSel))} wählen` : 'Feld antippen …'}</button>` : ''}</div>`;
      host.querySelectorAll('[data-qid]').forEach(btn => btn.addEventListener('click', () => { boardSel = btn.dataset.qid; showKey = ''; render(state); }));
      host.querySelector('[data-pick-send]')?.addEventListener('click', async event => {
        event.currentTarget.disabled = true; event.currentTarget.textContent = 'Gewählt – einen Moment …';
        try { await engine.setPick(playerId, { key: Show().pickKey(state.show), qid: boardSel }); } catch (error) { App.toast(error.message, 'error'); }
        boardSel = '';
      });
      const range = host.querySelector('[data-stake]');
      range?.addEventListener('input', () => { host.querySelector('[data-stake-out]').textContent = `${range.value} P`; });
      host.querySelector('[data-stake-send]')?.addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try { await engine.setPick(playerId, { key: Show().pickKey(state.show), stake: Number(range.value) }); } catch (error) { App.toast(error.message, 'error'); }
      });
      return true;
    }
    const fin = finalShow(current);
    if (fin && !state.questionStartedAt) {
      const wid = Show().wagerId(q.id);
      const mine = state.answers?.[wid]?.[playerId]?.answer?.stake;
      const max = Show().finalMaxStake(myScore());
      const key = JSON.stringify(['final', fin.phase, mine, myScore()]);
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = '';
      App.setText(els['game-status'], 'Einsatz-Finale');
      if (showKey === key && host.querySelector('.show-player')) return true;
      showKey = key; host.dataset.renderKey = '';
      if (fin.phase === 'wager') {
        const start = mine != null ? mine : Math.min(max, Math.round(max / 2 / 10) * 10);
        host.innerHTML = `<div class="show-player"><div class="panel panel-pad show-stake"><span class="eyebrow">💰 Einsatz-Finale · Thema: ${App.escapeHTML(q.category || '–')}</span><h2>Wie viel setzt du?</h2><div class="estimate-value" data-stake-out>${start} P</div><input type="range" min="0" max="${max}" step="10" value="${start}" data-stake><div class="range-labels"><span>0</span><span>${max} P${myScore() > 0 ? ' (alles)' : ''}</span></div><button type="button" class="btn btn--primary" data-wager-send>${mine != null ? 'Einsatz ändern' : 'Einsatz geheim abgeben'}</button>${mine != null ? `<div class="notice notice--success">✓ Abgegeben: ${mine} P – du kannst ihn noch ändern.</div>` : ''}<span class="microcopy">Richtig: +Einsatz · Falsch: −Einsatz. Niemand sieht deinen Einsatz vor der Auflösung.</span></div></div>`;
        const range = host.querySelector('[data-stake]');
        range.addEventListener('input', () => { host.querySelector('[data-stake-out]').textContent = `${range.value} P`; });
        host.querySelector('[data-wager-send]').addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try { await engine.submitWager(playerId, wid, Show().clampFinal(range.value, myScore())); } catch (error) { App.toast(error.message, 'error'); event.currentTarget.disabled = false; }
        });
      } else {
        host.innerHTML = `<div class="show-player"><div class="waiting-card"><span class="eyebrow">💰 Einsatz-Finale</span><h2>Einsätze sind zu</h2><p>Dein Einsatz: <b>${Math.round(Number(fin.stakes?.[playerId] ?? mine ?? 0))} P</b> · gleich kommt die Frage.</p></div></div>`;
      }
      return true;
    }
    showKey = '';
    return false;
  }
  function cellLabel(round, qid) {
    const c = Show().cells(round).find(x => x.qid === qid);
    return c ? `${round.board.topics[c.t]} · ${c.value}` : '';
  }
  /** Während/nach der Brett-Frage: Mitraten-Hinweis, „Hätten es auch gewusst“; Finale: eigenes Ergebnis */
  function augmentShow(current) {
    const q = current.question;
    if (!q || !state.questionStartedAt) return;
    const show = boardShow();
    const resolved = state.scoredQuestionIds?.includes(q.id);
    const fb = els['answer-feedback'];
    if (show && show.current?.qid === q.id && !show.current.shared) {
      const mine = show.current.by === playerId;
      const round = roundOf();
      if (!resolved && !mine) {
        fb.insertAdjacentHTML('afterbegin', `<div class="notice show-coguess">${round.board.coGuess ? `👀 <b>Mitraten</b> – ${App.escapeHTML(state.players.find(p => p.id === show.current.by)?.name || '')} ist dran, du bekommst keine Punkte.` : `${App.escapeHTML(state.players.find(p => p.id === show.current.by)?.name || '')} antwortet – schau zu.`}</div>`);
        if (!round.board.coGuess) els['game-question'].querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = true; });
      }
      if (resolved) fb.insertAdjacentHTML('afterbegin', ShowUI().alsoRightHTML(state.questionResults?.[q.id]?.board, state.players));
    }
    const fin = finalShow(current);
    if (fin && resolved && fin.rows) {
      const rows = Array.isArray(fin.rows) ? fin.rows : Object.values(fin.rows);
      const i = rows.findIndex(r => r.id === playerId);
      if (i >= 0 && i <= (Number(fin.index) || 0)) fb.insertAdjacentHTML('afterbegin', ShowUI().finalRevealHTML(rows, i, state.players));
    }
  }

  function readyButton() {
    const me = state.players.find(p => p.id === playerId);
    const ready = state.players.filter(p => p.ready).length;
    return me?.ready
      ? `<div class="ready-box is-ready"><strong>✓ Du bist bereit</strong><span>${ready} von ${state.players.length} bereit</span><button type="button" class="link-btn" data-ready>doch nicht bereit</button></div>`
      : `<div class="ready-box"><button type="button" class="btn btn--primary ready-btn" data-ready>✋ Bereit</button><span>${ready} von ${state.players.length} bereit</span></div>`;
  }

  // v35: Spielmodi erklären – beim ersten Mal eine Karte zum Wegtippen, danach ein „?“ an der Frage
  const modeOkKey = () => `sylasphere:modes-ok:${state?.code || ''}`;
  function modesOk() { try { return new Set(JSON.parse(sessionStorage.getItem(modeOkKey()) || '[]')); } catch (error) { return new Set(); } }
  function markModeOk(id) { const set = modesOk(); set.add(id); try { sessionStorage.setItem(modeOkKey(), JSON.stringify([...set])); } catch (error) { /* privat */ } }
  function renderModeHelp(current) {
    const box = els['mode-help'];
    const Modes = window.SylasphereModes;
    if (!box || !Modes) return;
    const id = state.status === 'playing' && current?.question && !state.paused ? Modes.target(state, current) : '';
    const mode = id ? Modes.get(id) : null;
    if (!mode) { box.hidden = true; box.dataset.key = ''; box.innerHTML = ''; return; }
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const fresh = Modes.enabled(state) && Modes.isNew(state, id) && !modesOk().has(id) && !resolved;
    const key = `${id}:${fresh}`;
    box.hidden = false;
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = fresh
      ? Modes.cardHTML(id, { variant: 'phone', dismiss: '✓ Verstanden' })
      : `<button type="button" class="mode-chip" data-mode-open aria-label="${App.escapeHTML(mode.label)} – so geht's"><span aria-hidden="true">${App.escapeHTML(mode.icon)}</span> ${App.escapeHTML(mode.label)} <b class="mode-q" aria-hidden="true">?</b></button>`;
    box.querySelector('[data-mode-dismiss]')?.addEventListener('click', () => { markModeOk(id); renderModeHelp(engine.getCurrent(state)); });
    box.querySelector('[data-mode-open]')?.addEventListener('click', () => openModeHelp(id));
  }
  function openModeHelp(id) {
    const Modes = window.SylasphereModes;
    document.getElementById('mode-help-modal')?.remove();
    const layer = document.createElement('div'); layer.id = 'mode-help-modal'; layer.className = 'mode-modal'; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true');
    layer.innerHTML = Modes.cardHTML(id, { isNew: false, variant: 'modal', dismiss: 'Schließen' });
    const close = () => layer.remove();
    layer.addEventListener('click', event => { if (event.target === layer || event.target.closest('[data-mode-dismiss]')) close(); });
    document.addEventListener('keydown', function esc(event) { if (event.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.append(layer);
    layer.querySelector('[data-mode-dismiss]')?.focus();
  }

  function renderStatus(current) {
    const total = Quiz.allQuestions(state.quiz).length;
    let global = 0;
    for (let i = 0; i < state.currentRoundIndex; i++) global += state.quiz.quiz.rounds[i].questions.length;
    global += state.currentQuestionIndex;
    const playing = state.status === 'playing' && Boolean(current.round); // v31: Lobby/Spielende ohne Rundenanzeige
    const onBoard = playing && Quiz.isBoardRound(current.round) && state.show?.kind === 'board' && window.SylasphereShowUI; // v34
    App.setText(els['player-progress'], !playing ? '' : onBoard ? window.SylasphereShowUI.progressText(current.round, state.show).replace(/ von \d+ Feldern/, ' Felder') : `${current.round.title} · ${Math.min(global + 1, total)}/${total}`);
    if (els['player-progress-bar']) { els['player-progress-bar'].style.width = `${total ? Math.round(((Math.min(global + 1, total)) / total) * 100) : 0}%`; els['player-progress-bar'].parentElement.hidden = !playing; }
    els['player-topbar']?.setAttribute('data-phase', state.status);

    if (state.status === 'lobby') {
      App.setText(els['game-status'], 'Lobby');
      els['game-question'].innerHTML = `<div class="waiting-card lobby-wait"><div class="pulse-dot"></div><span class="eyebrow">${App.escapeHTML(state.quiz.quiz.title)}</span><h2>Du bist drin!</h2><p>${state.players.length} Spieler in der Lobby · Der Moderator startet gleich.</p>${readyButton()}<p class="microcopy">Raum ${App.escapeHTML(state.code)}</p></div>`;
      els['game-question'].querySelector('[data-ready]')?.addEventListener('click', toggleReady);
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }
    if (state.status === 'finished') {
      App.setText(els['game-status'], 'Beendet');
      const ranked = App.rankPlayers(state.players);
      const place = ranked.find(p => p.id === playerId)?.place || 0; // v31: gleiche Punkte = gleicher Platz
      const podium = finalPodium(ranked, place);
      if (els['game-question'].dataset.finalKey !== podium || !els['game-question'].querySelector('.final-screen')) { els['game-question'].innerHTML = podium; els['game-question'].dataset.finalKey = podium; }
      renderXpResult();
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }
    if (!current.question) { els['game-question'].innerHTML = '<div class="empty-state">Warte auf die nächste Frage.</div>'; return; }
    if (renderShow(current)) return; // v34: Brett / Einsatz-Finale
    if (!state.questionStartedAt) {
      App.setText(els['game-status'], 'Bereit');
      // v24: Zwischenstand immer live aus der aktuellen Rangliste (gespeicherte Runden-Stände konnten veraltet sein)
      const leader = state.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      const previous = leader && leader.score > 0 ? { standings: [{ name: leader.name, score: leader.score }] } : null;
      els['game-question'].innerHTML = `<div class="round-intro"><span class="eyebrow">${App.escapeHTML(current.round?.title || 'Nächste Runde')}</span><div class="round-intro-icon">${Quiz.topic(current.question.category).icon}</div><h2>${App.escapeHTML(current.question.category || 'Ohne Thema')}</h2><p>${Quiz.TYPE_ICONS[current.question.type] || '•'} ${Quiz.TYPE_LABELS[current.question.type] || current.question.type} · ${current.question.points} Punkte</p>${previous?.standings?.[0] ? `<div class="round-leader">Zwischenstand: <strong>${App.escapeHTML(previous.standings[0].name)}</strong> führt mit ${App.formatPoints(previous.standings[0].score)}</div>` : ''}</div>`;
      els['submit-answer'].hidden = true; els['answer-feedback'].innerHTML = ''; return;
    }

    const answerRecord = state.answers[current.question.id]?.[playerId];
    const questionResult = state.questionResults?.[current.question.id] || null;
    if (currentQuestionId !== current.question.id) { currentQuestionId = current.question.id; draftAnswer = answerRecord?.answer ?? null; }
    const resolved = state.scoredQuestionIds?.includes(current.question.id);
    const timedOut = Boolean(state.questionOpen && state.questionEndsAt && Date.now() >= Number(state.questionEndsAt));
    const answerWindowOpen = state.questionOpen && !timedOut;

    if (current.question.type === 'buzzer') return renderBuzzer(current, answerRecord, questionResult, resolved);
    if (Quiz.gameOf(current.question)) return renderDuel(current, answerRecord, questionResult, resolved);

    window.SylasphereMedia?.sync(state.media, current.question); // Song-Ausschnitte auf diesem Gerät abspielen
    const stages = Quiz.stagesOf(current.question);
    const stage = Number(state.stage) || 0;
    const locked = Quiz.locksOnSubmit(current.question) && Boolean(answerRecord);

    if (answerWindowOpen && locked) {
      // Antwort ist abgegeben und gesperrt (z. B. Song-Enthüllung)
      App.setText(els['game-status'], 'Antwort gesperrt');
      renderQuestion(current.question, { currentAnswer: answerRecord.answer, readOnly: true, reveal: false, result: questionResult, stage });
      els['submit-answer'].hidden = true;
      const at = stages ? stages[Math.min(stages.length - 1, Number(answerRecord.answer?.stage) || 0)] : null;
      els['answer-feedback'].innerHTML = `<div class="notice notice--success">🔒 Antwort abgegeben${at ? ` in Stufe ${(Number(answerRecord.answer?.stage) || 0) + 1} (${at.percent} % der Punkte)` : ''}. Der Moderator prüft sie bei der Auflösung.</div>`;
    } else if (answerWindowOpen) {
      App.setText(els['game-status'], 'Frage läuft');
      // v24: Ohne „Abschicken“ – jede Änderung wird automatisch gespeichert; was beim Zeitablauf drinsteht, zählt.
      // Ausnahme: Fragen, deren Antwort nach dem Abschicken gesperrt wird (Song-Enthüllung mit Stufen).
      const manual = Quiz.locksOnSubmit(current.question);
      renderQuestion(current.question, { currentAnswer: draftAnswer, readOnly: false, reveal: false, result: questionResult, stage, onAnswer: value => { draftAnswer = value; updateSubmit(); if (!manual) scheduleAutoSave(current.question.id); } });
      els['submit-answer'].hidden = !manual; els['submit-answer'].disabled = draftAnswer == null;
      els['submit-answer'].textContent = stages ? `Abschicken · ${stages[Math.min(stages.length - 1, stage)].percent} %` : 'Antwort abschicken';
      els['answer-feedback'].innerHTML = manual
        ? '<div class="notice">Du kannst nur einmal abschicken – danach ist deine Antwort gesperrt.</div>'
        : `<div class="notice autosave-note${answerRecord ? ' is-saved' : ''}">${answerRecord ? '✓ Gespeichert – du kannst bis zum Ende noch ändern.' : '✎ Deine Antwort wird automatisch gespeichert. Was beim Zeitablauf drinsteht, zählt.'}</div>`;
    } else if (!resolved) {
      App.setText(els['game-status'], 'Antworten geschlossen');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: false, result: questionResult, stage });
      els['submit-answer'].hidden = true;
      els['answer-feedback'].innerHTML = `<div class="notice notice--warning reveal-wait"><strong>⏱ Antworten sind geschlossen.</strong><span>${answerRecord ? 'Deine Antwort ist gespeichert. ' : ''}Der Moderator löst die Frage gleich auf.</span></div>`;
    } else {
      App.setText(els['game-status'], 'Auflösung');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: true, result: questionResult });
      els['submit-answer'].hidden = true;
      const correct = Quiz.correctAnswerText(current.question, questionResult); const points = answerRecord?.awardedPoints;
      const label = Quiz.solutionLabel(current.question);
      els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>${label}</span><strong>${App.escapeHTML(correct || '–')}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points || 0)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : '<div class="notice">Keine Antwort abgegeben.</div>'}${Renderers.answerEntriesHTML(questionResult?.entries, playerId)}`;
    }
  }

  /*
   * Zeichnet die Frage nur neu, wenn sich für diesen Spieler wirklich etwas ändert
   * (andere Frage, Phase, Auflösung, Buzzer-Status). Antworten anderer Spieler lösen
   * so kein Neuzeichnen mehr aus – Textfelder behalten den Fokus, Regler springen nicht.
   */
  function renderQuestion(question, ctx) {
    const host = els['game-question'];
    const frozenAnswer = ctx.readOnly || ctx.reveal ? (ctx.currentAnswer ?? null) : null;
    const key = JSON.stringify([question.id, Boolean(ctx.readOnly), Boolean(ctx.reveal), ctx.result ?? null, frozenAnswer]);
    if (host.dataset.renderKey === key && host.querySelector('.question-shell')) {
      // Kleine Änderungen (z. B. neue Song-Stufe) ohne Neuzeichnen – Eingaben behalten den Fokus
      Quiz.typeDef(question.type)?.update?.(question, host, ctx);
      return;
    }
    Renderers.renderPlayer(question, host, Object.assign({ playerId }, ctx)); // v26: eigene Wertung (z. B. Grid)
    host.dataset.renderKey = key;
  }

  // Zeitduell (v22): alle sehen Bild und Uhren; wer dran ist, tippt (Modus „Tippen“) oder spricht
  function renderDuel(current, answerRecord, questionResult, resolved) {
    const q = current.question;
    const game = state.game || null;
    const host = els['game-question'];
    if (host.dataset.renderKey !== `duel:${q.id}`) host.replaceChildren();
    host.dataset.renderKey = `duel:${q.id}`;
    Renderers.renderPlayer(q, host, {
      readOnly: resolved, reveal: resolved, result: questionResult, game, players: state.players, playerId, role: 'player',
      onGuess: text => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, { text, pos: Number(state.game.pos) || 0 })).catch(error => App.toast(error.message, 'error')); },
      // v24: Spieler kann selbst passen (beide Modi) – der Moderator-Rechner verarbeitet es
      onPass: () => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, { pass: true, pos: Number(state.game.pos) || 0, at: Date.now() })).catch(error => App.toast(error.message, 'error')); },
      // v25: Einordnen – Zug (Karte + Stelle) an den Moderator-Rechner
      onInput: answer => { if (!state.game) return; Promise.resolve(engine.submitAnswer(playerId, answer)).catch(error => App.toast(error.message, 'error')); }
    });
    els['submit-answer'].hidden = true;
    const Game = Quiz.gameOf(q);
    if (!resolved && Game?.playerStatus) {
      const info = Game.playerStatus(game, playerId);
      App.setText(els['game-status'], info.status);
      if (els['answer-feedback'].innerHTML !== info.html) els['answer-feedback'].innerHTML = info.html;
      return;
    }
    if (!resolved) {
      const g = game;
      App.setText(els['game-status'], !g ? 'Gleich geht’s los' : g.phase === 'done' ? 'Duell beendet' : g.phase === 'reveal' ? 'Lösung' : g.phase === 'paused' ? 'Pause' : g.active === playerId ? 'Du bist dran!' : 'Zeitduell');
      const out = g && Array.isArray(g.eliminated) && g.eliminated.includes(playerId);
      const inGame = g && Array.isArray(g.order) && g.order.includes(playerId);
      els['answer-feedback'].innerHTML = out ? '<div class="notice">Deine Zeit ist abgelaufen – du bist raus, schau den anderen zu.</div>'
        : g && !inGame ? '<div class="notice">Du bist nach dem Start beigetreten und schaust bei diesem Duell zu.</div>'
        : g?.phase === 'done' ? '<div class="notice notice--warning reveal-wait"><strong>🏁 Duell beendet.</strong><span>Der Moderator vergibt gleich die Punkte.</span></div>' : '';
      return;
    }
    App.setText(els['game-status'], 'Auflösung');
    const points = answerRecord?.awardedPoints;
    els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>Ergebnis</span><strong>${App.escapeHTML(Quiz.correctAnswerText(q, questionResult) || '–')}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points || 0)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : ''}`;
  }

  function renderBuzzer(current, answerRecord, questionResult, resolved) {
    const result = questionResult && questionResult.kind === 'buzzer' ? questionResult : { mode: current.question.buzzerMode || 'spoken', status: state.questionOpen ? 'open' : 'idle', eliminatedIds: [] };
    const myTurn = result.contenderId && String(result.contenderId) === String(playerId);
    const eliminated = Array.isArray(result.eliminatedIds) && result.eliminatedIds.includes(playerId);
    const answerWindowOpen = state.questionOpen && result.status === 'open';

    if (resolved) {
      App.setText(els['game-status'], 'Auflösung');
      renderQuestion(current.question, { currentAnswer: answerRecord?.answer ?? draftAnswer, readOnly: true, reveal: true, result, playerId });
      els['submit-answer'].hidden = true;
      const points = answerRecord?.awardedPoints || 0;
      const winnerText = result.winnerId ? `${result.winnerName || 'Spieler'} gewinnt den Buzzer` : 'Keine Wertung';
      const solution = Quiz.correctAnswerText(current.question, result) || '–';
      els['answer-feedback'].innerHTML = `<div class="reveal-box"><span>Buzzer-Ergebnis</span><strong>${App.escapeHTML(winnerText)}</strong></div><div class="reveal-box"><span>Lösung</span><strong>${App.escapeHTML(solution)}</strong></div>${answerRecord ? `<div class="points-earned ${points > 0 ? 'is-positive' : ''}"><span>Deine Punkte</span><strong>+${Math.round(points)} P</strong><small>${App.escapeHTML(answerRecord.scoreDetail || '')}</small></div>` : ''}`;
      return;
    }

    App.setText(els['game-status'], answerWindowOpen ? 'Buzzer offen' : 'Buzzer gesperrt');
    renderQuestion(current.question, { currentAnswer: draftAnswer, readOnly: !answerWindowOpen, reveal: false, result, playerId, onAnswer: value => { draftAnswer = value; updateSubmit(); } });

    if (answerWindowOpen && !eliminated) {
      els['submit-answer'].hidden = false;
      els['submit-answer'].textContent = current.question.buzzerMode === 'text' ? (answerRecord ? 'Schnellantwort aktualisieren' : 'Schnellantwort senden') : 'Jetzt buzzern';
      els['submit-answer'].disabled = current.question.buzzerMode === 'text' ? !String(draftAnswer ?? '').trim() : false;
      els['answer-feedback'].innerHTML = '<div class="notice">⚡ Geschwindigkeit zählt. Nur der erste Spieler kommt durch.</div>';
      return;
    }

    els['submit-answer'].hidden = true;
    if (myTurn) {
      els['answer-feedback'].innerHTML = current.question.buzzerMode === 'text'
        ? '<div class="notice notice--success">✓ Du warst zuerst. Deine Antwort wurde gesendet und wird jetzt geprüft.</div>'
        : '<div class="notice notice--success">✓ Du warst zuerst. Antworte jetzt mündlich, der Moderator prüft deine Antwort.</div>';
    } else if (eliminated) {
      els['answer-feedback'].innerHTML = '<div class="notice notice--warning">Du bist für diese Frage gesperrt, weil deine letzte Buzzer-Antwort falsch war.</div>';
    } else {
      const contender = result.contenderName || 'Ein anderer Spieler';
      els['answer-feedback'].innerHTML = `<div class="notice notice--warning">${App.escapeHTML(contender)} ist dran. Warte auf die Entscheidung des Moderators.</div>`;
    }
  }

  function finalPodium(ranked, place) {
    const me = ranked.find(p => p.id === playerId);
    const after = `${me ? `<div class="my-final-score"><span>Dein Ergebnis</span><strong>${App.formatPoints(me.score)}</strong></div>` : ''}<div class="xp-result" data-xp-result></div>${window.SylasphereHighlights?.html(state.highlights) || ''}`;
    // v29: Siegerehrung im Stil des Themes (js/core/themes.js)
    return window.SylasphereThemes.ceremony(ranked, { role: 'player', place, eyebrow: 'Finale', title: place === 1 ? (App.winnersOf(ranked).length > 1 ? '🤝 Gleichstand auf Platz 1!' : '🏆 Sieg!') : `Platz ${place || '–'}`, after });
  }


  // Automatisches Speichern (kurz verzögert, damit Tippen/Regler nicht jede Millisekunde senden)
  let autoSaveTimer = null, autoSaveQuestion = '', lastSaved = '';
  function scheduleAutoSave(questionId) {
    autoSaveQuestion = questionId;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(autoSave, 450);
  }
  async function autoSave() {
    if (!engine || !state) return;
    const current = engine.getCurrent(state);
    if (!current.question || current.question.id !== autoSaveQuestion || draftAnswer == null) return;
    if (!state.questionOpen || (state.questionEndsAt && Date.now() > Number(state.questionEndsAt) + 400)) return;
    const serialized = JSON.stringify([current.question.id, draftAnswer]);
    if (serialized === lastSaved) return;
    try {
      const ok = await engine.submitAnswer(playerId, draftAnswer);
      if (ok) lastSaved = serialized;
    } catch (error) { console.warn('Automatisches Speichern fehlgeschlagen', error); }
  }
  // Kurz vor Zeitablauf den letzten Stand sicher senden
  setInterval(() => {
    if (!autoSaveTimer || !state?.questionEndsAt || !state.questionOpen) return;
    if (Number(state.questionEndsAt) - Date.now() < 700) { clearTimeout(autoSaveTimer); autoSave(); }
  }, 250);

  function updateSubmit(){
    const current = engine?.getCurrent(state);
    if (current?.question?.type === 'buzzer' && current.question.buzzerMode === 'spoken') { els['submit-answer'].disabled = false; return; }
    els['submit-answer'].disabled=draftAnswer==null || (typeof draftAnswer === 'string' && !draftAnswer.trim());
  }

  async function submit(){
    if(!engine)return;
    const current = engine.getCurrent(state);
    if (!current.question) return;
    if (current.question.type !== 'buzzer' && draftAnswer == null) return;
    if (current.question.type === 'buzzer' && current.question.buzzerMode === 'text' && !String(draftAnswer ?? '').trim()) return;
    const payload = current.question.type === 'buzzer' && current.question.buzzerMode === 'spoken' ? null : draftAnswer;
    const button = els['submit-answer']; button.disabled = true;
    try {
      const ok = await engine.submitAnswer(playerId,payload);
      if(ok) App.toast(current.question.type === 'buzzer' ? 'Buzzer gesendet.' : 'Antwort gespeichert.','success'); else App.toast('Antwort konnte nicht mehr angenommen werden.','error');
    } catch (error) { App.toast(transport === 'online' ? Firebase.friendlyError(error) : error.message, 'error'); }
    finally {
      const stillOpen = Boolean(state?.questionOpen && (!state.questionEndsAt || Date.now() < Number(state.questionEndsAt)));
      if (stillOpen) updateSubmit();
    }
  }

  function renderLeaderboard() {
    // v34: Einsatz-Finale – Rangliste erst, wenn die Auflösung auf dem Beamer durch ist
    const fin = state?.show?.kind === 'final' ? state.show : null;
    if (fin && state.status === 'playing') {
      const rows = Array.isArray(fin.rows) ? fin.rows : Object.values(fin.rows || {});
      if (fin.phase !== 'reveal' || (Number(fin.index) || 0) < rows.length - 1) { els['leaderboard'].innerHTML = '<p class="microcopy">🤫 Die Rangliste gibt es nach der Finale-Auflösung.</p>'; return; }
    }
    const ranked = App.rankPlayers(state.players).slice(0, 10);
    const current = engine?.getCurrent(state);
    const resolved = Boolean(current?.question && state.scoredQuestionIds?.includes(current.question.id));
    const gains = resolved ? (state.answers[current.question.id] || {}) : {};
    App.renderRanking(els['leaderboard'], ranked.map((p, i) => {
      const gain = Number(gains[p.id]?.awardedPoints) || 0;
      return `<div class="leader-row ${p.id === playerId ? 'is-me' : ''}" data-pid="${App.escapeHTML(p.id)}" data-rank="${i + 1}"><span>${p.place}</span><span class="avatar small">${App.escapeHTML(App.avatar(p.avatar))}</span><strong>${App.escapeHTML(p.name)}${window.SylasphereProgress?.badge(p) || ''}</strong><span class="leader-score">${gain > 0 ? `<em>+${Math.round(gain)}</em>` : ''}<b>${Math.round(p.score)} P</b></span></div>`;
    }).join(''));
  }

  // v31: Timer als Balken über der Frage (schrumpft gleichmäßig, die letzten 5 Sekunden rot)
  let barFrame = 0;
  function setBar(progress, cls = '') {
    const bar = els['player-timebar'];
    if (!bar) return;
    bar.style.setProperty('--p', String(App.clamp(Number(progress) || 0, 0, 1)));
    bar.classList.toggle('is-critical', cls === 'is-critical');
    bar.classList.toggle('is-ended', cls === 'is-ended');
  }
  function renderTimer(current){
    timer?.stop(); cancelAnimationFrame(barFrame);
    const bar = els['player-timebar'];
    const buzzing = current?.question?.type === 'buzzer' && state.questionStartedAt && !state.scoredQuestionIds?.includes(current.question.id);
    const ends = Number(state.questionEndsAt) || 0, started = Number(state.questionStartedAt) || 0;
    const running = state.status === 'playing' && state.questionOpen && ends && started && !buzzing;
    if (state.paused && state.paused.remaining != null && state.questionOpen) { // v33: Pause – Balken eingefroren
      if (bar) bar.hidden = false;
      setBar(state.paused.remaining / Math.max(1000, (Number(current?.question?.timer) || 1) * 1000));
      App.setText(els['player-timer'], `⏸ ${Math.ceil(state.paused.remaining / 1000)} s`); return;
    }
    if (bar) bar.hidden = !running;
    if (!running) { App.setText(els['player-timer'], '–'); return; }
    const span = Math.max(1000, ends - started);
    const tick = () => { const left = ends - Date.now(); setBar(left / span, left <= 0 ? 'is-ended' : left <= 5000 ? 'is-critical' : ''); if (left > 0) barFrame = requestAnimationFrame(tick); };
    tick();
    timer=new Timer((seconds)=>{App.setText(els['player-timer'],`${seconds ?? '–'} s`); window.SylasphereSfx?.countdown(seconds);},()=>{ setBar(0, 'is-ended'); App.setText(els['player-timer'],'0 s'); els['submit-answer'].disabled=true; els['game-question'].querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true); App.setText(els['game-status'],'Zeit abgelaufen'); if(!state.scoredQuestionIds?.includes(current?.question?.id)) els['answer-feedback'].innerHTML='<div class="notice notice--warning">⏱ Zeit abgelaufen. Warte auf die Auflösung durch den Moderator.</div>'; }); timer.start(state.questionEndsAt);
  }

  // v33: lokal melden sich Spieler-Tabs alle 10 s (Online-Punkt beim Moderator); online macht das Firebase
  let heartbeatTimer = 0;
  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    if (transport !== 'local' || !engine?.heartbeat) return;
    const beat = () => { try { engine?.heartbeat(playerId); } catch (_) {} };
    beat(); heartbeatTimer = setInterval(beat, 10000);
  }
  // v33: Pause – Hinweis über der Frage, Eingaben gesperrt
  function renderPause() {
    let box = document.getElementById('player-pause');
    if (!state.paused) { box?.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'player-pause'; box.className = 'player-pause'; box.setAttribute('role', 'status');
      box.innerHTML = '<div><strong>⏸ Pause</strong><span>Gleich geht es weiter – der Timer ist angehalten.</span></div>';
      document.querySelector('.player-question-card')?.prepend(box);
    }
  }
  async function toggleReady() {
    const me = state?.players.find(p => p.id === playerId);
    if (!me || !engine?.setReady) return;
    try { await engine.setReady(playerId, !me.ready); } catch (error) { App.toast(error.message, 'error'); }
  }

  async function disconnect(message){
    clearInterval(heartbeatTimer);
    stopProgress?.(); stopProgress = null;
    identity?.destroy(); identity=null; try { await engine?.destroy?.(); } catch (_) {} engine=null;
    els['game-panel'].hidden=true; els['join-panel'].hidden=false; els['join-error'].textContent=message;
  }
})();
