(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  /*
   * Buzzer ist ein Sonderfall: Statt gleichzeitiger Antworten gewinnt der
   * schnellste Spieler, der Moderator wertet richtig/falsch und kann den Buzzer
   * neu freigeben. Dieser Ablauf (interaction: 'buzzer') steckt in den
   * Spiel-Engines; das Modul liefert Anzeige, Editor, Normalisierung usw.
   */
  window.SylasphereTypes.register({
    type: 'buzzer',
    label: 'Buzzer',
    icon: '⚡',
    description: 'Geschwindigkeit zählt: Der erste Spieler buzzert oder sendet eine Schnellantwort, der Moderator entscheidet.',
    interaction: 'buzzer',
    noTimer: true,

    defaults: () => ({ timer: 0, buzzerMode: 'spoken', solution: '', penalty: 0 }),

    normalize(q) {
      q.timer = 0;
      q.buzzerMode = String(q.buzzerMode || q.mode || 'spoken');
      q.solution = String(q.solution || q.correctAnswer || q.answer || '');
      q.penalty = Kit.numberOr(q.penalty, 0);
    },

    score(q, answer, { base }) {
      const solution = Kit.normalizeTerm(q.solution || '');
      const hit = Boolean(solution) && Kit.normalizeTerm(answer || '') === solution;
      return { points: hit ? base : 0, detail: hit ? 'Musterlösung getroffen' : 'Moderatorentscheidung' };
    },

    solutionText(q) { return q.solution || 'Moderatorentscheidung'; },
    answerLabel(q, answer) { return q.buzzerMode === 'spoken' ? 'Mündliche Antwort' : String(answer ?? ''); },

    render(question, container, ctx) {
      const { el, escapeHTML } = Kit;
      const wrap = Kit.baseQuestion(question);
      const state = ctx.result && ctx.result.kind === 'buzzer' ? ctx.result : { mode: question.buzzerMode || 'spoken', status: 'open', eliminatedIds: [] };
      const mode = state.mode || question.buzzerMode || 'spoken';
      const contenderName = state.contenderName || ctx.contenderName || '—';
      const me = ctx.playerId || '';
      const lockedByMe = me && state.contenderId && String(state.contenderId) === String(me);
      const eliminated = me && Array.isArray(state.eliminatedIds) && state.eliminatedIds.includes(String(me));
      wrap.append(el('p', 'question-hint', mode === 'spoken' ? '⚡ Der erste Buzzer gewinnt das Rederecht. Der Moderator entscheidet danach über richtig oder falsch.' : '⚡ Der erste Spieler mit Antwort gewinnt. Der Moderator prüft die Antwort manuell.'));
      const panel = el('div', 'buzzer-panel');
      if (ctx.reveal) {
        const winner = state.winnerName || contenderName || 'Kein Spieler';
        panel.innerHTML = '<div class="buzzer-state buzzer-state--resolved"><strong>' + (state.winnerId ? 'Gewertet' : 'Aufgelöst') + '</strong><span>' + escapeHTML(state.winnerId ? winner : 'Ohne Gewinner') + '</span>' + ((state.winnerAnswer != null && String(state.winnerAnswer).trim()) ? '<small>' + escapeHTML(String(state.winnerAnswer)) + '</small>' : '') + '</div>';
      } else if (state.status === 'locked') {
        const text = mode === 'spoken' ? (lockedByMe ? 'Du warst zuerst – antworte jetzt mündlich.' : contenderName + ' hat gebuzzert.') : (lockedByMe ? 'Du warst zuerst – deine Antwort wurde gesendet.' : contenderName + ' hat zuerst geantwortet.');
        panel.innerHTML = '<div class="buzzer-state buzzer-state--locked"><strong>Buzzer gesperrt</strong><span>' + escapeHTML(text) + '</span>' + ((mode === 'text' && state.contenderAnswer) ? '<small>Antwort: ' + escapeHTML(String(state.contenderAnswer)) + '</small>' : '') + '</div>';
      } else if (state.status === 'exhausted') {
        panel.innerHTML = '<div class="buzzer-state"><strong>Kein Spieler mehr frei</strong><span>Alle bisherigen Buzzer-Versuche wurden bereits ausgeschlossen.</span></div>';
      } else if (eliminated) {
        panel.innerHTML = '<div class="buzzer-state buzzer-state--blocked"><strong>Für diese Frage gesperrt</strong><span>Deine letzte Antwort war falsch. Warte auf die nächste Frage.</span></div>';
      } else {
        panel.innerHTML = '<div class="buzzer-state buzzer-state--open"><strong>Buzzer ist frei</strong><span>' + escapeHTML(mode === 'spoken' ? 'Drücke schnell den Buzzer und antworte dann mündlich.' : 'Schreibe deine Antwort und sende sie als Schnellantwort.') + '</span></div>';
      }
      wrap.append(panel);
      if (mode === 'text' && !ctx.readOnly && !ctx.reveal && !eliminated && state.status !== 'locked' && state.status !== 'exhausted') {
        const field = el('div', 'field-group');
        const input = document.createElement('textarea');
        input.className = 'input textarea'; input.rows = 4; input.placeholder = 'Deine Schnellantwort';
        input.value = ctx.currentAnswer || '';
        input.addEventListener('input', () => ctx.onAnswer?.(input.value));
        field.append(el('label', 'field-label', 'Schnellantwort'), input);
        wrap.append(field);
      }
      container.replaceChildren(wrap);
    },

    editor(q, ui, box) {
      const { div, input, labelField } = ui;
      box.append(div('editor-help', 'Speed-Frage ohne Zeitlimit: Der erste Spieler buzzert oder sendet eine Schnellantwort. Der Moderator prüft richtig/falsch manuell und kann den Buzzer bei Fehlern erneut freigeben.'));
      const grid = div('dynamic-grid');
      const mode = document.createElement('select'); mode.className = 'select';
      [['spoken', 'Mündliche Antwort nach dem Buzzer'], ['text', 'Erste Textantwort gewinnt']].forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = String(q.buzzerMode || 'spoken') === value; mode.append(option);
      });
      mode.addEventListener('change', e => { q.buzzerMode = e.target.value; ui.structuralChange(); });
      const solution = document.createElement('textarea'); solution.className = 'input textarea'; solution.rows = 3; solution.value = q.solution || ''; solution.placeholder = 'Optional: Musterlösung / Auflösung für Moderator und Reveal';
      solution.addEventListener('input', e => { q.solution = e.target.value; ui.queueSave(); });
      const penalty = input('number', q.penalty ?? 0, 'input'); penalty.min = '0'; penalty.step = '1'; penalty.addEventListener('input', e => { q.penalty = ui.nonNegative(e.target.value, 0); ui.queueSave(); });
      grid.append(labelField('Buzzer-Modus', mode), labelField('Punktabzug bei falscher Antwort (optional)', penalty));
      box.append(grid, labelField('Lösung / Hinweistext', solution));
    },

    stats: {
      aggregate(q, records, result) {
        return {
          kind: 'buzzer', total: records.length,
          winnerId: String(result?.winnerId || ''), winnerName: String(result?.winnerName || ''),
          contenderId: String(result?.contenderId || ''), contenderName: String(result?.contenderName || ''),
          status: String(result?.status || 'open')
        };
      },
      render: () => ''
    }
  });
})();
