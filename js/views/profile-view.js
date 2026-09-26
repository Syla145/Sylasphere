(function () {
  'use strict';

  /*
   * Profil & Statistik (v28) – profil.html
   * ------------------------------------------------------------------
   * Für angemeldete Konten: Stufe mit XP-Balken, Statistiken (Spiele, Siege,
   * Trefferquote pro Fragetyp und Thema, letzte Spiele), Emotes, Bestenliste (Opt-in).
   * Moderatoren sehen zusätzlich die schwersten Fragen ihrer Quizze.
   * Daten: js/core/progress-store.js, Rechenlogik: js/core/progress.js
   */
  const App = window.SchmobinApp;
  const Account = window.SylasphereAccount;
  const UI = window.SylasphereAccountUI;
  const Progress = window.SylasphereProgress;
  const Store = window.SylasphereProgressStore;
  const esc = value => App.escapeHTML(value);
  const pct = rate => `${Math.round((Number(rate) || 0) * 100)} %`;
  const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const $ = id => document.getElementById(id);
  let loadedFor = '';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try { await Account.init(); }
    catch (error) { $('profile-content').innerHTML = `<div class="notice notice--error">Firebase ist nicht erreichbar: ${esc(Account.errorText(error))}</div>`; return; }
    $('account-slot')?.replaceWith(UI.headerButton({ onLogin: () => $('profile-content').scrollIntoView({ behavior: 'smooth' }) }));
    Account.onChange(render);
    render(Account.state());
  }

  function render(state) {
    const user = state.user && !state.user.isAnonymous ? state.user : null;
    if (!user) {
      loadedFor = '';
      const wrap = document.createElement('div');
      wrap.className = 'panel panel-pad profile-login';
      wrap.append(UI.loginCard({ title: 'Dein Profil', intro: 'Melde dich an, um XP zu sammeln, Stufen aufzusteigen, Emotes freizuschalten und deine Statistik zu sehen. Spieler brauchen keine Freischaltung.' }));
      $('profile-content').replaceChildren(wrap);
      return;
    }
    if (!state.role) return; // Rolle lädt noch
    const key = `${user.uid}|${state.role}`;
    if (key === loadedFor) return;
    loadedFor = key;
    load(user);
  }

  async function load(user) {
    const box = $('profile-content');
    box.innerHTML = '<p class="microcopy">Profil wird geladen …</p>';
    const context = Account.context();
    try {
      await window.SylasphereTypes?.ready;
      const data = await Store.loadProfile(context, user.uid);
      const moderator = Account.canModerate();
      const [board, modStats] = await Promise.all([
        Store.leaderboard(context).catch(() => null),
        moderator ? Store.loadModStats(context, user.uid).catch(() => ({})) : Promise.resolve(null)
      ]);
      Store.syncLeaderboard(context, user.uid).catch(() => {});
      box.innerHTML = page(user, data, board, modStats);
      bind(user, data);
    } catch (error) {
      box.innerHTML = `<div class="notice notice--error">Profil konnte nicht geladen werden: ${esc(Account.errorText(error))}<br><small>Sind die Firebase-Regeln für v28 veröffentlicht? (FIREBASE_SETUP.md)</small></div>`;
    }
  }

  function page(user, data, board, modStats) {
    const stats = Progress.playerStats(data.games);
    const xp = Number(data.xp?.total) || 0;
    const info = Progress.levelInfo(xp);
    const sameDay = data.xp && Date.now() - Number(data.xp.day) < Progress.RULES.DAY_MS;
    const today = sameDay ? Number(data.xp.dayXp) || 0 : 0;
    return `
      <section class="panel panel-pad profile-hero">
        <div class="profile-who">${UI.avatar(user)}<div><span class="eyebrow">Profil</span><h1>${esc(data.profile?.name || user.name)}</h1></div><span class="level-badge level-badge--big">⭐ Stufe ${info.level}</span></div>
        <div class="level-row level-row--big"><div class="xp-track" role="progressbar" aria-valuemin="0" aria-valuemax="${info.to - info.from}" aria-valuenow="${info.xp - info.from}" aria-label="Fortschritt bis Stufe ${info.level + 1}"><span style="width:${Math.round(info.progress * 100)}%"></span></div>
          <small><strong>${info.xp} XP</strong> · noch ${info.missing} XP bis Stufe ${info.level + 1} · heute ${today} / ${Progress.RULES.DAY_CAP} XP</small></div>
      </section>
      <section class="stat-tiles">
        ${tile('Spiele', stats.games)}${tile('Siege', stats.wins)}${tile('Podestplätze', stats.podiums)}${tile('Trefferquote', stats.answered ? pct(stats.rate) : '–', stats.answered ? `${stats.correct} von ${stats.answered} Antworten` : '')}
      </section>
      ${stats.games ? '' : '<div class="notice">Noch keine Spiele gespeichert. Tritt einem Online-Quiz mit deinem Konto bei – nach dem Spielende erscheinen hier deine XP und Statistiken.</div>'}
      <div class="profile-grid">
        ${breakdown('Nach Fragetyp', stats.byType, type => { const def = window.SylasphereTypes?.get(type); return `${def?.icon || '•'} ${def?.label || type}`; })}
        ${breakdown('Nach Thema', stats.byTopic, topic => { const t = window.SylasphereTopics?.resolve(topic); return `${t?.icon || '🏷️'} ${topic}`; })}
      </div>
      ${recent(stats.recent)}
      ${emotes(info.level)}
      ${leaderboard(user, data, board)}
      ${modStats ? hardest(modStats) : ''}
      ${xpHelp()}`;
  }

  const tile = (label, value, sub = '') => `<div class="panel stat-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;

  /** Balken pro Fragetyp/Thema: Trefferquote als Balken + Zahlen als Text */
  function breakdown(title, map, labelOf) {
    const rows = Object.entries(map || {}).map(([key, v]) => ({ key, a: Number(v.a) || 0, c: Number(v.c) || 0 })).filter(r => r.a > 0).sort((x, y) => y.a - x.a).slice(0, 12);
    if (!rows.length) return '';
    return `<section class="panel panel-pad"><div class="section-title"><h2>${esc(title)}</h2></div><div class="rate-list">${rows.map(r => `
      <div class="rate-row"><span class="rate-label">${esc(labelOf(r.key))}</span><div class="rate-track" aria-hidden="true"><span style="width:${Math.round((r.c / r.a) * 100)}%"></span></div><span class="rate-value"><strong>${pct(r.c / r.a)}</strong> <small>${r.c}/${r.a}</small></span></div>`).join('')}</div></section>`;
  }

  function recent(list) {
    if (!list.length) return '';
    return `<section class="panel panel-pad"><div class="section-title"><h2>Letzte Spiele</h2></div><div class="recent-list">${list.map(g => `
      <div class="recent-row"><span class="recent-rank">${Number(g.rank) === 1 ? '🏆' : `${esc(g.rank)}.`}</span><div><strong>${esc(g.quizTitle || 'Quiz')}</strong><small>${g.at ? esc(dateFormat.format(new Date(Number(g.at)))) : ''} · Platz ${esc(g.rank)} von ${esc(g.players)} · ${esc(g.correct)}/${esc(g.questions)} richtig${Array.isArray(g.hl) && g.hl.length ? ` · ${esc(g.hl.join(' '))}` : ''}</small></div><span class="recent-xp">+${esc(Math.round(Number(g.xp) || 0))} XP</span></div>`).join('')}</div></section>`;
  }

  function emotes(level) {
    const base = window.SylasphereReactions?.EMOJIS || [];
    return `<section class="panel panel-pad"><div class="section-title"><h2>Emotes</h2></div><p class="microcopy">Die ersten ${base.length} hat jeder. Mit höherer Stufe schaltest du weitere frei – sie erscheinen dann im Spiel in deiner Reaktionsleiste.</p>
      <div class="emote-grid">${base.map(e => `<span class="emote is-open" title="Grundausstattung">${esc(e)}</span>`).join('')}${Progress.EMOTES.map(x => `<span class="emote ${x.level <= level ? 'is-open' : 'is-locked'}" title="${x.level <= level ? 'Freigeschaltet' : `Ab Stufe ${x.level}`}">${esc(x.e)}${x.level <= level ? '' : `<small>🔒 ${x.level}</small>`}</span>`).join('')}</div></section>`;
  }

  function leaderboard(user, data, board) {
    const on = Boolean(data.profile?.board);
    const name = data.profile?.name || String(user.name || '').slice(0, 28);
    const rows = Array.isArray(board) && board.length
      ? `<div class="leaderboard board-list">${board.map((e, i) => `<div class="leader-row ${e.uid === user.uid ? 'is-me' : ''}"><span>${i + 1}</span><span class="avatar small">⭐</span><strong>${esc(e.name)} <span class="level-badge">⭐${Progress.levelFor(e.xp)}</span></strong><span class="leader-score"><b>${esc(e.xp)} XP</b></span></div>`).join('')}</div>`
      : `<p class="microcopy">${board === null ? 'Die Bestenliste ist gerade nicht erreichbar.' : 'Noch niemand in der Bestenliste.'}</p>`;
    return `<section class="panel panel-pad"><div class="section-title"><div><h2>Bestenliste</h2><p class="microcopy">Top 50 nach XP. Du erscheinst dort nur, wenn du es einschaltest – mit deinem Spielernamen, nie mit E-Mail oder Google-Namen.</p></div></div>
      <form class="board-form" data-board-form><label class="field-group"><span class="field-label">Spielername für die Bestenliste</span><input class="input" name="name" maxlength="28" required value="${esc(name)}"></label>
      <label class="check-row"><input type="checkbox" name="board" ${on ? 'checked' : ''}> In der Bestenliste zeigen</label>
      <button class="btn btn--primary" type="submit">Speichern</button></form>${rows}</section>`;
  }

  function hardest(modStats) {
    const quizzes = Object.entries(modStats || {}).filter(([, s]) => s && s.q);
    if (!quizzes.length) return '<section class="panel panel-pad"><div class="section-title"><h2>Schwerste Fragen</h2></div><p class="microcopy">Nach deinem ersten Online-Spiel als Moderator siehst du hier, welche Fragen am seltensten richtig beantwortet wurden.</p></section>';
    return `<section class="panel panel-pad"><div class="section-title"><div><h2>Schwerste Fragen</h2><p class="microcopy">Aus deinen Online-Spielen als Moderator – niedrigste Trefferquote zuerst.</p></div></div>${quizzes.map(([, s]) => {
      const list = Progress.hardestQuestions(s).slice(0, 8);
      return `<details class="hard-quiz"><summary><strong>${esc(s.title || 'Quiz')}</strong> <small>${esc(s.games)} ${Number(s.games) === 1 ? 'Spiel' : 'Spiele'}</small></summary><div class="rate-list">${list.map(q => `
        <div class="rate-row"><span class="rate-label">${esc(window.SylasphereTypes?.get(q.type)?.icon || '•')} ${esc(q.t)}</span><div class="rate-track" aria-hidden="true"><span style="width:${Math.round(q.rate * 100)}%"></span></div><span class="rate-value"><strong>${pct(q.rate)}</strong> <small>${q.c}/${q.n}</small></span></div>`).join('') || '<p class="microcopy">Noch keine Antworten.</p>'}</div></details>`;
    }).join('')}</section>`;
  }

  function xpHelp() {
    const R = Progress.RULES;
    return `<details class="panel panel-pad xp-help"><summary><strong>Wie bekomme ich XP?</strong></summary><ul>
      <li>Mitspielen: <strong>${R.PLAY} XP</strong>, wenn du mindestens die Hälfte der Fragen beantwortest</li>
      <li>Jede richtige Antwort: <strong>${R.PER_CORRECT} XP</strong></li>
      <li>Platz 1 / 2 / 3: <strong>${R.PLACES.join(' / ')} XP</strong></li>
      <li>Jedes Highlight am Spielende: <strong>${R.PER_HIGHLIGHT} XP</strong></li>
      <li>Höchstens ${R.GAME_CAP} XP pro Spiel und ${R.DAY_CAP} XP pro Tag. XP gibt es nur bei Online-Spielen mit mindestens ${R.MIN_PLAYERS} Spielern und ${R.MIN_QUESTIONS} gewerteten Fragen – und nicht im eigenen Raum.</li>
      <li>Von Stufe n auf n+1 brauchst du 50 × n XP (Stufe 2: 50, Stufe 5: 500, Stufe 10: 2250 XP).</li></ul></details>`;
  }

  function bind(user, data) {
    const form = document.querySelector('[data-board-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        const listed = await Store.saveProfile(Account.context(), user.uid, { name: form.name.value, board: form.board.checked });
        App.toast(form.board.checked ? (listed ? 'Gespeichert – du stehst in der Bestenliste.' : 'Gespeichert. Nach deinem ersten Spiel mit XP erscheinst du in der Bestenliste.') : 'Gespeichert – du bist nicht in der Bestenliste.', 'success');
        loadedFor = ''; render(Account.state());
      } catch (error) { App.toast(Account.errorText(error), 'error'); }
      finally { button.disabled = false; }
    });
  }
})();
