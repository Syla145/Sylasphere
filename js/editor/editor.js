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
    ['edit-title','edit-description','edit-default-timer','edit-default-points','add-round','new-quiz','editor-import','validate-quiz','export-quiz','editor-validation','editor-categories','rounds-container','category-list','autosave-state','preview-backdrop','preview-content','preview-close'].forEach(id => els[id] = document.getElementById(id));
    bindGlobal();
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try { state = Quiz.normalizeQuiz(JSON.parse(saved)); }
      catch (_) { localStorage.removeItem(AUTOSAVE_KEY); }
    }
    if (!state) {
      try {
        const response = await fetch(`./data/quiz-sample.json?cb=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) state = Quiz.normalizeQuiz(await response.json());
      } catch (_) {}
    }
    if (!state) state = createBlankQuiz();
    renderAll();
  }

  function createBlankQuiz() {
    return Quiz.normalizeQuiz({ quiz: {
      id: `quiz_${Date.now().toString(36)}`,
      title: 'Mein Sylasphere Quiz', description: '',
      settings: { defaultTimer: 30, defaultPoints: 100, buzzerEnabled: true },
      rounds: [{ id: App.uid('round'), title: 'Runde 1', pointsMultiplier: 1, questions: [newQuestion('multiple-choice')] }]
    }});
  }
  function newQuestion(type = 'multiple-choice') {
    const base = { id: App.uid('q'), type, category: 'Allgemeinwissen', text: 'Neue Frage', points: state?.quiz?.settings?.defaultPoints || 100, timer: state?.quiz?.settings?.defaultTimer || 30 };
    const defaultOptions = () => [{id:'a',text:'Antwort A'},{id:'b',text:'Antwort B'},{id:'c',text:'Antwort C'},{id:'d',text:'Antwort D'}];
    if (['multiple-choice', 'image-quiz', 'audio-quiz'].includes(type)) Object.assign(base, { options: defaultOptions(), correctAnswer:'a' });
    if (type === 'image-quiz') base.image = './assets/demo-landmark.svg';
    if (type === 'audio-quiz') Object.assign(base, { audio:'./assets/demo-tone.wav', audioLabel:'Audio-Hinweis' });
    if (type === 'estimate') Object.assign(base, { min:0, max:100, step:1, correctAnswer:50, unit:'' });
    if (type === 'sort') Object.assign(base, { items:['Element 1','Element 2','Element 3'], correctOrder:['Element 1','Element 2','Element 3'] });
    if (type === 'fight-list') Object.assign(base, { correctAnswers:['Begriff 1','Begriff 2'], maxEntries:4, pointsPerAnswer:50 });
    if (type === 'higher-lower') Object.assign(base, { cards:[{id:App.uid('card'),label:'Karte A',value:10,unit:''},{id:App.uid('card'),label:'Karte B',value:20,unit:''}] });
    if (type === 'survey') Object.assign(base, { options:[{id:'a',text:'Antwort A',value:40},{id:'b',text:'Antwort B',value:30},{id:'c',text:'Antwort C',value:20},{id:'d',text:'Antwort D',value:10}] });
    if (type === 'consensus') Object.assign(base, { options: defaultOptions() });
    if (type === 'hotspot') Object.assign(base, { image:'./assets/demo-landmark.svg', targetX:50, targetY:50, radius:10 });
    if (type === 'buzzer') Object.assign(base, { timer: 0, buzzerMode: 'spoken', solution: '', penalty: 0 });
    return Quiz.normalizeQuiz({quiz:{title:'x',settings:state?.quiz?.settings||{},rounds:[{questions:[base]}]}}).quiz.rounds[0].questions[0];
  }

  function bindGlobal() {
    els['edit-title'].addEventListener('input', e => { state.quiz.title = e.target.value; state.quiz.id ||= `quiz_${Quiz.slug(e.target.value)}`; queueSave(); });
    els['edit-description'].addEventListener('input', e => { state.quiz.description = e.target.value; queueSave(); });
    els['edit-default-timer'].addEventListener('input', e => { state.quiz.settings.defaultTimer = nonNegative(e.target.value, 30); queueSave(); });
    els['edit-default-points'].addEventListener('input', e => { state.quiz.settings.defaultPoints = nonNegative(e.target.value, 100); queueSave(); });
    els['add-round'].addEventListener('click', () => { state.quiz.rounds.push({ id: App.uid('round'), title: `Runde ${state.quiz.rounds.length + 1}`, pointsMultiplier: 1, questions: [] }); structuralChange(); });
    els['new-quiz'].addEventListener('click', () => { if (confirm('Neues Quiz anlegen? Der aktuelle Autosave wird ersetzt.')) { state = createBlankQuiz(); structuralChange(); } });
    els['editor-import'].addEventListener('change', async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        const data = await App.readJSONFile(file); const validation = Validator.validate(data);
        if (!validation.valid) { showValidation(validation); App.toast('Import enthält Fehler und wurde nicht übernommen.', 'error'); return; }
        state = validation.normalized; structuralChange(); App.toast('Quiz importiert.', 'success');
      } catch (error) { App.toast(error.message, 'error'); }
      e.target.value = '';
    });
    els['validate-quiz'].addEventListener('click', () => { const v = Validator.validate(state); showValidation(v); App.toast(v.valid ? 'Quiz ist spielbereit.' : 'Bitte Fehler vor dem Export korrigieren.', v.valid ? 'success' : 'error'); });
    els['export-quiz'].addEventListener('click', () => {
      const v = Validator.validate(state); showValidation(v); if (!v.valid) return App.toast('Export gestoppt: Das Quiz enthält noch Fehler.', 'error');
      const filename = `${Quiz.slug(state.quiz.title, 'jh-quiz')}.json`; App.downloadJSON(v.normalized, filename); App.toast('Quiz exportiert.', 'success');
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
    renderCategories(); renderRounds(); showValidation(Validator.validate(state));
  }
  function renderCategories() {
    const categories = Quiz.extractCategories(state);
    const suggestions = ['Allgemeinwissen','Sport','Filme & Serien','Musik','Geschichte','Geografie','Wissenschaft','Technik','Gaming','Internet & Popkultur','Essen & Trinken','Reisen','Bilderrätsel','Musik & Sounds','Community & Popkultur','Dilemma','Rekorde'];
    const categoryOptions = [...categories, ...suggestions.filter(suggestion => !categories.some(category => Quiz.categoryKey(category) === Quiz.categoryKey(suggestion)))];
    els['editor-categories'].innerHTML = categories.length ? categories.map(c => `<span class="chip">${App.escapeHTML(c)}</span>`).join('') : '<span class="microcopy">Noch keine Kategorien.</span>';
    els['category-list'].innerHTML = categoryOptions.map(c => `<option value="${App.escapeHTML(c)}"></option>`).join('');
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

    const addControl = div('add-question-control');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'select select--compact';
    Quiz.SUPPORTED_TYPES.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = `${Quiz.TYPE_ICONS[type] || '•'} ${Quiz.TYPE_LABELS[type]}`;
      typeSelect.append(option);
    });
    const addButton = button('+ Frage', 'btn btn--small btn--primary', () => {
      round.questions.push(newQuestion(typeSelect.value));
      structuralChange();
    });
    addControl.append(typeSelect, addButton);

    const actions = div('round-head-actions');
    const up = button('↑', 'icon-btn', () => moveRound(ri, -1)); up.title = 'Runde nach oben'; up.disabled = ri === 0;
    const down = button('↓', 'icon-btn', () => moveRound(ri, 1)); down.title = 'Runde nach unten'; down.disabled = ri === state.quiz.rounds.length - 1;
    actions.append(addControl, up, down, button('Duplizieren', 'btn btn--small btn--ghost', () => duplicateRound(ri)), button('Löschen', 'btn btn--small btn--danger', () => deleteRound(ri)));
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

    const category = input('text', q.category || '', 'input');
    category.setAttribute('list', 'category-list'); category.placeholder = 'Beliebige Kategorie';
    category.addEventListener('input', e => { q.category = e.target.value; queueSave(); renderCategories(); });
    fields.append(spanField('Kategorie', category, 'span-2'));

    const points = input('number', q.points, 'input'); points.min = '0';
    points.addEventListener('input', e => { q.points = nonNegative(e.target.value, 0); queueSave(); });
    fields.append(spanField('Punkte', points, ''));
    const timer = input('number', q.timer, 'input'); timer.min = '0';
    timer.addEventListener('input', e => { q.timer = nonNegative(e.target.value, 0); queueSave(); });
    fields.append(spanField('Timer (s)', timer, ''));
    const id = input('text', q.id, 'input');
    id.addEventListener('input', e => { q.id = e.target.value.trim(); queueSave(); });
    fields.append(spanField('ID', id, 'span-2'));
    fields.append(renderDynamic(q));
    wrap.append(fields);
    return wrap;
  }

  function renderChoiceEditor(q, box, mode) {
    const list = div('');
    (q.options || []).forEach((opt, i) => {
      const row = div(`option-row option-row--${mode}`);
      if (mode === 'correct') {
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = `correct_${q.id}`; radio.checked = String(Quiz.correctOption(q)?.id || '') === String(opt.id); radio.title = 'Richtige Antwort';
        radio.addEventListener('change', () => { q.correctAnswer = opt.id; queueSave(); });
        row.append(radio);
      } else {
        const marker = div('option-kind', mode === 'survey' ? `${i + 1}.` : '•');
        row.append(marker);
      }
      const id = input('text', opt.id, 'input'); id.maxLength = 12;
      id.addEventListener('change', e => {
        const old = opt.id; opt.id = e.target.value.trim() || String.fromCharCode(97 + i);
        if (String(q.correctAnswer) === String(old)) q.correctAnswer = opt.id;
        structuralChange();
      });
      const txt = input('text', opt.text, 'input'); txt.addEventListener('input', e => { opt.text = e.target.value; queueSave(); });
      row.append(id, txt);
      if (mode === 'survey') {
        const value = input('number', opt.value ?? 0, 'input'); value.min = '0'; value.max = '100'; value.step = '0.1'; value.title = 'Anteil in Prozent';
        value.addEventListener('input', e => { opt.value = Number(e.target.value) || 0; queueSave(); });
        row.append(value);
      }
      row.append(button('✕', 'icon-btn', () => {
        q.options.splice(i, 1);
        if (mode === 'correct' && !q.options.some(o => String(o.id) === String(q.correctAnswer))) q.correctAnswer = q.options[0]?.id || '';
        structuralChange();
      }));
      list.append(row);
    });
    box.append(list, button('+ Antwort', 'btn btn--small', () => {
      const id = String.fromCharCode(97 + (q.options?.length || 0)); q.options = q.options || [];
      const option = { id, text: `Antwort ${id.toUpperCase()}` };
      if (mode === 'survey') option.value = 0;
      q.options.push(option);
      if (mode === 'correct') q.correctAnswer ||= id;
      structuralChange();
    }));
  }

  function renderDynamic(q) {
    const box = div('dynamic-box');
    if (['multiple-choice', 'image-quiz', 'audio-quiz'].includes(q.type)) {
      if (q.type === 'image-quiz') {
        const image = input('text', q.image || q.imageUrl || '', 'input'); image.placeholder = './assets/bild.jpg oder https://…';
        image.addEventListener('input', e => { q.image = e.target.value; queueSave(); });
        box.append(labelField('Bildquelle', image));
      }
      if (q.type === 'audio-quiz') {
        const mediaGrid = div('dynamic-grid');
        const audio = input('text', q.audio || q.audioUrl || '', 'input'); audio.placeholder = './assets/clip.mp3 oder https://…';
        audio.addEventListener('input', e => { q.audio = e.target.value; queueSave(); });
        const label = input('text', q.audioLabel || '', 'input'); label.placeholder = 'z. B. Song-Snippet';
        label.addEventListener('input', e => { q.audioLabel = e.target.value; queueSave(); });
        mediaGrid.append(labelField('Audioquelle', audio), labelField('Audio-Label', label)); box.append(mediaGrid);
      }
      renderChoiceEditor(q, box, 'correct');
    } else if (q.type === 'survey') {
      box.append(div('editor-help', 'Trage die Ergebnisse einer Umfrage in Prozent ein. Die Antwort mit dem höchsten Anteil ist die gesuchte Top-Antwort.'));
      renderChoiceEditor(q, box, 'survey');
    } else if (q.type === 'consensus') {
      box.append(div('editor-help', 'Keine richtige Antwort nötig: Beim Schließen der Frage wertet Sylasphere automatisch aus, welche Option die meisten Spieler gewählt haben.'));
      renderChoiceEditor(q, box, 'consensus');
    } else if (q.type === 'hotspot') {
      const image = input('text', q.image || '', 'input'); image.placeholder = './assets/bild.jpg oder https://…';
      box.append(labelField('Bildquelle', image));

      const grid = div('dynamic-grid');
      const xInput = input('number', q.targetX ?? 50, 'input'); xInput.min = '0'; xInput.max = '100'; xInput.step = '0.1';
      const yInput = input('number', q.targetY ?? 50, 'input'); yInput.min = '0'; yInput.max = '100'; yInput.step = '0.1';
      const radiusInput = input('number', q.radius ?? 10, 'input'); radiusInput.min = '1'; radiusInput.max = '50'; radiusInput.step = '0.1';
      grid.append(labelField('Ziel X (%)', xInput), labelField('Ziel Y (%)', yInput), labelField('Trefferradius (%)', radiusInput));
      box.append(grid);

      const stage = div('hotspot-stage hotspot-editor-stage');
      const previewImage = document.createElement('img');
      previewImage.alt = 'Hotspot-Zielbereich im Editor';
      previewImage.draggable = false;
      const zone = div('hotspot-zone');
      const target = div('hotspot-marker hotspot-marker--target');
      stage.append(previewImage, zone, target);

      const syncPreview = () => {
        const x = App.clamp(Number(q.targetX) || 0, 0, 100);
        const y = App.clamp(Number(q.targetY) || 0, 0, 100);
        const radius = App.clamp(Number(q.radius) || 1, 1, 50);
        zone.style.left = `${x}%`; zone.style.top = `${y}%`; zone.style.width = `${radius * 2}%`; zone.style.height = `${radius * 2}%`;
        target.style.left = `${x}%`; target.style.top = `${y}%`;
        const src = App.sanitizeURL(q.image || '');
        zone.hidden = target.hidden = !src;
        if (src && previewImage.getAttribute('src') !== src) previewImage.src = src;
        if (!src) previewImage.removeAttribute('src');
      };
      const updateNumber = (key, control, min, max) => {
        control.addEventListener('input', e => {
          q[key] = App.clamp(Number(e.target.value) || min, min, max);
          syncPreview(); queueSave();
        });
      };
      updateNumber('targetX', xInput, 0, 100);
      updateNumber('targetY', yInput, 0, 100);
      updateNumber('radius', radiusInput, 1, 50);
      image.addEventListener('input', e => { q.image = e.target.value; syncPreview(); queueSave(); });
      stage.addEventListener('pointerup', event => {
        if (!previewImage.getAttribute('src')) return;
        const rect = stage.getBoundingClientRect();
        q.targetX = Number(App.clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100).toFixed(1));
        q.targetY = Number(App.clamp((event.clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100).toFixed(1));
        xInput.value = q.targetX; yInput.value = q.targetY; syncPreview(); queueSave();
      });
      syncPreview();
      box.append(div('editor-help', 'Zielpunkt direkt im Bild setzen: Klicke oder tippe auf die gesuchte Position. Den Radius kannst du darunter feinjustieren.'), stage);
    } else if (q.type === 'estimate') {
      const grid = div('dynamic-grid');
      [['Min','min'],['Max','max'],['Schritt','step'],['Zielwert','correctAnswer'],['Einheit','unit'],['Toleranz (optional)','tolerance']].forEach(([label,key]) => {
        const inp = input(key === 'unit' ? 'text' : 'number', q[key] ?? '', 'input'); if (key !== 'unit') inp.step = 'any';
        inp.addEventListener('input', e => { q[key] = key === 'unit' ? e.target.value : (e.target.value === '' && key === 'tolerance' ? null : Number(e.target.value)); queueSave(); });
        grid.append(labelField(label, inp));
      }); box.append(grid);
    } else if (q.type === 'sort') {
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 6; area.value = (q.correctOrder || q.items || []).join('\n');
      area.addEventListener('input', e => { const values = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); q.correctOrder = values; q.items = values.slice(); queueSave(); });
      box.append(labelField('Korrekte Reihenfolge – ein Element pro Zeile', area));
    } else if (q.type === 'fight-list') {
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 6; area.value = (q.correctAnswers || []).join('\n');
      area.addEventListener('input', e => { q.correctAnswers = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); queueSave(); });
      box.append(labelField('Gültige Lösungen – ein Begriff pro Zeile', area));
      const grid = div('dynamic-grid');
      const max = input('number', q.maxEntries || 5, 'input'); max.min = '1'; max.addEventListener('input', e => { q.maxEntries = Math.max(1, Math.round(Number(e.target.value) || 1)); queueSave(); });
      const ppa = input('number', q.pointsPerAnswer || 0, 'input'); ppa.min = '0'; ppa.addEventListener('input', e => { q.pointsPerAnswer = nonNegative(e.target.value, 0); queueSave(); });
      grid.append(labelField('Max. Eingaben', max), labelField('Punkte je Treffer', ppa)); box.append(grid);
    } else if (q.type === 'buzzer') {
      box.append(div('editor-help', 'Speed-Frage ohne Zeitlimit: Der erste Spieler buzzert oder sendet eine Schnellantwort. Der Moderator prüft richtig/falsch manuell und kann den Buzzer bei Fehlern erneut freigeben.'));
      const grid = div('dynamic-grid');
      const mode = document.createElement('select'); mode.className = 'select';
      [['spoken','Mündliche Antwort nach dem Buzzer'],['text','Erste Textantwort gewinnt']].forEach(([value,label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = String(q.buzzerMode || 'spoken') === value; mode.append(option);
      });
      mode.addEventListener('change', e => { q.buzzerMode = e.target.value; structuralChange(); });
      const solution = document.createElement('textarea'); solution.className = 'input textarea'; solution.rows = 3; solution.value = q.solution || ''; solution.placeholder = 'Optional: Musterlösung / Auflösung für Moderator und Reveal';
      solution.addEventListener('input', e => { q.solution = e.target.value; queueSave(); });
      const penalty = input('number', q.penalty ?? 0, 'input'); penalty.min = '0'; penalty.step = '1'; penalty.addEventListener('input', e => { q.penalty = nonNegative(e.target.value, 0); queueSave(); });
      grid.append(labelField('Buzzer-Modus', mode), labelField('Punktabzug bei falscher Antwort (optional)', penalty));
      box.append(grid, labelField('Lösung / Hinweistext', solution));
    } else if (q.type === 'higher-lower') {
      const list = div('');
      (q.cards || []).forEach((card, i) => {
        const row = div('card-row');
        const label = input('text', card.label, 'input'); label.addEventListener('input', e => { card.label = e.target.value; queueSave(); });
        const value = input('number', card.value, 'input'); value.step = 'any'; value.addEventListener('input', e => { card.value = Number(e.target.value); queueSave(); });
        const unit = input('text', card.unit || '', 'input'); unit.addEventListener('input', e => { card.unit = e.target.value; queueSave(); });
        row.append(label, value, unit, button('✕', 'icon-btn', () => { q.cards.splice(i, 1); structuralChange(); })); list.append(row);
      });
      box.append(list, button('+ Karte', 'btn btn--small', () => { q.cards = q.cards || []; q.cards.push({ id: App.uid('card'), label: `Karte ${q.cards.length + 1}`, value: 0, unit: '' }); structuralChange(); }));
    }
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
