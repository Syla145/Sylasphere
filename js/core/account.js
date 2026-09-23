(function () {
  'use strict';

  /*
   * Konten (v19)
   * ------------------------------------------------------------------
   * Moderatoren melden sich mit Google oder E-Mail + Passwort an (Firebase
   * Authentication, kostenlos). Spieler brauchen weiterhin kein Konto und
   * treten als Gast bei.
   *
   * Rollen (werden von den Firebase-Regeln durchgesetzt):
   *   admins/<uid>: true          → Admin (einmalig von Hand in der Konsole)
   *   moderators/<uid>: {…}       → Moderator (vergibt der Admin auf admin.html)
   *   moderatorRequests/<uid>     → offene Anfrage eines angemeldeten Kontos
   * Eine Anmeldung allein gibt keine Moderator-Rechte.
   * Später automatisch möglich (z. B. Einladungslink/Code), ohne den Aufbau zu ändern.
   *
   * Später für Spieler-Konten: dasselbe Modul (signIn…), nur ohne Freischaltung.
   *
   * Nutzt den Firebase-Kontext „moderator“ – Editor und Moderatorseite teilen
   * sich dadurch automatisch die Anmeldung.
   */
  const ROLE = 'moderator';
  const listeners = new Set();
  let context = null;
  let initPromise = null;
  let current = { ready: false, user: null, role: null, request: null };

  function Firebase() {
    if (!window.JHQuizFirebase) throw new Error('Firebase ist auf dieser Seite nicht geladen.');
    return window.JHQuizFirebase;
  }

  function describe(user) {
    if (!user) return null;
    const provider = user.isAnonymous ? 'anonymous' : (user.providerData?.[0]?.providerId || 'password');
    return {
      uid: user.uid,
      isAnonymous: Boolean(user.isAnonymous),
      provider,
      email: user.email || '',
      name: user.displayName || (user.email ? user.email.split('@')[0] : 'Gast'),
      photo: user.photoURL || ''
    };
  }

  function emit() { listeners.forEach(fn => { try { fn(current); } catch (error) { console.error(error); } }); }
  function set(patch) { current = Object.assign({}, current, patch); emit(); }

  /** Firebase verbinden und gespeicherte Anmeldung wiederherstellen (ohne Gastkonto). */
  function init() {
    if (!initPromise) {
      initPromise = (async () => {
        context = await Firebase().ready(ROLE, { anonymous: false });
        const auth = context.modules.auth;
        let first = true;
        await new Promise(resolve => {
          auth.onAuthStateChanged(context.auth, async user => {
            const info = describe(user);
            const sameUser = current.user?.uid === info?.uid;
            set({ ready: true, user: info, role: sameUser ? current.role : null });
            if (!sameUser) watchModeratorEntry(info);
            if (info && !info.isAnonymous && !sameUser) await refreshRole();
            else if (!info || info.isAnonymous) set({ role: 'none', request: null });
            if (first) { first = false; resolve(); }
          });
        });
        return current;
      })();
    }
    return initPromise;
  }

  // Live: Sobald der Admin das Konto freigibt (oder entzieht), aktualisiert sich die Rolle sofort.
  let unwatch = null;
  function watchModeratorEntry(info) {
    if (unwatch) { try { unwatch(); } catch (_) {} unwatch = null; }
    if (!info || info.isAnonymous) return;
    let firstValue = true;
    try {
      unwatch = context.modules.database.onValue(ref(`moderators/${info.uid}`), () => {
        if (firstValue) { firstValue = false; return; }
        refreshRole();
      }, () => {});
    } catch (_) {}
  }

  function isAccount() { return Boolean(current.user && !current.user.isAnonymous); }

  function ref(path) { return context.modules.database.ref(context.db, path); }
  async function read(path) {
    try { return (await context.modules.database.get(ref(path))).val(); }
    catch (_) { return null; }
  }

  /** Rolle des angemeldeten Kontos neu laden: admin | moderator | pending | none */
  async function refreshRole() {
    if (!isAccount()) { set({ role: 'none' }); return 'none'; }
    const uid = current.user.uid;
    const [admin, moderator, request] = await Promise.all([read(`admins/${uid}`), read(`moderators/${uid}`), read(`moderatorRequests/${uid}`)]);
    const role = admin === true ? 'admin' : moderator ? 'moderator' : request ? 'pending' : 'none';
    set({ role, request: request || null });
    return role;
  }

  /** Moderator-Zugang anfragen (der Admin bestätigt auf admin.html). */
  async function requestAccess(note = '') {
    await init();
    if (!isAccount()) throw new Error('Bitte zuerst anmelden.');
    const user = current.user;
    await context.modules.database.set(ref(`moderatorRequests/${user.uid}`), {
      name: user.name.slice(0, 60), email: user.email.slice(0, 120), note: String(note || '').trim().slice(0, 200),
      requestedAt: context.modules.database.serverTimestamp()
    });
    return refreshRole();
  }

  async function cancelRequest() {
    await init();
    if (!isAccount()) return;
    await context.modules.database.remove(ref(`moderatorRequests/${current.user.uid}`));
    await refreshRole();
  }

  // ---- Admin-Funktionen (nur für admins/<uid>; Firebase lehnt sonst ab) ----
  async function listRequests() {
    const value = await context.modules.database.get(ref('moderatorRequests')).then(s => s.val());
    return Object.entries(value || {}).map(([uid, r]) => Object.assign({ uid }, r)).sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
  }
  async function listModerators() {
    const value = await context.modules.database.get(ref('moderators')).then(s => s.val());
    return Object.entries(value || {}).map(([uid, m]) => Object.assign({ uid }, m)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
  async function approve(uid, info = {}) {
    const dbm = context.modules.database;
    await dbm.update(ref('/'), {
      [`moderators/${uid}`]: { name: String(info.name || '').slice(0, 60), email: String(info.email || '').slice(0, 120), grantedAt: dbm.serverTimestamp(), grantedBy: current.user.uid },
      [`moderatorRequests/${uid}`]: null
    });
  }
  async function reject(uid) { await context.modules.database.remove(ref(`moderatorRequests/${uid}`)); }
  async function revoke(uid) { await context.modules.database.remove(ref(`moderators/${uid}`)); }

  async function signInGoogle() {
    await init();
    const auth = context.modules.auth;
    const provider = new auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(context.auth, provider);
    await refreshRole();
    return current;
  }

  async function signInEmail(email, password) {
    await init();
    await context.modules.auth.signInWithEmailAndPassword(context.auth, String(email || '').trim(), String(password || ''));
    await refreshRole();
    return current;
  }

  async function register(email, password, name) {
    await init();
    const auth = context.modules.auth;
    const credential = await auth.createUserWithEmailAndPassword(context.auth, String(email || '').trim(), String(password || ''));
    const displayName = String(name || '').trim().slice(0, 40);
    if (displayName) {
      try { await auth.updateProfile(credential.user, { displayName }); } catch (_) {}
      set({ user: describe(context.auth.currentUser) });
    }
    await refreshRole();
    return current;
  }

  async function resetPassword(email) {
    await init();
    await context.modules.auth.sendPasswordResetEmail(context.auth, String(email || '').trim());
  }

  async function signOut() {
    await init();
    await context.modules.auth.signOut(context.auth);
    set({ user: null, role: 'none', request: null });
  }

  function errorText(error) {
    const code = String(error?.code || '');
    const map = {
      'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
      'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
      'auth/user-not-found': 'Zu dieser E-Mail gibt es noch kein Konto.',
      'auth/invalid-email': 'Bitte eine gültige E-Mail-Adresse eingeben.',
      'auth/missing-password': 'Bitte ein Passwort eingeben.',
      'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.',
      'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
      'auth/popup-closed-by-user': 'Google-Anmeldung abgebrochen.',
      'auth/cancelled-popup-request': 'Google-Anmeldung abgebrochen.',
      'auth/popup-blocked': 'Der Browser hat das Google-Fenster blockiert. Bitte Pop-ups für diese Seite erlauben.',
      'auth/unauthorized-domain': 'Diese Website ist in Firebase noch nicht freigegeben (Authentication → Einstellungen → Autorisierte Domains).',
      'auth/operation-not-allowed': 'Diese Anmeldeart ist in Firebase noch nicht aktiviert (Authentication → Sign-in method).',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
      'auth/network-request-failed': 'Keine Verbindung. Bitte Internet prüfen.',
      'auth/account-exists-with-different-credential': 'Diese E-Mail ist schon mit einer anderen Anmeldeart verknüpft.'
    };
    if (map[code]) return map[code];
    if (window.JHQuizFirebase) return window.JHQuizFirebase.friendlyError(error);
    return error?.message || 'Unbekannter Fehler.';
  }

  window.SylasphereAccount = {
    init,
    state: () => current,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    isAccount,
    /** Darf moderieren und Quizze speichern (Moderator oder Admin) */
    canModerate: () => isAccount() && (current.role === 'moderator' || current.role === 'admin'),
    isAdmin: () => isAccount() && current.role === 'admin',
    refreshRole,
    requestAccess,
    cancelRequest,
    admin: { listRequests, listModerators, approve, reject, revoke },
    signInGoogle,
    signInEmail,
    register,
    resetPassword,
    signOut,
    errorText,
    context: () => context
  };
})();
