(function () {
  'use strict';

  /*
   * Moderatoren verwalten (v19) – nur für Admins (admins/<uid> in Firebase).
   * Offene Anfragen bestätigen oder ablehnen, Moderator-Rechte entziehen.
   * Die Firebase-Regeln lassen diese Aktionen ausschließlich für Admins zu.
   */
  const App = window.SchmobinApp;
  const Account = window.SylasphereAccount;
  const UI = window.SylasphereAccountUI;
  const esc = value => App.escapeHTML(value);
  const $ = id => document.getElementById(id);
  let listening = false;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try { await Account.init(); }
    catch (error) { $('admin-gate-card').innerHTML = `<div class="notice notice--error">Firebase ist nicht erreichbar: ${esc(Account.errorText(error))}</div>`; return; }
    $('account-slot')?.replaceWith(UI.headerButton({ onLogin: () => $('admin-gate').scrollIntoView({ behavior: 'smooth' }) }));
    let lastKey = '';
    Account.onChange(state => {
      const key = `${state.user?.uid || '-'}|${state.role || ''}`;
      if (key === lastKey || (state.user && !state.user.isAnonymous && !state.role)) return;
      lastKey = key;
      render(state);
    });
    render(Account.state());
  }

  function render(state) {
    const admin = Account.isAdmin();
    $('admin-gate').hidden = admin;
    $('admin-panel').hidden = !admin;
    if (admin) { startLists(); return; }
    const card = $('admin-gate-card');
    if (!state.user || state.user.isAnonymous) { card.replaceChildren(UI.loginCard({ title: 'Admin-Anmeldung', intro: 'Diese Seite ist nur für Admins.' })); return; }
    card.innerHTML = `<div class="account-card"><div class="account-card-head"><div class="moderator-gate-icon">🛡️</div><span class="eyebrow">Verwaltung</span><h1>Kein Admin-Zugang</h1><p>Dieses Konto ist kein Admin. Um dich selbst als Admin einzutragen, kopiere deine Konto-ID und lege sie in der Firebase-Konsole unter <code>admins</code> an (Wert <code>true</code>). Die genaue Anleitung steht in FIREBASE_SETUP.md.</p></div>
      <div class="account-who">${UI.avatar(state.user)}<div><strong>${esc(state.user.name)}</strong><span>${esc(state.user.email)}</span></div></div>
      <div class="share-row admin-uid"><code>${esc(state.user.uid)}</code><button type="button" class="icon-btn" data-copy title="Konto-ID kopieren">⧉</button></div>
      <button type="button" class="btn" data-refresh>Erneut prüfen</button></div>`;
    card.querySelector('[data-copy]').addEventListener('click', async () => { await App.copyText(state.user.uid); App.toast('Konto-ID kopiert.', 'success'); });
    card.querySelector('[data-refresh]').addEventListener('click', () => Account.refreshRole());
  }

  // Live-Listen: neue Anfragen erscheinen sofort
  function startLists() {
    if (listening) return;
    listening = true;
    const context = Account.context();
    const dbm = context.modules.database;
    dbm.onValue(dbm.ref(context.db, 'moderatorRequests'), snap => renderRequests(snap.val() || {}), error => showListError('request-list', error));
    dbm.onValue(dbm.ref(context.db, 'moderators'), snap => renderModerators(snap.val() || {}), error => showListError('moderator-list', error));
  }

  function showListError(id, error) {
    $(id).innerHTML = `<div class="notice notice--error">${esc(Account.errorText(error))}<br><small>Sind die v19-Regeln veröffentlicht?</small></div>`;
  }

  function when(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function person(entry) {
    const initial = esc(String(entry.name || entry.email || '?').trim().charAt(0).toUpperCase() || '?');
    return `<span class="account-avatar">${initial}</span><div class="admin-person"><strong>${esc(entry.name || 'Ohne Namen')}</strong><span>${esc(entry.email || 'ohne E-Mail')}</span>${entry.note ? `<em>„${esc(entry.note)}“</em>` : ''}<small>${entry.requestedAt ? `angefragt ${esc(when(entry.requestedAt))}` : entry.grantedAt ? `seit ${esc(when(entry.grantedAt))}` : ''}</small></div>`;
  }

  function renderRequests(value) {
    const entries = Object.entries(value).map(([uid, r]) => Object.assign({ uid }, r)).sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
    $('request-count').textContent = entries.length;
    const box = $('request-list');
    if (!entries.length) { box.innerHTML = '<p class="microcopy" style="margin:0">Keine offenen Anfragen.</p>'; return; }
    box.replaceChildren(...entries.map(entry => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `${person(entry)}<div class="admin-actions"><button type="button" class="btn btn--success btn--small" data-approve>✓ Freischalten</button><button type="button" class="btn btn--danger btn--small" data-reject>Ablehnen</button></div>`;
      row.querySelector('[data-approve]').addEventListener('click', e => act(e.currentTarget, () => Account.admin.approve(entry.uid, entry), `${entry.name || entry.email} ist jetzt Moderator.`));
      row.querySelector('[data-reject]').addEventListener('click', e => { if (confirm(`Anfrage von ${entry.name || entry.email} ablehnen?`)) act(e.currentTarget, () => Account.admin.reject(entry.uid), 'Anfrage abgelehnt.'); });
      return row;
    }));
  }

  function renderModerators(value) {
    const entries = Object.entries(value).map(([uid, m]) => Object.assign({ uid }, m)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    $('moderator-count').textContent = entries.length;
    const box = $('moderator-list');
    if (!entries.length) { box.innerHTML = '<p class="microcopy" style="margin:0">Noch keine Moderatoren freigeschaltet.</p>'; return; }
    const me = Account.state().user?.uid;
    box.replaceChildren(...entries.map(entry => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `${person(entry)}<div class="admin-actions">${entry.uid === me ? '<span class="pill">Du</span>' : '<button type="button" class="btn btn--danger btn--small" data-revoke>Entziehen</button>'}</div>`;
      row.querySelector('[data-revoke]')?.addEventListener('click', e => {
        if (confirm(`${entry.name || entry.email} die Moderator-Rechte entziehen? Gespeicherte Quizze bleiben erhalten, sind aber erst nach erneuter Freischaltung wieder erreichbar.`)) act(e.currentTarget, () => Account.admin.revoke(entry.uid), 'Rechte entzogen.');
      });
      return row;
    }));
  }

  async function act(button, fn, success) {
    button.disabled = true;
    try { await fn(); App.toast(success, 'success'); }
    catch (error) { App.toast(Account.errorText(error), 'error'); button.disabled = false; }
  }
})();
