(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  const MIN_VOTES = 2;
  // Zählt alle Antworten und bestimmt die Mehrheit. Wird beim Auflösen einmal berechnet.
  function computeResult(q, submissions) {
    const counts = {};
    (q.options || []).forEach(option => { counts[String(option.id)] = 0; });
    Object.values(submissions || {}).forEach(record => {
      const id = String(record?.answer ?? '');
      if (Object.prototype.hasOwnProperty.call(counts, id)) counts[id] += 1;
    });
    const values = Object.values(counts);
    const maxVotes = values.length ? Math.max(...values) : 0;
    // v32: Mehrheit erst ab 2 Stimmen – wählen alle unterschiedlich (auch 1:1), gibt es keine Punkte
    const noMajority = maxVotes < MIN_VOTES;
    const winningOptionIds = noMajority ? [] : Object.keys(counts).filter(id => counts[id] === maxVotes);
    return { counts, maxVotes, totalVotes: values.reduce((sum, value) => sum + value, 0), winningOptionIds, noMajority };
  }

  window.SylasphereTypes.register({
    type: 'consensus',
    label: 'Gleich gedacht',
    icon: '◎',
    description: 'Es gibt kein Vorwissen: Punkte gibt es für die Antwort der Mehrheit (mindestens 2 Stimmen).',
    solutionLabel: 'Mehrheit',

    defaults: () => ({ options: Kit.defaultOptions() }),

    normalize(q) {
      q.options = Kit.normalizeOptions(q.options || q.answers);
      if (q.correctAnswer == null && q.correct != null) q.correctAnswer = q.correct;
    },

    validate(q, report) { Kit.validateOptions(q, report); },

    // Wird beim Auflösen mit allen Antworten aufgerufen; das Ergebnis landet in questionResults
    resolve: (q, submissions) => computeResult(q, submissions),

    score(q, answer, { base, result }) {
      if (!result) return { points: 0, detail: '' };
      if (result.noMajority || !(result.winningOptionIds || []).length) return { points: 0, detail: 'Keine Mehrheit – alle haben unterschiedlich gewählt' };
      const won = result.winningOptionIds.includes(String(answer));
      const tie = result.winningOptionIds.length > 1 ? ' · Gleichstand' : '';
      return {
        points: won ? base : 0,
        detail: won ? `Mehrheit getroffen · ${result.maxVotes}/${result.totalVotes} Stimmen${tie}` : `Nicht in der Mehrheit · ${result.maxVotes}/${result.totalVotes} Stimmen${tie}`
      };
    },

    solutionText(q, result) {
      const ids = result?.winningOptionIds || [];
      if (result && (result.noMajority || !ids.length) && Number(result.totalVotes) > 0) return 'Keine Mehrheit';
      return ids.length ? ids.map(id => Kit.optionById(q, id)?.text || id).join(' · ') : 'Mehrheit entscheidet';
    },
    moderatorSolution: () => ({ text: 'Keine feste Lösung – die Mehrheit der Spielerantworten entscheidet.' }),
    answerLabel(q, answer) { return Kit.optionById(q, answer)?.text || String(answer ?? ''); },

    render(q, container, ctx) {
      const counts = ctx.result?.counts || {};
      Kit.renderChoice(q, container, ctx, {
        winners: (ctx.result?.winningOptionIds || []).map(String),
        detail: option => { const n = Math.round(Number(counts[option.id]) || 0); return `<small>${n} Stimme${n === 1 ? '' : 'n'}</small>`; },
        hint: '🎯 Ziel: Wähle die Antwort, von der du glaubst, dass die meisten anderen sie ebenfalls wählen.'
      });
    },

    editor(q, ui, box) {
      box.append(ui.div('editor-help', 'Keine richtige Antwort nötig: Beim Auflösen wertet Sylasphere aus, welche Option die meisten Spieler gewählt haben. Punkte gibt es nur, wenn die Mehrheit mindestens 2 Stimmen hat; bei Gleichstand bekommen alle Mehrheitsgruppen Punkte.'));
      Kit.choiceEditor(q, ui, box, 'consensus');
    },
    stats: Kit.choiceStats,

    computeResult
  });
})();
