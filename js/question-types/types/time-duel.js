(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * Zeitduell (v22) – inspiriert von Bilder-Duell-Shows
   * ------------------------------------------------------------------
   * Jeder Spieler hat ein eigenes Zeitkonto (Standard 30 s, wie eine Schachuhr).
   * Der Zufall bestimmt die Reihenfolge. Nur beim Spieler, der dran ist, läuft die Uhr.
   *  ✓ richtig  → Uhr stoppt, Lösung kurz sichtbar, nächster Spieler bekommt ein neues Bild
   *  ⏭ passen   → −3 s, Lösung 3 s sichtbar, nächster Spieler bekommt ein neues Bild
   *  ⏰ Zeit 0   → Spieler scheidet aus
   * Ende: nur noch ein Spieler übrig – oder die Bilder sind aufgebraucht.
   * Punkte nach Platzierung (im Editor einstellbar, z. B. 100 % / 60 % / 30 %).
   *
   * Antwort: „mündlich“ (Moderator drückt ✓ oder Passen) oder „tippen“
   * (das Moderator-Gerät prüft automatisch, Groß-/Kleinschreibung egal).
   *
   * Das Moderator-Gerät ist die Uhr: Es führt den Spielstand (state.game) und
   * schreibt nur bei Ereignissen (richtig, passen, Zeit abgelaufen). Alle Geräte
   * rechnen die laufende Zeit selbst aus – so bleibt es flüssig und sparsam.
   */
  const REVEAL_MS = { correct: 2000, pass: 3000, timeout: 3000 };
  const DEFAULT_PLACES = [100, 60, 30];

  // ---------------------------------------------------------------- Hilfen
  const toNumber = (v, f) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  function normalizeGuess(value) { return String(value || '').normalize('NFKC').replace(/[​-‍﻿]/g, '').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' '); }
  function shuffle(list, rand = Math.random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function parsePlaces(value) {
    const list = (Array.isArray(value) ? value : String(value ?? '').split(/[,;\s]+/).filter(Boolean)).map(Number).filter(n => Number.isFinite(n) && n >= 0).map(n => Math.min(100, n));
    return list.length ? list : DEFAULT_PLACES.slice();
  }
  const clockMs = q => Math.round(Math.max(5, Math.min(600, toNumber(q.clockSeconds, 30))) * 1000);
  const penaltyMs = q => Math.round(Math.max(0, Math.min(60, toNumber(q.passPenalty, 3))) * 1000);
  const itemAt = (q, game) => (q.items || [])[game?.deck?.[game.pos]] || null;

  // ---------------------------------------------------------------- Spiellogik (rein, ohne DOM – testbar)
  /** Firebase entfernt leere Listen/Objekte – hier wieder auffüllen */
  function normalizeGame(game) {
    if (!game || typeof game !== 'object') return null;
    const g = JSON.parse(JSON.stringify(game));
    g.order = Array.isArray(g.order) ? g.order : Object.values(g.order || {});
    g.deck = (Array.isArray(g.deck) ? g.deck : Object.values(g.deck || {})).map(Number);
    g.eliminated = Array.isArray(g.eliminated) ? g.eliminated : Object.values(g.eliminated || {});
    g.clocks = g.clocks && typeof g.clocks === 'object' ? g.clocks : {};
    g.pos = toNumber(g.pos, 0);
    g.runningSince = g.runningSince == null ? null : Number(g.runningSince);
    g.reveal = g.reveal || null;
    g.lastGuess = g.lastGuess || null;
    return g;
  }
  function remaining(game, playerId, now = Date.now()) {
    if (!game) return 0;
    const base = toNumber(game.clocks?.[playerId], 0);
    if (game.phase === 'play' && game.active === playerId && game.runningSince) return Math.max(0, base - (now - game.runningSince));
    return Math.max(0, base);
  }
  function alive(game) { return (game?.order || []).filter(id => !(game.eliminated || []).includes(id)); }

  /** Neues Duell: zufällige Reihenfolge und (optional) gemischte Bilder */
  function start(q, playerIds, now = Date.now(), rand = Math.random) {
    const order = shuffle(playerIds.map(String), rand);
    const indexes = (q.items || []).map((_, i) => i);
    const deck = q.shuffleImages === false ? indexes : shuffle(indexes, rand);
    const clocks = Object.fromEntries(order.map(id => [id, clockMs(q)]));
    return { kind: 'time-duel', questionId: String(q.id || ''), phase: order.length && deck.length ? 'play' : 'done', order, active: order[0] || '', clocks, runningSince: now, deck, pos: 0, eliminated: [], reveal: null, lastGuess: null, startedAt: now, endReason: order.length ? '' : 'no-players', seq: 1 };
  }
  // Laufende Zeit des aktiven Spielers festschreiben (Uhr anhalten)
  function settle(game, now) {
    if (game.phase === 'play' && game.runningSince && game.active) game.clocks[game.active] = remaining(game, game.active, now);
    game.runningSince = null;
  }
  function beginReveal(game, q, now, reason) {
    const item = itemAt(q, game);
    game.reveal = { pos: game.pos, reason, by: game.active, answer: String(item?.answer || ''), image: String(item?.image || ''), until: now + REVEAL_MS[reason] };
    game.phase = 'reveal';
    game.lastGuess = null;
    game.seq = (game.seq || 0) + 1;
    return game;
  }
  function correct(input, q, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game || game.phase !== 'play') return input;
    settle(game, now);
    return beginReveal(game, q, now, 'correct');
  }
  function pass(input, q, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game || game.phase !== 'play') return input;
    settle(game, now);
    game.clocks[game.active] = Math.max(0, toNumber(game.clocks[game.active], 0) - penaltyMs(q));
    return beginReveal(game, q, now, 'pass');
  }
  function pause(input, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game || game.phase !== 'play') return input;
    settle(game, now);
    game.phase = 'paused'; game.seq++;
    return game;
  }
  function resume(input, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game || game.phase !== 'paused') return input;
    game.phase = 'play'; game.runningSince = now; game.seq++;
    return game;
  }
  /** Nach der Lösungsanzeige: Ausscheiden prüfen, nächster Spieler, neues Bild */
  function advance(game, now) {
    const by = game.reveal?.by || game.active;
    if (toNumber(game.clocks[by], 0) <= 0 && !game.eliminated.includes(by)) game.eliminated.push(by);
    game.reveal = null;
    game.pos += 1;
    const left = alive(game);
    const lastStanding = game.order.length > 1 ? left.length <= 1 : left.length === 0;
    if (lastStanding || game.pos >= game.deck.length) {
      game.phase = 'done'; game.active = ''; game.runningSince = null;
      game.endReason = lastStanding ? 'last-standing' : 'out-of-images';
      game.seq++;
      return game;
    }
    // Reihum zum nächsten Spieler, der noch im Spiel ist
    const start = game.order.indexOf(by);
    for (let step = 1; step <= game.order.length; step++) {
      const candidate = game.order[(start + step) % game.order.length];
      if (!game.eliminated.includes(candidate)) { game.active = candidate; break; }
    }
    game.phase = 'play'; game.runningSince = now; game.seq++;
    return game;
  }
  /** Vom Moderator-Gerät regelmäßig aufgerufen. Gibt bei Änderung einen neuen Stand zurück, sonst denselben. */
  function tick(input, q, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game) return input;
    if (game.phase === 'play' && remaining(game, game.active, now) <= 0) {
      settle(game, now);
      game.clocks[game.active] = 0;
      return beginReveal(game, q, now, 'timeout');
    }
    if (game.phase === 'reveal' && game.reveal && now >= Number(game.reveal.until)) return advance(game, now);
    return input;
  }
  /** Getippte Antwort prüfen (nur der Spieler, der dran ist, für das aktuelle Bild) */
  function guess(input, q, playerId, text, now = Date.now()) {
    const game = normalizeGame(input);
    if (!game || game.phase !== 'play' || game.active !== playerId) return input;
    const item = itemAt(q, game);
    if (item && normalizeGuess(text) && normalizeGuess(text) === normalizeGuess(item.answer)) return correct(game, q, now);
    game.lastGuess = { by: playerId, text: String(text || '').slice(0, 80), at: now };
    game.seq++;
    return game;
  }
  /** Platzierung: Übrige nach Restzeit, dann Ausgeschiedene (zuletzt ausgeschieden = besser) */
  function placements(input) {
    const game = normalizeGame(input);
    if (!game) return [];
    const standing = alive(game).sort((a, b) => toNumber(game.clocks[b], 0) - toNumber(game.clocks[a], 0));
    const out = game.eliminated.slice().reverse();
    return [...standing, ...out].map((playerId, i) => ({ playerId, rank: i + 1, remainingMs: Math.round(toNumber(game.clocks[playerId], 0)), out: game.eliminated.includes(playerId) }));
  }

  const Game = { start, correct, pass, pause, resume, tick, guess, advance, remaining, alive, placements, normalize: normalizeGame, normalizeGuess, parsePlaces, REVEAL_MS };

  // ---------------------------------------------------------------- Anzeige
  function fmt(ms) { const s = Math.max(0, ms) / 1000; return s >= 10 ? String(Math.ceil(s)) : s.toFixed(1).replace('.', ','); }
  const REASON = { correct: '✓ Richtig', pass: '⏭ Gepasst', timeout: '⏰ Zeit abgelaufen' };

  /*
   * Idempotent: wird bei jeder Zustandsänderung erneut aufgerufen und aktualisiert nur,
   * was sich geändert hat (Eingabefeld behält den Fokus). Eine eigene Schleife lässt
   * die Uhr des aktiven Spielers flüssig laufen.
   * ctx: { game, players, playerId, role, reveal, result, onGuess(text), onPass() }
   */
  function render(q, container, ctx) {
    let root = container.querySelector(`.duel[data-qid="${CSS.escape(String(q.id))}"]`);
    if (!root) {
      const wrap = Kit.baseQuestion(q);
      root = Kit.el('div', 'duel');
      root.dataset.qid = String(q.id);
      root.innerHTML = `
        <div class="duel-stage"><div class="duel-image"></div><div class="duel-overlay" hidden></div></div>
        <div class="duel-turn"></div>
        <form class="duel-guess" hidden autocomplete="off"><input class="input" maxlength="80" placeholder="Was ist auf dem Bild?" enterkeyhint="send" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="btn btn--primary" type="submit">Raten</button></form>
        <button type="button" class="btn duel-pass duel-self-pass" hidden>⏭ Passen</button>
        <div class="duel-clocks"></div>`;
      wrap.append(root);
      container.replaceChildren(wrap);
      const form = root.querySelector('.duel-guess');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        root._ctx?.onGuess?.(text);
        input.value = '';
      });
      const passButton = root.querySelector('.duel-self-pass');
      passButton.addEventListener('click', () => {
        if (passButton.disabled) return;
        passButton.disabled = true; // Doppeltipp verhindern – wird beim nächsten Bild wieder aktiv
        root._ctx?.onPass?.();
      });
    }
    root._ctx = ctx;
    root._q = q;
    paint(root);
    if (!root._loop) {
      root._loop = setInterval(() => { if (!root.isConnected) { clearInterval(root._loop); root._loop = null; return; } paintClocks(root); }, 100);
    }
  }

  function paint(root) {
    const ctx = root._ctx || {};
    const q = root._q;
    const game = normalizeGame(ctx.game);
    const players = new Map((ctx.players || []).map(p => [p.id, p]));
    const name = id => players.get(id)?.name || 'Spieler';
    const imageBox = root.querySelector('.duel-image');
    const overlay = root.querySelector('.duel-overlay');
    const turn = root.querySelector('.duel-turn');
    const form = root.querySelector('.duel-guess');
    const App = window.SchmobinApp;
    const esc = App.escapeHTML;

    // Bild
    let src = '';
    if (game?.phase === 'reveal' && game.reveal) src = game.reveal.image || q.items?.[game.deck[game.reveal.pos]]?.image || '';
    else if (game && (game.phase === 'play' || game.phase === 'paused')) src = q.items?.[game.deck[game.pos]]?.image || '';
    src = App.sanitizeURL(src);
    if (imageBox.dataset.src !== src) {
      imageBox.dataset.src = src;
      if (src) { const img = new Image(); img.alt = 'Welches Wort passt?'; img.src = src; imageBox.replaceChildren(img); }
      else imageBox.innerHTML = `<div class="duel-placeholder">${game?.phase === 'done' ? '🏁' : '⏱'}<span>${game?.phase === 'done' ? 'Duell beendet' : 'Gleich geht’s los …'}</span></div>`;
      // nächstes Bild vorladen
      const next = game ? q.items?.[game.deck[game.pos + 1]]?.image : '';
      if (next) { const pre = new Image(); pre.src = App.sanitizeURL(next); }
    }
    // Lösung / Ereignis
    if (game?.phase === 'reveal' && game.reveal) {
      const r = game.reveal;
      const out = r.reason !== 'correct' && Number(game.clocks[r.by]) <= 0;
      overlay.hidden = false;
      overlay.className = `duel-overlay is-${r.reason}`;
      overlay.innerHTML = `<span class="duel-reason">${REASON[r.reason] || ''} · ${esc(name(r.by))}${r.reason === 'pass' ? ` −${fmt(penaltyMs(q))} s` : ''}</span><strong>${esc(r.answer || '')}</strong>${out ? `<em>${esc(name(r.by))} ist raus!</em>` : ''}`;
    } else if (game?.phase === 'paused') {
      overlay.hidden = false; overlay.className = 'duel-overlay is-paused'; overlay.innerHTML = '<strong>⏸ Pause</strong>';
    } else overlay.hidden = true;

    // Wer ist dran?
    const me = ctx.playerId || '';
    const myTurn = game?.phase === 'play' && game.active === me && me;
    const typed = q.answerMode === 'typed';
    if (!game) turn.innerHTML = `<span class="duel-hint">${ctx.role === 'moderator' ? 'Tippe auf „🎲 Duell starten“ – der Zufall bestimmt, wer beginnt.' : 'Der Moderator startet gleich das Duell.'}</span>`;
    else if (game.phase === 'done') turn.innerHTML = `<span class="duel-hint">🏁 ${game.endReason === 'out-of-images' ? 'Alle Bilder gespielt' : `${esc(name(placements(game)[0]?.playerId))} gewinnt das Duell!`}</span>`;
    else if (game.phase === 'play' || game.phase === 'paused') {
      const guessNote = game.lastGuess && game.lastGuess.by === game.active ? `<span class="duel-wrong">✗ ${esc(game.lastGuess.text)}</span>` : '';
      turn.innerHTML = myTurn
        ? `<span class="duel-you">Du bist dran!</span><span class="duel-hint">${typed ? 'Tippe, was auf dem Bild ist.' : 'Sag laut, was auf dem Bild ist.'}</span>${guessNote}`
        : `<span class="duel-now"><b>${esc(name(game.active))}</b> ist dran</span>${guessNote}`;
    } else turn.innerHTML = '';
    const showForm = Boolean(myTurn && typed && ctx.onGuess && !ctx.readOnlyGuess);
    const passButton = root.querySelector('.duel-self-pass');
    const showPass = Boolean(myTurn && ctx.onPass && !ctx.readOnlyGuess);
    passButton.hidden = !showPass;
    const passKey = `${game?.pos}|${game?.active}`;
    if (passButton.dataset.key !== passKey) { passButton.dataset.key = passKey; passButton.disabled = false; }
    passButton.innerHTML = `⏭ Passen <small>−${fmt(penaltyMs(q))} s</small>`;
    if (form.hidden === showForm) {
      form.hidden = !showForm;
      if (showForm) setTimeout(() => { const field = form.querySelector('input'); field?.focus(); field?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
    }

    // Uhren
    const clocks = root.querySelector('.duel-clocks');
    const order = game?.order?.length ? game.order : (ctx.players || []).map(p => p.id);
    const ranks = game?.phase === 'done' ? new Map(placements(game).map(p => [p.playerId, p.rank])) : null;
    const key = JSON.stringify([order, game?.active, game?.phase, game?.eliminated, ranks && [...ranks], me]);
    if (clocks.dataset.key !== key) {
      clocks.dataset.key = key;
      clocks.innerHTML = order.map(id => {
        const p = players.get(id) || { name: 'Spieler', avatar: '🙂' };
        const out = game?.eliminated?.includes(id);
        const active = game && game.active === id && game.phase !== 'done';
        const rank = ranks?.get(id);
        return `<div class="duel-clock${active ? ' is-active' : ''}${out ? ' is-out' : ''}${id === me ? ' is-me' : ''}${rank === 1 ? ' is-winner' : ''}" data-player="${esc(id)}"><span class="duel-avatar">${esc(App.avatar(p.avatar))}</span><span class="duel-name">${esc(p.name)}</span><b class="duel-time"></b>${rank ? `<small class="duel-rank">${rank}.</small>` : ''}</div>`;
      }).join('');
    }
    paintClocks(root);
  }

  function paintClocks(root) {
    const ctx = root._ctx || {};
    const game = normalizeGame(ctx.game);
    const q = root._q;
    const now = Date.now();
    root.querySelectorAll('.duel-clock').forEach(node => {
      const id = node.dataset.player;
      const ms = game ? remaining(game, id, now) : clockMs(q);
      const time = node.querySelector('.duel-time');
      const text = game?.eliminated?.includes(id) ? 'raus' : fmt(ms);
      if (time.textContent !== text) time.textContent = text;
      node.classList.toggle('is-critical', Boolean(game && game.phase === 'play' && game.active === id && ms <= 5000));
      const total = clockMs(q);
      node.style.setProperty('--clock', String(Math.max(0, Math.min(1, ms / total))));
    });
  }

  // ---------------------------------------------------------------- Editor
  function editor(q, ui, box) {
    const { div, input, labelField, button } = ui;
    box.append(div('editor-help', 'Jeder Spieler hat ein Zeitkonto. Reihum wird ein Bild gezeigt: richtig → Uhr stoppt, nächster Spieler. Passen kostet Zeit. Wer auf 0 fällt, ist raus. Punkte gibt es nach Platzierung.'));
    const grid = div('dynamic-grid');
    const clock = input('number', q.clockSeconds, 'input'); clock.min = '5'; clock.max = '600';
    clock.addEventListener('input', e => { q.clockSeconds = Math.max(5, Number(e.target.value) || 30); ui.queueSave(); });
    const penalty = input('number', q.passPenalty, 'input'); penalty.min = '0'; penalty.max = '60'; penalty.step = '0.5';
    penalty.addEventListener('input', e => { q.passPenalty = Math.max(0, Number(e.target.value) || 0); ui.queueSave(); });
    const mode = document.createElement('select'); mode.className = 'select';
    mode.innerHTML = '<option value="spoken">Mündlich – Moderator drückt ✓ oder Passen</option><option value="typed">Tippen – System prüft automatisch</option>';
    mode.value = q.answerMode;
    mode.addEventListener('change', e => { q.answerMode = e.target.value; ui.queueSave(); });
    const places = input('text', (q.placePoints || []).join(', '), 'input'); places.placeholder = '100, 60, 30';
    places.addEventListener('change', e => { q.placePoints = parsePlaces(e.target.value); e.target.value = q.placePoints.join(', '); ui.queueSave(); });
    const shuffleBox = document.createElement('select'); shuffleBox.className = 'select';
    shuffleBox.innerHTML = '<option value="true">Zufällig mischen</option><option value="false">Reihenfolge wie unten</option>';
    shuffleBox.value = String(q.shuffleImages !== false);
    shuffleBox.addEventListener('change', e => { q.shuffleImages = e.target.value === 'true'; ui.queueSave(); });
    grid.append(labelField('Zeit pro Spieler (s)', clock), labelField('Passen kostet (s)', penalty), labelField('Antwort', mode), labelField('Bilder', shuffleBox));
    const placesField = labelField('Punkte nach Platz in % (1., 2., 3. …)', places);
    placesField.classList.add('span-wide');
    grid.append(placesField);
    box.append(grid);

    const list = div('duel-items');
    const head = div('duel-items-head');
    const count = Kit.el('strong', '');
    head.append(count);
    box.append(head, list);

    function renderItems() {
      count.textContent = `${q.items.length} Bilder`;
      list.replaceChildren(...q.items.map((item, index) => {
        const row = div('duel-item');
        const n = Kit.el('span', 'duel-item-no', String(index + 1));
        const img = input('text', item.image || '', 'input'); img.placeholder = './assets/duell/katze.webp';
        img.addEventListener('input', e => { item.image = e.target.value; ui.queueSave(); });
        const answer = input('text', item.answer || '', 'input'); answer.placeholder = 'Lösung, z. B. Katze';
        answer.addEventListener('input', e => { item.answer = e.target.value; ui.queueSave(); });
        const imgField = labelField('Bild', img);
        const ansField = labelField('Lösung', answer);
        const remove = button('✕', 'icon-btn', () => { q.items.splice(index, 1); renderItems(); ui.queueSave(); });
        remove.title = 'Bild entfernen';
        row.append(n, imgField, ansField, remove);
        window.SylasphereMediaLibrary?.enhance(img, 'image');
        return row;
      }));
    }
    renderItems();

    const actions = div('duel-item-actions');
    actions.append(button('+ Bild', 'btn btn--small', () => { q.items.push({ image: '', answer: '' }); renderItems(); ui.queueSave(); }));
    // v25.1: viele Bilder auf einmal hochladen – Lösung aus dem Dateinamen (katze.jpg → Katze)
    const Cloud = window.SylasphereCloudMedia;
    if (Cloud?.available()) {
      const note = Kit.el('span', 'field-hint', '');
      actions.append(button('⬆ Bilder hochladen', 'btn btn--small btn--primary', async () => {
        await Cloud.pickAndUpload({
          kind: 'image', multiple: true, folder: 'zeitduell',
          onProgress: text => { note.textContent = text; },
          onEach: r => { q.items = q.items.filter(i => i.image || i.answer); q.items.push({ image: r.url, answer: Cloud.labelFromName(r.name) }); renderItems(); ui.queueSave(); }
        });
      }), note);
    }
    // Ganzen Ordner übernehmen – Lösung aus dem Dateinamen (katze.webp → Katze)
    const Library = window.SylasphereMediaLibrary;
    if (Library) {
      const folderSelect = document.createElement('select'); folderSelect.className = 'select'; folderSelect.innerHTML = '<option value="">Ordner aus assets/ wählen …</option>';
      folderSelect.addEventListener('focus', async () => {
        if (folderSelect.dataset.loaded) return;
        folderSelect.dataset.loaded = '1';
        try {
          const files = (await Library.list()).filter(f => f.kind === 'image');
          const folders = [...new Set(files.map(f => f.folder))].sort();
          folderSelect.innerHTML = '<option value="">Ordner aus assets/ wählen …</option>' + folders.map(f => `<option value="${window.SchmobinApp.escapeHTML(f)}">${window.SchmobinApp.escapeHTML(f || 'assets (Hauptordner)')} · ${files.filter(x => x.folder === f).length} Bilder</option>`).join('');
        } catch (error) { folderSelect.innerHTML = `<option value="">${window.SchmobinApp.escapeHTML(error.message)}</option>`; }
      }, { once: false });
      const addFolder = button('📁 Alle Bilder übernehmen', 'btn btn--small', async () => {
        const folder = folderSelect.value;
        if (!folderSelect.dataset.loaded || folderSelect.selectedIndex <= 0) { window.SchmobinApp.toast('Bitte zuerst einen Ordner wählen.', 'error'); return; }
        const files = (await Library.list()).filter(f => f.kind === 'image' && f.folder === folder);
        const known = new Set(q.items.map(i => i.image));
        const fresh = files.filter(f => !known.has(f.path));
        fresh.forEach(f => q.items.push({ image: f.path, answer: answerFromFile(f.name) }));
        // leere Platzhalter-Zeilen entfernen
        q.items = q.items.filter(i => i.image || i.answer);
        renderItems(); ui.queueSave();
        window.SchmobinApp.toast(`${fresh.length} Bilder übernommen – Lösungen bitte kurz prüfen.`, 'success');
      });
      actions.append(folderSelect, addFolder);
    }
    box.append(actions);
    box.append(div('editor-help', 'Tipp: Lege die Bilder in einen eigenen Ordner, z. B. assets/duell-tiere/, und übernimm ihn mit einem Klick. Die Lösung wird aus dem Dateinamen vorgeschlagen (hund.webp → Hund). Achtung: Dateinamen sind für neugierige Spieler technisch sichtbar – bei ernsten Wettkämpfen neutral benennen und die Lösung von Hand eintragen.'));
  }
  function answerFromFile(name) {
    const base = String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+\d+$/, '').trim();
    return base ? base.charAt(0).toLocaleUpperCase('de-DE') + base.slice(1) : '';
  }

  // ---------------------------------------------------------------- Registrierung
  window.SylasphereTypes.register({
    type: 'time-duel',
    label: 'Zeitduell',
    icon: '⏱',
    description: 'Bilder-Duell mit Schachuhr: Wer zuerst keine Zeit mehr hat, scheidet aus. Reihum, mündlich oder getippt.',
    solutionLabel: 'Ergebnis',
    noTimer: true,
    scoresAllPlayers: true,
    game: Game,
    defaults: () => ({
      text: 'Was ist auf dem Bild?', points: 300, clockSeconds: 30, passPenalty: 3, answerMode: 'spoken', placePoints: DEFAULT_PLACES.slice(), shuffleImages: true, timer: 0,
      items: [
        { image: './assets/duell/sonne.svg', answer: 'Sonne' },
        { image: './assets/duell/baum.svg', answer: 'Baum' },
        { image: './assets/duell/haus.svg', answer: 'Haus' },
        { image: './assets/duell/herz.svg', answer: 'Herz' }
      ]
    }),
    normalize(q) {
      q.items = (Array.isArray(q.items) ? q.items : []).map(item => ({ image: String(item?.image ?? item?.src ?? ''), answer: String(item?.answer ?? item?.solution ?? '') }));
      q.clockSeconds = Math.max(5, Math.min(600, toNumber(q.clockSeconds, 30)));
      q.passPenalty = Math.max(0, Math.min(60, toNumber(q.passPenalty, 3)));
      q.answerMode = q.answerMode === 'typed' ? 'typed' : 'spoken';
      q.placePoints = parsePlaces(q.placePoints);
      q.shuffleImages = q.shuffleImages !== false;
      q.timer = 0;
    },
    validate(q, report) {
      if (!Array.isArray(q.items) || q.items.length < 2) report.error('items', 'Zeitduell braucht mindestens 2 Bilder.');
      (q.items || []).forEach((item, i) => {
        if (!String(item.image || '').trim()) report.error('items', `Bild ${i + 1}: Bildquelle fehlt.`);
        else Kit.mediaAdvice(item.image, 'image').forEach(a => { if (a.level === 'error') report.error('items', `Bild ${i + 1}: ${a.text}`); else if (a.level === 'warn') report.warn('items', `Bild ${i + 1}: ${a.text}`); });
        if (!String(item.answer || '').trim()) report.error('items', `Bild ${i + 1}: Lösung fehlt.`);
      });
      if ((q.items || []).length && (q.items || []).length < 12) report.warn('items', 'Tipp: Für ein spannendes Duell etwa 15–40 Bilder einplanen, damit sie nicht zu früh ausgehen.');
    },
    // Lösungen verstecken – Bilder dürfen die Spieler vorab laden
    hideSolution(pq) { pq.items = (pq.items || []).map(item => ({ image: item.image })); },
    resolve(q, answers, options = {}) {
      const names = options.names || {};
      const list = placements(options.game).map(place => Object.assign(place, { name: String(names[place.playerId] || 'Spieler') }));
      return { kind: 'time-duel', placements: list, endReason: normalizeGame(options.game)?.endReason || '' };
    },
    score(q, answer, { base, result, playerId }) {
      const place = (result?.placements || []).find(p => p.playerId === playerId);
      if (!place) return { points: 0, detail: 'Nicht am Duell beteiligt' };
      const pct = parsePlaces(q.placePoints)[place.rank - 1] || 0;
      return { points: Math.round(base * pct / 100), detail: `${place.rank}. Platz${place.out ? '' : ` · ${fmt(place.remainingMs)} s übrig`}` };
    },
    solutionText(q, result) {
      const first = result?.placements?.[0];
      if (!first) return `${(q.items || []).length} Bilder`;
      return result.placements.slice(0, 3).map(p => `${p.rank}. ${p.name || 'Spieler'}`).join(' · ');
    },
    moderatorSolution(q) { return { text: `${(q.items || []).length} Bilder · ${q.clockSeconds} s pro Spieler`, extra: q.answerMode === 'typed' ? 'Spieler tippen – richtige Antworten werden automatisch erkannt.' : 'Mündlich – du drückst ✓ oder Passen.' }; },
    answerLabel(q, answer) { return answer && typeof answer === 'object' ? String(answer.text || '') : String(answer ?? '–'); },
    render,
    update: render,
    editor
  });
})();
