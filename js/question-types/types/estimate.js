(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  function withUnit(value, unit) { return `${value}${unit ? ` ${unit}` : ''}`; }

  window.SylasphereTypes.register({
    type: 'estimate',
    label: 'Schätzfrage',
    icon: '≈',
    description: 'Wert auf einer Skala schätzen; Nähe zum Zielwert bringt Punkte.',

    defaults: () => ({ min: 0, max: 100, step: 1, correctAnswer: 50, unit: '' }),

    normalize(q) {
      q.min = Kit.numberOr(q.min, 0);
      q.max = Kit.numberOr(q.max, 100);
      q.step = Math.max(0.000001, Kit.numberOr(q.step, 1));
      if (q.correctAnswer == null && q.answer != null) q.correctAnswer = q.answer;
      q.correctAnswer = Kit.numberOr(q.correctAnswer, q.min);
      if (q.unit == null) q.unit = '';
      if (q.tolerance != null && q.tolerance !== '') q.tolerance = Math.max(0, Kit.numberOr(q.tolerance, 0));
      else q.tolerance = null;
      q.toleranceMode = String(q.toleranceMode || 'absolute') === 'percent' ? 'percent' : 'absolute';
    },

    validate(q, report) {
      if (!(Number(q.max) > Number(q.min))) report.error('max', 'Max muss größer als Min sein.');
      if (!Number.isFinite(Number(q.correctAnswer))) report.error('correctAnswer', 'Zielwert fehlt oder ist ungültig.');
      if (Number(q.correctAnswer) < Number(q.min) || Number(q.correctAnswer) > Number(q.max)) report.warn('correctAnswer', 'Zielwert liegt außerhalb des Reglerbereichs.');
      if (q.tolerance != null && (!Number.isFinite(Number(q.tolerance)) || Number(q.tolerance) < 0)) report.error('tolerance', 'Toleranz muss leer oder eine Zahl ≥ 0 sein.');
      if (q.tolerance != null && !['absolute', 'percent'].includes(String(q.toleranceMode || 'absolute'))) report.error('toleranceMode', 'Toleranzmodus muss „absolute“ oder „percent“ sein.');
    },

    // Punkte sinken linear mit dem Abstand zum Zielwert; innerhalb der Toleranz gibt es volle Punkte.
    score(q, answer, { base }) {
      const value = Number(answer);
      if (!Number.isFinite(value)) return { points: 0, detail: '' };
      const target = Number(q.correctAnswer);
      const range = Math.max(Math.abs(q.max - q.min), q.step || 1);
      const distance = Math.abs(value - target);
      let points = Math.round(base * Math.max(0, 1 - distance / range));
      if (q.tolerance != null) {
        const tolerance = Math.max(0, Number(q.tolerance) || 0);
        const threshold = q.toleranceMode === 'percent' ? Math.abs(target) * tolerance / 100 : tolerance;
        if (distance <= threshold) points = base;
      }
      return { points, detail: `Abweichung: ${withUnit(Number(distance.toFixed(3)), q.unit)}` };
    },

    solutionText(q) { return withUnit(q.correctAnswer, q.unit); },
    moderatorSolution(q) {
      if (q.tolerance == null) return {};
      return { extra: `Toleranz: ±${q.tolerance}${q.toleranceMode === 'percent' ? ' %' : (q.unit ? ` ${q.unit}` : '')}` };
    },
    answerLabel(q, answer) { return withUnit(answer ?? '–', q.unit); },

    render(q, container, ctx) {
      const { el, escapeHTML } = Kit;
      const wrap = Kit.baseQuestion(q);
      const block = el('div', 'estimate-block');
      const min = Number(q.min); const max = Number(q.max); const step = Number(q.step || 1);
      // null/'' = noch keine Antwort (Number(null) wäre 0 → falsche Anzeige „0 …“)
      const raw = ctx.currentAnswer;
      const hasAnswer = raw != null && raw !== '' && Number.isFinite(Number(raw));
      let value = hasAnswer ? Number(raw) : Kit.clamp(min + Math.round((max - min) / 2 / step) * step, min, max);
      const output = el('output', 'estimate-value', !hasAnswer && ctx.readOnly ? '–' : withUnit(value, q.unit));
      const rangeWrap = el('div', 'range-wrap');
      const input = document.createElement('input');
      input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value; input.disabled = Boolean(ctx.readOnly);
      input.className = 'estimate-range';
      if (ctx.reveal) {
        const target = Kit.clamp((Number(q.correctAnswer) - min) / Math.max(0.000001, max - min) * 100, 0, 100);
        const marker = el('span', 'range-target'); marker.style.left = `${target}%`; marker.title = `Lösung: ${withUnit(q.correctAnswer, q.unit)}`;
        rangeWrap.append(marker);
      }
      rangeWrap.append(input);
      const labels = el('div', 'range-labels');
      labels.innerHTML = `<span>${escapeHTML(withUnit(min, q.unit))}</span><span>${escapeHTML(withUnit(max, q.unit))}</span>`;
      input.addEventListener('input', () => { value = Number(input.value); output.textContent = withUnit(value, q.unit); ctx.onAnswer?.(value); });
      block.append(output, rangeWrap, labels); wrap.append(block); container.replaceChildren(wrap);
      if (!hasAnswer && !ctx.readOnly) ctx.onAnswer?.(value);
    },

    editor(q, ui, box) {
      const { div, input, labelField } = ui;
      const grid = div('dynamic-grid');
      let updateTolerancePreview = () => {};
      [['Min', 'min'], ['Max', 'max'], ['Schritt', 'step'], ['Zielwert', 'correctAnswer'], ['Einheit', 'unit']].forEach(([label, key]) => {
        const inp = input(key === 'unit' ? 'text' : 'number', q[key] ?? '', 'input'); if (key !== 'unit') inp.step = 'any';
        inp.addEventListener('input', e => { q[key] = key === 'unit' ? e.target.value : Number(e.target.value); updateTolerancePreview(); ui.queueSave(); });
        grid.append(labelField(label, inp));
      });
      box.append(grid);

      const toleranceBox = div('tolerance-editor');
      const preset = document.createElement('select'); preset.className = 'select';
      const currentMode = q.toleranceMode || 'absolute';
      const currentTol = q.tolerance == null ? null : Number(q.tolerance);
      const presetValue = currentTol == null ? 'none' : (currentMode === 'percent' && [5, 10, 20].includes(currentTol) ? `pct-${currentTol}` : 'custom');
      [['none', 'Keine Toleranz'], ['pct-5', '5 %'], ['pct-10', '10 %'], ['pct-20', '20 %'], ['custom', 'Benutzerdefiniert']].forEach(([value, label]) => {
        const o = document.createElement('option'); o.value = value; o.textContent = label; o.selected = value === presetValue; preset.append(o);
      });
      const customRow = div('tolerance-custom-row');
      const modeSelect = document.createElement('select'); modeSelect.className = 'select';
      [['percent', 'Prozentual (%)'], ['absolute', 'Fester Wert (±)']].forEach(([value, label]) => { const o = document.createElement('option'); o.value = value; o.textContent = label; o.selected = currentMode === value; modeSelect.append(o); });
      const valueInput = input('number', currentTol ?? 5, 'input'); valueInput.min = '0'; valueInput.step = 'any';
      customRow.append(labelField('Art', modeSelect), labelField('Wert', valueInput));
      const preview = div('tolerance-preview');
      updateTolerancePreview = () => {
        const target = Number(q.correctAnswer);
        const tolerance = q.tolerance == null ? null : Number(q.tolerance);
        if (!Number.isFinite(target) || tolerance == null || !Number.isFinite(tolerance)) {
          preview.textContent = 'Keine Volltreffer-Toleranz: Die Punkte richten sich nur nach der Entfernung zum Zielwert.';
          return;
        }
        const absolute = (q.toleranceMode || 'absolute') === 'percent' ? Math.abs(target) * tolerance / 100 : tolerance;
        const unit = q.unit ? ` ${q.unit}` : '';
        const fmt = n => Number(Number(n).toFixed(4)).toLocaleString('de-DE');
        preview.innerHTML = `<strong>Volle Punkte:</strong> ${fmt(target - absolute)}${Kit.escapeHTML(unit)} bis ${fmt(target + absolute)}${Kit.escapeHTML(unit)} <span>(${q.toleranceMode === 'percent' ? `${tolerance} %` : `±${tolerance}${Kit.escapeHTML(unit)}`})</span>`;
      };
      const syncToleranceControls = () => {
        const selected = preset.value;
        if (selected === 'none') { q.tolerance = null; q.toleranceMode = 'absolute'; customRow.hidden = true; }
        else if (selected.startsWith('pct-')) { q.tolerance = Number(selected.split('-')[1]); q.toleranceMode = 'percent'; customRow.hidden = true; }
        else { customRow.hidden = false; q.toleranceMode = modeSelect.value; q.tolerance = Math.max(0, Number(valueInput.value) || 0); }
        updateTolerancePreview(); ui.queueSave();
      };
      preset.addEventListener('change', syncToleranceControls);
      modeSelect.addEventListener('change', syncToleranceControls);
      valueInput.addEventListener('input', syncToleranceControls);
      customRow.hidden = preset.value !== 'custom';
      toleranceBox.append(labelField('Toleranz', preset), customRow, preview);
      box.append(toleranceBox);
      updateTolerancePreview();
    },

    stats: {
      aggregate(q, records) {
        const nums = records.map(record => Number(record?.answer)).filter(Number.isFinite);
        if (!nums.length) return { kind: 'estimate', count: 0 };
        return { kind: 'estimate', count: nums.length, average: nums.reduce((sum, n) => sum + n, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums) };
      },
      render(stats, q) {
        if (!(Number(stats.count) > 0)) return '';
        return Kit.statCards([['Ø Schätzung', withUnit(Number(Number(stats.average).toFixed(1)), q.unit)], ['Spanne', `${stats.min}–${stats.max}`]]);
      }
    }
  });
})();
