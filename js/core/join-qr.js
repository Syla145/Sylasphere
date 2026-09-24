(function () {
  'use strict';

  /*
   * QR-Code zum Beitreten + „Bildschirm bleibt an“ (v23)
   * ------------------------------------------------------------------
   * QR: erzeugt ein SVG mit dem Spieler-Link (spieler.html?code=…). Die Bibliothek
   * (js/vendor/qrcode.js, MIT-Lizenz, Kazuhiko Arase) liegt im Projekt – es werden
   * keine fremden Server kontaktiert.
   * Wake Lock: hält den Bildschirm an, solange die Seite sichtbar ist (Spieler-Handys,
   * Beamer-Laptop, Moderator). Browser ohne Unterstützung ignorieren das einfach.
   */
  function joinUrl(code, mode) {
    const url = new URL('./spieler.html', location.href);
    url.search = '';
    url.searchParams.set('code', String(code || '').toUpperCase());
    if (mode) url.searchParams.set('mode', mode);
    return url.href;
  }

  /** SVG-Markup eines QR-Codes (schwarz auf weiß, skaliert mit dem Container) */
  function svg(text) {
    if (typeof window.qrcode !== 'function') return '';
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(String(text));
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR-Code zum Beitreten' });
    } catch (error) { console.warn('QR-Code konnte nicht erzeugt werden', error); return ''; }
  }

  /** Fertiger Block: QR + Code + kurzer Text */
  function joinCard(code, mode, { size = 'large', title = 'Scannen & mitspielen' } = {}) {
    const url = joinUrl(code, mode);
    const esc = window.SchmobinApp.escapeHTML;
    const shortUrl = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    return `<div class="join-qr join-qr--${size}"><div class="join-qr-code">${svg(url)}</div><div class="join-qr-text"><span class="eyebrow">${esc(title)}</span><strong class="join-qr-room">${esc(String(code || '').toUpperCase())}</strong><small>oder ${esc(shortUrl)} öffnen und den Code eingeben</small></div></div>`;
  }

  // ---------------------------------------------------------------- Bildschirm bleibt an
  let sentinel = null;
  let wanted = false;
  async function acquire() {
    if (!wanted || sentinel || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => { sentinel = null; });
    } catch (_) { sentinel = null; } // z. B. Energiesparmodus – dann eben nicht
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
  // Manche Browser erlauben es erst nach einer Berührung
  ['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, () => acquire(), { passive: true }));
  function keepAwake(on = true) {
    wanted = Boolean(on);
    if (wanted) acquire();
    else if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; }
  }

  window.SylasphereJoin = { joinUrl, svg, joinCard, keepAwake, isAwake: () => Boolean(sentinel) };
})();
