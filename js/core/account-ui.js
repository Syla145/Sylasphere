(function () {
  'use strict';

  /*
   * Konto-Oberfläche (v19): Login-Karte, Status/Anfrage-Karte, Konto-Knopf im Kopf.
   * Wird von moderator.html, editor.html, admin.html, profil.html, spieler.html und index.html genutzt.
   */
  const Account = () => window.SylasphereAccount;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  const toast = (msg, type) => window.SchmobinApp?.toast(msg, type);

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  const GOOGLE_ICON = '<svg class="google-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>';

  /** Login-/Registrier-Karte. options: { title, intro } */
  function loginCard(options = {}) {
    let mode = 'login';
    const card = el('div', 'account-card');
    card.innerHTML = `
      <div class="account-card-head"><div class="moderator-gate-icon">👤</div><span class="eyebrow">Konto</span><h1 data-title>${esc(options.title || 'Anmelden')}</h1><p>${esc(options.intro || 'Melde dich an, um zu moderieren und deine Quizze online zu speichern.')}</p></div>
      <button type="button" class="btn google-btn" data-google>${GOOGLE_ICON}<span>Mit Google anmelden</span></button>
      <div class="account-divider"><span>oder mit E-Mail</span></div>
      <form class="join-form account-form" data-form novalidate>
        <label class="field-group" data-name-field hidden><span class="field-label">Name (wird anderen angezeigt)</span><input class="input" name="name" autocomplete="nickname" maxlength="40"></label>
        <label class="field-group"><span class="field-label">E-Mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <label class="field-group"><span class="field-label">Passwort</span><input class="input" name="password" type="password" autocomplete="current-password" minlength="6" required></label>
        <button class="btn btn--primary" type="submit" data-submit>Anmelden</button>
      </form>
      <p class="gate-error" role="alert" data-error></p>
      <div class="account-links"><button type="button" class="link-btn" data-toggle>Noch kein Konto? Registrieren</button><button type="button" class="link-btn" data-reset>Passwort vergessen?</button></div>`;
    const $ = sel => card.querySelector(sel);
    const form = $('[data-form]');
    const error = $('[data-error]');
    const submit = $('[data-submit]');

    function setMode(next) {
      mode = next;
      const register = mode === 'register';
      $('[data-name-field]').hidden = !register;
      $('[data-title]').textContent = register ? 'Konto erstellen' : (options.title || 'Anmelden');
      submit.textContent = register ? 'Konto erstellen' : 'Anmelden';
      $('[data-toggle]').textContent = register ? 'Schon ein Konto? Anmelden' : 'Noch kein Konto? Registrieren';
      $('[data-reset]').hidden = register;
      form.password.autocomplete = register ? 'new-password' : 'current-password';
      error.textContent = '';
    }

    async function busy(button, text, fn) {
      const original = button.innerHTML;
      button.disabled = true; if (text) button.textContent = text;
      error.textContent = '';
      try { await fn(); }
      catch (err) { error.textContent = Account().errorText(err); }
      finally { button.disabled = false; button.innerHTML = original; }
    }

    $('[data-google]').addEventListener('click', event => busy(event.currentTarget, 'Google-Fenster offen …', () => Account().signInGoogle()));
    $('[data-toggle]').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
    $('[data-reset]').addEventListener('click', event => busy(event.currentTarget, null, async () => {
      if (!form.email.value.trim()) { error.textContent = 'Bitte zuerst oben deine E-Mail eintragen.'; return; }
      await Account().resetPassword(form.email.value);
      toast('E-Mail zum Zurücksetzen verschickt (auch im Spam-Ordner nachsehen).', 'success');
    }));
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (mode === 'register' && form.password.value.length < 6) { error.textContent = 'Das Passwort braucht mindestens 6 Zeichen.'; return; }
      busy(submit, mode === 'register' ? 'Konto wird erstellt …' : 'Anmelden …', () => mode === 'register'
        ? Account().register(form.email.value, form.password.value, form.name.value)
        : Account().signInEmail(form.email.value, form.password.value));
    });
    return card;
  }

  /** Karte für angemeldete Konten ohne Moderator-Rechte (Anfrage stellen / wartet). */
  function accessCard(state, options = {}) {
    const user = state.user;
    const pending = state.role === 'pending';
    const card = el('div', 'account-card');
    card.innerHTML = `
      <div class="account-card-head"><div class="moderator-gate-icon">${pending ? '⏳' : '🔐'}</div><span class="eyebrow">Moderator-Zugang</span>
      <h1>${pending ? 'Anfrage gesendet' : 'Noch nicht freigeschaltet'}</h1>
      <p>${pending ? 'Sobald der Admin deine Anfrage bestätigt, geht es hier automatisch weiter.' : 'Du bist angemeldet, darfst aber noch nicht moderieren. Frage den Zugang an – der Admin schaltet dich frei.'}</p></div>
      <div class="account-who">${avatar(user)}<div><strong>${esc(user.name)}</strong><span>${esc(user.email || 'ohne E-Mail')}</span></div></div>
      ${pending ? '' : '<label class="field-group"><span class="field-label">Nachricht an den Admin (optional)</span><input class="input" data-note maxlength="200" placeholder="z. B. Wer du bist"></label><button type="button" class="btn btn--primary" data-request>Moderator-Zugang anfragen</button>'}
      ${pending ? '<button type="button" class="btn" data-refresh>Status prüfen</button><button type="button" class="btn btn--ghost" data-cancel>Anfrage zurückziehen</button>' : ''}
      <p class="gate-error" role="alert" data-error></p>
      <details class="account-id"><summary>Konto-ID anzeigen</summary><p class="microcopy">Brauchst du nur, wenn du dich selbst als Admin einträgst (siehe FIREBASE_SETUP.md).</p><div class="share-row"><code>${esc(user.uid)}</code><button type="button" class="icon-btn" data-copy title="Kopieren">⧉</button></div></details>
      <div class="account-links"><button type="button" class="link-btn" data-signout>Abmelden / anderes Konto</button></div>`;
    const $ = sel => card.querySelector(sel);
    const error = $('[data-error]');
    const run = async (button, fn) => {
      button.disabled = true; error.textContent = '';
      try { await fn(); } catch (err) { error.textContent = Account().errorText(err); } finally { button.disabled = false; }
    };
    $('[data-request]')?.addEventListener('click', e => run(e.currentTarget, async () => { await Account().requestAccess($('[data-note]').value); toast('Anfrage gesendet.', 'success'); }));
    $('[data-refresh]')?.addEventListener('click', e => run(e.currentTarget, async () => { const role = await Account().refreshRole(); if (role === 'pending') toast('Noch nicht bestätigt.', 'info'); }));
    $('[data-cancel]')?.addEventListener('click', e => run(e.currentTarget, () => Account().cancelRequest()));
    $('[data-copy]').addEventListener('click', async () => { await window.SchmobinApp?.copyText(user.uid); toast('Konto-ID kopiert.', 'success'); });
    $('[data-signout]').addEventListener('click', e => run(e.currentTarget, async () => { await Account().signOut(); options.onSignOut?.(); }));
    return card;
  }

  function avatar(user) {
    if (user?.photo) return `<img class="account-avatar" src="${esc(user.photo)}" alt="" referrerpolicy="no-referrer">`;
    return `<span class="account-avatar">${esc((user?.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
  }

  const ROLE_LABEL = { admin: 'Admin', moderator: 'Moderator', pending: 'Anfrage offen', none: 'Kein Moderator' };

  /**
   * Konto-Knopf für die Kopfzeile. Zeigt „Anmelden“ oder den Namen; Klick öffnet ein Menü.
   * options: { onLogin() – wenn nicht angemeldet, onSignOut() }
   */
  function headerButton(options = {}) {
    const wrap = el('div', 'account-menu');
    const button = el('button', 'btn btn--ghost account-btn');
    button.type = 'button';
    const menu = el('div', 'panel account-dropdown');
    menu.hidden = true;
    wrap.append(button, menu);

    function render(state) {
      const user = state.user && !state.user.isAnonymous ? state.user : null;
      button.innerHTML = user ? `${avatar(user)}<span class="account-btn-name">${esc(user.name)}</span>` : '<span>👤</span><span class="account-btn-name">Anmelden</span>';
      button.title = user ? `${user.name} · ${ROLE_LABEL[state.role] || ''}` : 'Anmelden';
      if (!user) { menu.hidden = true; return; }
      menu.innerHTML = `<div class="account-who">${avatar(user)}<div><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div></div>
        <span class="pill account-role account-role--${esc(state.role || 'none')}">${esc(ROLE_LABEL[state.role] || '…')}</span>
        <a class="btn btn--ghost" href="./profil.html">⭐ Mein Profil</a>
        ${state.role === 'admin' ? '<a class="btn btn--ghost" href="./admin.html">🛡️ Moderatoren verwalten</a>' : ''}
        <button type="button" class="btn btn--ghost" data-signout>Abmelden</button>`;
      menu.querySelector('[data-signout]').addEventListener('click', async () => {
        menu.hidden = true;
        try { await Account().signOut(); toast('Abgemeldet.', 'success'); options.onSignOut?.(); }
        catch (err) { toast(Account().errorText(err), 'error'); }
      });
    }

    button.addEventListener('click', () => {
      const state = Account().state();
      if (!state.user || state.user.isAnonymous) { options.onLogin?.(); return; }
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', event => { if (!wrap.contains(event.target)) menu.hidden = true; });
    Account().onChange(render);
    render(Account().state());
    return wrap;
  }

  /** Einfacher Dialog (z. B. Login im Editor). Gibt { close } zurück. */
  function dialog(content, { onClose } = {}) {
    const backdrop = el('div', 'preview-backdrop account-backdrop');
    const box = el('div', 'panel account-modal');
    const close = el('button', 'icon-btn account-close', '✕');
    close.type = 'button'; close.title = 'Schließen';
    box.append(close, content);
    backdrop.append(box);
    document.body.append(backdrop);
    const api = {
      close() { backdrop.remove(); document.removeEventListener('keydown', onKey); onClose?.(); },
      replace(next) { box.replaceChildren(close, next); }
    };
    function onKey(event) { if (event.key === 'Escape') api.close(); }
    close.addEventListener('click', () => api.close());
    backdrop.addEventListener('click', event => { if (event.target === backdrop) api.close(); });
    document.addEventListener('keydown', onKey);
    return api;
  }

  /**
   * Dialog: anmelden und (falls nötig) Moderator-Zugang anfragen.
   * Schließt sich selbst, sobald das Konto moderieren darf.
   */
  function openAccountDialog({ intro } = {}) {
    let api = null;
    const content = () => {
      const state = Account().state();
      if (!state.user || state.user.isAnonymous) return loginCard({ intro });
      return accessCard(state);
    };
    const keyOf = state => `${state.user && !state.user.isAnonymous ? state.user.uid : '-'}|${state.role || ''}`;
    let lastKey = keyOf(Account().state());
    api = dialog(content(), { onClose: () => off() });
    const off = Account().onChange(state => {
      if (Account().canModerate()) { api.close(); toast(`Angemeldet als ${state.user.name}.`, 'success'); return; }
      const key = keyOf(state);
      if (key === lastKey || (state.user && !state.role)) return;
      lastKey = key;
      api.replace(content());
    });
    return api;
  }

  window.SylasphereAccountUI = { loginCard, accessCard, headerButton, dialog, openAccountDialog, avatar, ROLE_LABEL };
})();
