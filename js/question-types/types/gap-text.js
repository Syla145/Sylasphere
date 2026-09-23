(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * Lückentext: Spieler tippen das fehlende Wort. Der Moderator prüft jede Antwort
   * (✓/✗), damit Rechtschreibung keine Rolle spielt. Exakte Treffer werden ihm
   * als „richtig“ vorgeschlagen. Nach der Auflösung sehen alle, was die anderen
   * geschrieben haben.
   */
  const GAP = /_{3,}/;

  function accepted(q) { return (q.correctAnswers || []).map(String).filter(s => s.trim()); }
  function matches(q, answer) {
    const given = Kit.normalizeTerm(answer);
    return Boolean(given) && accepted(q).some(solution => Kit.normalizeTerm(solution) === given);
  }

  window.SylasphereTypes.register({
    type: 'gap-text',
    label: 'Lückentext',
    icon: '✍',
    description: 'Fehlendes Wort eintippen – der Moderator bestätigt, Rechtschreibung ist egal.',
    review: 'manual',
    publishAnswers: true,

    defaults: () => ({ text: 'Die Hauptstadt von Australien ist ___.', correctAnswers: ['Canberra'] }),

    normalize(q) {
      let list = q.correctAnswers ?? q.answers ?? q.solutions ?? q.correctAnswer ?? q.solution ?? [];
      if (!Array.isArray(list)) list = String(list).split(/\n|\|/);
      q.correctAnswers = list.map(v => String(v).trim()).filter(Boolean);
      q.maxLength = Math.max(10, Math.min(200, Math.round(Kit.numberOr(q.maxLength, 80))));
    },

    validate(q, report) {
      if (!accepted(q).length) report.error('correctAnswers', 'Lückentext benötigt mindestens eine Lösung.');
      if (!GAP.test(q.text || '')) report.warn('text', 'Keine Lücke im Fragetext gefunden (___). Das Eingabefeld erscheint dann unter der Frage.');
    },

    // Vorschlag für den Moderator: exakter Treffer (ohne Groß-/Kleinschreibung) = richtig
    autoCheck: (q, answer) => (matches(q, answer) ? true : null),

    // Moderator hat entschieden: result.verdicts = { spielerId: true|false }
    resolve: (q, answers, options) => ({ kind: 'review', verdicts: Object.assign({}, options?.verdicts || {}) }),

    score(q, answer, { base, result, playerId }) {
      if (!String(answer ?? '').trim()) return { points: 0, detail: 'Keine Antwort' };
      const verdict = result?.verdicts ? result.verdicts[playerId] === true : matches(q, answer);
      return { points: verdict ? base : 0, detail: verdict ? 'Vom Moderator als richtig gewertet' : 'Als falsch gewertet' };
    },

    solutionText(q) {
      const list = accepted(q);
      return list.length > 1 ? `${list[0]} (auch: ${list.slice(1).join(', ')})` : (list[0] || '');
    },
    answerLabel: (q, answer) => String(answer ?? '').trim() || '–',

    render(q, container, ctx) {
      const { el } = Kit;
      const wrap = Kit.baseQuestion(q);
      const title = wrap.querySelector('.question-title');
      const parts = String(q.text || '').split(GAP);
      const answerText = String(ctx.currentAnswer ?? '').trim();
      if (parts.length > 1 && title) {
        title.replaceChildren();
        parts.forEach((part, i) => {
          title.append(document.createTextNode(part));
          if (i < parts.length - 1) {
            const blank = el('span', 'gap-blank');
            if (ctx.reveal && accepted(q)[0]) { blank.textContent = accepted(q)[0]; blank.classList.add('is-solution'); }
            else if (answerText && ctx.readOnly) blank.textContent = answerText;
            else blank.textContent = ' ';
            title.append(blank);
          }
        });
      }
      if (!ctx.readOnly) {
        const field = el('label', 'field-group gap-input-field');
        const input = document.createElement('input');
        input.className = 'input gap-input'; input.type = 'text'; input.maxLength = q.maxLength || 80;
        input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
        input.placeholder = 'Deine Antwort'; input.value = ctx.currentAnswer ?? '';
        input.addEventListener('input', () => ctx.onAnswer?.(input.value.trim() ? input.value : null));
        field.append(el('span', 'field-label', 'Deine Antwort'), input);
        wrap.append(field);
      } else if (answerText && parts.length < 2) {
        wrap.append(el('div', 'gap-own-answer', `Deine Antwort: ${answerText}`));
      }
      if (!ctx.reveal) wrap.append(el('p', 'question-hint', '✍ Rechtschreibung ist egal – der Moderator prüft jede Antwort.'));
      container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      box.append(ui.div('editor-help', 'Markiere die Lücke im Fragetext mit drei Unterstrichen: ___ . Beim Auflösen prüfst du als Moderator jede Antwort per ✓/✗ – exakte Treffer sind schon vorausgewählt.'));
      const area = document.createElement('textarea'); area.className = 'input textarea'; area.rows = 3;
      area.value = (q.correctAnswers || []).join('\n');
      area.addEventListener('input', e => { q.correctAnswers = e.target.value.split('\n').map(v => v.trim()).filter(Boolean); ui.queueSave(); });
      box.append(ui.labelField('Lösung – weitere erlaubte Schreibweisen je eine Zeile', area));
    }
  });
})();
