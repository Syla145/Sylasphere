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
   * v31: Raumcode-Feld direkt oben (für alle, auch Gäste) – Anmelden ist nur noch ein Nebenweg.
   *      Die frühere Auswahl „Anmelden / Als Gast“ entfällt.
   */
  const App = window.SchmobinApp;
  const Account = window.SylasphereAccount;
  const UI = window.SylasphereAccountUI;
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

  // v31: Beitreten direkt auf der Startseite – Code eingeben, weiter zur Spieleransicht (Name + Avatar)
  function joinBox() {
    return `<form class="panel home-join" data-home-join novalidate><div class="home-join-head"><span class="eyebrow">Mitspielen</span><h2>Raumcode eingeben</h2></div><div class="home-join-row"><input class="input code-input" name="code" maxlength="6" placeholder="ABC234" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Raumcode"><button type="submit" class="btn btn--primary">Beitreten</button></div><div class="error-text" data-join-error role="alert"></div></form>`;
  }
  function bindJoin() {
    const form = content().querySelector('[data-home-join]');
    if (!form) return;
    const input = form.querySelector('input');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); form.querySelector('[data-join-error]').textContent = ''; });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const code = input.value.trim();
      if (code.length !== 6) { form.querySelector('[data-join-error]').textContent = 'Bitte den 6-stelligen Raumcode eingeben (steht beim Moderator oder auf dem Beamer).'; input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      location.href = `./spieler.html?code=${encodeURIComponent(code)}`;
    });
  }

  function renderChoice() {
    content().innerHTML = `${joinBox()}
      <div class="home-secondary">
        <a class="home-secondary-link" href="./zuschauer.html"><span>📺</span><span><strong>Zuschauen</strong><small>Große Ansicht für Beamer, TV oder Stream</small></span></a>
        <a class="home-secondary-link" href="./spielmodi.html"><span>🎲</span><span><strong>Spielmodi</strong><small>So geht's – mit Demo zum Ausprobieren</small></span></a>
        <button type="button" class="home-secondary-link" data-choice="login"><span>🔑</span><span><strong>Anmelden</strong><small>Quiz moderieren, XP sammeln, Statistik</small></span></button>
      </div>`;
    content().querySelector('[data-choice="login"]').addEventListener('click', () => { view = 'login'; render(); });
    bindJoin();
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
    back.textContent = '← Zurück';
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
    const shown = keys.filter(key => key !== 'play'); // v31: „Mitspielen“ ist jetzt das Raumcode-Feld oben
    const modes = '<a class="notice home-note home-note--link" href="./spielmodi.html">🎲 <strong>Spielmodi</strong> – so geht\'s, mit Demo zum Ausprobieren →</a>'; // v35
    content().innerHTML = `${greeting}${joinBox()}${profile}<div class="role-grid home-roles home-roles--${shown.length}">${shown.map(card).join('')}</div>${extra}${modes}`;
    bindJoin();
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
      view = 'auto';
      renderCards(state.role, state);
      return;
    }
    if (view === 'login') { renderLogin(); return; }
    if (state.ready || firebaseFailed) store.set(HINT_KEY, '');
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
