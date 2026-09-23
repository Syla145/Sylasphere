(function () {
  'use strict';
  const App = window.SchmobinApp;
  const Quiz = window.SchmobinQuiz;
  const Validator = window.SchmobinValidator;
  const Renderers = window.SchmobinRenderers;
  const AUTOSAVE_KEY = 'schmobin:editor:autosave:v2';

  let state = null;
  let saveTimer = null;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready; // Fragetyp-Module sind geladen
    ['editor-start','editor-workspace','choose-edit-quiz','choose-new-quiz','editor-load-panel','editor-quiz-select','load-selected-quiz','continue-autosave','editor-import-start','editor-start-message','back-to-editor-start','edit-title','edit-description','edit-default-timer','edit-default-points','add-round','new-quiz','editor-import','validate-quiz','export-quiz','editor-validation','editor-categories','rounds-container','category-list','autosave-state','preview-backdrop','preview-content','preview-close'].forEach(id => els[id] = document.getElementById(id));
    bindGlobal();
    bindStartScreen();
    await loadEditorQuizList();
    updateAutosaveChoice();
    showStart();
  }

  function bindStartScreen() {
    els['choose-edit-quiz'].addEventListener('click', () => {
      els['editor-load-panel'].hidden = false;
      els['editor-load-panel'].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    els['choose-new-quiz'].addEventListener('click', () => {
      state = createBlankQuiz();
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
    els['back-to-editor-start'].addEventListener('click', () => showStart());
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
      const validation = Validator.validate(data);
      if (!validation.valid) { App.toast('Das Quiz enthält Fehler. Bitte zuerst korrigieren oder als JSON importieren.', 'error'); return; }
      state = validation.normalized;
      openWorkspace(`„${state.quiz.title}“ geladen.`);
    } catch (error) { App.toast(`Quiz konnte nicht geladen werden: ${error.message}`, 'error'); }
  }

  async function importIntoEditor(file, openAfter = false) {
    try {
      const data = await App.readJSONFile(file);
      const validation = Validator.validate(data);
      if (!validation.valid) { showValidation(validation); App.toast('Import enthält Fehler und wurde nicht übernommen.', 'error'); return false; }
      state = validation.normalized;
      if (openAfter) openWorkspace(`„${state.quiz.title}“ importiert.`); else { structuralChange(); App.toast('Quiz importiert.', 'success'); }
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
    updateAutosaveChoice();
    App.setText(els['autosave-state'], state ? 'Entwurf gespeichert' : 'Editor bereit');
  }

  function openWorkspace(message = '') {
    els['editor-start'].hidden = true;
    els['editor-workspace'].hidden = false;
    renderAll();
    queueSave();
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
    const base = { id: App.uid('q'), type, category: 'Allgemeinwissen', text: 'Neue Frage', points: state?.quiz?.settings?.defaultPoints || 100, timer: state?.quiz?.settings?.defaultTimer || 30 };
    // Typ-spezifische Startwerte liefert das Fragetyp-Modul
    Object.assign(base, Quiz.typeDef(type)?.defaults() || {});
    return Quiz.normalizeQuiz({quiz:{title:'x',settings:state?.quiz?.settings||{},rounds:[{questions:[base]}]}}).quiz.rounds[0].questions[0];
  }

  function bindGlobal() {
    els['edit-title'].addEventListener('input', e => { state.quiz.title = e.target.value; state.quiz.id ||= `quiz_${Quiz.slug(e.target.value)}`; queueSave(); });
    els['edit-description'].addEventListener('input', e => { state.quiz.description = e.target.value; queueSave(); });
    els['edit-default-timer'].addEventListener('input', e => { state.quiz.settings.defaultTimer = nonNegative(e.target.value, 30); queueSave(); });
    els['edit-default-points'].addEventListener('input', e => { state.quiz.settings.defaultPoints = nonNegative(e.target.value, 100); queueSave(); });
    els['add-round'].addEventListener('click', () => { state.quiz.rounds.push({ id: App.uid('round'), title: `Runde ${state.quiz.rounds.length + 1}`, pointsMultiplier: 1, questions: [] }); structuralChange(); });
    els['new-quiz'].addEventListener('click', () => { if (confirm('Neues Quiz anlegen? Der aktuelle Entwurf wird durch ein neues Quiz ersetzt.')) { state = createBlankQuiz(); structuralChange(); App.toast('Neues Quiz erstellt.', 'success'); } });
    els['editor-import'].addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      await importIntoEditor(file, false);
      e.target.value = '';
    });
    els['validate-quiz'].addEventListener('click', () => { const v = Validator.validate(state); showValidation(v); App.toast(v.valid ? 'Quiz ist spielbereit.' : 'Bitte Fehler vor dem Export korrigieren.', v.valid ? 'success' : 'error'); });
    els['export-quiz'].addEventListener('click', () => {
      const v = Validator.validate(state); showValidation(v); if (!v.valid) return App.toast('Export gestoppt: Das Quiz enthält noch Fehler.', 'error');
      const filename = `${Quiz.slug(state.quiz.title, 'sylasphere-quiz')}.json`; App.downloadJSON(v.normalized, filename); App.toast('Quiz exportiert.', 'success');
    });
    els['preview-close'].addEventListener('click', closePreview);
    els['preview-backdrop'].addEventListener('click', e => { if (e.target === els['preview-backdrop']) closePreview(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els['preview-backdrop'].hidden) closePreview(); });
  }

  function nonNegative(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : fallback; }
  function queueSave() {
    clearTimeout(saveTimer); App.setText(els['autosave-state'], 'Änderungen …');
    saveTimer = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state)); App.setText(els['autosave-state'], `Gespeichert ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    }, 350);
  }
  function structuralChange() { renderAll(); queueSave(); }
  function renderAll() {
    els['edit-title'].value = state.quiz.title || '';
    els['edit-description'].value = state.quiz.description || '';
    els['edit-default-timer'].value = state.quiz.settings.defaultTimer;
    els['edit-default-points'].value = state.quiz.settings.defaultPoints;
    renderTheme();
    renderCategories(); renderRounds(); showValidation(Validator.validate(state));
  }
  // Design des Quiz: wird im Editor sofort als Vorschau angewendet
  function renderTheme() {
    const box = document.getElementById('edit-theme');
    if (!box || !window.SylasphereThemes) return;
    window.SylasphereThemes.applyQuiz(state);
    box.replaceChildren(window.SylasphereThemes.picker(state.quiz.settings.theme, id => {
      state.quiz.settings.theme = id;
      window.SylasphereThemes.apply(id);
      queueSave();
    }));
  }
  // ---------- Themen (v15) ----------
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
    const box = els['editor-categories'];
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
  function renderRounds() {
    els['rounds-container'].replaceChildren();
    if (!state.quiz.rounds.length) {
      const empty = document.createElement('div'); empty.className='panel panel-pad empty-state'; empty.textContent='Noch keine Runde vorhanden.'; els['rounds-container'].append(empty); return;
    }
    state.quiz.rounds.forEach((round, ri) => els['rounds-container'].append(renderRound(round, ri)));
  }

  function renderRound(round, ri) {
    const card = div('panel round-card');
    const head = div('round-head');
    const title = input('text', round.title, 'input');
    title.setAttribute('aria-label', 'Rundentitel');
    title.addEventListener('input', e => { round.title = e.target.value; queueSave(); });
    const multWrap = labelField('Multiplikator', input('number', round.pointsMultiplier, 'input'));
    multWrap.style.maxWidth = '150px';
    const mult = multWrap.querySelector('input');
    mult.min = '0'; mult.step = '0.1';
    mult.addEventListener('input', e => { round.pointsMultiplier = nonNegative(e.target.value, 1); queueSave(); });

    // Der Fragetyp wird direkt in der jeweiligen Frage gewählt. Neue Fragen übernehmen
    // den Typ der letzten Frage dieser Runde (sonst Multiple Choice) und lassen sich dort umstellen.
    const addButton = button('+ Frage', 'btn btn--small btn--primary', () => {
      const lastType = round.questions[round.questions.length - 1]?.type;
      round.questions.push(newQuestion(Quiz.SUPPORTED_TYPES.includes(lastType) ? lastType : Quiz.SUPPORTED_TYPES[0]));
      structuralChange();
    });
    addButton.title = 'Neue Frage zu dieser Runde hinzufügen';

    const actions = div('round-head-actions');
    const up = button('↑', 'icon-btn', () => moveRound(ri, -1)); up.title = 'Runde nach oben'; up.disabled = ri === 0;
    const down = button('↓', 'icon-btn', () => moveRound(ri, 1)); down.title = 'Runde nach unten'; down.disabled = ri === state.quiz.rounds.length - 1;
    actions.append(addButton, up, down,button('Duplizieren', 'btn btn--small btn--ghost', () => duplicateRound(ri)), button('Löschen', 'btn btn--small btn--danger', () => deleteRound(ri)));
    head.append(title, multWrap, actions); card.append(head);

    const body = div('');
    round.questions.forEach((q, qi) => body.append(renderQuestionEditor(q, ri, qi)));
    if (!round.questions.length) body.append(div('empty-state compact', 'Diese Runde enthält noch keine Fragen.'));
    card.append(body);
    return card;
  }

  function renderQuestionEditor(q, ri, qi) {
    const wrap = div('question-editor');
    const head = div('question-editor-head');
    const typeName = Quiz.TYPE_LABELS[q.type] || q.type;
    head.append(div('pill pill--category', `${Quiz.TYPE_ICONS[q.type] || '•'} ${typeName}`));
    const title = document.createElement('strong'); title.textContent = `Frage ${qi + 1}`; head.append(title);
    const up = button('↑', 'icon-btn', () => moveQuestion(ri, qi, -1)); up.title = 'Frage nach oben'; up.disabled = qi === 0;
    const down = button('↓', 'icon-btn', () => moveQuestion(ri, qi, 1)); down.title = 'Frage nach unten'; down.disabled = qi === state.quiz.rounds[ri].questions.length - 1;
    head.append(up, down, button('Vorschau', 'btn btn--small btn--ghost', () => openPreview(q)), button('Duplizieren', 'btn btn--small btn--ghost', () => duplicateQuestion(ri, qi)), button('Löschen', 'btn btn--small btn--danger', () => deleteQuestion(ri, qi)));
    wrap.append(head);

    const description = Quiz.TYPE_DESCRIPTIONS[q.type];
    if (description) wrap.append(div('type-description', description));

    const fields = div('editor-fields');
    const textArea = document.createElement('textarea');
    textArea.className = 'input textarea'; textArea.rows = 2; textArea.value = q.text || '';
    textArea.addEventListener('input', e => { q.text = e.target.value; queueSave(); });
    fields.append(spanField('Fragetext', textArea, 'span-4'));

    const type = document.createElement('select'); type.className = 'select';
    Quiz.SUPPORTED_TYPES.forEach(t => {
      const o = document.createElement('option'); o.value = t; o.textContent = `${Quiz.TYPE_ICONS[t] || '•'} ${Quiz.TYPE_LABELS[t]}`; o.selected = t === q.type; type.append(o);
    });
    type.addEventListener('change', e => changeQuestionType(ri, qi, e.target.value));
    fields.append(spanField('Fragetyp', type, 'span-2'));

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
    fields.append(spanField('Timer (s)', timer, ''));
    fields.append(renderDynamic(q));
    wrap.append(fields, renderAdvancedQuestionSettings(q));
    return wrap;
  }

  function renderAdvancedQuestionSettings(q) {
    const details = document.createElement('details');
    details.className = 'advanced-settings';
    const summary = document.createElement('summary');
    summary.textContent = 'Erweiterte Einstellungen';
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

  // Typ-spezifische Eingabefelder baut das Fragetyp-Modul (editor)
  const editorUI = { div, input, button, labelField, nonNegative, queueSave: () => queueSave(), structuralChange: () => structuralChange() };
  function renderDynamic(q) {
    const box = div('dynamic-box');
    Quiz.typeDef(q.type)?.editor?.(q, editorUI, box, window.SylasphereTypeKit);
    return box;
  }

  function changeQuestionType(ri, qi, type) {
    const old=state.quiz.rounds[ri].questions[qi]; const fresh=newQuestion(type);
    ['id','category','text','points','timer'].forEach(k=>fresh[k]=old[k]); fresh.type=type; state.quiz.rounds[ri].questions[qi]=fresh; structuralChange();
  }
  function moveQuestion(ri, qi, delta) {
    const questions = state.quiz.rounds[ri].questions; const target = qi + delta;
    if (target < 0 || target >= questions.length) return;
    [questions[qi], questions[target]] = [questions[target], questions[qi]]; structuralChange();
  }
  function moveRound(ri, delta) {
    const target = ri + delta; if (target < 0 || target >= state.quiz.rounds.length) return;
    [state.quiz.rounds[ri], state.quiz.rounds[target]] = [state.quiz.rounds[target], state.quiz.rounds[ri]]; structuralChange();
  }
  function duplicateQuestion(ri,qi){const copy=Quiz.clone(state.quiz.rounds[ri].questions[qi]);copy.id=App.uid('q');if(copy.cards)copy.cards=copy.cards.map(c=>({...c,id:App.uid('card')}));copy.text=`${copy.text} (Kopie)`;state.quiz.rounds[ri].questions.splice(qi+1,0,copy);structuralChange();}
  function deleteQuestion(ri,qi){if(confirm('Frage löschen?')){state.quiz.rounds[ri].questions.splice(qi,1);structuralChange();}}
  function duplicateRound(ri){const copy=Quiz.clone(state.quiz.rounds[ri]);copy.id=App.uid('round');copy.title=`${copy.title} (Kopie)`;copy.questions.forEach(q=>{q.id=App.uid('q');if(q.cards)q.cards=q.cards.map(c=>({...c,id:App.uid('card')}))});state.quiz.rounds.splice(ri+1,0,copy);structuralChange();}
  function deleteRound(ri){if(confirm('Runde inklusive Fragen löschen?')){state.quiz.rounds.splice(ri,1);structuralChange();}}

  function showValidation(v) {
    if(!els['editor-validation'])return;
    const items=[...v.errors.map(x=>({...x,kind:'error'})),...v.warnings.map(x=>({...x,kind:'warning'}))];
    if(!items.length){els['editor-validation'].innerHTML='<div class="notice notice--success">Keine Validierungsprobleme.</div>';return;}
    els['editor-validation'].innerHTML=`<details ${v.errors.length?'open':''}><summary>${v.errors.length} Fehler · ${v.warnings.length} Hinweise</summary><div class="validation-list">${items.slice(0,20).map(x=>`<div class="validation-item validation-item--${x.kind}"><code>${App.escapeHTML(x.path)}</code><span>${App.escapeHTML(x.message)}</span></div>`).join('')}${items.length>20?`<div class="microcopy">+ ${items.length-20} weitere</div>`:''}</div></details>`;
  }
  function openPreview(q){els['preview-backdrop'].hidden=false;Renderers.renderPlayer(q,els['preview-content'],{readOnly:false,reveal:false,onAnswer:()=>{}});}
  function closePreview(){els['preview-backdrop'].hidden=true;els['preview-content'].replaceChildren();}

  function div(className,text){const d=document.createElement('div');if(className)d.className=className;if(text!=null)d.textContent=text;return d;}
  function input(type,value,className){const i=document.createElement('input');i.type=type;i.className=className||'input';i.value=value??'';return i;}
  function button(text,className,handler){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=text;b.addEventListener('click',handler);return b;}
  function labelField(label,control){const l=document.createElement('label');l.className='field-group';const s=document.createElement('span');s.className='field-label';s.textContent=label;l.append(s,control);return l;}
  function spanField(label,control,extra){const l=labelField(label,control);if(extra)l.classList.add(extra);return l;}
})();
