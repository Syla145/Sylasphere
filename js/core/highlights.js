(function () {
  'use strict';

  /*
   * Show-Ende mit Highlights (v27)
   * ------------------------------------------------------------------
   * Beim „Spiel beenden“ rechnet das Moderator-Gerät ein paar Auszeichnungen aus dem
   * kompletten Spielverlauf aus und speichert sie im Spielstand (state.highlights).
   * Spieler, Beamer und Moderator zeigen sie unter dem Siegerpodest.
   *
   *  🎯 Treffsicher        – bei den meisten Fragen gepunktet
   *  ⚡ Buzzer-König        – die meisten Buzzer-Fragen gewonnen
   *  📏 Knappste Schätzung  – am nächsten an einem Schätzwert (relativ zur Skala)
   *  🚀 Punkte-Rakete       – die meisten Punkte bei einer einzigen Frage
   *  🍀 Pechvogel des Abends – am häufigsten leer ausgegangen (augenzwinkernd)
   *  👑 Brett-König         – v34: die meisten Punkte auf eigenen Brett-Feldern
   *  🎲 Alles auf eine Karte – v34: höchster Einsatz im Einsatz-Finale
 *
 * v28: Jede Karte enthält die Spieler-IDs (ids) – jede Auszeichnung bringt 10 XP.
   */
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  const short = (text, n = 42) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

  function questionsOf(state) {
    const quiz = state?.quiz?.quiz || state?.quiz || {};
    return (quiz.rounds || []).flatMap(round => round.questions || []);
  }
  /** Spieler mit dem höchsten Wert (Gleichstand: bis zu 3 Namen) */
  function leaders(map, names, min = 1) {
    const entries = Object.entries(map).filter(([id, v]) => v >= min && names[id]);
    if (!entries.length) return null;
    const best = Math.max(...entries.map(([, v]) => v));
    const ids = entries.filter(([, v]) => v === best).map(([id]) => id);
    return { value: best, ids, names: ids.slice(0, 3).map(id => names[id]) };
  }

  function compute(state) {
    if (!state) return [];
    const names = Object.fromEntries((state.players || []).map(p => [p.id, p.name]));
    const questions = questionsOf(state);
    const scored = new Set(state.scoredQuestionIds || []);
    const hits = {}, zeros = {}, buzzer = {};
    let rocket = null, closest = null;
    questions.forEach(q => {
      if (!scored.has(q.id)) return;
      const answers = state.answers?.[q.id] || {};
      Object.entries(answers).forEach(([pid, record]) => {
        if (!names[pid] || !record) return;
        if (/^Mitgeraten/.test(String(record.scoreDetail || ''))) return; // v34: Mitraten im Brett zählt nicht
        const pts = Number(record.awardedPoints) || 0;
        if (pts > 0) hits[pid] = (hits[pid] || 0) + 1;
        else if (q.type !== 'buzzer') zeros[pid] = (zeros[pid] || 0) + 1;
        if (pts > 0 && (!rocket || pts > rocket.points)) rocket = { pid, points: pts, text: q.text };
      });
      const result = state.questionResults?.[q.id];
      if (q.type === 'buzzer' && result?.winnerId && names[result.winnerId]) buzzer[result.winnerId] = (buzzer[result.winnerId] || 0) + 1;
      if (q.type === 'estimate' && Number.isFinite(Number(q.correctAnswer))) {
        const range = Math.max(1e-9, Math.abs(Number(q.max) - Number(q.min)) || Math.abs(Number(q.correctAnswer)) || 1);
        Object.entries(answers).forEach(([pid, record]) => {
          const value = Number(record?.answer);
          if (!names[pid] || !Number.isFinite(value)) return;
          const rel = Math.abs(value - Number(q.correctAnswer)) / range;
          if (!closest || rel < closest.rel) closest = { pid, rel, value, target: Number(q.correctAnswer), unit: q.unit || '', text: q.text };
        });
      }
    });
    // v34: Brett-König + Einsatz-Finale
    const board = {}; let bold = null;
    questions.forEach(q => {
      const r = state.questionResults?.[q.id];
      if (r?.board && !r.board.shared && r.board.by && names[r.board.by] && Number(r.board.points) > 0) board[r.board.by] = (board[r.board.by] || 0) + Number(r.board.points);
      (Array.isArray(r?.final) ? r.final : Object.values(r?.final || {})).forEach(row => { if (names[row.id] && Number(row.stake) > 0 && (!bold || Number(row.stake) > bold.stake)) bold = { pid: row.id, stake: Number(row.stake), correct: row.correct }; });
    });
    const cards = [];
    const boardKing = leaders(board, names);
    if (boardKing) cards.push({ icon: '👑', title: 'Brett-König', names: boardKing.names, ids: boardKing.ids.slice(0, 3), detail: `${Math.round(boardKing.value)} P auf eigenen Brett-Feldern` });
    if (bold) cards.push({ icon: '🎲', title: 'Alles auf eine Karte', names: [names[bold.pid]], ids: [bold.pid], detail: `${Math.round(bold.stake)} P im Finale gesetzt – ${bold.correct ? 'und gewonnen!' : 'mutig verloren'}` });
    const played = questions.filter(q => scored.has(q.id)).length;
    const top = leaders(hits, names);
    if (top) cards.push({ icon: '🎯', title: 'Treffsicher', names: top.names, ids: top.ids.slice(0, 3), detail: `bei ${top.value} von ${played} Fragen gepunktet` });
    const king = leaders(buzzer, names);
    if (king) cards.push({ icon: '⚡', title: 'Buzzer-König', names: king.names, ids: king.ids.slice(0, 3), detail: `${king.value} ${king.value === 1 ? 'Buzzer-Frage' : 'Buzzer-Fragen'} gewonnen` });
    if (closest) cards.push({ icon: '📏', title: 'Knappste Schätzung', names: [names[closest.pid]], ids: [closest.pid], detail: closest.rel === 0 ? `exakt ${numberFormat.format(closest.target)}${closest.unit ? ` ${closest.unit}` : ''} bei „${short(closest.text)}“` : `${numberFormat.format(closest.value)} statt ${numberFormat.format(closest.target)}${closest.unit ? ` ${closest.unit}` : ''} bei „${short(closest.text)}“` });
    if (rocket) cards.push({ icon: '🚀', title: 'Punkte-Rakete', names: [names[rocket.pid]], ids: [rocket.pid], detail: `+${Math.round(rocket.points)} P bei „${short(rocket.text)}“` });
    const unlucky = leaders(zeros, names, 2);
    if (unlucky && played >= 3) cards.push({ icon: '🍀', title: 'Pechvogel des Abends', names: unlucky.names, ids: unlucky.ids.slice(0, 3), detail: `${unlucky.value}× leer ausgegangen – nächstes Mal!` });
    return cards.slice(0, 6);
  }

  function html(cards) {
    const list = Array.isArray(cards) ? cards : (cards && typeof cards === 'object' ? Object.values(cards) : []);
    if (!list.length) return '';
    const esc = window.SchmobinApp.escapeHTML;
    return `<div class="highlights"><span class="eyebrow">Highlights des Abends</span><div class="highlight-grid">${list.map((c, i) => {
      const names = Array.isArray(c.names) ? c.names : Object.values(c.names || {});
      return `<div class="highlight-card" style="--i:${i}"><span class="highlight-icon">${esc(c.icon)}</span><div><small>${esc(c.title)}</small><strong>${esc(names.join(' & '))}</strong><span>${esc(c.detail)}</span></div></div>`;
    }).join('')}</div></div>`;
  }

  window.SylasphereHighlights = { compute, html };
})();
