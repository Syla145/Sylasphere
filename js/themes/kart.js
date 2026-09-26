(function () {
  'use strict';
  /*
   * Theme „Mario Kart“ (id: kart) – Effekte (v29)
   * Startampel als Übergang, Zielflagge + Konfetti bei der Siegerehrung,
   * eigene Töne im Stil eines Rennspiels (im Browser erzeugt, keine Original-Sounds).
   */
  const sq = (s, f, at, d, v = 0.16, to = null) => s.tone({ f, at, d, type: 'square', v, to });
  window.SylasphereThemes.register({
    id: 'kart',
    decor: ['box1', 'box2', 'box3'],
    transition: {
      duration: 1500,
      html: (ctx, esc) => `<div class="kart-start"><div class="kart-lights"><i></i><i></i><i></i></div>${ctx.kicker ? `<small>${esc(ctx.kicker)}</small>` : ''}<strong>${esc(ctx.title)}</strong><span class="kart-go">${ctx.kind === 'round' ? 'LOS!' : esc(ctx.sub || 'Weiter geht’s!')}</span></div>`
    },
    ceremony: {
      effect: 'confetti',
      title: ({ role, place, winner, esc }) => role === 'player'
        ? (place === 1 ? '🏁 1. Platz!' : `🏁 ${place || '–'}. Platz`)
        : (winner ? `🏁 ${esc(winner.name)} gewinnt das Rennen!` : 'Rennen beendet'),
      extra: () => '<div class="kart-finish" aria-hidden="true"></div>'
    },
    sounds: {
      open: s => { sq(s, 523, 0, 0.1); sq(s, 784, 0.1, 0.18); },
      tick: s => sq(s, 880, 0, 0.05, 0.1),
      last: s => sq(s, 1175, 0, 0.1, 0.14),
      lock: s => { sq(s, 659, 0, 0.08); sq(s, 494, 0.08, 0.14); },
      correct: s => { sq(s, 1047, 0, 0.07, 0.14); sq(s, 1568, 0.07, 0.32, 0.14); },
      wrong: s => { sq(s, 330, 0, 0.12, 0.14, 220); sq(s, 196, 0.12, 0.22, 0.14, 130); },
      buzz: s => { for (let i = 0; i < 6; i++) sq(s, 700 + i * 90, i * 0.045, 0.04, 0.1); s.noise({ at: 0.28, d: 0.12, v: 0.1, hp: 2500 }); },
      turn: s => { sq(s, 784, 0, 0.08); sq(s, 1047, 0.1, 0.16); },
      reveal: s => { [523, 659, 784, 1047].forEach((f, i) => sq(s, f, i * 0.07, 0.22, 0.12)); },
      transition: s => { sq(s, 440, 0.25, 0.16, 0.12); sq(s, 440, 0.52, 0.16, 0.12); sq(s, 440, 0.79, 0.16, 0.12); sq(s, 880, 0.93, 0.4, 0.14); },
      fanfare: s => {
        [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [784, 0.62], [1047, 0.76]].forEach(([f, at], i, all) => sq(s, f, at, i === all.length - 1 ? 0.7 : 0.14, 0.14));
        [131, 196, 262].forEach((f, i) => s.tone({ f, at: i * 0.28, d: 0.3, type: 'triangle', v: 0.25 }));
        s.noise({ at: 0.76, d: 0.6, v: 0.08, hp: 4000 });
      }
    }
  });
})();
