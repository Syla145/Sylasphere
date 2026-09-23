(function () {
  'use strict';

  /*
   * Meine Quizze – Online-Speicher (v19)
   * ------------------------------------------------------------------
   * Quizze liegen in der Firebase Realtime Database (Gratis-Tarif) unter
   *   userQuizzes/<uid>/index/<id>  → Übersicht (Titel, Anzahl Fragen, Datum …)
   *   userQuizzes/<uid>/data/<id>   → { json: "<komplettes Quiz als JSON-Text>" }
   * Die Übersicht wird getrennt gespeichert, damit die Liste schnell lädt,
   * ohne alle Quizze herunterzuladen. Das Quiz selbst wird als JSON-Text
   * gespeichert, damit es exakt so zurückkommt (Firebase verändert sonst
   * leere Felder und Listen).
   *
   * Nur der Besitzer kann seine Quizze lesen und ändern – und nur, solange
   * er Moderator oder Admin ist (Firebase-Regeln). Lösungen sind damit vor
   * Spielern geschützt; in einen Raum gelangt wie bisher nur die öffentliche
   * Version der Fragen.
   *
   * Bilder/Audio: bitte weiter im GitHub-Repo (assets/) ablegen oder per Link
   * einbinden. Firebase-Dateispeicher ist nicht mehr kostenlos.
   */
  const MAX_JSON = 4000000; // ~4 MB pro Quiz (Grenze auch in den Firebase-Regeln)
  const Account = () => window.SylasphereAccount;

  function ctx() {
    const account = Account();
    if (!account?.canModerate()) throw new Error('Zum Speichern bitte mit einem freigeschalteten Moderator-Konto anmelden.');
    const context = account.context();
    const uid = account.state().user.uid;
    const dbm = context.modules.database;
    return { dbm, db: context.db, uid, ref: path => dbm.ref(context.db, path) };
  }

  function summary(quizData) {
    const quiz = quizData?.quiz || {};
    const rounds = Array.isArray(quiz.rounds) ? quiz.rounds : [];
    return {
      title: String(quiz.title || 'Ohne Titel').slice(0, 160),
      description: String(quiz.description || '').slice(0, 300),
      roundCount: rounds.length,
      questionCount: rounds.reduce((sum, round) => sum + (Array.isArray(round.questions) ? round.questions.length : 0), 0),
      theme: String(quiz.settings?.theme || '').slice(0, 20)
    };
  }

  function newId() {
    const random = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16);
    return `q${Date.now().toString(36)}${random}`.slice(0, 28);
  }
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(id);

  async function list() {
    const { dbm, ref, uid } = ctx();
    const value = (await dbm.get(ref(`userQuizzes/${uid}/index`))).val() || {};
    return Object.entries(value).map(([id, entry]) => Object.assign({ id }, entry)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function load(id) {
    if (!validId(id)) throw new Error('Unbekanntes Quiz.');
    const { dbm, ref, uid } = ctx();
    const value = (await dbm.get(ref(`userQuizzes/${uid}/data/${id}`))).val();
    if (!value?.json) throw new Error('Dieses Quiz wurde nicht gefunden (vielleicht gelöscht).');
    return JSON.parse(value.json);
  }

  /** Speichert ein Quiz. Ohne id wird ein neues angelegt. Gibt { id } zurück. */
  async function save(quizData, id = '') {
    const { dbm, ref, uid } = ctx();
    const json = JSON.stringify(quizData);
    if (json.length > MAX_JSON) throw new Error('Das Quiz ist zu groß für den Online-Speicher (meist wegen eingebetteter Bilder). Bilder bitte als Datei/Link einbinden.');
    const quizId = validId(id) ? id : newId();
    const now = dbm.serverTimestamp();
    const updates = {
      [`userQuizzes/${uid}/data/${quizId}`]: { json, updatedAt: now },
      [`userQuizzes/${uid}/index/${quizId}/updatedAt`]: now
    };
    Object.entries(summary(quizData)).forEach(([key, value]) => { updates[`userQuizzes/${uid}/index/${quizId}/${key}`] = value; });
    if (!validId(id)) updates[`userQuizzes/${uid}/index/${quizId}/createdAt`] = now;
    await dbm.update(ref('/'), updates);
    return { id: quizId };
  }

  async function remove(id) {
    if (!validId(id)) return;
    const { dbm, ref, uid } = ctx();
    await dbm.update(ref('/'), { [`userQuizzes/${uid}/data/${id}`]: null, [`userQuizzes/${uid}/index/${id}`]: null });
  }

  async function duplicate(id) {
    const data = await load(id);
    if (data?.quiz) data.quiz.title = `${data.quiz.title || 'Quiz'} (Kopie)`;
    return save(data);
  }

  function formatDate(ms) {
    if (!ms) return '';
    const date = new Date(ms);
    const today = new Date();
    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === today.toDateString()) return `heute ${time}`;
    return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${time}`;
  }

  window.SylasphereCloud = {
    available: () => Boolean(Account()?.canModerate()),
    list, load, save, remove, duplicate, summary, formatDate, validId, MAX_JSON
  };
})();
