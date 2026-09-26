(function () {
  'use strict';
  /*
   * Theme „Valorant“ (id: tactical) – Effekte (v29)
   * Diagonaler Wisch als Übergang, MVP-Karte bei der Siegerehrung,
   * digitale Ticks und kräftige Synth-Töne (im Browser erzeugt, keine Original-Sounds).
   */
  const t = (s, f, at, d, type = 'square', v = 0.12, to = null) => s.tone({ f, at, d, type, v, to });
  window.SylasphereThemes.register({
    id: 'tactical',
    decor: ['slash', 'slash2', 'bracket'],
    transition: {
      duration: 1300,
      html: (ctx, esc) => `<div class="tactical-wipe"></div><div class="tactical-text">${ctx.kicker ? `<small>${esc(ctx.kicker)}</small>` : ''}<strong>${esc(ctx.kind === 'round' ? `Runde ${ctx.round}` : ctx.title)}</strong>${ctx.kind === 'round' ? `<span>${esc(ctx.title)}</span>` : (ctx.sub ? `<span>${esc(ctx.sub)}</span>` : '')}</div>`
    },
    ceremony: {
      effect: 'none',
      title: ({ role, place, winner, esc }) => role === 'player'
        ? (place === 1 ? 'Sieg' : `Platz ${place || '–'}`)
        : (winner ? 'Sieg' : 'Match beendet'),
      extra: ({ winner, esc, avatar, points }) => winner
        ? `<div class="tactical-mvp"><span class="tactical-mvp-tag">MVP</span><div class="podium-avatar">${avatar(winner.avatar)}</div><strong>${esc(winner.name)}</strong><span>${points(winner.score)}</span></div>`
        : ''
    },
    sounds: {
      open: s => { t(s, 300, 0, 0.14, 'sawtooth', 0.08, 1200); t(s, 1760, 0.14, 0.06, 'square', 0.1); },
      tick: s => t(s, 2000, 0, 0.03, 'square', 0.08),
      last: s => { t(s, 2400, 0, 0.04, 'square', 0.1); t(s, 2400, 0.08, 0.04, 'square', 0.1); },
      lock: s => { t(s, 880, 0, 0.05); t(s, 440, 0.06, 0.12, 'sawtooth', 0.08); },
      correct: s => { [440, 554, 659].forEach(f => t(s, f, 0, 0.3, 'sawtooth', 0.06)); t(s, 1319, 0.02, 0.25, 'square', 0.06); s.noise({ d: 0.12, v: 0.12, hp: 2500 }); },
      wrong: s => { t(s, 120, 0, 0.3, 'sawtooth', 0.14, 90); t(s, 123, 0, 0.3, 'square', 0.06); },
      buzz: s => { t(s, 1500, 0, 0.07, 'square', 0.12); t(s, 1500, 0.1, 0.07, 'square', 0.12); },
      turn: s => { t(s, 1320, 0, 0.06); t(s, 1760, 0.08, 0.1); },
      reveal: s => { s.noise({ d: 0.25, v: 0.1, hp: 1500 }); [330, 494, 659, 988].forEach((f, i) => t(s, f, 0.05 + i * 0.05, 0.35, 'sawtooth', 0.05)); },
      transition: s => { s.noise({ d: 0.45, v: 0.1, hp: 900 }); t(s, 200, 0, 0.35, 'sawtooth', 0.06, 800); t(s, 1760, 0.36, 0.05, 'square', 0.08); },
      fanfare: s => {
        const hit = (fs, at, d) => fs.forEach(f => t(s, f, at, d, 'sawtooth', 0.05));
        hit([220, 330, 440], 0, 0.22); hit([247, 370, 494], 0.25, 0.22); hit([294, 440, 587], 0.5, 1.1);
        s.noise({ at: 0.5, d: 0.3, v: 0.12, hp: 1800 }); t(s, 73, 0.5, 1.0, 'sine', 0.3);
      }
    }
  });
})();
