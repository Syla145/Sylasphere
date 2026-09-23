(function () {
  'use strict';

  const FIREBASE_VERSION = '12.19.0';
  const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyDxC-CTMxWdp7ZDXrQ_PvACU0kFt1DCBsM',
    authDomain: 'jh-quiz.firebaseapp.com',
    databaseURL: 'https://jh-quiz-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'jh-quiz',
    storageBucket: 'jh-quiz.firebasestorage.app',
    messagingSenderId: '12206665857',
    appId: '1:12206665857:web:28e6a1e723869745e2dd80'
  });

  const contexts = new Map();
  let modulesPromise = null;

  function loadModules() {
    if (!modulesPromise) {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
      modulesPromise = Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-database.js`)
      ]).then(([app, auth, database]) => ({ app, auth, database }));
    }
    return modulesPromise;
  }

  function appName(role) {
    if (role === 'moderator') return 'jhquiz-online-moderator';
    if (role === 'spectator') return 'jhquiz-online-spectator';
    return 'jhquiz-online-player';
  }

  async function createContext(role) {
    const modules = await loadModules();
    const name = appName(role);
    let app;
    try { app = modules.app.getApp(name); }
    catch (_) { app = modules.app.initializeApp(FIREBASE_CONFIG, name); }

    const auth = modules.auth.getAuth(app);
    const persistence = role === 'moderator'
      ? modules.auth.browserLocalPersistence
      : modules.auth.browserSessionPersistence;
    await modules.auth.setPersistence(auth, persistence);
    if (!auth.currentUser) await modules.auth.signInAnonymously(auth);

    const db = modules.database.getDatabase(app);
    const context = {
      role,
      modules,
      app,
      auth,
      db,
      serverOffset: 0,
      connected: false,
      offsetUnsubscribe: null,
      connectedUnsubscribe: null
    };
    try {
      context.offsetUnsubscribe = modules.database.onValue(
        modules.database.ref(db, '.info/serverTimeOffset'),
        snapshot => { context.serverOffset = Number(snapshot.val()) || 0; }
      );
    } catch (_) {}
    try {
      context.connectedUnsubscribe = modules.database.onValue(
        modules.database.ref(db, '.info/connected'),
        snapshot => { context.connected = snapshot.val() === true; }
      );
    } catch (_) {}
    return context;
  }

  async function ready(role = 'player') {
    const key = appName(role);
    if (!contexts.has(key)) contexts.set(key, createContext(role));
    return contexts.get(key);
  }

  async function rotateAnonymous(role = 'player') {
    const context = await ready(role);
    await context.modules.auth.signOut(context.auth);
    await context.modules.auth.signInAnonymously(context.auth);
    return context.auth.currentUser;
  }

  async function currentUser(role = 'player') {
    const context = await ready(role);
    return context.auth.currentUser;
  }

  function serverNow(context) {
    return Date.now() + (Number(context?.serverOffset) || 0);
  }

  function toLocalTime(context, serverEpoch) {
    const value = Number(serverEpoch);
    if (!Number.isFinite(value)) return null;
    return value - (Number(context?.serverOffset) || 0);
  }

  function friendlyError(error) {
    const code = String(error?.code || '');
    if (/auth\/operation-not-allowed/i.test(code)) return 'Firebase: Anonyme Anmeldung ist noch nicht aktiviert.';
    if (/permission-denied/i.test(code)) return 'Firebase: Zugriff verweigert. Bitte die mitgelieferten Realtime-Database-Regeln veröffentlichen.';
    if (/network-request-failed|network-error|failed-precondition/i.test(code)) return 'Firebase ist gerade nicht erreichbar. Prüfe die Internetverbindung.';
    return error?.message || 'Firebase-Verbindung fehlgeschlagen.';
  }

  window.JHQuizFirebase = {
    version: FIREBASE_VERSION,
    config: FIREBASE_CONFIG,
    ready,
    currentUser,
    rotateAnonymous,
    serverNow,
    toLocalTime,
    friendlyError
  };
})();
