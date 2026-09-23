(function () {
  'use strict';

  /*
   * Verteiler: Zeigt eine Frage mit dem passenden Fragetyp-Modul an.
   * Die eigentliche Darstellung steckt in js/question-types/types/<typ>.js (render).
   */
  const Types = () => window.SylasphereTypes;
  const Kit = () => window.SylasphereTypeKit;

  function unsupported(question, container) {
    const box = document.createElement('div');
    box.className = 'empty-state';
    box.textContent = `Fragetyp „${question?.type || '?'}“ wird nicht unterstützt.`;
    container.replaceChildren(box);
  }

  function renderPlayer(question, container, context = {}) {
    const def = Types()?.get(question?.type);
    if (!def) return unsupported(question, container);
    def.render(question, container, Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: false, reveal: false, result: null }, context), Kit());
  }

  function renderModerator(question, container, context = {}) {
    const def = Types()?.get(question?.type);
    if (!def) return unsupported(question, container);
    const ctx = Object.assign({ onAnswer: () => {}, currentAnswer: null, readOnly: true, reveal: true, result: null }, context);
    if (def.moderatorAlwaysReveal) ctx.reveal = true;
    def.render(question, container, ctx, Kit());
  }

  /** Nach der Auflösung: Antworten aller Spieler (für Typen mit publishAnswers, z. B. Lückentext) */
  function answerEntriesHTML(entries, meId = '') {
    if (!Array.isArray(entries) || !entries.length) return '';
    const esc = window.SchmobinApp.escapeHTML;
    return `<div class="all-answers"><div class="all-answers-title">Alle Antworten</div>${entries.map(entry => `<div class="all-answers-row ${entry.correct ? 'is-right' : 'is-wrong'}${entry.playerId === meId ? ' is-me' : ''}"><span class="all-answers-mark">${entry.correct ? '✓' : '✗'}</span><strong>${esc(entry.name)}</strong><b>+${Math.round(entry.points || 0)}</b><span class="all-answers-text">${esc(entry.answer)}</span></div>`).join('')}</div>`;
  }

  window.SchmobinRenderers = { renderPlayer, renderModerator, answerEntriesHTML };
})();
