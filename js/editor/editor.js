(function () {
  'use strict';
  /*
   * Quiz-Editor (v30: Umbau mit Gliederung)
   * ------------------------------------------------------------------
   * Links die Gliederung (⚙️ Quiz, Runden einklappbar, Fragen als kompakte Zeilen, ⠿ ziehen),
   * in der Mitte immer genau eine Frage, Runde oder „⚙️ Quiz“. Obere Leiste: Speicherstatus,
   * ‹ ›, Vorschau, Prüfen, „⋯“-Menü. Handy: Gliederung ist der Startbildschirm, eine Frage
   * öffnet sich bildschirmfüllend mit „← Übersicht“.
   * Datenlogik (Verschieben, Duplizieren, Typwechsel, ⚠️-Zuordnung): js/editor/editor-model.js
   * Die Felder der 17 Fragetypen baut weiterhin jedes Typ-Modul selbst (editor()).
   */
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Validator = window.SchmobinValidator;
  const Renderers = window.SchmobinRenderers;
  const M = window.SylasphereEditorModel;
  const AUTOSAVE_KEY = 'schmobin:editor:autosave:v2';
  const CLOUD_ID_KEY = 'sylasphere:editor:cloud-id';
  const COLLAPSED_KEY = 'sylasphere:editor:collapsed';
  const Cloud = () => window.SylasphereCloud;
  const Account = () => window.SylasphereAccount;
  const AccountUI = () => window.SylasphereAccountUI;
  const esc = value => App.escapeHTML(value);
  const phone = () => window.matchMedia?.('(max-width: 760px)').matches;

  let state = null;
  let saveTimer = null;
  // Online-Speicher: Moderatoren speichern automatisch in „Meine Quizze“ (v30: auch ein neues Quiz beim ersten Bearbeiten)
  let cloudId = readCloudId();
  let cloudTimer = null;
  let cloudStatus = { kind: 'idle', at: 0, message: '' };
  let cloudSaving = null;
  let accountUnavailable = false;
  // v30: Auswahl + Gliederung
  let selection = { kind: 'quiz' };
  let collapsed = readCollapsed();
  let validation = null;
  let issueMap = { questions: new Map(), rounds: new Map(), quiz: [] };
  let dragging = null;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['editor-start','editor-workspace','choose-edit-quiz','choose-new-quiz','editor-load-panel','editor-quiz-select','load-selected-quiz','continue-autosave','editor-import-start','editor-start-message','back-to-editor-start','new-quiz','editor-import','validate-quiz','export-quiz','autosave-state','preview-backdrop','preview-content','preview-close',
      'ed-outline','ed-detail','ed-top-title','ed-save-state','ed-prev','ed-next','ed-preview','ed-issue-count','ed-menu-btn','ed-menu','ed-back','cloud-panel'].forEach(id => els[id] = document.getElementById(id));
    bindGlobal();
    bindStartScreen();
    await loadEditorQuizList();
    updateAutosaveChoice();
    showStart();
    initAccount();
  }

  // ---------------------------------------------------------------- Konto & Online-Speicher (v19)
  function readCloudId() { try { return localStorage.getItem(CLOUD_ID_KEY) || ''; } catch (_) { return ''; } }
  function setCloudId(id) {
    cloudId = id || '';
    try { if (cloudId) localStorage.setItem(CLOUD_ID_KEY, cloudId); else localStorage.removeItem(CLOUD_ID_KEY); } catch (_) {}
    cloudStatus = { kind: cloudId ? 'saved' : 'idle', at: cloudId ? Date.now() : 0, message: '' };
    renderSaveState();
  }
  function readCollapsed() { try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')); } catch (_) { return new Set(); } }
  function writeCollapsed() { try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed].slice(-50))); } catch (_) {} }

  async function initAccount() {
    if (!Account() || !AccountUI() || !window.JHQuizFirebase) return;
    try { await Account().init(); }
    catch (error) { console.warn('Konto nicht verfügbar', error); accountUnavailable = true; renderCloudPanel(); renderSaveState(); return; }
    document.getElementById('account-slot')?.replaceWith(AccountUI().headerButton({ onLogin: openLogin }));
    let lastKey = '';
    Account().onChange(stateNow => {
      const key = `${stateNow.user?.uid || '-'}|${stateNow.role || ''}`;
      if (key === lastKey) return;
      lastKey = key;
      renderCloudPanel(); renderSaveState();
    });
    renderCloudPanel(); renderSaveState();
  }

  function openLogin() { AccountUI()?.openAccountDialog({ intro: 'Melde dich an, um deine Quizze online zu speichern und auf jedem Gerät weiterzubearbeiten.' }); }

  function accountHint() {
    const s = Account()?.state();
    if (!Account() || !window.JHQuizFirebase) return { text: 'Online-Speicher ist auf dieser Seite nicht verfügbar. Dein Entwurf wird auf diesem Gerät gesichert.', action: null };
    if (accountUnavailable) return { text: 'Online-Speicher gerade nicht erreichbar (keine Verbindung zu Firebase). Dein Entwurf wird auf diesem Gerät gesichert.', action: null };
    if (!s?.ready) return { text: 'Anmeldung wird geladen …', action: null };
    if (!s.user || s.user.isAnonymous) return { text: 'Melde dich an, um Quizze online zu speichern und auf jedem Gerät weiterzubearbeiten.', action: 'Anmelden' };
    if (s.role === 'pending') return { text: 'Deine Moderator-Anfrage wartet noch auf Freigabe. Danach kannst du Quizze online speichern.', action: 'Status ansehen' };
    if (s.role && s.role !== 'moderator' && s.role !== 'admin') return { text: 'Online speichern können nur freigeschaltete Moderatoren.', action: 'Zugang anfragen' };
    return null;
  }

  async function renderCloudPanel() {
    const panel = els['cloud-panel'];
    if (!panel) return;
    if (!Account() || !window.JHQuizFirebase) { panel.hidden = true; return; }
    panel.hidden = false;
    const hint = accountHint();
    if (hint) {
      panel.innerHTML = `<div class="section-title"><div><span class="eyebrow">☁️ Meine Quizze</span><h2>Online speichern</h2><p>${esc(hint.text)}</p></div></div>`;
      if (hint.action) panel.querySelector('.section-title').append(button(hint.action, 'btn btn--primary', openLogin));
      return;
    }
    panel.innerHTML = '<div class="section-title"><div><span class="eyebrow">☁️ Meine Quizze</span><h2>Deine gespeicherten Quizze</h2><p>Online gespeichert – auf jedem Gerät mit deinem Konto verfügbar.</p></div></div><div class="cloud-list"><p class="microcopy">Lade …</p></div>';
    const listBox = panel.querySelector('.cloud-list');
    let entries = [];
    try { entries = await Cloud().list(); }
    catch (error) { listBox.innerHTML = `<div class="notice notice--error">${esc(Account().errorText(error))}</div>`; return; }
    if (!entries.length) { listBox.innerHTML = '<p class="microcopy" style="margin:0">Noch keine Quizze gespeichert. Öffne oder erstelle ein Quiz – es wird beim Bearbeiten automatisch hier gespeichert.</p>'; return; }
    listBox.replaceChildren(...entries.map(entry => {
      const row = div('cloud-row');
      const info = div('cloud-row-info');
      info.innerHTML = `<strong>${esc(entry.title)}</strong><span>${entry.roundCount || 0} Runden · ${entry.questionCount || 0} Fragen · ${esc(Cloud().formatDate(entry.updatedAt))}</span>`;
      const actions = div('cloud-row-actions');
      actions.append(
        button('Öffnen', 'btn btn--primary btn--small', () => openCloudQuiz(entry.id)),
        button('▶', 'btn btn--small', () => { location.href = `./moderator.html?quiz=${encodeURIComponent('cloud:' + entry.id)}`; }),
        button('⧉', 'btn btn--small', async () => { try { await Cloud().duplicate(entry.id); App.toast('Kopie angelegt.', 'success'); renderCloudPanel(); } catch (e) { App.toast(Account().errorText(e), 'error'); } }),
        button('🗑', 'btn btn--danger btn--small', async () => {
          if (!confirm(`„${entry.title}“ endgültig aus „Meine Quizze“ löschen?`)) return;
          try { await Cloud().remove(entry.id); if (entry.id === cloudId) setCloudId(''); App.toast('Gelöscht.', 'success'); renderCloudPanel(); }
          catch (e) { App.toast(Account().errorText(e), 'error'); }
        })
      );
      actions.children[1].title = 'Direkt moderieren'; actions.children[2].title = 'Duplizieren'; actions.children[3].title = 'Löschen';
      row.append(info, actions);
      return row;
    }));
  }

  async function openCloudQuiz(id) {
    try {
      const data = await Cloud().load(id);
      const result = Validator.validate(data);
      state = result.normalized;
      setCloudId(id);
      openWorkspace(`„${state.quiz.title}“ geöffnet.`);
      if (!result.valid) App.toast('Hinweis: Das Quiz enthält noch Fehler (siehe „✓ Prüfen“).', 'error');
    } catch (error) { App.toast(`Öffnen fehlgeschlagen: ${Account().errorText(error)}`, 'error'); }
  }

  /** v30: Speicherstatus in der oberen Leiste */
  function renderSaveState() {
    const box = els['ed-save-state'];
    if (!box) return;
    const hint = accountHint();
    box.classList.remove('is-error', 'is-busy', 'is-ok', 'is-local');
    if (hint) {
      box.innerHTML = '💾 <span>Auf diesem Gerät</span>';
      box.title = hint.text + (hint.action ? ' (antippen)' : '');
      box.classList.add('is-local');
      box.dataset.action = hint.action ? 'login' : '';
      return;
    }
    const time = cloudStatus.at ? new Date(cloudStatus.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    const view = {
      idle: ['☁️', cloudId ? 'Gespeichert' : 'Speichert beim Bearbeiten', 'is-ok', 'Änderungen werden automatisch in „Meine Quizze“ gespeichert.'],
      pending: ['☁️', 'Änderungen …', 'is-busy', 'Wird gleich online gespeichert.'],
      saving: ['☁️', 'Speichere …', 'is-busy', 'Wird online gespeichert.'],
      saved: ['☁️', 'Gespeichert', 'is-ok', `Online gespeichert${time ? ` um ${time}` : ''}. Änderungen werden automatisch gespeichert.`],
      error: ['⚠️', 'Nicht gespeichert', 'is-error', `${cloudStatus.message || 'Online-Speichern fehlgeschlagen.'} Antippen zum erneuten Versuchen. Dein Entwurf ist auf diesem Gerät gesichert.`]
    }[cloudStatus.kind] || ['☁️', '', 'is-ok', ''];
    box.innerHTML = `${view[0]} <span>${esc(view[1])}</span>`;
    box.title = view[3];
    box.classList.add(view[2]);
    box.dataset.action = cloudStatus.kind === 'error' ? 'retry' : '';
  }

  function queueCloudSave() {
    if (!state || !Cloud()?.available() || accountHint()) return;
    clearTimeout(cloudTimer);
    cloudStatus = Object.assign({}, cloudStatus, { kind: 'pending' });
    renderSaveState();
    cloudTimer = setTimeout(() => cloudSave({ manual: false }), 2000);
  }

  async function cloudSave({ manual = false, asCopy = false } = {}) {
    if (!state || !Cloud()?.available()) { if (manual) openLogin(); return; }
    clearTimeout(cloudTimer);
    if (cloudSaving) { try { await cloudSaving; } catch (_) {} }
    cloudStatus = Object.assign({}, cloudStatus, { kind: 'saving' });
    renderSaveState();
    cloudSaving = (async () => {
      const data = Quiz.clone(state);
      if (asCopy && data.quiz) data.quiz.title = `${data.quiz.title || 'Quiz'} (Kopie)`;
      const result = await Cloud().save(data, asCopy ? '' : cloudId);
      if (asCopy) { state.quiz.title = data.quiz.title; localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); renderTop(); renderDetail(); }
      if (result.id !== cloudId) { const firstSave = !cloudId && !asCopy; setCloudId(result.id); if (firstSave) App.toast('Automatisch in „Meine Quizze“ gespeichert.', 'success'); }
      cloudStatus = { kind: 'saved', at: Date.now(), message: '' };
      if (manual) App.toast(asCopy ? 'Als Kopie in „Meine Quizze“ gespeichert.' : 'In „Meine Quizze“ gespeichert.', 'success');
    })();
    try { await cloudSaving; }
    catch (error) {
      cloudStatus = { kind: 'error', at: cloudStatus.at, message: Account()?.errorText(error) || error.message };
      if (manual) App.toast(`Online-Speichern fehlgeschlagen: ${cloudStatus.message}`, 'error');
    } finally { cloudSaving = null; renderSaveState(); }
  }

  // ---------------------------------------------------------------- Startbildschirm
  function bindStartScreen() {
    els['choose-edit-quiz'].addEventListener('click', () => {
      els['editor-load-panel'].hidden = false;
      els['editor-load-panel'].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    els['choose-new-quiz'].addEventListener('click', () => {
      state = createBlankQuiz();
      setCloudId('');
      openWorkspace('Neues Quiz erstellt.');
    });
    els['load-selected-quiz'].addEventListener('click', () => loadSelectedEditorQuiz());
    els['continue-autosave'].addEventListener('click', () => {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) return App.toast('Es gibt noch keinen gespeicherten Entwurf.', 'error');
      try {
        state = Quiz.normalizeQuiz(JSON.parse(saved));
        openWorkspace('Letzten Entwurf geladen.');
      } catch (_) {
        localStorage.removeItem(AUTOSAVE_KEY);
        updateAutosaveChoice();
        App.toast('Der gespeicherte Entwurf war beschädigt und wurde verworfen.', 'error');
      }
    });
    els['editor-import-start'].addEventListener('change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      await importIntoEditor(file, true);
      event.target.value = '';
    });
  }

  async function loadEditorQuizList() {
    try {
      const response = await fetch(`./data/quiz-list.json?cb=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const list = await response.json();
      const entries = Array.isArray(list) ? list : list.quizzes || [];
      els['editor-quiz-select'].replaceChildren();
      entries.forEach(item => {
        const option = document.createElement('option');
        option.value = item.file || item.filename || '';
        option.textContent = item.title || option.value;
        els['editor-quiz-select'].append(option);
      });
      if (!entries.length) throw new Error('Keine Quiz-Dateien gefunden.');
      els['editor-start-message'].textContent = `${entries.length} Quiz-Datei${entries.length === 1 ? '' : 'en'} aus data/ gefunden.`;
    } catch (error) {
      els['editor-start-message'].textContent = `Quiz-Liste konnte nicht geladen werden: ${error.message}. JSON-Import funktioniert weiterhin.`;
      els['load-selected-quiz'].disabled = true;
    }
  }

  async function loadSelectedEditorQuiz() {
    const file = els['editor-quiz-select'].value;
    if (!file) return App.toast('Bitte ein Quiz auswählen.', 'error');
    try {
      const safeFile = file.replace(/^\.\//, '');
      const response = await fetch(`./data/${safeFile}?cb=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const result = Validator.validate(data);
      if (!result.valid) { App.toast('Das Quiz enthält Fehler. Bitte zuerst korrigieren oder als JSON importieren.', 'error'); return; }
      state = result.normalized;
      setCloudId('');
      openWorkspace(`„${state.quiz.title}“ geladen.`);
    } catch (error) { App.toast(`Quiz konnte nicht geladen werden: ${error.message}`, 'error'); }
  }

  async function importIntoEditor(file, openAfter = false) {
    try {
      const data = await App.readJSONFile(file);
      const result = Validator.validate(data);
      if (!result.valid) { showValidationDialog(result); App.toast('Import enthält Fehler und wurde nicht übernommen.', 'error'); return false; }
      state = result.normalized;
      setCloudId('');
      if (openAfter) openWorkspace(`„${state.quiz.title}“ importiert.`);
      else { selection = firstSelection(); structuralChange(); App.toast('Quiz importiert.', 'success'); }
      return true;
    } catch (error) { App.toast(error.message, 'error'); return false; }
  }

  function updateAutosaveChoice() {
    const hasAutosave = Boolean(localStorage.getItem(AUTOSAVE_KEY));
    els['continue-autosave'].disabled = !hasAutosave;
    els['continue-autosave'].textContent = hasAutosave ? 'Letzten Entwurf fortsetzen' : 'Kein Entwurf gespeichert';
  }

  function showStart() {
    els['editor-start'].hidden = false;
    els['editor-workspace'].hidden = true;
    els['editor-load-panel'].hidden = true;
    if (cloudId && cloudTimer) cloudSave({ manual: false });
    renderCloudPanel();
    updateAutosaveChoice();
    App.setText(els['autosave-state'], state ? 'Entwurf gespeichert' : 'Editor bereit');
  }

  function firstSelection() {
    if (phone()) return { kind: 'quiz' };
    return M.total(state) ? { kind: 'question', ri: M.flat(state)[0].ri, qi: M.flat(state)[0].qi } : { kind: 'quiz' };
  }

  function openWorkspace(message = '') {
    els['editor-start'].hidden = true;
    els['editor-workspace'].hidden = false;
    selection = firstSelection();
    setMobileDetail(false);
    window.scrollTo({ top: 0 });
    renderAll();
    renderSaveState();
    queueSave(false);
    if (message) App.toast(message, 'success');
  }

  function createBlankQuiz() {
    return Quiz.normalizeQuiz({ quiz: {
      id: `quiz_${Date.now().toString(36)}`,
      title: 'Mein Sylasphere Quiz', description: '',
      settings: { defaultTimer: 30, defaultPoints: 100, buzzerEnabled: true },
      rounds: [{ id: App.uid('round'), title: 'Runde 1', pointsMultiplier: 1, questions: [{
        id: App.uid('q'), type: 'multiple-choice', category: 'Allgemeinwissen', text: 'Neue Frage', points: 100, timer: 30,
        options: [{id:'a',text:'Antwort A'},{id:'b',text:'Antwort B'},{id:'c',text:'Antwort C'},{id:'d',text:'Antwort D'}], correctAnswer: 'a'
      }] }]
    }});
  }
  function newQuestion(type = 'multiple-choice') {
    const base = { id: App.uid('q'), type, category: '', text: 'Neue Frage', points: state?.quiz?.settings?.defaultPoints || 100, timer: state?.quiz?.settings?.defaultTimer || 30 };
    // Typ-spezifische Startwerte liefert das Fragetyp-Modul
    Object.assign(base, Quiz.typeDef(type)?.defaults() || {});
    return Quiz.normalizeQuiz({quiz:{title:'x',settings:state?.quiz?.settings||{},rounds:[{questions:[base]}]}}).quiz.rounds[0].questions[0];
  }
  // v24: ausgeblendete Typen (z. B. Higher/Lower) nicht für neue Fragen anbieten
  function usableType(type) {
    return Quiz.SUPPORTED_TYPES.includes(type) && !Quiz.typeDef(type)?.hidden ? type : Quiz.SUPPORTED_TYPES[0];
  }

  // ---------------------------------------------------------------- Obere Leiste, Menü, Tasten
  function bindGlobal() {
    els['ed-outline'].addEventListener('click', onOutlineClick);
    els['ed-outline'].addEventListener('pointerdown', onGripDown);
    els['ed-prev'].addEventListener('click', () => go(-1));
    els['ed-next'].addEventListener('click', () => go(1));
    els['ed-back'].addEventListener('click', () => setMobileDetail(false, true));
    els['ed-preview'].addEventListener('click', () => { const q = M.questionAt(state, selection) || M.questionAt(state, M.step(state, selection, 0)); if (q) openPreview(q); else App.toast('Noch keine Frage vorhanden.', 'error'); });
    els['ed-save-state'].addEventListener('click', () => {
      const action = els['ed-save-state'].dataset.action;
      if (action === 'login') openLogin();
      else if (action === 'retry') cloudSave({ manual: true });
      else App.toast(els['ed-save-state'].title, 'info');
    });
    els['validate-quiz'].addEventListener('click', () => showValidationDialog(Validator.validate(state)));
    els['ed-menu-btn'].addEventListener('click', event => { event.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', event => { if (!els['ed-menu'].hidden && !event.target.closest('.ed-menu-wrap')) toggleMenu(false); });
    els['ed-menu'].addEventListener('click', event => {
      const entry = event.target.closest('[data-menu]');
      if (!entry) return;
      toggleMenu(false);
      menuAction(entry.dataset.menu);
    });
    els['editor-import'].addEventListener('change', async e => {
      toggleMenu(false);
      const file = e.target.files?.[0]; if (!file) return;
      if (!confirm('Quiz aus der Datei laden? Das aktuelle Quiz im Editor wird ersetzt (online gespeicherte Quizze bleiben erhalten).')) { e.target.value = ''; return; }
      await importIntoEditor(file, false);
      e.target.value = '';
    });
    els['preview-close'].addEventListener('click', closePreview);
    els['preview-backdrop'].addEventListener('click', e => { if (e.target === els['preview-backdrop']) closePreview(); });
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', e => { if (cloudStatus.kind === 'pending' || cloudStatus.kind === 'saving') { cloudSave({ manual: false }); e.preventDefault(); e.returnValue = ''; } });
    window.matchMedia?.('(max-width: 760px)').addEventListener?.('change', () => { if (state) { setMobileDetail(false); renderAll(); } });
  }

  function workspaceOpen() { return state && !els['editor-workspace'].hidden; }
  function onKey(e) {
    if (e.key === 'Escape') {
      if (!els['preview-backdrop'].hidden) { closePreview(); return; }
      if (!els['ed-menu'].hidden) { toggleMenu(false); return; }
    }
    if (!workspaceOpen() || document.querySelector('.ed-modal-backdrop')) return;
    // Strg/Cmd+S: online speichern
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (Cloud()?.available()) cloudSave({ manual: true }); else openLogin(); return; }
    // Strg/Cmd+D: duplizieren
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateCurrent(); return; }
    // Alt+↑/↓: verschieben
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); nudgeCurrent(e.key === 'ArrowUp' ? -1 : 1); }
  }

  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : els['ed-menu'].hidden;
    if (open) renderMenu();
    els['ed-menu'].hidden = !open;
    els['ed-menu-btn'].setAttribute('aria-expanded', String(open));
  }
  function renderMenu() {
    const group = els['ed-menu'].querySelector('[data-item-actions]');
    const entries = [];
    if (selection.kind === 'question') entries.push(['q-preview', '👁 Vorschau'], ['q-dup', '⧉ Frage duplizieren · Strg+D'], ['q-up', '↑ Frage nach oben · Alt+↑'], ['q-down', '↓ Frage nach unten · Alt+↓'], ['q-type', '⇄ Spielmodus ändern …'], ['q-del', '🗑 Frage löschen']);
    if (selection.kind === 'round') entries.push(['r-add', '＋ Frage in dieser Runde'], ['r-dup', '⧉ Runde duplizieren'], ['r-up', '↑ Runde nach oben'], ['r-down', '↓ Runde nach unten'], ['r-del', '🗑 Runde löschen']);
    group.innerHTML = entries.map(([key, label]) => `<button type="button" class="ed-menu-entry${key.endsWith('del') ? ' is-danger' : ''}" data-menu="${key}">${esc(label)}</button>`).join('');
    group.hidden = !entries.length;
    const canModerate = Boolean(Cloud()?.available());
    els['ed-menu'].querySelector('[data-menu="moderate"]').hidden = !canModerate;
    els['ed-menu'].querySelector('[data-menu="copy"]').hidden = !canModerate;
  }
  function menuAction(key) {
    const actions = {
      'q-preview': () => { const q = M.questionAt(state, selection); if (q) openPreview(q); },
      'q-dup': duplicateCurrent, 'r-dup': duplicateCurrent,
      'q-up': () => nudgeCurrent(-1), 'q-down': () => nudgeCurrent(1), 'r-up': () => nudgeCurrent(-1), 'r-down': () => nudgeCurrent(1),
      'q-type': () => changeTypeDialog(), 'q-del': deleteCurrent, 'r-del': deleteCurrent,
      'r-add': () => openTypePicker(),
      moderate: async () => { await cloudSave({ manual: false }); if (cloudId) location.href = `./moderator.html?quiz=${encodeURIComponent('cloud:' + cloudId)}`; },
      copy: () => cloudSave({ manual: true, asCopy: true }),
      export: () => {
        const v = Validator.validate(state);
        if (!v.valid) { showValidationDialog(v); return App.toast('Export gestoppt: Das Quiz enthält noch Fehler.', 'error'); }
        App.downloadJSON(v.normalized, `${Quiz.slug(state.quiz.title, 'sylasphere-quiz')}.json`); App.toast('Quiz exportiert.', 'success');
      },
      new: () => { if (confirm('Neues Quiz anlegen? Das aktuelle Quiz bleibt in „Meine Quizze“ bzw. als Datei erhalten, im Editor wird es ersetzt.')) { flushCloud(); state = createBlankQuiz(); setCloudId(''); selection = firstSelection(); setMobileDetail(false); structuralChange(); App.toast('Neues Quiz erstellt.', 'success'); } },
      open: () => { flushCloud(); showStart(); }
    };
    actions[key]?.();
  }
  function flushCloud() { if (cloudTimer) cloudSave({ manual: false }); }

  // ---------------------------------------------------------------- Speichern + Neuzeichnen
  function nonNegative(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : fallback; }
  let outlineTimer = null;
  function queueSave(syncCloud = true) {
    clearTimeout(saveTimer); App.setText(els['autosave-state'], 'Änderungen …');
    saveTimer = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); App.setText(els['autosave-state'], `Entwurf ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    }, 350);
    if (syncCloud !== false) {
      queueCloudSave();
      // Gliederung (Textanfang, Punkte, ⚠️) kurz verzögert nachziehen – das Bearbeitungsfeld bleibt unberührt
      clearTimeout(outlineTimer);
      outlineTimer = setTimeout(() => { if (workspaceOpen() && !dragging) { refreshValidation(); renderOutline(); renderTop(); } }, 400);
    }
  }
  function structuralChange() { renderAll(); queueSave(); }
  function renderAll() {
    selection = M.clampSelection(state, selection);
    window.SylasphereTopics?.use(state.quiz.categories);
    window.SylasphereThemes?.applyQuiz(state);
    refreshValidation();
    renderOutline();
    renderDetail();
    renderTop();
  }
  function refreshValidation() {
    validation = Validator.validate(state);
    issueMap = M.issues(validation);
    const count = validation.errors.length + validation.warnings.length;
    const badge = els['ed-issue-count'];
    badge.hidden = !count;
    badge.textContent = String(count);
    badge.classList.toggle('is-error', validation.errors.length > 0);
    els['validate-quiz'].title = count ? `${validation.errors.length} Fehler · ${validation.warnings.length} Hinweise` : 'Keine Probleme gefunden';
  }
  function renderTop() {
    const detail = document.getElementById('editor-workspace').classList.contains('is-detail');
    let title = state.quiz.title || 'Quiz';
    if (phone() && detail) {
      if (selection.kind === 'question') title = `Frage ${M.numberOf(state, selection.ri, selection.qi)} / ${M.total(state)}`;
      else if (selection.kind === 'round') title = state.quiz.rounds[selection.ri]?.title || 'Runde';
      else title = '⚙️ Quiz';
    }
    App.setText(els['ed-top-title'], title);
    const list = M.flat(state);
    const index = selection.kind === 'question' ? list.findIndex(x => x.ri === selection.ri && x.qi === selection.qi) : -1;
    els['ed-prev'].disabled = !list.length || index === 0;
    els['ed-next'].disabled = !list.length || index === list.length - 1;
  }

  // ---------------------------------------------------------------- Auswahl
  function select(next, { openDetail = true, focus = false } = {}) {
    selection = M.clampSelection(state, next);
    renderOutline();
    renderDetail({ focus });
    if (openDetail && phone()) setMobileDetail(true);
    renderTop();
    scrollOutlineToSelection();
  }
  function go(delta) {
    const next = M.step(state, selection, delta);
    if (next && next.kind === 'question') select(next);
  }
  function setMobileDetail(open, scrollBack = false) {
    const shell = els['editor-workspace'];
    shell.classList.toggle('is-detail', Boolean(open));
    if (open) window.scrollTo({ top: 0 });
    else if (scrollBack) requestAnimationFrame(scrollOutlineToSelection);
    if (state) renderTop();
  }
  function scrollOutlineToSelection() {
    const outline = els['ed-outline'];
    const row = outline.querySelector('.is-selected');
    if (!row) return;
    if (phone()) { if (!els['editor-workspace'].classList.contains('is-detail')) row.scrollIntoView({ block: 'center' }); return; }
    // Desktop: nur die Gliederung scrollen, nicht die ganze Seite
    const box = outline.getBoundingClientRect(), r = row.getBoundingClientRect();
    if (r.top < box.top + 8) outline.scrollTop -= box.top + 8 - r.top;
    else if (r.bottom > box.bottom - 8) outline.scrollTop += r.bottom - box.bottom + 8;
  }

  // ---------------------------------------------------------------- Gliederung
  function issueBadge(list) {
    if (!list?.length) return '';
    const error = list.some(x => x.kind === 'error');
    return `<span class="ed-issue ${error ? 'is-error' : ''}" title="${esc(list.map(x => x.message).join('\n'))}">⚠️</span>`;
  }
  function renderOutline() {
    const box = els['ed-outline'];
    if (!box || !state) return;
    const sel = selection;
    const parts = [`<button type="button" class="ed-row ed-row--quiz${sel.kind === 'quiz' ? ' is-selected' : ''}" data-sel="quiz"><span class="ed-row-icon">⚙️</span><span class="ed-row-text"><strong>Quiz</strong><small>Titel, Design, Themen …</small></span>${issueBadge(issueMap.quiz)}</button>`];
    let n = 0;
    state.quiz.rounds.forEach((round, ri) => {
      const isCollapsed = collapsed.has(round.id);
      const meta = [`${round.questions.length} ${round.questions.length === 1 ? 'Frage' : 'Fragen'}`];
      if (Number(round.pointsMultiplier) !== 1) meta.push(`×${round.pointsMultiplier}`);
      if (round.theme) meta.push('🎨');
      parts.push(`<div class="ed-round${isCollapsed ? ' is-collapsed' : ''}" data-round="${ri}">
        <div class="ed-round-head${sel.kind === 'round' && sel.ri === ri ? ' is-selected' : ''}" data-drop-round="${ri}">
          <span class="ed-grip" data-drag="round" data-ri="${ri}" title="Runde ziehen" aria-hidden="true">⠿</span>
          <button type="button" class="ed-toggle" data-toggle="${esc(round.id)}" aria-expanded="${!isCollapsed}" title="${isCollapsed ? 'Aufklappen' : 'Einklappen'}">▾</button>
          <button type="button" class="ed-round-title" data-sel="round" data-ri="${ri}"><span>${esc(round.title || `Runde ${ri + 1}`)}</span><small>${esc(meta.join(' · '))}</small></button>
          ${issueBadge(issueMap.rounds.get(ri))}
        </div>
        <div class="ed-qlist">`);
      round.questions.forEach((q, qi) => {
        n += 1;
        if (isCollapsed) return;
        const selected = sel.kind === 'question' && sel.ri === ri && sel.qi === qi;
        parts.push(`<div class="ed-q${selected ? ' is-selected' : ''}" data-ri="${ri}" data-qi="${qi}">
          <span class="ed-grip" data-drag="question" data-ri="${ri}" data-qi="${qi}" title="Frage ziehen" aria-hidden="true">⠿</span>
          <button type="button" class="ed-q-main" data-sel="question" data-ri="${ri}" data-qi="${qi}" title="${esc(Quiz.TYPE_LABELS[q.type] || q.type)}: ${esc(q.text || '')}"><span class="ed-q-icon">${esc(Quiz.TYPE_ICONS[q.type] || '•')}</span><span class="ed-q-num">${n}</span><span class="ed-q-text">${esc(M.preview(q.text))}</span></button>
          <span class="ed-q-points">${esc(Math.round(Number(q.points) || 0))} P</span>${issueBadge(issueMap.questions.get(`${ri}:${qi}`))}
        </div>`);
      });
      if (!round.questions.length && !isCollapsed) parts.push(`<div class="ed-qlist-empty" data-drop-empty="${ri}">Noch keine Fragen – hierher ziehen oder „+ Frage“</div>`);
      parts.push('</div></div>');
    });
    parts.push('<div class="ed-outline-actions"><button type="button" class="btn btn--primary btn--small" data-act="add-question">+ Frage</button><button type="button" class="btn btn--small" data-act="add-round">+ Runde</button></div>');
    parts.push('<p class="microcopy ed-outline-hint">⠿ ziehen zum Sortieren · Alt+↑/↓ verschieben · Strg+D duplizieren</p>');
    box.innerHTML = parts.join('');
  }

  function onOutlineClick(event) {
    if (dragJustEnded) return;
    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
      const id = toggle.dataset.toggle;
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      writeCollapsed();
      renderOutline();
      return;
    }
    const act = event.target.closest('[data-act]');
    if (act?.dataset.act === 'add-question') { openTypePicker(); return; }
    if (act?.dataset.act === 'add-round') { const next = M.addRound(state, selection.kind === 'quiz' ? undefined : selection.ri); selection = next; structuralChange(); if (phone()) setMobileDetail(true); focusDetail(); return; }
    const target = event.target.closest('[data-sel]');
    if (!target) return;
    const kind = target.dataset.sel;
    select(kind === 'quiz' ? { kind } : { kind, ri: Number(target.dataset.ri), qi: Number(target.dataset.qi) });
  }

  // ---------------------------------------------------------------- Ziehen (Maus + Finger)
  let dragJustEnded = false;
  function onGripDown(event) {
    const grip = event.target.closest('[data-drag]');
    if (!grip || event.button > 0) return;
    event.preventDefault();
    const source = grip.dataset.drag === 'round' ? { kind: 'round', ri: Number(grip.dataset.ri) } : { kind: 'question', ri: Number(grip.dataset.ri), qi: Number(grip.dataset.qi) };
    const startY = event.clientY;
    const row = grip.closest(source.kind === 'round' ? '.ed-round' : '.ed-q');
    let active = false, target = null;
    const line = document.createElement('div'); line.className = 'ed-drop-line';
    const move = e => {
      if (!active && Math.abs(e.clientY - startY) < 5) return;
      if (!active) { active = true; dragging = source; row.classList.add('is-dragging'); els['ed-outline'].append(line); document.body.classList.add('ed-is-dragging'); }
      e.preventDefault();
      autoScroll(e.clientY);
      target = dropTarget(source, e.clientX, e.clientY);
      placeLine(line, target);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      line.remove(); row?.classList.remove('is-dragging'); document.body.classList.remove('ed-is-dragging');
      if (!active) return;
      dragging = null;
      dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
      if (!target) return;
      let next = null;
      if (source.kind === 'question') next = M.moveQuestion(state, source.ri, source.qi, target.ri, target.index);
      else next = M.moveRound(state, source.ri, target.index);
      if (next) { if (source.kind === 'question' && collapsed.has(state.quiz.rounds[next.ri].id)) { collapsed.delete(state.quiz.rounds[next.ri].id); writeCollapsed(); } selection = next; structuralChange(); scrollOutlineToSelection(); }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  function dropTarget(source, x, y) {
    const outline = els['ed-outline'];
    const el = document.elementFromPoint(Math.min(Math.max(x, outline.getBoundingClientRect().left + 8), outline.getBoundingClientRect().right - 8), y);
    if (!el || !outline.contains(el)) return null;
    if (source.kind === 'round') {
      const roundEl = el.closest('.ed-round');
      if (!roundEl) return null;
      const ri = Number(roundEl.dataset.round);
      const rect = roundEl.getBoundingClientRect();
      const after = y > rect.top + Math.min(rect.height / 2, 40);
      return { kind: 'round', index: after ? ri + 1 : ri, el: roundEl, after };
    }
    const q = el.closest('.ed-q');
    if (q) {
      const rect = q.getBoundingClientRect();
      const after = y > rect.top + rect.height / 2;
      return { kind: 'question', ri: Number(q.dataset.ri), index: Number(q.dataset.qi) + (after ? 1 : 0), el: q, after };
    }
    const empty = el.closest('[data-drop-empty]');
    if (empty) return { kind: 'question', ri: Number(empty.dataset.dropEmpty), index: 0, el: empty, after: false };
    const head = el.closest('[data-drop-round]');
    if (head) {
      const ri = Number(head.dataset.dropRound);
      const count = state.quiz.rounds[ri].questions.length;
      // Auf den Rundenkopf: eingeklappt → ans Ende, sonst an den Anfang
      return { kind: 'question', ri, index: collapsed.has(state.quiz.rounds[ri].id) ? count : 0, el: head, after: true };
    }
    return null;
  }
  function placeLine(line, target) {
    if (!target) { line.hidden = true; return; }
    line.hidden = false;
    const box = els['ed-outline'].getBoundingClientRect();
    const rect = target.el.getBoundingClientRect();
    const y = (target.after ? rect.bottom : rect.top) - box.top + els['ed-outline'].scrollTop;
    line.style.top = `${Math.round(y - 1)}px`;
  }
  function autoScroll(y) {
    const outline = els['ed-outline'];
    const rect = outline.getBoundingClientRect();
    const scrollsItself = outline.scrollHeight > outline.clientHeight + 4;
    if (scrollsItself) {
      if (y < rect.top + 40) outline.scrollTop -= 12; else if (y > rect.bottom - 40) outline.scrollTop += 12;
    } else if (y < 60) window.scrollBy(0, -12); else if (y > window.innerHeight - 60) window.scrollBy(0, 12);
  }

  // ---------------------------------------------------------------- Aktionen auf der Auswahl
  function duplicateCurrent() {
    let next = null;
    if (selection.kind === 'question') next = M.duplicateQuestion(state, selection.ri, selection.qi);
    else if (selection.kind === 'round') next = M.duplicateRound(state, selection.ri);
    if (!next) return;
    selection = next; structuralChange();
    App.toast(next.kind === 'round' ? 'Runde dupliziert.' : 'Frage dupliziert.', 'success');
  }
  function deleteCurrent() {
    if (selection.kind === 'question') {
      const q = M.questionAt(state, selection);
      if (!q || !confirm(`Frage „${M.preview(q.text, 50)}“ löschen?`)) return;
      selection = M.deleteQuestion(state, selection.ri, selection.qi);
    } else if (selection.kind === 'round') {
      const round = state.quiz.rounds[selection.ri];
      if (!round || !confirm(`Runde „${round.title}“ mit ${round.questions.length} ${round.questions.length === 1 ? 'Frage' : 'Fragen'} löschen?`)) return;
      selection = M.deleteRound(state, selection.ri);
    } else return;
    structuralChange();
  }
  function nudgeCurrent(delta) {
    let next = null;
    if (selection.kind === 'question') next = M.nudgeQuestion(state, selection.ri, selection.qi, delta);
    else if (selection.kind === 'round') next = M.moveRound(state, selection.ri, selection.ri + (delta < 0 ? -1 : 2));
    if (!next) return;
    if (next.kind === 'question') collapsed.delete(state.quiz.rounds[next.ri].id);
    selection = next; structuralChange(); scrollOutlineToSelection();
  }

  // ---------------------------------------------------------------- Dialoge (Typ-Auswahl, Prüfen)
  function openModal(title, body, { wide = false } = {}) {
    const backdrop = div('preview-backdrop ed-modal-backdrop');
    const box = div(`panel ed-modal${wide ? ' ed-modal--wide' : ''}`);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', title);
    const head = div('ed-modal-head');
    head.innerHTML = `<h2>${esc(title)}</h2>`;
    const close = button('✕', 'icon-btn', () => api.close()); close.title = 'Schließen';
    head.append(close);
    box.append(head, body);
    backdrop.append(box);
    document.body.append(backdrop);
    const onEsc = e => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onEsc);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) api.close(); });
    const api = { close() { backdrop.remove(); document.removeEventListener('keydown', onEsc); } };
    setTimeout(() => box.querySelector('button:not(.icon-btn)')?.focus(), 30);
    return api;
  }
  /** „+ Frage“: Kachel-Auswahl mit Symbol + einem Satz */
  function typeTiles(current, onPick) {
    const grid = div('ed-type-grid');
    const round = state.quiz.rounds[selection.ri];
    const onlyBoard = Quiz.isBoardRound(round); // v34: im Brett nur Multiple Choice, Schätzfrage, Song-Enthüllung
    if (onlyBoard) grid.append(div('microcopy ed-type-note', 'Im Themen-Brett gehen nur Multiple Choice, Schätzfrage, Song-Enthüllung, Hinweis-Kaskade und Bild-Enthüllung (richtig oder falsch, keine Teilpunkte).'));
    Quiz.SUPPORTED_TYPES.filter(t => (!Quiz.typeDef(t)?.hidden || t === current) && (!onlyBoard || Quiz.BOARD_TYPES.includes(t))).forEach(t => {
      const wrap = div(`ed-type-tile${t === current ? ' is-current' : ''}`);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'ed-type-pick';
      tile.innerHTML = `<span class="ed-type-icon">${esc(Quiz.TYPE_ICONS[t] || '•')}</span><strong>${esc(Quiz.TYPE_LABELS[t] || t)}</strong><small>${esc(Quiz.TYPE_DESCRIPTIONS[t] || '')}</small>`;
      tile.addEventListener('click', () => onPick(t));
      // v35: „Mehr erfahren“ – Erklärung + Mini-Vorschau (Handy + Beamer) mit Beispieldaten
      const more = button('Mehr erfahren', 'link-btn ed-type-more', () => showTypeInfo(box, t, current, onPick));
      wrap.append(tile, more);
      grid.append(wrap);
    });
    const box = div('ed-type-box');
    const help = div('microcopy ed-type-help'); help.innerHTML = 'Nicht sicher? „Mehr erfahren“ zeigt Erklärung und Vorschau – oder <a href="./spielmodi.html" target="_blank" rel="noopener">alle Spielmodi mit Demo ansehen ↗</a>';
    grid.prepend(help);
    box.append(grid);
    return box;
  }
  function showTypeInfo(box, t, current, onPick) {
    const Modes = window.SylasphereModes;
    const mode = Modes?.get(t);
    const list = box.firstElementChild;
    list.hidden = true;
    box.querySelector('.ed-type-info')?.remove();
    const info = div('ed-type-info');
    info.innerHTML = `<button type="button" class="link-btn" data-back>← Alle Spielmodi</button>
      <div class="mode-card-head"><span class="mode-card-icon" aria-hidden="true">${esc(mode?.icon || '•')}</span><div><span class="eyebrow">${esc(mode?.help?.group || 'Spielmodus')}</span><strong>${esc(mode?.label || t)}</strong></div></div>
      <div class="ed-type-info-grid"><div>${Modes ? Modes.detailHTML(t, { open: true }) : ''}<p><a class="link-btn" href="./spielmodi.html#${encodeURIComponent(t)}" target="_blank" rel="noopener">🕹️ Auf der Spielmodi-Seite ausprobieren ↗</a></p></div><div class="ed-type-preview"></div></div>
      <div class="ed-type-info-actions"><button type="button" class="btn btn--primary" data-pick>${t === current ? '✓ Bleibt so' : `${esc(mode?.icon || '')} ${esc(mode?.label || t)} wählen`}</button></div>`;
    info.querySelector('[data-back]').addEventListener('click', () => { info.remove(); list.hidden = false; });
    info.querySelector('[data-pick]').addEventListener('click', () => onPick(t));
    box.append(info);
    window.SylasphereModeDemo?.renderPreview(t, info.querySelector('.ed-type-preview'));
    info.querySelector('[data-back]').focus();
  }
  function openTypePicker() {
    const api = openModal('Welcher Spielmodus?', typeTiles('', type => {
      api.close();
      const previous = M.questionAt(state, selection);
      const q = newQuestion(usableType(type));
      if (previous?.category) q.category = previous.category;
      selection = M.insertQuestion(state, selection, q);
      if (!q.category) q.category = 'Allgemeinwissen';
      collapsed.delete(state.quiz.rounds[selection.ri].id);
      structuralChange();
      if (phone()) setMobileDetail(true);
      scrollOutlineToSelection();
      focusDetail();
    }), { wide: true });
  }
  function changeTypeDialog() {
    const q = M.questionAt(state, selection);
    if (!q) return;
    const api = openModal('Spielmodus ändern', typeTiles(q.type, type => {
      if (type === q.type) { api.close(); return; }
      const ok = confirm(`Zu „${Quiz.TYPE_LABELS[type]}“ wechseln?\n\nFragetext, Thema, Punkte und Timer bleiben erhalten. Alle Angaben, die nur zu „${Quiz.TYPE_LABELS[q.type]}“ gehören (z. B. Antworten, Lösung, Bilder), gehen verloren.`);
      if (!ok) return;
      api.close();
      selection = M.changeType(state, selection.ri, selection.qi, newQuestion(type));
      structuralChange();
      App.toast(`Spielmodus geändert: ${Quiz.TYPE_LABELS[type]}`, 'success');
    }), { wide: true });
  }
  function showValidationDialog(v) {
    refreshValidation(); renderOutline();
    const body = div('ed-validation');
    const items = [...v.errors.map(x => ({ ...x, kind: 'error' })), ...v.warnings.map(x => ({ ...x, kind: 'warning' }))];
    if (!items.length) body.innerHTML = '<div class="notice notice--success">✓ Keine Probleme – das Quiz ist spielbereit.</div>';
    else {
      body.innerHTML = `<p class="microcopy">${v.errors.length} Fehler · ${v.warnings.length} Hinweise. Antippen springt zur Stelle.</p>`;
      items.forEach(item => {
        const m = /^quiz\.rounds\[(\d+)\](?:\.questions\[(\d+)\])?/.exec(item.path || '');
        const where = m ? (m[2] != null ? `Frage ${M.numberOf(state, Number(m[1]), Number(m[2]))}` : (state.quiz.rounds[Number(m[1])]?.title || 'Runde')) : 'Quiz';
        const row = button('', `ed-validation-item is-${item.kind}`, () => {
          api.close();
          select(m ? (m[2] != null ? { kind: 'question', ri: Number(m[1]), qi: Number(m[2]) } : { kind: 'round', ri: Number(m[1]) }) : { kind: 'quiz' });
        });
        row.innerHTML = `<span>${item.kind === 'error' ? '⛔' : '⚠️'}</span><strong>${esc(where)}</strong><span>${esc(item.message)}</span>`;
        body.append(row);
      });
    }
    const api = openModal(v.valid ? 'Quiz geprüft' : 'Quiz prüfen', body);
  }

  // ---------------------------------------------------------------- Bearbeitungsbereich
  function focusDetail() { requestAnimationFrame(() => els['ed-detail'].querySelector('textarea, input')?.focus({ preventScroll: true })); }
  function renderDetail({ focus = false } = {}) {
    const box = els['ed-detail'];
    if (!box || !state) return;
    box.replaceChildren();
    if (selection.kind === 'question') box.append(detailBar(), renderQuestionEditor(M.questionAt(state, selection), selection.ri, selection.qi));
    else if (selection.kind === 'round') box.append(detailBar(), renderRoundEditor(selection.ri));
    else box.append(detailBar(), renderQuizEditor());
    if (focus) focusDetail();
  }
  function detailBar() {
    const bar = div('ed-detail-bar');
    const crumb = div('ed-crumb');
    if (selection.kind === 'question') {
      const round = state.quiz.rounds[selection.ri];
      crumb.innerHTML = `<span>${esc(round?.title || 'Runde')}</span> › <strong>Frage ${M.numberOf(state, selection.ri, selection.qi)} von ${M.total(state)}</strong>`;
    } else if (selection.kind === 'round') crumb.innerHTML = `<strong>Runde ${selection.ri + 1} von ${state.quiz.rounds.length}</strong>`;
    else crumb.innerHTML = '<strong>⚙️ Quiz-Einstellungen</strong>';
    const actions = div('ed-detail-actions');
    if (selection.kind === 'question') {
      actions.append(button('⧉ Duplizieren', 'btn btn--small btn--ghost', duplicateCurrent));
      const del = button('🗑', 'btn btn--small btn--danger', deleteCurrent); del.title = 'Frage löschen'; del.setAttribute('aria-label', 'Frage löschen');
      actions.append(del);
    } else if (selection.kind === 'round') {
      actions.append(button('＋ Frage', 'btn btn--small btn--primary', () => openTypePicker()), button('⧉ Duplizieren', 'btn btn--small btn--ghost', duplicateCurrent));
      const del = button('🗑', 'btn btn--small btn--danger', deleteCurrent); del.title = 'Runde löschen'; del.setAttribute('aria-label', 'Runde löschen');
      actions.append(del);
    }
    bar.append(crumb, actions);
    return bar;
  }

  function renderQuizEditor() {
    const card = div('panel panel-pad ed-card');
    const grid = div('editor-fields');
    const title = input('text', state.quiz.title || '', 'input');
    title.addEventListener('input', e => { state.quiz.title = e.target.value; state.quiz.id ||= `quiz_${Quiz.slug(e.target.value)}`; renderTop(); queueSave(); });
    const description = document.createElement('textarea'); description.className = 'input textarea'; description.rows = 2; description.value = state.quiz.description || '';
    description.addEventListener('input', e => { state.quiz.description = e.target.value; queueSave(); });
    const timer = input('number', state.quiz.settings.defaultTimer, 'input'); timer.min = '0';
    timer.addEventListener('input', e => { state.quiz.settings.defaultTimer = nonNegative(e.target.value, 30); queueSave(); });
    const points = input('number', state.quiz.settings.defaultPoints, 'input'); points.min = '0';
    points.addEventListener('input', e => { state.quiz.settings.defaultPoints = nonNegative(e.target.value, 100); queueSave(); });
    grid.append(spanField('Titel', title, 'span-4'), spanField('Beschreibung', description, 'span-4'), spanField('Standard-Timer (s)', timer, 'span-2'), spanField('Standard-Punkte', points, 'span-2'));
    const stats = div('ed-quiz-stats', `${state.quiz.rounds.length} ${state.quiz.rounds.length === 1 ? 'Runde' : 'Runden'} · ${M.total(state)} Fragen · ${state.quiz.rounds.reduce((s, r) => s + r.questions.reduce((t, q) => t + (Number(q.points) || 0) * (Number(r.pointsMultiplier) || 0), 0), 0)} Punkte möglich`);
    const design = div('field-group ed-section');
    design.append(div('field-label', 'Design'));
    const themeBox = document.createElement('div'); themeBox.id = 'edit-theme';
    design.append(themeBox);
    // v34: Einsatz-Finale
    const finalBox = div('field-group ed-section');
    const finalLabel = document.createElement('label'); finalLabel.className = 'ed-check';
    const finalCheck = document.createElement('input'); finalCheck.type = 'checkbox'; finalCheck.checked = state.quiz.settings.finalWager === true;
    finalCheck.addEventListener('change', e => { state.quiz.settings.finalWager = e.target.checked; refreshValidation(); queueSave(); });
    finalLabel.append(finalCheck, document.createTextNode(' 💰 Letzte Frage als Einsatz-Finale'));
    finalBox.append(finalLabel, div('microcopy', 'Vor der letzten Frage setzt jeder geheim 0 bis alle eigenen Punkte (bei 0 oder weniger bis 100). Richtig: +Einsatz, falsch: −Einsatz. Die letzte Frage muss Multiple Choice, Schätzfrage, Song-Enthüllung, Hinweis-Kaskade oder Bild-Enthüllung sein und in einer eigenen Runde (kein Brett) stehen.'));
    // v35: Spielmodi erklären
    const explainBox = div('field-group ed-section');
    const explainLabel = document.createElement('label'); explainLabel.className = 'ed-check';
    const explainCheck = document.createElement('input'); explainCheck.type = 'checkbox'; explainCheck.checked = state.quiz.settings.explainModes !== false;
    explainCheck.addEventListener('change', e => { state.quiz.settings.explainModes = e.target.checked; queueSave(); });
    explainLabel.append(explainCheck, document.createTextNode(' 🆕 Spielmodi erklären'));
    explainBox.append(explainLabel, div('microcopy', 'Kommt ein Spielmodus zum ersten Mal dran, zeigen Beamer und Handys kurz „Neu: … – so geht\'s“. Am Handy gibt es an jeder Frage ein „?“.'));
    const topics = div('field-group ed-section');
    topics.append(div('field-label', 'Themen im Quiz'));
    const topicBox = div('topic-manager'); topicBox.id = 'editor-categories';
    topics.append(topicBox, div('microcopy', 'Antippen, um Name, Icon oder Farbe anzupassen.'));
    card.append(stats, grid, finalBox, explainBox, design, topics);
    requestAnimationFrame(() => { renderTheme(); renderCategories(); });
    return card;
  }

  function renderRoundEditor(ri) {
    const round = state.quiz.rounds[ri];
    const card = div('panel panel-pad ed-card');
    const grid = div('editor-fields');
    const title = input('text', round.title, 'input');
    title.addEventListener('input', e => { round.title = e.target.value; queueSave(); });
    const mult = input('number', round.pointsMultiplier, 'input'); mult.min = '0'; mult.step = '0.1';
    mult.addEventListener('input', e => { round.pointsMultiplier = nonNegative(e.target.value, 1); queueSave(); });
    // v29: eigenes Theme für diese Runde (leer = wie das Quiz)
    const themeSelect = document.createElement('select');
    themeSelect.className = 'select round-theme';
    themeSelect.setAttribute('aria-label', 'Design dieser Runde');
    themeSelect.innerHTML = `<option value="">wie das Quiz</option>${(window.SylasphereThemes?.list() || []).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}`;
    themeSelect.value = round.theme || '';
    themeSelect.addEventListener('change', e => { if (e.target.value) round.theme = e.target.value; else delete round.theme; queueSave(); });
    grid.append(spanField('Rundentitel', title, 'span-4'), spanField('Punkte-Multiplikator', mult, 'span-2'), spanField('Design dieser Runde', themeSelect, 'span-2'));
    // v34: Format der Runde – normal oder Themen-Brett
    const format = document.createElement('select'); format.className = 'select';
    format.innerHTML = '<option value="">≡ Normale Runde</option><option value="board">▦ Themen-Brett</option>';
    format.value = Quiz.isBoardRound(round) ? 'board' : '';
    format.addEventListener('change', e => {
      if (e.target.value === 'board') { round.format = 'board'; round.board = round.board || { topics: [], values: [100, 300, 500], doubles: 0, coGuess: true }; Quiz.normalizeBoard(round); }
      else { delete round.format; }
      structuralChange();
    });
    grid.append(spanField('Format', format, 'span-2'));
    if (Quiz.isBoardRound(round)) { card.append(grid, boardEditor(round, ri)); return card; }
    const list = div('ed-round-questions');
    if (!round.questions.length) list.append(div('empty-state compact', 'Diese Runde enthält noch keine Fragen.'));
    round.questions.forEach((q, qi) => {
      const row = button('', 'ed-round-question', () => select({ kind: 'question', ri, qi }));
      row.innerHTML = `<span>${esc(Quiz.TYPE_ICONS[q.type] || '•')}</span><span class="ed-q-text">${esc(M.preview(q.text, 80))}</span><small>${esc(Math.round(Number(q.points) || 0))} P</small>`;
      list.append(row);
    });
    card.append(grid, div('field-label ed-section', 'Fragen dieser Runde'), list);
    return card;
  }

  // ---------------------------------------------------------------- v34: Themen-Brett im Editor
  function boardEditor(round, ri) {
    const box = div('ed-board');
    const b = round.board;
    const settings = div('ed-board-settings');
    const numberField = (label, value, min, max, apply) => {
      const inp = input('number', value, 'input'); inp.min = String(min); inp.max = String(max);
      inp.addEventListener('change', e => { apply(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min)))); Quiz.normalizeBoard(round); structuralChange(); });
      return labelField(label, inp);
    };
    settings.append(numberField('Themen', b.topics.length, 1, 8, n => { b.topics = Array.from({ length: n }, (_, i) => b.topics[i] || ''); b.topicCount = n; }));
    settings.append(numberField('Fragen pro Thema', b.values.length, 1, 8, n => { const last = b.values[b.values.length - 1] || 100; b.values = Array.from({ length: n }, (_, i) => b.values[i] ?? last + (i - b.values.length + 1) * 200); }));
    const values = input('text', b.values.join(', '), 'input');
    values.addEventListener('change', e => { const list = e.target.value.split(/[,;\s]+/).map(Number).filter(n => Number.isFinite(n) && n >= 0); if (list.length) b.values = list.slice(0, 8); Quiz.normalizeBoard(round); structuralChange(); });
    settings.append(labelField('Punkte je Zeile', values));
    settings.append(numberField('Doppel-Felder', b.doubles, 0, 5, n => { b.doubles = n; }));
    const co = document.createElement('label'); co.className = 'ed-check';
    const coBox = document.createElement('input'); coBox.type = 'checkbox'; coBox.checked = b.coGuess !== false;
    coBox.addEventListener('change', e => { b.coGuess = e.target.checked; queueSave(); });
    co.append(coBox, document.createTextNode(' Mitraten (ohne Punkte)'));
    settings.append(co);
    box.append(settings);
    // Raster: Themen oben, Punkte links; Fragen per Ziehen (oder Antippen + Ziel antippen) tauschen
    const grid = div('ed-board-grid'); grid.style.setProperty('--cols', String(b.topics.length));
    b.topics.forEach((t, ti) => {
      const name = input('text', t, 'input ed-board-topic'); name.placeholder = `Thema ${ti + 1}`; name.maxLength = 40;
      name.addEventListener('input', e => { b.topics[ti] = e.target.value; queueSave(); });
      name.addEventListener('change', () => { if (!b.topics[ti].trim()) b.topics[ti] = `Thema ${ti + 1}`; structuralChange(); });
      grid.append(name);
    });
    const at = new Map(round.questions.map((q, qi) => [q.cell ? `${q.cell.t}:${q.cell.v}` : '', { q, qi }]));
    let moving = null;
    const swap = (from, to) => {
      const a = round.questions[from.qi]; const target = at.get(`${to.t}:${to.v}`);
      if (target) target.q.cell = { t: a.cell.t, v: a.cell.v };
      a.cell = { t: to.t, v: to.v };
      Quiz.normalizeBoard(round); structuralChange();
    };
    b.values.forEach((value, v) => {
      for (let t = 0; t < b.topics.length; t++) {
        const cell = div('ed-board-cell'); cell.dataset.t = String(t); cell.dataset.v = String(v);
        cell.append(div('ed-board-value', String(value)));
        const entry = at.get(`${t}:${v}`);
        if (entry) {
          const chip = button('', 'ed-board-q', () => select({ kind: 'question', ri, qi: entry.qi }));
          chip.draggable = true;
          chip.innerHTML = `<span class="ed-grip" aria-hidden="true">⠿</span><i>${esc(Quiz.TYPE_ICONS[entry.q.type] || '•')}</i><span>${esc(M.preview(entry.q.text, 34))}</span>`;
          chip.title = 'Antippen: bearbeiten · ziehen: in ein anderes Feld';
          chip.addEventListener('dragstart', e => { moving = entry; e.dataTransfer.setData('text/plain', String(entry.qi)); e.dataTransfer.effectAllowed = 'move'; });
          if (!Quiz.BOARD_TYPES.includes(entry.q.type)) chip.classList.add('is-invalid');
          cell.append(chip);
        } else {
          cell.classList.add('is-empty');
          const add = button('＋ Frage', 'link-btn', () => { selection = { kind: 'round', ri }; const q = newQuestion('multiple-choice'); q.cell = { t, v }; q.category = b.topics[t]; round.questions.push(q); Quiz.normalizeBoard(round); selection = { kind: 'question', ri, qi: round.questions.length - 1 }; structuralChange(); focusDetail(); });
          cell.append(add);
        }
        cell.addEventListener('dragover', e => { if (moving) { e.preventDefault(); cell.classList.add('is-over'); } });
        cell.addEventListener('dragleave', () => cell.classList.remove('is-over'));
        cell.addEventListener('drop', e => { e.preventDefault(); cell.classList.remove('is-over'); if (moving) swap(moving, { t, v }); moving = null; });
        grid.append(cell);
      }
    });
    box.append(grid, div('microcopy', 'Frage antippen = bearbeiten · am Griff ⠿ in ein anderes Feld ziehen (tauscht die Fragen) · Punkte der Frage = Feldwert. Doppel-Felder werden beim Spielstart zufällig verteilt (nie in der ersten Zeile).'));
    // Handy/Tastatur: Feld per Auswahl verschieben
    const moveRow = div('ed-board-move');
    const qSel = document.createElement('select'); qSel.className = 'select';
    qSel.innerHTML = round.questions.map((q, qi) => `<option value="${qi}">${esc(M.preview(q.text, 40))}</option>`).join('');
    const cellSel = document.createElement('select'); cellSel.className = 'select';
    cellSel.innerHTML = b.values.flatMap((value, v) => b.topics.map((t, ti) => `<option value="${ti}:${v}">${esc(t)} · ${value}</option>`)).join('');
    moveRow.append(labelField('Frage', qSel), labelField('in Feld', cellSel), button('Verschieben', 'btn btn--small', () => { const [t, v] = cellSel.value.split(':').map(Number); swap({ q: round.questions[Number(qSel.value)], qi: Number(qSel.value) }, { t, v }); }));
    if (round.questions.length) box.append(moveRow);
    return box;
  }

  function renderQuestionEditor(q, ri, qi) {
    const wrap = div('panel panel-pad ed-card ed-question');
    wrap.dataset.qid = q.id;
    const head = div('ed-q-head');
    head.append(div('pill pill--category', `${Quiz.TYPE_ICONS[q.type] || '•'} ${Quiz.TYPE_LABELS[q.type] || q.type}`));
    const change = button('Spielmodus ändern …', 'link-btn ed-type-change', () => changeTypeDialog());
    change.title = 'Spielmodus wechseln (Angaben, die nur zum bisherigen Spielmodus gehören, gehen dabei verloren)';
    head.append(change);
    wrap.append(head);

    const description = Quiz.TYPE_DESCRIPTIONS[q.type];
    if (description) wrap.append(div('type-description', description));

    const fields = div('editor-fields');
    const textArea = document.createElement('textarea');
    textArea.className = 'input textarea'; textArea.rows = 2; textArea.value = q.text || '';
    textArea.addEventListener('input', e => { q.text = e.target.value; queueSave(); });
    fields.append(spanField('Fragetext', textArea, 'span-4'));

    // Thema aus Bibliothek/Quiz wählen oder neu anlegen
    const topicPicker = TopicPicker.create({
      value: q.category || '',
      quizTopics: quizTopicNames,
      onSelect: name => { q.category = name; queueSave(); renderCategories(); },
      onCreate: name => { customEntry(name, true); }
    });
    const topicField = div('field-group span-2'); // bewusst kein <label>: würde Klicks im Picker an den Knopf weiterleiten
    topicField.append(div('field-label', 'Thema'), topicPicker);
    fields.append(topicField);

    const points = input('number', q.points, 'input'); points.min = '0';
    points.addEventListener('input', e => { q.points = nonNegative(e.target.value, 0); queueSave(); });
    fields.append(spanField('Punkte', points, ''));
    const timer = input('number', q.timer, 'input'); timer.min = '0';
    timer.addEventListener('input', e => { q.timer = nonNegative(e.target.value, 0); queueSave(); });
    // Typen ohne gemeinsamen Timer (Buzzer, Zeitduell) blenden das Feld aus
    if (Quiz.hasTimer(q)) fields.append(spanField('Timer (s)', timer, ''));
    fields.append(renderDynamic(q));
    const problems = issueMap.questions.get(`${ri}:${qi}`);
    if (problems?.length) {
      const box = div('ed-q-issues');
      box.innerHTML = problems.map(p => `<div class="validation-item validation-item--${p.kind}"><span>${p.kind === 'error' ? '⛔' : '⚠️'} ${esc(p.message)}</span></div>`).join('');
      wrap.append(box);
    }
    wrap.append(fields, renderExpertSettings(q));
    return wrap;
  }

  function renderExpertSettings(q) {
    const details = document.createElement('details');
    details.className = 'advanced-settings';
    const summary = document.createElement('summary');
    summary.textContent = 'Experten';
    const body = div('advanced-settings-body');
    const id = input('text', q.id || App.uid('q'), 'input');
    if (!q.id) q.id = id.value;
    id.addEventListener('change', e => {
      const value = e.target.value.trim();
      q.id = value || App.uid('q');
      id.value = q.id;
      queueSave();
    });
    const help = div('editor-help', 'Die Fragen-ID wird automatisch erzeugt. Du musst hier normalerweise nichts ändern. Sie bleibt beim Bearbeiten stabil; Duplikate erhalten automatisch eine neue ID.');
    body.append(labelField('Technische Fragen-ID', id), help);
    details.append(summary, body);
    return details;
  }

  // Typ-spezifische Eingabefelder baut das Fragetyp-Modul (editor). structuralChange zeichnet nur den Bearbeitungsbereich neu.
  const editorUI = { div, input, button, labelField, nonNegative, queueSave: () => queueSave(), structuralChange: () => { refreshValidation(); renderOutline(); renderDetail(); queueSave(); } };
  function renderDynamic(q) {
    const box = div('dynamic-box');
    try { Quiz.typeDef(q.type)?.editor?.(q, editorUI, box, window.SylasphereTypeKit); }
    catch (error) { console.error(error); box.append(div('notice notice--error', `Die Felder für „${Quiz.TYPE_LABELS[q.type] || q.type}“ konnten nicht angezeigt werden: ${error.message}`)); }
    return box;
  }

  // ---------------------------------------------------------------- Design (v17/v29)
  function renderTheme() {
    const box = document.getElementById('edit-theme');
    if (!box || !window.SylasphereThemes) return;
    window.SylasphereThemes.applyQuiz(state);
    box.replaceChildren(window.SylasphereThemes.picker(state.quiz.settings.theme, id => {
      state.quiz.settings.theme = id;
      window.SylasphereThemes.apply(id);
      showThemePreview(id);
      queueSave();
    }));
    // v29: Vorschau (Beispielfrage, Rangliste, Übergang, Sounds, Siegerehrung) – vorschau.html im Rahmen
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'btn btn--small btn--ghost theme-preview-toggle';
    toggle.textContent = '👁 Vorschau zeigen';
    toggle.addEventListener('click', () => {
      const open = !box.querySelector('.theme-preview-frame');
      toggle.textContent = open ? '👁 Vorschau ausblenden' : '👁 Vorschau zeigen';
      if (open) showThemePreview(state.quiz.settings.theme, true); else box.querySelector('.theme-preview-frame')?.remove();
    });
    box.append(toggle);
  }
  function showThemePreview(id, create = false) {
    const box = document.getElementById('edit-theme');
    let frame = box?.querySelector('.theme-preview-frame');
    if (!box || (!frame && !create)) return;
    if (!frame) { frame = document.createElement('iframe'); frame.className = 'theme-preview-frame'; frame.title = 'Vorschau des Designs'; box.append(frame); }
    const src = `./vorschau.html?theme=${encodeURIComponent(id || 'neon')}&embed=1`;
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  }

  // ---------------------------------------------------------------- Themen (v15)
  const Topics = window.SylasphereTopics;
  const TopicPicker = window.SylasphereTopicPicker;
  function quizTopicNames() {
    const names = new Map();
    (state.quiz.categories || []).forEach(t => { if (t?.name) names.set(Topics.key(t.name), t.name); });
    state.quiz.rounds.forEach(r => r.questions.forEach(q => { const k = Topics.key(q.category); if (k && !names.has(k)) names.set(k, q.category); }));
    return Array.from(names.values());
  }
  function topicUsage(name) {
    const k = Topics.key(name); let count = 0;
    state.quiz.rounds.forEach(r => r.questions.forEach(q => { if (Topics.key(q.category) === k) count++; }));
    return count;
  }
  function customEntry(name, create = false) {
    state.quiz.categories = Array.isArray(state.quiz.categories) ? state.quiz.categories : [];
    let entry = state.quiz.categories.find(t => Topics.key(t.name) === Topics.key(name));
    if (!entry && create) { entry = { name }; state.quiz.categories.push(entry); }
    return entry;
  }
  function renameTopic(oldName, newName) {
    const clean = String(newName || '').normalize('NFKC').trim();
    if (!clean || Topics.key(clean) === Topics.key(oldName)) return;
    if (/[.#$\[\]\/]/.test(clean)) return App.toast('Themen dürfen keine der Zeichen . # $ [ ] / enthalten.', 'error');
    state.quiz.rounds.forEach(r => r.questions.forEach(q => { if (Topics.key(q.category) === Topics.key(oldName)) q.category = clean; }));
    const entry = customEntry(oldName);
    const existing = customEntry(clean);
    if (entry && existing && entry !== existing) state.quiz.categories.splice(state.quiz.categories.indexOf(entry), 1);
    else if (entry) entry.name = clean;
    structuralChange();
  }
  function renderCategories() {
    Topics.use(state.quiz.categories);
    const box = document.getElementById('editor-categories');
    if (!box) return;
    const names = quizTopicNames();
    box.replaceChildren();
    if (!names.length) { box.append(div('microcopy', 'Noch keine Themen.')); return; }
    names.forEach(name => {
      const topic = Topics.resolve(name);
      const custom = customEntry(name);
      const count = topicUsage(name);
      const row = document.createElement('details'); row.className = 'topic-row';
      const summary = document.createElement('summary');
      summary.append(TopicPicker.chip(topic, name), div('topic-row-meta', `${count} ${count === 1 ? 'Frage' : 'Fragen'}${topic.source === 'library' && !custom?.icon && !custom?.color ? ' · Bibliothek' : ''}`));
      row.append(summary);
      const body = div('topic-row-body');
      const nameInput = input('text', name, 'input'); nameInput.maxLength = 40;
      nameInput.addEventListener('change', e => renameTopic(name, e.target.value));
      const iconInput = input('text', custom?.icon || topic.icon, 'input topic-icon-input'); iconInput.maxLength = 4; iconInput.title = 'Emoji als Icon';
      iconInput.addEventListener('change', e => { const v = e.target.value.trim(); const entry = customEntry(name, true); if (v) entry.icon = v; else delete entry.icon; structuralChange(); });
      const colorInput = input('color', topic.color, 'topic-color-input'); colorInput.title = 'Farbe';
      colorInput.addEventListener('change', e => { customEntry(name, true).color = e.target.value; structuralChange(); });
      const grid = div('topic-edit-grid');
      grid.append(labelField('Icon', iconInput), labelField('Farbe', colorInput));
      body.append(labelField('Name', nameInput), grid);
      const actions = div('topic-row-actions');
      if (custom && (custom.icon || custom.color)) actions.append(button(Topics.isLibrary(name) ? 'Bibliotheks-Look' : 'Icon/Farbe zurücksetzen', 'btn btn--small btn--ghost', () => { delete custom.icon; delete custom.color; structuralChange(); }));
      if (!count && custom) actions.append(button('Entfernen', 'btn btn--small btn--danger', () => { state.quiz.categories.splice(state.quiz.categories.indexOf(custom), 1); structuralChange(); }));
      if (actions.children.length) body.append(actions);
      row.append(body);
      box.append(row);
    });
  }

  // ---------------------------------------------------------------- Vorschau (Spieleransicht)
  function openPreview(q){els['preview-backdrop'].hidden=false;Renderers.renderPlayer(q,els['preview-content'],{readOnly:false,reveal:false,onAnswer:()=>{}});}
  function closePreview(){els['preview-backdrop'].hidden=true;els['preview-content'].replaceChildren();}

  function div(className,text){const d=document.createElement('div');if(className)d.className=className;if(text!=null)d.textContent=text;return d;}
  function input(type,value,className){const i=document.createElement('input');i.type=type;i.className=className||'input';i.value=value??'';return i;}
  function button(text,className,handler){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=text;b.addEventListener('click',handler);return b;}
  function labelField(label,control){const l=document.createElement('label');l.className='field-group';const s=document.createElement('span');s.className='field-label';s.textContent=label;l.append(s,control);return l;}
  function spanField(label,control,extra){const l=labelField(label,control);if(extra)l.classList.add(extra);return l;}
})();
