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
    dbm.onValue(dbm.ref(context.db, 'moderators'), snap => { renderModerators(snap.val() || {}); syncStorage(snap.val() || {}); }, error => showListError('moderator-list', error));
    startUpkeep(context);
    startUsage(context);
  }

  // ================================================================ v33: Nutzung & Kosten
  const Usage = () => window.SylasphereUsage;
  const Limits = () => window.SylasphereUsageLimits;
  let cloudToken = null; // { token, expiresAt } – nur im Speicher, nie in localStorage
  let lastCloud = null;
  function startUsage(context) {
    loadOwn(context);
    renderCloud();
    $('usage-refresh')?.addEventListener('click', () => { loadOwn(context); if (cloudToken) loadCloud(); });
  }
  /** Nur die Schlüssel eines Pfads (REST ?shallow=true), notfalls komplett laden */
  async function keysOf(context, path) {
    try {
      const token = await context.auth.currentUser.getIdToken();
      const response = await fetch(`${window.JHQuizFirebase.config.databaseURL}/${path}.json?shallow=true&auth=${encodeURIComponent(token)}`);
      if (response.status === 401 || response.status === 403) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Object.keys((await response.json()) || {});
    } catch (error) {
      if (error.code === 'PERMISSION_DENIED') throw error;
      const dbm = context.modules.database;
      return Object.keys((await dbm.get(dbm.ref(context.db, path))).val() || {});
    }
  }
  async function loadOwn(context) {
    const box = $('usage-own');
    if (!box || !Usage()) return;
    const dbm = context.modules.database;
    const get = async path => (await dbm.get(dbm.ref(context.db, path))).val();
    const missing = [];
    const safe = async (label, fn, fallback) => { try { return await fn(); } catch (error) { missing.push(label); console.warn(label, error); return fallback; } };
    const [userMedia, moderators, modStats, accounts, rooms] = await Promise.all([
      safe('Uploads', () => get('userMedia'), {}),
      safe('Moderatoren', () => get('moderators'), {}),
      safe('Spiele', () => get('modStats'), {}),
      safe('Konten', () => keysOf(context, 'players'), []),
      safe('Räume', () => keysOf(context, 'rooms'), []),
      Promise.resolve([]) // Quizze: nur Moderatoren/Admins können speichern → ihre Listen zählen (siehe unten)
    ]);
    const me = Account.state().user;
    // Admin darf nur die Liste (index) lesen, nicht die Quizze selbst – gezählt wird ohne Inhalte (shallow)
    const owners = [...new Set([...Object.keys(moderators || {}), me?.uid].filter(Boolean))];
    const quizCounts = await Promise.all(owners.map(uid => safe('Quizze', () => keysOf(context, `userQuizzes/${uid}/index`), [])));
    const stats = Usage().ownStats({
      userMedia: userMedia || {}, moderators: moderators || {}, admins: me ? { [me.uid]: me.name } : {},
      accounts: accounts.length, rooms: rooms.length, games: Usage().countGames(modStats), quizzes: quizCounts.reduce((s, list) => s + list.length, 0)
    });
    const U = Usage();
    const tile = (label, value, sub = '') => `<div class="usage-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    const people = stats.uploads.perUser.map(u => `<tr><td>${esc(u.name)}</td><td>${U.fmtCount(u.count)}</td><td>${U.fmtBytes(u.bytes)}</td><td>${U.fmtBytes(u.monthBytes)}</td></tr>`).join('');
    const warn = [...new Set(missing)];
    box.innerHTML = `${warn.length ? `<div class="notice notice--warning">Nicht lesbar: ${esc(warn.join(', '))}. Sind die Firebase-Regeln für v33 veröffentlicht? (FIREBASE_SETUP.md → v33)</div>` : ''}
      <div class="usage-tiles">${tile('Uploads gesamt', U.fmtBytes(stats.uploads.bytes), `${U.fmtCount(stats.uploads.count)} Dateien`)}${tile('Uploads diesen Monat', U.fmtBytes(stats.uploads.monthBytes))}${tile('Konten', U.fmtCount(stats.accounts), 'mit gespeichertem Fortschritt')}${tile('Moderatoren', U.fmtCount(stats.moderators))}${tile('Gespielte Spiele', U.fmtCount(stats.games), 'online, mit Ergebnis')}${tile('Gespeicherte Quizze', U.fmtCount(stats.quizzes))}${tile('Offene Räume', U.fmtCount(stats.rooms), 'aufräumen: siehe oben')}</div>
      ${people ? `<div class="usage-table-wrap"><table class="usage-table"><thead><tr><th>Uploads pro Konto</th><th>Dateien</th><th>Gesamt</th><th>Diesen Monat</th></tr></thead><tbody>${people}</tbody></table></div>` : '<p class="microcopy">Noch keine Uploads.</p>'}`;
  }

  function renderCloud(message = '', kind = 'info') {
    const box = $('usage-cloud');
    if (!box || !Usage() || !Limits()) return;
    const L = Limits();
    const connected = cloudToken && cloudToken.expiresAt > Date.now();
    const head = `<div class="usage-connect"><div><strong>${connected ? '✓ Mit Google Cloud verbunden' : 'Nicht verbunden'}</strong><span>${connected ? 'Die Verbindung gilt etwa eine Stunde und bleibt nur in diesem Tab.' : 'Öffnet ein Google-Fenster und fragt einmalig die Leseberechtigung für Cloud Monitoring an.'}</span></div><button type="button" class="btn ${connected ? 'btn--ghost' : 'btn--primary'}" data-connect>${connected ? '↻ Neu laden' : '🔗 Mit Google Cloud verbinden'}</button></div>`;
    const note = message ? `<div class="notice ${kind === 'error' ? 'notice--warning' : ''}">${esc(message)}</div>` : '';
    box.innerHTML = head + note + (lastCloud ? cloudHTML(lastCloud) : '') + `<p class="microcopy usage-links">Die echte Rechnung steht in der <a href="${L.links.billing}" target="_blank" rel="noopener">Google Cloud Console → Abrechnung ↗</a>. Tipp: <a href="${L.links.budgets}" target="_blank" rel="noopener">Budget-Warnung einrichten ↗</a> (z. B. bei 1 €). Freikontingente und Preise: <a href="${L.links.pricing}" target="_blank" rel="noopener">Firebase-Preise ↗</a> · Werte anpassbar in <code>js/core/usage-limits.js</code>.</p>`;
    box.querySelector('[data-connect]').addEventListener('click', () => connect(connected));
  }
  async function connect(connected) {
    if (!connected) {
      try { cloudToken = await Account.googleAccessToken([Usage().SCOPE]); }
      catch (error) { renderCloud(/popup|cancel/i.test(String(error?.code)) ? Account.errorText(error) : (error.code?.startsWith('sylasphere/') ? error.message : Account.errorText(error)), 'error'); return; }
    }
    loadCloud();
  }
  async function loadCloud() {
    renderCloud('Lade Zahlen aus Google Cloud …');
    try {
      const result = await Usage().fetchMonitoring({ token: cloudToken.token, projectId: window.JHQuizFirebase.config.projectId, limits: Limits() });
      if (result.errors.some(e => e.status === 401)) cloudToken = null;
      lastCloud = Usage().evaluate(Limits(), result);
      const errs = result.errors;
      const allFailed = errs.length && Object.keys(result.values).length === 0;
      if (allFailed) lastCloud = null; // keine Zahlen → keine (irreführende) Ampel zeigen
      renderCloud(allFailed ? Usage().explainError(errs[0]) : errs.length ? `${errs.length} Werte fehlen: ${Usage().explainError(errs[0])}` : '', errs.length ? 'error' : 'info');
    } catch (error) { renderCloud(Usage().explainError(error), 'error'); }
  }
  /** Mini-Verlauf der letzten 30 Tage (ein Balken pro Tag, Tooltip mit Datum und Wert) */
  function sparkline(item) {
    const U = Usage();
    const points = item.series || [];
    if (points.length < 2) return '';
    const max = Math.max(...points.map(p => p.value), item.period === 'day' ? item.free : 0, 1);
    const w = 4, gap = 2, h = 34;
    const bars = points.map((p, i) => { const bh = Math.max(1, Math.round(p.value / max * h)); const day = new Date(p.end - 1).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); return `<rect x="${i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="1"><title>${day}: ${U.fmtValue(item, p.value)}</title></rect>`; }).join('');
    const limitLine = item.period === 'day' && item.free <= max ? `<line x1="0" x2="${points.length * (w + gap)}" y1="${h - Math.round(item.free / max * h)}" y2="${h - Math.round(item.free / max * h)}"><title>Freikontingent pro Tag</title></line>` : '';
    return `<svg class="usage-spark" viewBox="0 0 ${points.length * (w + gap)} ${h}" preserveAspectRatio="none" role="img" aria-label="Verlauf der letzten 30 Tage">${bars}${limitLine}</svg>`;
  }
  function cloudHTML(data) {
    const U = Usage(), L = Limits();
    const groups = [...new Set(data.items.map(i => i.group))];
    const rows = groups.map(group => `<div class="usage-group"><h4>${esc(group)}</h4>${data.items.filter(i => i.group === group).map(item => {
      const pct = item.pct == null ? 0 : Math.min(1, item.pct);
      const value = item.level === 'none' ? '–' : U.fmtValue(item, item.value);
      return `<div class="usage-item is-${item.level}"><div class="usage-item-head"><strong>${esc(item.label)}</strong><span class="usage-status">${esc(U.LEVEL_TEXT[item.level])}</span></div>
        <div class="usage-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((item.pct || 0) * 100)}" aria-label="${esc(item.label)}"><i style="width:${Math.round(pct * 100)}%"></i></div>
        <div class="usage-item-foot">${item.kind === 'manual' ? `<span>Freikontingent ${esc(U.fmtValue(item, item.free))} · <a href="${L.links.usage}" target="_blank" rel="noopener">in der Firebase-Konsole ansehen ↗</a></span>` : `<span><b>${esc(value)}</b> von ${esc(U.fmtValue(item, item.free))} Freikontingent · ${esc(U.PERIOD_TEXT[item.period])}${item.pct != null ? ` · ${Math.round(item.pct * 100)} %` : ''}</span>`}${item.costUsd > 0 ? `<span class="usage-cost">≈ ${item.costUsd * L.usdToEur < 0.01 ? '< 0,01 €' : esc(U.fmtMoney(item.costUsd * L.usdToEur))}</span>` : ''}</div>
        ${item.note ? `<small class="microcopy">${esc(item.note)}</small>` : ''}${sparkline(item)}</div>`;
    }).join('')}</div>`).join('');
    const summary = data.costEur > 0.005
      ? `<div class="usage-summary is-over">💶 Über dem Freikontingent ≈ <strong>${esc(U.fmtMoney(data.costEur))}</strong> diesen Monat <small>(grobe Schätzung – die echte Rechnung steht in der Google Cloud Console)</small></div>`
      : `<div class="usage-summary is-ok">✓ Alles im Freikontingent – geschätzte Kosten <strong>${esc(U.fmtMoney(0))}</strong> <small>(grobe Schätzung – die echte Rechnung steht in der Google Cloud Console)</small></div>`;
    return summary + `<div class="usage-groups">${rows}</div>`;
  }

  // v28: Alte Räume löschen, Emote-Liste für die Firebase-Regeln abgleichen
  function startUpkeep(context) {
    const Store = window.SylasphereProgressStore;
    if (!Store) return;
    const emoteStatus = $('emote-status');
    const sync = async () => {
      emoteStatus.textContent = 'Gleiche ab …';
      try { const changed = await Store.syncEmotes(context); emoteStatus.textContent = changed ? '✓ Liste in Firebase aktualisiert.' : '✓ Liste ist aktuell.'; }
      catch (error) { emoteStatus.textContent = `Fehler: ${Account.errorText(error)} – sind die Regeln für v28 veröffentlicht?`; }
    };
    sync();
    $('sync-emotes')?.addEventListener('click', sync);
    $('cleanup-rooms')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!confirm('Alle Online-Räume löschen, die älter als 2 Tage sind?')) return;
      button.disabled = true; button.textContent = 'Räume werden geprüft …';
      try {
        const result = await Store.cleanupAllRooms(context);
        App.toast(`${result.removed} von ${result.checked} Räumen gelöscht.`, 'success');
      } catch (error) { App.toast(Account.errorText(error), 'error'); }
      finally { button.disabled = false; button.textContent = 'Jetzt aufräumen'; }
    });
  }

  // v25.1: Upload-Freigaben (Firestore uploaders/<uid>) an Admin + Moderatoren angleichen
  let syncing = Promise.resolve();
  function syncStorage(moderators) {
    const box = $('storage-status');
    const Cloud = window.SylasphereCloudMedia;
    if (!box || !Cloud) return;
    const uids = [...Object.keys(moderators), Account.state().user?.uid];
    syncing = syncing.then(async () => {
      try {
        const result = await Cloud.syncUploaders(uids);
        const changes = [result.added.length ? `${result.added.length} neu freigegeben` : '', result.removed.length ? `${result.removed.length} entfernt` : ''].filter(Boolean).join(', ');
        box.innerHTML = `<div class="notice notice--success">✓ ${result.total} ${result.total === 1 ? 'Konto darf' : 'Konten dürfen'} Dateien hochladen${changes ? ` (${esc(changes)})` : ''}.</div>`;
      } catch (error) {
        const code = String(error?.code || error?.message || '');
        const hint = /permission/i.test(code) ? 'Firestore lehnt ab: Sind die Firestore-Regeln veröffentlicht und steht dort deine Konto-ID statt DEINE_ADMIN_UID?'
          : /not-found|NOT_FOUND|failed-precondition|unavailable/i.test(code) ? 'Firestore ist noch nicht eingerichtet (Build → Firestore Database → Create database).'
          : Account.errorText(error);
        box.innerHTML = `<div class="notice notice--warning"><strong>Upload-Freigabe noch nicht aktiv.</strong><br>${esc(hint)}<br><small>Anleitung: FIREBASE_SETUP.md → „v25.1 Datei-Upload“.</small></div><button type="button" class="btn btn--small" data-storage-retry>Erneut versuchen</button>`;
        box.querySelector('[data-storage-retry]')?.addEventListener('click', () => syncStorage(moderators));
      }
    });
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
