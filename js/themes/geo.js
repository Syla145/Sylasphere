(function () {
  'use strict';
  /*
   * Theme „GeoGuessr“ (id: geo) – Effekte (v29)
   * Nadel fällt auf die Karte als Übergang, Ergebnis-Balken bei der Siegerehrung,
   * weiche Marimba-/Plopp-Töne (im Browser erzeugt, keine Original-Sounds).
   */
  const t = (s, f, at, d, type = 'sine', v = 0.25, to = null) => s.tone({ f, at, d, type, v, to });
  window.SylasphereThemes.register({
    id: 'geo',
    decor: ['pin1', 'pin2', 'compass'],
    transition: {
      duration: 1400,
      html: (ctx, esc) => `<div class="geo-drop"><i class="geo-pin"></i>${ctx.kicker ? `<small>${esc(ctx.kicker)}</small>` : ''}<strong>${esc(ctx.title)}</strong>${ctx.sub ? `<span>📍 ${esc(ctx.sub)}</span>` : ''}</div>`
    },
    ceremony: {
      effect: 'confetti',
      title: ({ role, place, winner, esc }) => role === 'player'
        ? (place === 1 ? '📍 Volltreffer – Platz 1!' : `📍 Platz ${place || '–'}`)
        : (winner ? `📍 ${esc(winner.name)} liegt goldrichtig!` : 'Spiel beendet'),
      extra: ({ ranked, esc, points }) => {
        const top = ranked.slice(0, 3);
        const best = Math.max(1, ...top.map(p => Number(p.score) || 0));
        return `<div class="geo-bars">${top.map((p, i) => `<div class="geo-bar"><strong>${i + 1}. ${esc(p.name)}</strong><b>${points(p.score)}</b><div class="geo-track"><span style="--w:${Math.max(2, Math.round((Math.max(0, Number(p.score) || 0) / best) * 100))}%"></span></div></div>`).join('')}</div>`;
      }
    },
    sounds: {
      open: s => t(s, 620, 0, 0.18, 'sine', 0.3, 300),
      tick: s => t(s, 1500, 0, 0.03, 'sine', 0.14),
      last: s => t(s, 1900, 0, 0.06, 'sine', 0.18),
      lock: s => { t(s, 523, 0, 0.12, 'sine', 0.25); t(s, 392, 0.1, 0.18, 'sine', 0.25); },
      correct: s => { t(s, 784, 0, 0.25, 'sine', 0.3); t(s, 1175, 0.1, 0.4, 'sine', 0.28); t(s, 1568, 0.1, 0.3, 'triangle', 0.06); },
      wrong: s => { t(s, 300, 0, 0.18, 'sine', 0.3, 200); t(s, 200, 0.14, 0.25, 'sine', 0.25, 150); },
      buzz: s => { t(s, 880, 0, 0.08, 'triangle', 0.2); t(s, 660, 0.08, 0.14, 'triangle', 0.2); },
      turn: s => { t(s, 660, 0, 0.1, 'sine', 0.28); t(s, 990, 0.1, 0.22, 'sine', 0.28); },
      reveal: s => { for (let i = 0; i < 10; i++) t(s, 700 + i * 70, i * 0.045, 0.04, 'sine', 0.12); t(s, 1568, 0.48, 0.5, 'sine', 0.22); t(s, 2093, 0.52, 0.5, 'sine', 0.12); },
      transition: s => { t(s, 1400, 0, 0.45, 'sine', 0.1, 500); t(s, 520, 0.55, 0.16, 'sine', 0.3, 260); },
      fanfare: s => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => t(s, f, i * 0.09, 0.45, 'sine', 0.22)); [262, 392].forEach((f, i) => t(s, f, 0.54 + i * 0.02, 0.9, 'triangle', 0.14)); }
    }
  });
})();
