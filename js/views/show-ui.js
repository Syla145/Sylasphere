(function () {
  'use strict';

  /*
   * Show-Formate (v34) – gemeinsame Darstellung für Moderator, Beamer und Handy
   * Themen-Brett, gewähltes Feld (Zoom), Doppel-Feld, Einsatz-Finale.
   */
  const App = () => window.SchmobinApp;
  const S = () => window.SylasphereShow;
  const esc = v => App().escapeHTML(v);
  const player = (players, id) => (players || []).find(p => p.id === id) || null;
  const who = (players, id) => { const p = player(players, id); return p ? `${esc(App().avatar(p.avatar))} ${esc(p.name)}` : '–'; };

  /**
   * Brett als Raster. opts: { players, clickable (Felder als Knöpfe), selected (qid), showDoubles, compact }
   */
  function boardHTML(round, show, opts = {}) {
    const b = round.board;
    const byCell = new Map(S().cells(round).map(c => [`${c.t}:${c.v}`, c]));
    const used = show?.used || {};
    const cols = b.topics.length;
    let html = `<div class="show-board${opts.compact ? ' is-compact' : ''}" style="--cols:${cols};--rows:${b.values.length}">`;
    html += b.topics.map(t => `<div class="show-topic">${esc(t)}</div>`).join('');
    b.values.forEach((value, v) => {
      for (let t = 0; t < cols; t++) {
        const cell = byCell.get(`${t}:${v}`);
        if (!cell) { html += '<div class="show-cell is-empty"></div>'; continue; }
        const u = used[cell.qid];
        const current = show?.current?.qid === cell.qid;
        const double = opts.showDoubles && (show?.doubles || []).includes(cell.qid) && !u;
        if (u) {
          const p = player(opts.players, u.by);
          const mark = u.shared ? '👥 alle' : p ? `${esc(App().avatar(p.avatar))} <span>${esc(p.name)}</span>` : '';
          html += `<div class="show-cell is-used${u.correct ? ' is-right' : ' is-wrong'}" title="${esc(value)} · ${u.correct ? 'richtig' : 'falsch'}"><s>${esc(value)}</s>${mark ? `<em class="show-who">${mark}</em>` : ''}</div>`;
        } else if (opts.clickable) {
          html += `<button type="button" class="show-cell${current || opts.selected === cell.qid ? ' is-picked' : ''}" data-qid="${esc(cell.qid)}" aria-label="${esc(b.topics[t])} für ${esc(value)}">${esc(value)}${double ? '<small class="show-double">💎</small>' : ''}</button>`;
        } else {
          html += `<div class="show-cell${current ? ' is-picked' : ''}">${esc(value)}${double ? '<small class="show-double">💎</small>' : ''}</div>`;
        }
      }
    });
    return `${html}</div>`;
  }
  /** Kopfzeile: wer dran ist und wer danach */
  function turnHTML(show, players) {
    if (!show) return '';
    if (show.phase === 'shared') return '<div class="show-turn"><span class="show-chip is-now">👥 Letzte Felder – alle spielen mit</span></div>';
    if (show.phase === 'done') return '<div class="show-turn"><span class="show-chip is-now">✓ Brett fertig</span></div>';
    const next = S().nextUp(show);
    const by = show.current?.by || show.active;
    return `<div class="show-turn"><span class="show-chip is-now">${who(players, by)} ${show.phase === 'pick' ? 'ist dran' : show.phase === 'wager' ? 'setzt …' : 'antwortet'}</span>${next && show.phase === 'pick' ? `<span class="show-chip">danach: ${who(players, next)}</span>` : ''}</div>`;
  }
  /** Gewähltes Feld groß (vor dem Öffnen der Frage) */
  function zoomHTML(round, show, players, { me = '' } = {}) {
    const cur = show.current;
    const cell = S().cells(round).find(c => c.qid === cur.qid);
    const topic = cell ? round.board.topics[cell.t] : '';
    return `<div class="show-zoom${cur.double ? ' is-double' : ''}"><span class="eyebrow">${esc(topic)}${cur.shared ? ' · für alle' : ''}</span><strong>${esc(cur.value)}</strong>${cur.double ? `<div class="show-double-banner">💎 Doppel-Feld!</div>${cur.stake != null ? `<p>Einsatz: <b>${esc(cur.stake)} P</b></p>` : (me && me === cur.by ? '<p>Du setzt jetzt deinen Einsatz.</p>' : `<p>${who(players, cur.by)} setzt den Einsatz …</p>`)}` : ''}${cur.shared ? '<p>👥 Alle spielen mit – normale Wertung</p>' : `<span class="show-chip is-now">${who(players, cur.by)}</span>`}</div>`;
  }
  /** Zeile „Hätten es auch gewusst: …“ */
  function alsoRightHTML(boardResult, players) {
    if (!boardResult || boardResult.shared) return '';
    const ids = Array.isArray(boardResult.alsoRight) ? boardResult.alsoRight : Object.values(boardResult.alsoRight || {});
    return ids.length ? `<div class="notice show-also">🤓 Hätten es auch gewusst: ${ids.map(id => who(players, id)).join(', ')}</div>` : '';
  }
  /** Einsatz-Finale: Auflösung Spieler für Spieler (bis index) */
  function finalRevealHTML(rows, index, players, { big = false } = {}) {
    const list = Array.isArray(rows) ? rows : Object.values(rows || {});
    const row = list[Math.max(0, Math.min(index, list.length - 1))];
    if (!row) return '';
    const p = player(players, row.id);
    return `<div class="show-final${big ? ' is-big' : ''}"><span class="eyebrow">Einsatz-Finale · ${Math.min(index + 1, list.length)} von ${list.length} (vom Letzten zum Ersten)</span>
      <div class="show-final-who">${p ? esc(App().avatar(p.avatar)) : ''} <b>${esc(p?.name || 'Spieler')}</b></div>
      <div class="show-final-grid"><div><small>Antwort</small><b>${esc(row.answer)} ${row.correct ? '✓' : '✗'}</b></div><div><small>Einsatz</small><b>${esc(row.stake)} P</b></div><div><small>Punkte</small><b>${esc(row.before)} → <span class="${row.correct ? 'is-up' : row.stake ? 'is-down' : ''}">${esc(row.after)}</span></b></div></div></div>`;
  }

  /** Fortschritt im Brett: „Themen-Brett · 12 von 15 Feldern frei“ (Rundentitel nicht doppelt) */
  function progressText(round, show) {
    const title = String(round?.title || '').trim();
    const head = !title ? 'Themen-Brett' : /brett/i.test(title) ? title : `${title} · Themen-Brett`;
    const Show = window.SylasphereShow;
    if (!Show || !round || !show || show.kind !== 'board') return head;
    const total = Show.cells(round).length;
    const free = Show.freeCells(show, round).filter(c => c.qid !== show.current?.qid).length; // das gerade gespielte Feld zählt nicht mehr als frei
    return free ? `${head} · ${free} von ${total} Feldern frei` : `${head} · alle Felder gespielt`;
  }

  window.SylasphereShowUI = { boardHTML, turnHTML, zoomHTML, alsoRightHTML, finalRevealHTML, who, progressText };
})();
