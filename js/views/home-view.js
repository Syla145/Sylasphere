(function () {
  'use strict';

  /*
   * Startseite (v21)
   * ------------------------------------------------------------------
   * 1. Erst wählen: Anmelden oder als Gast fortfahren (Gast-Wahl wird gemerkt).
   * 2. Dann nur die passenden Bereiche:
   *    Moderator/Admin → Moderieren, Mitspielen, Zuschauen, Editor (+ Verwaltung für Admins)
   *    Angemeldet ohne Moderator-Rechte → Mitspielen, Zuschauen (+ „Moderator werden“)
   *    Gast → Mitspielen, Zuschauen
   * Direkte Links (z. B. spieler.html?code=…) funktionieren weiterhin ohne diese Auswahl.
   * v28: Angemeldete sehen ihre Stufe und einen Link zum Profil (XP, Statistik, Bestenliste).
   */
  const App = window.SchmobinApp;
  const Account = window.SylasphereAccount;
  const UI = window.SylasphereAccountUI;
  const GUEST_KEY = 'sylasphere:home-guest';
  const HINT_KEY = 'sylasphere:home-role-hint';
  const esc = value => App.escapeHTML(value);
  let view = 'auto'; // 'auto' | 'login'
  let firebaseFailed = false;

  const store = {
    get: key => { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } },
    set: (key, value) => { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch (_) {} }
  };

  const CARDS = {
    moderator: { href: './moderator.html', icon: '🎛️', title: 'Moderieren', text: 'Quiz auswählen, Raum erstellen, Fragen steuern und Punkte vergeben.' },
    play: { href: './spieler.html', icon: '🎮', title: 'Mitspielen', text: 'Mit Raumcode beitreten – vom Handy oder PC.' },
    watch: { href: './zuschauer.html', icon: '📺', title: 'Zuschauen', text: 'Große Ansicht für Beamer, TV oder Stream.' },
    editor: { href: './editor.html', icon: '🧩', title: 'Quiz-Editor', text: 'Quizze erstellen, bearbeiten und online speichern.' },
    admin: { href: './admin.html', icon: '🛡️', title: 'Verwaltung', text: 'Moderator-Anfragen freischalten und Rechte verwalten.' }
  };

  function card(key) {
    const c = CARDS[key];
    return `<a class="role-card role-card--${key}" href="${c.href}"><div class="role-icon">${c.icon}</div><h2>${esc(c.title)}</h2><p>${esc(c.text)}</p><span class="role-arrow">↗</span></a>`;
  }

  function content() { return document.getElementById('home-content'); }

  function renderChoice() {
    content().innerHTML = `
      <div class="home-choice">
        <button type="button" class="role-card home-choice-card" data-choice="login"><div class="role-icon">🔑</div><h2>Anmelden</h2><p>Mit Google oder E-Mail. Mit Konto sammelst du XP, steigst Stufen auf und siehst deine Statistik. Moderatoren brauchen ein Konto.</p><span class="role-arrow">→</span></button>
        <button type="button" class="role-card home-choice-card" data-choice="guest"><div class="role-icon">👋</div><h2>Als Gast fortfahren</h2><p>Ohne Konto direkt mitspielen oder zuschauen.</p><span class="role-arrow">→</span></button>
      </div>`;
    content().querySelector('[data-choice="login"]').addEventListener('click', () => { view = 'login'; render(); });
    content().querySelector('[data-choice="guest"]').addEventListener('click', () => { store.set(GUEST_KEY, '1'); view = 'auto'; render(); });
  }

  function renderLogin() {
    const wrap = document.createElement('div');
    wrap.className = 'panel panel-pad home-login';
    if (firebaseFailed) {
      wrap.innerHTML = '<div class="notice notice--warning">Anmeldung gerade nicht erreichbar (keine Verbindung zu Firebase). Du kannst als Gast fortfahren.</div>';
    } else {
      wrap.append(UI.loginCard({ title: 'Anmelden', intro: 'Mit Google oder E-Mail. Neue Konten können danach den Moderator-Zugang anfragen.' }));
    }
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'link-btn home-back';
    back.textContent = store.get(GUEST_KEY) ? '← Zurück' : '← Zurück zur Auswahl';
    back.addEventListener('click', () => { view = 'auto'; render(); });
    wrap.append(back);
    content().replaceChildren(wrap);
  }

  function renderCards(role, state) {
    const moderator = role === 'moderator' || role === 'admin';
    const keys = moderator ? ['moderator', 'play', 'watch', 'editor'] : ['play', 'watch'];
    if (role === 'admin') keys.push('admin');
    const user = state?.user && !state.user.isAnonymous ? state.user : null;
    const greeting = user
      ? `<div class="home-greeting"><span>Hallo <strong>${esc(user.name)}</strong> 👋</span><span class="pill account-role account-role--${esc(role)}">${esc(UI.ROLE_LABEL[role] || '')}</span></div>`
      : '<div class="home-greeting"><span>Du bist als <strong>Gast</strong> unterwegs.</span><button type="button" class="link-btn" data-login>Anmelden</button></div>';
    let extra = '';
    if (user && role === 'pending') extra = '<div class="notice home-note">⏳ Deine Moderator-Anfrage wartet auf Freigabe durch den Admin.</div>';
    else if (user && role === 'none') extra = '<a class="notice home-note home-note--link" href="./moderator.html">Du möchtest selbst ein Quiz moderieren? <strong>Moderator-Zugang anfragen →</strong></a>';
    const profile = user ? '<a class="notice home-note home-note--link home-profile" href="./profil.html"><span data-home-level>⭐</span> <strong>Dein Profil</strong> – Stufe, XP, Statistik und Bestenliste →</a>' : '';
    content().innerHTML = `${greeting}${profile}<div class="role-grid home-roles home-roles--${keys.length}">${keys.map(card).join('')}</div>${extra}`;
    content().querySelector('[data-login]')?.addEventListener('click', () => { view = 'login'; render(); });
    if (user) showLevel(user.uid);
  }

  // v28: Stufe neben dem Profil-Link
  let levelCache = null;
  async function showLevel(uid) {
    const Store = window.SylasphereProgressStore, Progress = window.SylasphereProgress;
    if (!Store || !Progress) return;
    if (levelCache?.uid !== uid) {
      try { levelCache = { uid, xp: Number((await Store.readXp(Account.context(), uid))?.total) || 0 }; } catch (_) { return; }
    }
    const slot = content().querySelector('[data-home-level]');
    if (slot) slot.innerHTML = `<span class="level-badge">⭐${Progress.levelFor(levelCache.xp)}</span>`;
  }

  function render() {
    const state = Account?.state() || {};
    const loggedIn = Boolean(state.user && !state.user.isAnonymous);
    if (loggedIn && !state.role) { renderCards(store.get(HINT_KEY) || 'none', state); return; } // Rolle lädt noch
    if (loggedIn) {
      store.set(HINT_KEY, state.role);
      store.set(GUEST_KEY, '');
      view = 'auto';
      renderCards(state.role, state);
      return;
    }
    if (view === 'login') { renderLogin(); return; }
    if (state.ready || firebaseFailed) store.set(HINT_KEY, '');
    if (store.get(GUEST_KEY)) { renderCards('guest', null); return; }
    const hint = store.get(HINT_KEY);
    if (hint && !state.ready && !firebaseFailed) { renderCards(hint, null); return; } // war angemeldet – kein Aufblitzen der Auswahl
    renderChoice();
  }

  async function init() {
    render();
    if (!Account || !UI || !window.JHQuizFirebase) { firebaseFailed = true; render(); return; }
    try { await Account.init(); }
    catch (error) { console.warn('Anmeldung nicht verfügbar', error); firebaseFailed = true; render(); return; }
    document.getElementById('account-slot')?.replaceWith(UI.headerButton({ onLogin: () => { view = 'login'; render(); }, onSignOut: () => { view = 'auto'; store.set(HINT_KEY, ''); render(); } }));
    let lastKey = '';
    Account.onChange(state => {
      const key = `${state.user?.uid || '-'}|${state.role || ''}|${state.ready}`;
      if (key === lastKey) return;
      lastKey = key;
      render();
    });
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
