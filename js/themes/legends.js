(function () {
  'use strict';
  /*
   * Theme „League of Legends“ (id: legends) – Effekte (v29)
   * Goldener Ring als Übergang, Sieges-Banner mit Lichtstrahlen, tiefer Gong,
   * Kristall-Klänge und eine Blechbläser-artige Fanfare (im Browser erzeugt, keine Original-Sounds).
   */
  const t = (s, f, at, d, type = 'sine', v = 0.2, to = null) => s.tone({ f, at, d, type, v, to });
  window.SylasphereThemes.register({
    id: 'legends',
    decor: ['bl', 'br'],
    transition: {
      duration: 1500,
      html: (ctx, esc) => `<div class="legends-ring"></div><div class="legends-card">${ctx.kicker ? `<small>${esc(ctx.kicker)}</small>` : ''}<strong>${esc(ctx.title)}</strong>${ctx.sub ? `<span>${esc(ctx.sub)}</span>` : ''}</div>`
    },
    ceremony: {
      effect: 'rays',
      before: ({ role, place }) => `<div class="legends-banner">${role === 'player' && place !== 1 ? 'Ergebnis' : 'Sieg'}</div>`,
      title: ({ role, place, winner, esc }) => role === 'player'
        ? (place === 1 ? 'Platz 1' : `Platz ${place || '–'}`)
        : (winner ? esc(winner.name) : 'Spiel beendet')
    },
    sounds: {
      open: s => { t(s, 98, 0, 1.4, 'sine', 0.35); t(s, 196, 0, 1.0, 'triangle', 0.14); t(s, 294, 0.02, 0.8, 'sine', 0.08); s.noise({ d: 0.3, v: 0.05, hp: 200 }); },
      tick: s => t(s, 1320, 0, 0.05, 'triangle', 0.12),
      last: s => t(s, 1760, 0, 0.09, 'triangle', 0.16),
      lock: s => { t(s, 392, 0, 0.25, 'triangle', 0.18); t(s, 262, 0.1, 0.4, 'sine', 0.2); },
      correct: s => { [1568, 2093, 2637].forEach((f, i) => t(s, f, i * 0.06, 0.6, 'sine', 0.13)); t(s, 784, 0, 0.5, 'triangle', 0.08); },
      wrong: s => { t(s, 110, 0, 0.35, 'sawtooth', 0.12, 80); s.noise({ d: 0.15, v: 0.06, hp: 300 }); },
      buzz: s => { t(s, 220, 0, 0.25, 'sawtooth', 0.1); t(s, 330, 0, 0.25, 'triangle', 0.12); },
      turn: s => { t(s, 988, 0, 0.12, 'sine', 0.2); t(s, 1480, 0.12, 0.3, 'sine', 0.18); },
      reveal: s => { [392, 440, 587, 659, 784].forEach((f, i) => t(s, f, i * 0.06, 0.7, 'triangle', 0.12)); t(s, 1568, 0.3, 0.8, 'sine', 0.1); },
      transition: s => { s.noise({ d: 0.6, v: 0.07, hp: 1200 }); t(s, 147, 0, 1.0, 'sine', 0.2); [1319, 1760, 2349].forEach((f, i) => t(s, f, 0.35 + i * 0.08, 0.5, 'sine', 0.06)); },
      fanfare: s => {
        const chord = (fs, at, d) => fs.forEach(f => { t(s, f, at, d, 'sawtooth', 0.05); t(s, f, at, d, 'triangle', 0.08); });
        chord([262, 330, 392], 0, 0.3); chord([294, 370, 440], 0.32, 0.3); chord([392, 494, 587], 0.64, 1.2);
        t(s, 98, 0.64, 1.4, 'sine', 0.3);
      }
    }
  });
})();
