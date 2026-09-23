(function () {
  'use strict';

  /*
   * Zugang zu Moderatorseite und Editor (v21)
   * ------------------------------------------------------------------
   * Nur mit angemeldetem Konto, das der Admin als Moderator freigeschaltet
   * hat (oder Admin ist). Ohne Anmeldung erscheint die Login-Karte, ohne
   * Freischaltung die Karte „Moderator-Zugang anfragen“.
   * Den früheren Moderator-Code (Gastmodus) gibt es seit v21 nicht mehr.
   *
   * Der echte Schutz liegt in den Firebase-Regeln (Räume anlegen, Quizze
   * speichern). Diese Datei steuert nur, was die Oberfläche zeigt.
   *
   * Seite braucht: <section id="moderator-gate" hidden><div class="… moderator-gate-card">
   *   <div id="account-gate"></div></div></section>, optional <span id="account-slot">,
   * und die Klasse moderator-locked am <html>, die den Inhalt bis zur Freigabe versteckt.
   */
  const Account = () => window.SylasphereAccount;
  const AccountUI = () => window.SylasphereAccountUI;

  let unlocked = false;
  let resolveUnlocked;
  const unlockedPromise = new Promise(resolve => { resolveUnlocked = resolve; });

  function page() { return document.body?.dataset.gatePage || 'moderator'; }

  function setUnlocked() {
    if (unlocked) return;
    unlocked = true;
    document.documentElement.classList.remove('moderator-locked');
    const gate = document.getElementById('moderator-gate');
    if (gate) gate.hidden = true;
    resolveUnlocked();
  }

  function renderGate(state) {
    const box = document.getElementById('account-gate');
    if (!box || unlocked) return;
    const UI = AccountUI();
    const editor = page() === 'editor';
    if (!state.user || state.user.isAnonymous) {
      box.replaceChildren(UI.loginCard({
        title: editor ? 'Editor-Anmeldung' : 'Moderator-Anmeldung',
        intro: editor ? 'Quizze erstellen und bearbeiten können angemeldete Moderatoren.' : 'Melde dich mit deinem Konto an. Moderieren darf, wen der Admin freigeschaltet hat.'
      }));
    } else if (state.role) {
      box.replaceChildren(UI.accessCard(state));
    }
  }

  function showUnavailable(message) {
    const box = document.getElementById('account-gate');
    if (box) box.innerHTML = `<div class="notice notice--warning">${message}</div><a class="btn btn--ghost" href="./">← Zur Startseite</a>`;
  }

  async function init() {
    const gate = document.getElementById('moderator-gate');
    if (!gate) { setUnlocked(); return; }
    gate.hidden = false;
    if (!Account() || !AccountUI() || !window.JHQuizFirebase) { showUnavailable('Die Anmeldung konnte nicht geladen werden. Bitte Seite neu laden.'); return; }
    try { await Account().init(); }
    catch (error) {
      console.warn('Anmeldung nicht verfügbar', error);
      showUnavailable('Anmeldung gerade nicht erreichbar (keine Verbindung zu Firebase). Bitte Internetverbindung prüfen und neu laden.');
      return;
    }
    document.getElementById('account-slot')?.replaceWith(AccountUI().headerButton({
      onLogin: () => document.getElementById('account-gate')?.scrollIntoView({ behavior: 'smooth' }),
      onSignOut: () => { location.href = './'; }
    }));
    let lastKey = '';
    Account().onChange(state => {
      if (Account().canModerate()) { setUnlocked(); return; }
      if (unlocked) { if (!state.user || state.user.isAnonymous) location.href = './'; return; } // abgemeldet
      const key = `${state.user && !state.user.isAnonymous ? state.user.uid : '-'}|${state.role || ''}`;
      if (key === lastKey || (state.user && !state.user.isAnonymous && !state.role)) return;
      lastKey = key;
      renderGate(state);
    });
    if (Account().canModerate()) { setUnlocked(); return; }
    renderGate(Account().state());
  }

  /** Vor dem Anlegen eines Online-Raums: Konto muss (noch) Moderator sein. */
  async function ensureOnlineGrant() {
    if (Account()?.canModerate()) return true;
    throw new Error('Dein Konto hat keine Moderator-Rechte (mehr). Bitte neu anmelden.');
  }

  function explainCreateError(error) {
    if (!/permission[_-]denied/i.test(String(error?.code || error?.message || ''))) return null;
    return 'Firebase hat das Anlegen des Online-Raums abgelehnt. Ist dein Konto noch freigeschaltet und sind die aktuellen Regeln veröffentlicht (siehe FIREBASE_SETUP.md)?';
  }

  async function lock() {
    try { await Account()?.signOut(); } catch (_) {}
    location.href = './';
  }

  document.addEventListener('DOMContentLoaded', init);

  window.SylasphereModeratorGate = {
    whenUnlocked: () => unlockedPromise,
    isUnlocked: () => unlocked,
    mode: () => 'account',
    ensureOnlineGrant,
    explainCreateError,
    lock
  };
})();
