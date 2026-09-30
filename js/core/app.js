(function () {
  'use strict';

  const APP_VERSION = 'v35';

  const App = {
    version: APP_VERSION,
    qs(selector, root = document) { return root.querySelector(selector); },
    qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); },
    uid(prefix = 'id') {
      const random = (crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
      return `${prefix}_${random}`;
    },
    escapeHTML(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[char]);
    },
    sanitizeURL(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^(https?:|data:image\/|blob:)/i.test(raw)) return raw;
      if (/^(\.\.?\/|[a-zA-Z0-9_\-./%]+$)/.test(raw)) return raw;
      return '';
    },
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    readJSONFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(JSON.parse(reader.result)); }
          catch (error) { reject(new Error(`Ungültiges JSON: ${error.message}`)); }
        };
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsText(file, 'utf-8');
      });
    },
    downloadJSON(data, filename = 'quiz.json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    getParam(name) { return new URLSearchParams(location.search).get(name); },
    async copyText(value) {
      const text = String(value ?? '');
      if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
    },
    toast(message, type = 'info', timeout = 3600) {
      let stack = document.getElementById('toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
      }
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = message;
      stack.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));
      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 220);
      }, timeout);
    },
    setText(el, value) { if (el) el.textContent = value ?? ''; },
    formatPoints(value) { return `${Math.round(Number(value) || 0)} P`; },
    avatar(value) { return String(value || '🦊').slice(0, 4); }
  };

  function applyVersion() {
    document.querySelectorAll('[data-app-version]').forEach(el => { if (!String(el.textContent || '').trim()) el.textContent = APP_VERSION; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyVersion);
  else applyVersion();

  /**
   * v27: Rangliste neu zeichnen und Plätze sanft verschieben (FLIP).
   * Zeilen brauchen data-pid (Spieler) und data-rank. Wer aufsteigt, bekommt kurz „▲n“.
   */
  App.renderRanking = function (container, html) {
    if (!container || container.dataset.html === html) return;
    const before = new Map(Array.from(container.querySelectorAll('[data-pid]')).map(el => [el.dataset.pid, { top: el.getBoundingClientRect().top, rank: Number(el.dataset.rank) }]));
    container.dataset.html = html;
    container.innerHTML = html;
    if (!before.size) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.querySelectorAll('[data-pid]').forEach(el => {
      const prev = before.get(el.dataset.pid);
      if (!prev) return;
      const dy = prev.top - el.getBoundingClientRect().top;
      if (!calm && Math.abs(dy) > 1 && el.animate) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
      const up = prev.rank - Number(el.dataset.rank);
      if (up > 0) { el.dataset.climb = `▲${up}`; el.classList.add('is-climb'); setTimeout(() => el.classList.remove('is-climb'), 2400); }
    });
  };

  /**
   * v31: Rangliste mit Gleichstand. Gleiche Punkte = gleicher Platz (1, 1, 3 …).
   * → Kopie der Spieler, sortiert, jeweils mit place (Platz) und tied (teilt sich den Platz)
   */
  App.rankPlayers = function (players) {
    const sorted = (players || []).slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0));
    return sorted.map((player, i) => {
      const score = Number(player.score) || 0;
      const place = 1 + sorted.filter(o => (Number(o.score) || 0) > score).length;
      const tied = sorted.some((o, j) => j !== i && (Number(o.score) || 0) === score);
      return Object.assign({}, player, { place, tied });
    });
  };
  /** v31: Alle Spieler auf Platz 1 (bei Gleichstand mehrere) */
  App.winnersOf = ranked => (ranked || []).filter(p => p.place === 1);
  /** v31: „🏆 Anna gewinnt!“ bzw. „🤝 Gleichstand! Anna & Ben“ (HTML-sicher) */
  /** v31: Namen bei Gleichstand als eigene, kleinere Zeile unter dem Titel */
  App.winnerNames = winners => `<small class="final-names">${winners.slice(0, 4).map(p => App.escapeHTML(p.name)).join(' & ')}${winners.length > 4 ? ' …' : ''}</small>`;
  App.winnerTitle = function (ranked) {
    const winners = App.winnersOf(ranked);
    if (!winners.length) return '';
    if (winners.length > 1) return `🤝 Gleichstand! ${App.winnerNames(winners)}`;
    return `🏆 ${App.escapeHTML(winners[0].name)} gewinnt!`;
  };

  window.SchmobinApp = App;
})();
