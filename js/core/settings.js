(function () {
  'use strict';

  /*
   * Einstellungen (v26) – gelten nur für dieses Gerät
   * ------------------------------------------------------------------
   * ⚙️ oben rechts auf Spieler-, Zuschauer- und Moderator-Seite:
   *  - Design: wie im Quiz (Standard) oder ein eigenes Design für dieses Gerät
   *  - Musik: an/aus und Lautstärke (Song-Enthüllung, Audio-Quiz)
   * Soundeffekte folgen mit dem nächsten Schritt (Spielerlebnis) und bekommen hier einen eigenen Regler.
   * Gespeichert wird im Browser (localStorage) – nichts davon geht an andere Geräte.
   */
  const App = () => window.SchmobinApp;
  const Themes = () => window.SylasphereThemes;
  const Media = () => window.SylasphereMedia;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

  function button() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn settings-btn';
    btn.textContent = '⚙️';
    btn.title = 'Einstellungen für dieses Gerät';
    btn.setAttribute('aria-label', 'Einstellungen');
    btn.addEventListener('click', open);
    return btn;
  }

  function open() {
    const themes = Themes()?.list() || [];
    const media = Media();
    const backdrop = document.createElement('div');
    backdrop.className = 'preview-backdrop settings-backdrop';
    const box = document.createElement('div');
    box.className = 'panel settings-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Einstellungen');
    const device = Themes()?.deviceTheme?.() || '';
    box.innerHTML = `
      <div class="media-modal-head"><div><span class="eyebrow">⚙️ Nur dieses Gerät</span><h2>Einstellungen</h2></div><button type="button" class="icon-btn" data-close title="Schließen">✕</button></div>
      <section class="settings-section"><h3>🎨 Design</h3>
        <div class="settings-themes" role="radiogroup">
          <button type="button" class="theme-option settings-auto${device ? '' : ' is-selected'}" data-theme-choice="" role="radio" aria-checked="${!device}"><span class="theme-swatch settings-auto-swatch">Quiz</span><strong>Wie im Quiz</strong></button>
          ${themes.map(t => `<button type="button" class="theme-option${device === t.id ? ' is-selected' : ''}" data-theme-choice="${esc(t.id)}" role="radio" aria-checked="${device === t.id}" title="${esc(t.description)}"><span class="theme-swatch" style="background:${esc(t.swatch[0])}">${t.swatch.slice(1).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span><strong>${esc(t.name)}</strong></button>`).join('')}
        </div>
        <p class="microcopy">„Wie im Quiz“ übernimmt das Design, das der Moderator gewählt hat.</p>
      </section>
      <section class="settings-section"><h3>🎵 Musik</h3>
        ${media ? `<label class="settings-switch"><input type="checkbox" data-music-on ${media.enabled() ? 'checked' : ''}><span>Musik auf diesem Gerät abspielen</span></label>
        <div class="settings-slider"><span aria-hidden="true">🔈</span><input type="range" min="0" max="100" step="5" value="${media.volume()}" data-music-volume aria-label="Musik-Lautstärke"><span aria-hidden="true">🔊</span><b data-music-value>${media.volume()} %</b></div>
        <button type="button" class="btn btn--small" data-music-test>▶ Probehören</button>
        <p class="microcopy">Gilt für Song-Enthüllung und Audio-Fragen. Tipp für Streams: Auf dem Moderator-Rechner ausschalten, wenn der Ton schon über den Beamer läuft.</p>` : '<p class="microcopy">Auf dieser Seite wird keine Musik abgespielt.</p>'}
      </section>
      <section class="settings-section settings-soon"><h3>🔔 Soundeffekte</h3><p class="microcopy">Kommen mit dem nächsten Update – dann mit eigenem Regler hier.</p></section>`;
    backdrop.append(box);
    document.body.append(backdrop);
    const $ = sel => box.querySelector(sel);
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('[data-close]').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });

    box.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('[data-theme-choice]').forEach(x => { x.classList.toggle('is-selected', x === b); x.setAttribute('aria-checked', String(x === b)); });
      Themes()?.setDeviceTheme(b.dataset.themeChoice);
    }));
    if (media) {
      $('[data-music-on]').addEventListener('change', e => media.setEnabled(e.target.checked));
      $('[data-music-volume]').addEventListener('input', e => { const v = media.setVolume(e.target.value); $('[data-music-value]').textContent = `${v} %`; });
      $('[data-music-test]').addEventListener('click', async () => {
        await media.unlock();
        if (!media.enabled()) { media.setEnabled(true); $('[data-music-on]').checked = true; }
        const ok = await media.play('./assets/demo-tone.mp3', { offset: 0, duration: 1.2, fade: 0.3, volume: 1 });
        if (!ok) App()?.toast('Ton konnte nicht abgespielt werden.', 'error');
      });
    }
    setTimeout(() => $('[data-close]').focus(), 30);
  }

  function mount() {
    const header = document.querySelector('.app-header');
    if (!header || header.querySelector('.settings-btn') || document.body.dataset.settings === 'off') return;
    let actions = header.querySelector('.top-actions');
    if (!actions) { actions = document.createElement('div'); actions.className = 'top-actions'; header.append(actions); }
    actions.prepend(button());
  }
  document.addEventListener('DOMContentLoaded', mount);

  window.SylasphereSettings = { open, mount };
})();
