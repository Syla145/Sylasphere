(function () {
  'use strict';

  /*
   * spielmodi.html (v35): Galerie aller Spielmodi mit Filter nach Gruppe.
   * Pro Spielmodus: Kurzbeschreibung, So geht's, Punkte, Moderator-Tipps (einklappbar),
   * spielbare Demo (lokal, ohne Raum) und Vorschau Handy + Beamer.
   * Links: spielmodi.html#<id> öffnet einen Spielmodus, ?nur=a,b zeigt „In diesem Quiz“.
   */
  const App = window.SchmobinApp;
  const esc = value => App.escapeHTML(value);
  const $ = id => document.getElementById(id);
  let filter = 'all';
  let only = [];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await window.SylasphereTypes?.ready;
    const Modes = window.SylasphereModes;
    only = (new URLSearchParams(location.search).get('nur') || '').split(',').map(s => s.trim()).filter(id => Modes.get(id));
    if (only.length) filter = 'quiz';
    renderFilter();
    renderGrid();
    window.addEventListener('hashchange', openFromHash);
    openFromHash();
  }

  function renderFilter() {
    const Modes = window.SylasphereModes;
    const chips = [['all', '✨ Alle']];
    if (only.length) chips.push(['quiz', '🎯 In diesem Quiz']);
    Modes.GROUPS.forEach(g => chips.push([g.id, `${g.icon} ${g.id}`]));
    $('modes-filter').innerHTML = chips.map(([id, label]) => `<button type="button" class="chip modes-chip${filter === id ? ' is-active' : ''}" data-filter="${esc(id)}" aria-pressed="${filter === id}">${esc(label)}</button>`).join('');
    $('modes-filter').querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; renderFilter(); renderGrid(); }));
  }

  function visible() {
    const all = window.SylasphereModes.list();
    if (filter === 'quiz') return only.map(id => window.SylasphereModes.get(id)).filter(Boolean);
    return filter === 'all' ? all : all.filter(m => m.help.group === filter);
  }

  function renderGrid() {
    const list = visible();
    $('modes-grid').innerHTML = list.map(m => `<a class="panel mode-tile" href="#${esc(m.id)}" data-mode="${esc(m.id)}">
      <span class="mode-tile-icon" aria-hidden="true">${esc(m.icon)}</span>
      <span class="mode-tile-body"><strong>${esc(m.label)}</strong><small class="pill">${esc(m.help.group)}</small><span>${esc(m.help.short)}</span></span>
      <span class="mode-tile-go" aria-hidden="true">→</span></a>`).join('') || '<div class="empty-state">Keine Spielmodi in dieser Gruppe.</div>';
  }

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const mode = id ? window.SylasphereModes.get(id) : null;
    const detail = $('modes-detail');
    detail.querySelector('.mode-demo-host')?._stopDemo?.();
    if (!mode) { detail.hidden = true; detail.innerHTML = ''; $('modes-grid').hidden = false; $('modes-filter').hidden = false; return; }
    $('modes-grid').hidden = true; $('modes-filter').hidden = true;
    detail.hidden = false;
    detail.innerHTML = `<a class="link-btn modes-back" href="#">← Alle Spielmodi</a>
      <div class="panel panel-pad modes-detail-card">
        <div class="mode-card-head"><span class="mode-card-icon" aria-hidden="true">${esc(mode.icon)}</span><div><span class="eyebrow">${esc(mode.help.group)}</span><h2>${esc(mode.label)}</h2></div></div>
        <div class="modes-detail-grid">
          <div>${window.SylasphereModes.detailHTML(mode.id)}</div>
          <div class="modes-try"><h3>🕹️ Ausprobieren</h3><p class="microcopy">Lokal auf diesem Gerät, ohne Raum – nichts wird gespeichert.</p><div class="mode-demo-host"></div></div>
        </div>
        <details class="modes-preview"><summary>👀 So sieht es auf Handy und Beamer aus</summary><div class="mode-preview-host"></div></details>
      </div>`;
    window.SylasphereModeDemo.mountDemo(mode.id, detail.querySelector('.mode-demo-host'));
    const preview = detail.querySelector('.modes-preview');
    preview.addEventListener('toggle', () => { if (preview.open && !preview.dataset.done) { preview.dataset.done = '1'; window.SylasphereModeDemo.renderPreview(mode.id, detail.querySelector('.mode-preview-host')); } });
    window.scrollTo({ top: 0 });
  }
})();
