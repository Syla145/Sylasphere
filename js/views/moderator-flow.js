(function () {
  'use strict';

  /*
   * Moderator-Ablauf (v31) – welcher Schritt kommt als Nächstes? (ohne DOM, in Node getestet)
   * ------------------------------------------------------------------
   * Der große Knopf und die Leertaste machen immer denselben „nächsten Schritt“:
   *   Lobby → ▶ Spiel starten → ❓ Frage öffnen → ⏹ Antworten schließen → ✓ Auflösen → ➜ Nächste Frage
   *   … nach der letzten Frage → 🏁 Zur Siegerehrung · Spielende → 🔁 Nochmal spielen
   * Sonderfälle: Buzzer (Auflösen mit/ohne Gewinner), Mini-Spiele wie Zeitduell/Einordnen
   * (🎲 Spiel starten, danach steuert das Spiel selbst, am Ende ✓ Auflösen).
   *
   * facts: { status, players, hasQuestion, started, open, resolved, isLast, isFirst,
   *          isBuzzer, contender, isGame, gameRunning, gameDone }
   * → { key, label, disabled, hint, prev, skip, finish } (prev/skip/finish = { disabled })
   */
  function next(f) {
    const small = {
      prev: { disabled: f.status !== 'playing' || f.open || (f.started && !f.resolved) || f.isFirst },
      skip: { disabled: f.status !== 'playing' || (f.started && !f.resolved) || f.isLast },
      finish: { disabled: f.status !== 'playing' }
    };
    const step = (key, label, extra = {}) => Object.assign({ key, label, disabled: false, hint: '' }, small, extra);
    if (f.status === 'lobby') {
      return f.players ? step('start-game', '▶ Spiel starten', { hint: `${f.players} ${f.players === 1 ? 'Spieler ist' : 'Spieler sind'} da` })
        : step('start-game', '⏳ Warte auf Spieler …', { disabled: true, hint: 'QR-Code zeigen oder Link teilen' });
    }
    if (f.status === 'finished') return step('replay', '🔁 Nochmal spielen', { hint: 'Gleiche Spieler, Punkte auf 0' });
    if (!f.hasQuestion) return step('wait', 'Keine Frage', { disabled: true });
    if (f.resolved) return f.isLast ? step('finish', '🏁 Zur Siegerehrung') : step('next', '➜ Nächste Frage');
    if (!f.started) return step('open', '❓ Frage öffnen');
    if (f.isBuzzer) return f.contender ? step('resolve', '✅ Richtig & auflösen', { hint: 'Falsch? Rechts „❌ Falsch“ tippen' }) : step('resolve', 'Ohne Gewinner auflösen', { hint: 'Wartet auf den ersten Buzzer' });
    if (f.isGame) {
      if (!f.gameRunning && !f.gameDone) return step('game-start', '🎲 Spiel starten');
      if (!f.gameDone) return step('wait', '⏱ Spiel läuft …', { disabled: true, hint: 'Steuerung direkt an der Frage' });
      return step('resolve', '✓ Auflösen');
    }
    if (f.open) return step('close', '⏹ Antworten schließen');
    return step('resolve', '✓ Auflösen');
  }

  window.SylasphereModeratorFlow = { next };
})();
