(function () {
  'use strict';

  /*
   * Moderator-Zugang per Code (v13)
   * ------------------------------------------------------------------
   * Zwei Ebenen:
   * 1. Lokal (diese Datei): Der eingegebene Code wird gehasht und mit
   *    MODERATOR_CODE_HASH verglichen. Das ist nur eine Sperre in der
   *    Oberfläche – wer den Quelltext liest, kann sie umgehen.
   * 2. Online (Firebase-Regeln): Der Code wird unter moderatorGrants/<uid>
   *    gespeichert. Firebase erlaubt das nur, wenn der Code unter
   *    config/moderatorKeys/<code> existiert (für niemanden lesbar).
   *    Online-Räume darf nur anlegen, wer einen gültigen Grant hat.
   *    Das ist der eigentliche Schutz.
   *
   * Code ändern: tools/moderator-code.html öffnen, neuen Code eingeben,
   * den erzeugten Hash hier eintragen und denselben Code in der
   * Firebase-Konsole unter config/moderatorKeys anlegen (siehe FIREBASE_SETUP.md).
   * Später wird dieses Modul durch Login + Moderator-Rolle ersetzt.
   */
  const MODERATOR_CODE_HASH = '3324cb69664921bc390d821b2c47f6c67e8c4e0937476fba9af69da58df53f17';
  const HASH_PREFIX = 'sylasphere:';
  const STORAGE_KEY = 'sylasphere:moderator-code';
  const INVALID_KEY_CHARS = /[.#$\[\]\/]/;

  let unlocked = false;
  let resolveUnlocked;
  const unlockedPromise = new Promise(resolve => { resolveUnlocked = resolve; });

  function normalize(code) { return String(code || '').trim(); }

  async function sha256(text) {
    if (!window.crypto?.subtle) return '';
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  function storedCode() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { return ''; }
  }
  function storeCode(code) {
    try { if (code) localStorage.setItem(STORAGE_KEY, code); else localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  async function matchesLocal(code) {
    return Boolean(MODERATOR_CODE_HASH) && (await sha256(HASH_PREFIX + code)) === MODERATOR_CODE_HASH;
  }

  // Schreibt den Code als Grant für die anonyme Moderator-UID. Firebase prüft ihn serverseitig.
  async function grantOnline(code) {
    const Firebase = window.JHQuizFirebase;
    if (!Firebase || !code) return false;
    const context = await Firebase.ready('moderator');
    const dbm = context.modules.database;
    const uid = context.auth.currentUser?.uid;
    if (!uid) return false;
    await dbm.set(dbm.ref(context.db, `moderatorGrants/${uid}`), code);
    return true;
  }

  function isPermissionDenied(error) {
    return /permission[_-]denied/i.test(String(error?.code || error?.message || ''));
  }

  async function verify(rawCode) {
    const code = normalize(rawCode);
    if (!code) return { ok: false, message: 'Bitte den Moderator-Code eingeben.' };
    if (INVALID_KEY_CHARS.test(code)) return { ok: false, message: 'Der Code darf keine der Zeichen . # $ [ ] / enthalten.' };
    if (await matchesLocal(code)) return { ok: true, code };
    // Lokaler Hash passt nicht – vielleicht wurde der Code nur in Firebase geändert.
    try {
      if (await grantOnline(code)) return { ok: true, code };
    } catch (error) {
      if (!isPermissionDenied(error)) return { ok: false, message: 'Code falsch – und Firebase ist gerade nicht erreichbar, um ihn online zu prüfen.' };
    }
    return { ok: false, message: 'Dieser Code ist nicht gültig.' };
  }

  function setUnlocked(code) {
    unlocked = true;
    storeCode(code);
    document.documentElement.classList.remove('moderator-locked');
    const gate = document.getElementById('moderator-gate');
    if (gate) gate.hidden = true;
    const lockButton = document.getElementById('btn-lock-moderator');
    if (lockButton) lockButton.hidden = false;
    resolveUnlocked();
  }

  function lock() {
    storeCode('');
    location.href = location.pathname;
  }

  /**
   * Vor dem Anlegen eines Online-Raums aufrufen. Stellt sicher, dass die aktuelle
   * anonyme Moderator-UID einen gültigen Grant hat. Wirft einen verständlichen Fehler,
   * wenn Firebase den Code ablehnt. Mit älteren Regeln (ohne moderatorGrants) wird
   * die Ablehnung ignoriert, damit die Online-Sitzung weiterhin funktioniert.
   */
  async function ensureOnlineGrant() {
    const code = storedCode();
    if (!code) throw new Error('Bitte zuerst den Moderator-Code eingeben.');
    try { await grantOnline(code); }
    catch (error) {
      if (isPermissionDenied(error)) { console.warn('Moderator-Grant abgelehnt (Code nicht in Firebase hinterlegt oder alte Regeln).', error); return false; }
      throw error;
    }
    return true;
  }

  function explainCreateError(error) {
    if (!isPermissionDenied(error)) return null;
    return 'Firebase hat das Anlegen des Online-Raums abgelehnt. Prüfe, ob dein Moderator-Code in der Firebase-Konsole unter config/moderatorKeys hinterlegt ist und die v13-Regeln veröffentlicht sind (siehe FIREBASE_SETUP.md).';
  }

  function bindForm() {
    const gate = document.getElementById('moderator-gate');
    if (!gate) { setUnlocked(''); return; }
    const form = document.getElementById('moderator-gate-form');
    const input = document.getElementById('moderator-code');
    const error = document.getElementById('moderator-gate-error');
    const submit = form.querySelector('button[type="submit"]');
    document.getElementById('btn-lock-moderator')?.addEventListener('click', lock);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      submit.disabled = true; submit.textContent = 'Prüfe …';
      try {
        const result = await verify(input.value);
        if (result.ok) setUnlocked(result.code);
        else { error.textContent = result.message; input.select(); gate.classList.remove('is-shaking'); void gate.offsetWidth; gate.classList.add('is-shaking'); }
      } finally {
        submit.disabled = false; submit.textContent = 'Freischalten';
      }
    });
    input.focus();
  }

  async function init() {
    const saved = storedCode();
    if (saved && await matchesLocal(saved)) { setUnlocked(saved); return; }
    if (saved) {
      try { if (await grantOnline(saved)) { setUnlocked(saved); return; } } catch (_) {}
      storeCode('');
    }
    const gate = document.getElementById('moderator-gate');
    if (gate) gate.hidden = false;
    bindForm();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.SylasphereModeratorGate = {
    whenUnlocked: () => unlockedPromise,
    isUnlocked: () => unlocked,
    ensureOnlineGrant,
    explainCreateError,
    lock,
    // Nur für tools/moderator-code.html und Tests
    hashCode: code => sha256(HASH_PREFIX + normalize(code))
  };
})();
