(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * 3×3-Grid (v26) – Kreuz-Raster-Rätsel
   * ------------------------------------------------------------------
   * 3 Begriffe links (Zeilen) und 3 oben (Spalten), jeweils Text und/oder Bild.
   * Jedes der 9 Felder braucht eine Antwort, die zu Zeile UND Spalte passt.
   * Alle Spieler tippen gleichzeitig, bis die Zeit um ist (automatisch gespeichert).
   * Eine Antwort darf pro Spieler nur einmal im Grid stehen.
   *
   * Auswertung wie bei Fight List, aber pro Feld: Das System markiert vorab
   * ✓ erkannt, ≈ mit Tippfehler erkannt, ✗ nicht erkannt / doppelt.
   * Der Moderator tippt ein Feld an, um die Wertung umzudrehen.
   *
   * Punkte: „Punkte“ der Frage gibt es pro richtigem Feld, dazu optional ein Bonus
   * für ein komplett richtiges Grid (alle 9 Felder).
   *
   * Antwort eines Spielers: Liste mit 9 Texten (Feld k = Zeile ⌊k/3⌋, Spalte k mod 3).
   */
  const N = 3;
  const CELLS = N * N;
  const keyOf = k => `c${k}`;
  const rowOf = k => Math.floor(k / N);
  const colOf = k => k % N;

  function header(h) { return { label: String(h?.label ?? h?.text ?? (typeof h === 'string' ? h : '')).trim(), image: String(h?.image ?? '').trim() }; }
  function answersList(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n|;/);
    return list.map(v => String(v).trim()).filter(Boolean);
  }
  const headerText = h => h?.label || (h?.image ? 'Bild' : '–');
  function cellName(q, k) { return `${headerText(q.rows?.[rowOf(k)])} × ${headerText(q.cols?.[colOf(k)])}`; }
  function valuesOf(answer) {
    const list = Array.isArray(answer) ? answer : (answer && typeof answer === 'object' ? Object.values(answer) : []);
    return Array.from({ length: CELLS }, (_, k) => String(list[k] ?? '').trim());
  }
  /** Wie passt die Eingabe in Feld k? { kind: 'empty'|'double'|'exact'|'fuzzy'|'none', solution } */
  function cellMatch(q, answer, k) {
    const values = valuesOf(answer);
    const text = values[k];
    if (!text) return { kind: 'empty' };
    const clean = Kit.cleanTerm(text);
    if (values.slice(0, k).some(v => v && Kit.cleanTerm(v) === clean)) return { kind: 'double' };
    const solutions = q.cells?.[k]?.answers;
    if (!Array.isArray(solutions)) return { kind: 'unknown' }; // Spieler-Gerät vor der Auflösung
    const match = Kit.matchTerm(text, solutions);
    // Auch „Tokyo“ und „Tokio“ in zwei Feldern zählen als dieselbe Antwort
    if (match.kind !== 'none') {
      const same = values.slice(0, k).some((v, j) => {
        if (!v) return false;
        const other = Kit.matchTerm(v, q.cells?.[j]?.answers || []);
        return other.kind !== 'none' && Kit.cleanTerm(other.solution) === Kit.cleanTerm(match.solution);
      });
      if (same) return { kind: 'double', solution: match.solution };
    }
    return match;
  }
  const autoOk = m => m.kind === 'exact' || m.kind === 'fuzzy';
  /** Doppelte Einträge (gleicher Text in mehreren Feldern) – für den Hinweis am Handy */
  function doubles(values) {
    const seen = new Map();
    const out = new Set();
    values.forEach((v, k) => { const c = Kit.cleanTerm(v); if (!c) return; if (seen.has(c)) { out.add(k); out.add(seen.get(c)); } else seen.set(c, k); });
    return out;
  }
  /** Wertung pro Feld: Moderator-Entscheidung, sonst Vorschlag des Systems */
  function verdictsOf(q, answer, result, playerId) {
    const explicit = result?.verdicts?.[playerId];
    return Array.from({ length: CELLS }, (_, k) => {
      if (explicit && typeof explicit === 'object' && typeof explicit[keyOf(k)] === 'boolean') return explicit[keyOf(k)];
      return autoOk(cellMatch(q, answer, k));
    });
  }
  const bonusOf = q => Math.max(0, Kit.numberOr(q.bonus, 0));

  // ---------------------------------------------------------------- Anzeige
  function headHTML(h, cls) {
    const App = window.SchmobinApp;
    const esc = App.escapeHTML;
    const src = App.sanitizeURL(h?.image || '');
    return `<div class="grid9-head ${cls}">${src ? `<img src="${esc(src)}" alt="${esc(h.label || '')}" loading="lazy">` : ''}${h?.label ? `<span>${esc(h.label)}</span>` : ''}</div>`;
  }

  function render(q, container, ctx) {
    const App = window.SchmobinApp;
    const esc = App.escapeHTML;
    const wrap = Kit.baseQuestion(q);
    const root = Kit.el('div', 'grid9');
    const values = valuesOf(ctx.currentAnswer);
    const editable = !ctx.readOnly && !ctx.reveal && typeof ctx.onAnswer === 'function';
    const reveal = Boolean(ctx.reveal);
    const own = reveal && ctx.currentAnswer ? verdictsOf(q, ctx.currentAnswer, ctx.result, ctx.playerId) : null;
    let active = values.findIndex(v => !v); if (active < 0) active = 0;

    const board = Kit.el('div', 'grid9-board');
    board.innerHTML = `<div class="grid9-corner" aria-hidden="true"></div>${(q.cols || []).map(h => headHTML(h, 'is-col')).join('')}`;
    for (let r = 0; r < N; r++) {
      board.insertAdjacentHTML('beforeend', headHTML(q.rows?.[r], 'is-row'));
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const cell = document.createElement(editable ? 'button' : 'div');
        if (editable) cell.type = 'button';
        cell.className = 'grid9-cell';
        cell.dataset.k = String(k);
        cell.setAttribute('aria-label', `Feld ${cellName(q, k)}`);
        let inner = `<span class="grid9-text">${values[k] ? esc(values[k]) : (editable ? '＋' : '')}</span>`;
        if (reveal) {
          const valid = q.cells?.[k]?.answers || [];
          if (own) {
            cell.classList.add(own[k] ? 'is-right' : 'is-wrong');
            inner = `<b class="grid9-mark">${own[k] ? '✓' : '✗'}</b>${inner}`;
          }
          if (valid.length) inner += `<small class="grid9-valid">${esc(valid.slice(0, 3).join(', '))}${valid.length > 3 ? ` +${valid.length - 3}` : ''}</small>`;
        }
        cell.innerHTML = inner;
        board.append(cell);
      }
    }
    root.append(board);

    if (editable) {
      const form = Kit.el('div', 'grid9-input');
      form.innerHTML = `<label class="field-group"><span class="field-label grid9-input-label"></span><input class="input" type="text" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="Antwort für dieses Feld"></label><div class="grid9-nav"><button type="button" class="btn btn--small" data-step="-1" aria-label="Vorheriges Feld">◀</button><button type="button" class="btn btn--small" data-step="1" aria-label="Nächstes Feld">▶</button></div>`;
      const note = Kit.el('p', 'grid9-note', '');
      root.append(form, note);
      const input = form.querySelector('input');
      const label = form.querySelector('.grid9-input-label');
      const cells = [...board.querySelectorAll('.grid9-cell')];
      const paint = () => {
        const dup = doubles(values);
        cells.forEach((cell, k) => {
          cell.classList.toggle('is-active', k === active);
          cell.classList.toggle('is-double', dup.has(k));
          cell.classList.toggle('is-filled', Boolean(values[k]));
          cell.querySelector('.grid9-text').textContent = values[k] || '＋';
        });
        label.textContent = `Feld ${rowOf(active) + 1}·${colOf(active) + 1}: ${cellName(q, active)}`;
        const filled = values.filter(Boolean).length;
        note.className = `grid9-note${dup.size ? ' is-warning' : ''}`;
        note.textContent = dup.size ? '⚠ Eine Antwort steht mehrfach im Grid – sie zählt nur einmal. Bitte ändern.' : `${filled}/9 Felder ausgefüllt · wird automatisch gespeichert`;
      };
      const select = k => { active = (k + CELLS) % CELLS; input.value = values[active]; paint(); input.focus({ preventScroll: true }); };
      const emit = () => ctx.onAnswer(values.some(Boolean) ? values.slice() : null);
      cells.forEach((cell, k) => cell.addEventListener('click', () => select(k)));
      form.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => select(active + Number(b.dataset.step))));
      input.addEventListener('input', () => { values[active] = input.value.trim(); paint(); emit(); });
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const next = values.findIndex((v, k) => k > active && !v);
        select(next >= 0 ? next : active + 1);
      });
      input.value = values[active];
      paint();
    } else if (!reveal) {
      root.append(Kit.el('p', 'grid9-note', ctx.currentAnswer ? `${values.filter(Boolean).length}/9 Felder ausgefüllt` : 'Jedes Feld braucht eine Antwort, die zu Zeile und Spalte passt.'));
    } else if (own) {
      const right = own.filter(Boolean).length;
      root.append(Kit.el('p', 'grid9-note', `${right} von 9 Feldern richtig${right === CELLS && bonusOf(q) ? ' – volles Grid, Bonus!' : ''}`));
    }
    wrap.append(root);
    container.replaceChildren(wrap);
  }

  // ---------------------------------------------------------------- Moderator: Prüfung pro Feld
  const KIND = { exact: ['✓', 'erkannt'], fuzzy: ['≈', 'mit Tippfehler erkannt'], none: ['✗', 'nicht erkannt'], double: ['✗', 'doppelt'], empty: ['–', 'leer'] };
  function reviewPanel(q, answers, h) {
    const entries = Object.entries(answers || {});
    if (!entries.length) return '<div class="notice review-empty">Noch keine Antworten zum Prüfen.</div>';
    const esc = h.esc;
    const rows = entries.map(([pid, record]) => {
      const values = valuesOf(record.answer);
      let right = 0;
      const cells = values.map((text, k) => {
        const match = cellMatch(q, record.answer, k);
        const v = h.verdict(pid, record.answer, keyOf(k));
        const ok = v.value === true;
        if (ok) right++;
        const [icon, what] = v.source === 'moderator' ? [ok ? '✓' : '✗', 'von dir gewertet'] : (KIND[match.kind] || KIND.none);
        const title = `${cellName(q, k)} · ${what}${match.solution && match.kind === 'fuzzy' ? ` (${match.solution})` : ''} – antippen zum Umdrehen`;
        return `<button type="button" class="grid9-review-cell ${ok ? 'is-right' : 'is-wrong'}${v.source === 'moderator' ? ' is-manual' : ''}" data-review-player="${esc(pid)}" data-review-part="${keyOf(k)}" data-verdict="${ok ? 'false' : 'true'}" title="${esc(title)}"><b>${icon}</b>${text ? `<span>${esc(text)}</span>` : ''}</button>`;
      }).join('');
      const bonus = right === CELLS && bonusOf(q) ? ' · Bonus' : '';
      return `<div class="grid9-review"><div class="grid9-review-who"><strong>${esc(h.name(pid) || 'Spieler')}</strong><span>${right}/9 richtig${bonus}</span></div><div class="grid9-review-board">${cells}</div></div>`;
    }).join('');
    return `<div class="review-panel"><div class="review-head"><strong>Grids prüfen</strong><span>✓ erkannt · ≈ Tippfehler · ✗ nicht erkannt/doppelt – Feld antippen zum Umdrehen</span></div><div class="grid9-review-list">${rows}</div></div>`;
  }

  // ---------------------------------------------------------------- Editor
  function editor(q, ui, box) {
    const { div, input, labelField } = ui;
    box.append(div('editor-help', 'Links 3 Zeilen, oben 3 Spalten (Text und/oder Bild). In jedes Feld gehört eine Antwort, die zu beiden passt. Trage pro Feld alle gültigen Antworten ein – eine pro Zeile. Kleine Tippfehler und Nachnamen erkennt das System, du kannst beim Auflösen jedes Feld umdrehen. „Punkte“ oben = Punkte pro richtigem Feld.'));
    const top = div('dynamic-grid');
    const bonus = input('number', bonusOf(q), 'input'); bonus.min = '0'; bonus.step = '10';
    bonus.addEventListener('input', e => { q.bonus = Math.max(0, Number(e.target.value) || 0); ui.queueSave(); });
    top.append(labelField('Bonus für ein komplett richtiges Grid (0 = kein Bonus)', bonus));
    box.append(top);

    const matrix = div('grid9-editor');
    const headField = (h, placeholder, update) => {
      const cell = div('grid9-editor-head');
      const text = input('text', h.label, 'input'); text.placeholder = placeholder; text.maxLength = 60;
      text.addEventListener('input', e => { h.label = e.target.value; update(); ui.queueSave(); });
      const img = input('text', h.image, 'input'); img.placeholder = 'Bild (optional)';
      img.addEventListener('input', e => { h.image = e.target.value.trim(); ui.queueSave(); });
      cell.append(text, img);
      window.SylasphereMediaLibrary?.enhance(img, 'image');
      return cell;
    };
    const cellLabels = [];
    const refreshLabels = () => cellLabels.forEach((node, k) => { node.textContent = cellName(q, k); });
    matrix.append(div('grid9-editor-corner'));
    q.cols.forEach((h, c) => matrix.append(headField(h, `Spalte ${c + 1}, z. B. Bundesliga`, refreshLabels)));
    q.rows.forEach((h, r) => {
      matrix.append(headField(h, `Zeile ${r + 1}, z. B. Torhüter`, refreshLabels));
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const cell = div('grid9-editor-cell');
        const name = Kit.el('span', 'field-label', '');
        cellLabels[k] = name;
        const area = document.createElement('textarea');
        area.className = 'input'; area.rows = 3; area.placeholder = 'Gültige Antworten, eine pro Zeile';
        area.value = (q.cells[k]?.answers || []).join('\n');
        const count = Kit.el('small', 'field-hint', '');
        const updateCount = () => { const n = answersList(area.value).length; count.textContent = n ? `${n} gültig` : '⚠ noch keine Antwort'; count.classList.toggle('is-warning', !n); };
        area.addEventListener('input', () => { q.cells[k].answers = answersList(area.value); updateCount(); ui.queueSave(); });
        updateCount();
        cell.append(name, area, count);
        matrix.append(cell);
      }
    });
    refreshLabels();
    box.append(matrix);
  }

  // ---------------------------------------------------------------- Registrierung
  window.SylasphereTypes.register({
    type: 'grid',
    label: '3×3-Grid',
    icon: '▦',
    description: 'Neun Felder, jedes muss zu seiner Zeile und Spalte passen. Alle tippen gleichzeitig.',
    solutionLabel: 'Gültige Antworten',
    review: 'manual',
    defaults: () => ({
      text: 'Fülle das Grid!', points: 20, bonus: 50, timer: 180,
      rows: [{ label: 'Hauptstadt', image: '' }, { label: 'Liegt am Meer', image: '' }, { label: 'Über 1 Mio. Einwohner', image: '' }],
      cols: [{ label: 'Europa', image: '' }, { label: 'Asien', image: '' }, { label: 'Afrika', image: '' }],
      cells: [
        { answers: ['Berlin', 'Paris', 'Madrid', 'Rom', 'Wien'] }, { answers: ['Tokio', 'Peking', 'Seoul', 'Bangkok'] }, { answers: ['Kairo', 'Nairobi', 'Accra', 'Rabat'] },
        { answers: ['Lissabon', 'Kopenhagen', 'Oslo', 'Athen'] }, { answers: ['Tokio', 'Manila', 'Jakarta', 'Colombo'] }, { answers: ['Dakar', 'Accra', 'Tunis', 'Algier'] },
        { answers: ['Hamburg', 'Barcelona', 'Mailand', 'München'] }, { answers: ['Shanghai', 'Mumbai', 'Delhi', 'Istanbul'] }, { answers: ['Lagos', 'Kinshasa', 'Johannesburg', 'Kairo'] }
      ]
    }),
    normalize(q) {
      const heads = value => Array.from({ length: N }, (_, i) => header((Array.isArray(value) ? value : [])[i]));
      q.rows = heads(q.rows);
      q.cols = heads(q.cols);
      const cells = Array.isArray(q.cells) ? q.cells : [];
      q.cells = Array.from({ length: CELLS }, (_, k) => ({ answers: answersList(cells[k]?.answers ?? cells[k]) }));
      q.bonus = bonusOf(q);
    },
    validate(q, report) {
      [['rows', 'Zeile'], ['cols', 'Spalte']].forEach(([key, word]) => (q[key] || []).forEach((h, i) => {
        if (!h.label && !h.image) report.error(key, `${word} ${i + 1}: Begriff oder Bild fehlt.`);
        if (h.image) Kit.mediaAdvice(h.image, 'image').forEach(a => { if (a.level === 'error') report.error(key, `${word} ${i + 1}: ${a.text}`); else if (a.level === 'warn') report.warn(key, `${word} ${i + 1}: ${a.text}`); });
      }));
      (q.cells || []).forEach((cell, k) => { if (!cell.answers.length) report.error('cells', `Feld ${cellName(q, k)}: noch keine gültige Antwort.`); });
      if (!Number(q.timer)) report.warn('timer', 'Tipp: Ein Grid braucht Zeit – etwa 2–4 Minuten (Timer 120–240 s).');
    },
    hideSolution(pq) { delete pq.cells; },
    reviewParts: q => Array.from({ length: CELLS }, (_, k) => ({ key: keyOf(k), label: cellName(q, k) })),
    autoCheck(q, answer, part) {
      const k = Number(String(part || '').slice(1));
      if (!Number.isInteger(k) || k < 0 || k >= CELLS) return null;
      return autoOk(cellMatch(q, answer, k));
    },
    reviewPanel,
    cellMatch,
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),
    score(q, answer, { base, result, playerId }) {
      const values = valuesOf(answer);
      if (!values.some(Boolean)) return { points: 0, detail: 'Keine Antwort' };
      const right = verdictsOf(q, answer, result, playerId).filter(Boolean).length;
      const mult = Number(q.points) > 0 ? base / Number(q.points) : 1;
      const full = right === CELLS && bonusOf(q) > 0;
      return { points: Math.round(right * base + (full ? bonusOf(q) * mult : 0)), detail: `${right}/9 Felder richtig${full ? ' · Bonus für volles Grid' : ''}` };
    },
    solutionText: q => `${(q.cells || []).reduce((n, c) => n + (c.answers || []).length, 0)} gültige Antworten in 9 Feldern`,
    moderatorSolution(q) {
      const lines = (q.cells || []).map((c, k) => `${cellName(q, k)}: ${(c.answers || []).slice(0, 4).join(', ')}${(c.answers || []).length > 4 ? ' …' : ''}`);
      return { text: `${(q.cells || []).reduce((n, c) => n + (c.answers || []).length, 0)} gültige Antworten`, extra: lines.join(' · ') };
    },
    answerLabel(q, answer) {
      const values = valuesOf(answer);
      const filled = values.filter(Boolean);
      return filled.length ? `${filled.length}/9: ${filled.slice(0, 4).join(', ')}${filled.length > 4 ? ' …' : ''}` : '–';
    },
    render,
    editor
  });
})();
