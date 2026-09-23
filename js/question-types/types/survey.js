(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  function normalizeSurveyOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => {
      if (option && typeof option === 'object') {
        return {
          id: String(option.id ?? String.fromCharCode(97 + index)),
          text: String(option.text ?? option.label ?? ''),
          value: Math.max(0, Kit.numberOr(option.value ?? option.percent ?? option.percentage, 0))
        };
      }
      return { id: String.fromCharCode(97 + index), text: String(option ?? ''), value: 0 };
    });
  }
  function winnerIds(q) {
    const options = q.options || [];
    if (!options.length) return [];
    const max = Math.max(...options.map(option => Number(option.value) || 0));
    return options.filter(option => (Number(option.value) || 0) === max).map(option => String(option.id));
  }

  window.SylasphereTypes.register({
    type: 'survey',
    label: 'Publikums-Duell',
    icon: '▥',
    description: 'Wie hat das Publikum abgestimmt? Die stärkste Umfrage-Antwort gewinnt.',
    solutionLabel: 'Top-Antwort',

    defaults: () => ({ options: [{ id: 'a', text: 'Antwort A', value: 40 }, { id: 'b', text: 'Antwort B', value: 30 }, { id: 'c', text: 'Antwort C', value: 20 }, { id: 'd', text: 'Antwort D', value: 10 }] }),

    normalize(q) { q.options = normalizeSurveyOptions(q.options || q.answers); },

    validate(q, report) {
      Kit.validateOptions(q, report);
      if ((q.options || []).some(o => !Number.isFinite(Number(o.value)) || Number(o.value) < 0 || Number(o.value) > 100)) report.error('options', 'Umfragewerte müssen Zahlen zwischen 0 und 100 sein.');
      const values = (q.options || []).map(option => Number(option.value) || 0);
      const sum = values.reduce((total, value) => total + value, 0);
      if (values.length && Math.max(...values) <= 0) report.error('options', 'Mindestens eine Umfrage-Antwort benötigt einen Wert größer als 0.');
      if (q.options?.length && (sum < 99 || sum > 101)) report.warn('options', `Umfragewerte ergeben ${Number(sum.toFixed(1))} %. Für eine saubere Auflösung sollten sie ungefähr 100 % ergeben.`);
    },

    score(q, answer, { base }) {
      const hit = winnerIds(q).includes(String(answer));
      const option = Kit.optionById(q, answer);
      return {
        points: hit ? base : 0,
        detail: hit ? `Publikums-Favorit${option ? ` · ${option.value}%` : ''}` : (option ? `${option.value}% der Befragten` : 'Keine gültige Auswahl')
      };
    },

    solutionText(q) {
      return winnerIds(q).map(id => { const option = Kit.optionById(q, id); return option ? `${option.text} (${option.value}%)` : id; }).join(' · ');
    },
    answerLabel(q, answer) { return Kit.optionById(q, answer)?.text || String(answer ?? ''); },
    // Prozentwerte erst bei der Auflösung an Spieler senden
    hideSolution(pq) { if (Array.isArray(pq.options)) pq.options = pq.options.map(option => ({ id: option.id, text: option.text })); },

    render(q, container, ctx) {
      const max = Math.max(1, ...(q.options || []).map(option => Number(option.value) || 0));
      Kit.renderChoice(q, container, ctx, {
        winners: winnerIds(q),
        detail: option => `<small>${Kit.escapeHTML(option.value)}%</small>`,
        strength: option => (Number(option.value) || 0) / max * 100,
        hint: '📊 Gesucht ist die häufigste Antwort aus der hinterlegten Publikums-Umfrage.'
      });
    },

    editor(q, ui, box) {
      box.append(ui.div('editor-help', 'Trage die Ergebnisse einer Umfrage in Prozent ein. Die Antwort mit dem höchsten Anteil ist die gesuchte Top-Antwort.'));
      Kit.choiceEditor(q, ui, box, 'survey');
    },
    stats: Kit.choiceStats,

    // Für andere Module/Views nutzbar
    winnerIds
  });
})();
