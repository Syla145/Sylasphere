(function () {
  'use strict';

  /*
   * Emoji-Reaktionen (v27)
   * ------------------------------------------------------------------
   * Spieler tippen am Handy auf ein Emoji – es fliegt auf dem Beamer (Zuschauer-Seite)
   * und beim Moderator mit dem Spielernamen nach oben.
   * Höchstens etwa eine Reaktion pro Sekunde und Spieler (online zusätzlich vom Server begrenzt).
   * Ein- und ausschaltbar in ⚙️ (Leiste am Handy bzw. Anzeige auf dem Bildschirm).
   *
   * Später (Roadmap „XP & Stufen“): weitere Emotes werden mit höherer Stufe freigeschaltet –
   * dafür ist EMOJIS die Grundausstattung, zusätzliche kommen dann pro Konto dazu.
   */
  const EMOJIS = ['👏', '😂', '😮', '🔥', '😭', '🤯', '🎉', '👀'];
  const COOLDOWN_MS = 1200;
  const MAX_FLYING = 28;
  const on = () => window.SylasphereSettings?.reactionsOn?.() ?? true;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

  /** Leiste am Handy. send(emoji) → Promise<boolean> */
  function attachBar(host, send) {
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.className = 'reaction-bar';
    host.setAttribute('aria-label', 'Reaktionen');
    host.innerHTML = EMOJIS.map(e => `<button type="button" class="reaction-btn" data-emoji="${esc(e)}" aria-label="Reaktion ${esc(e)}">${esc(e)}</button>`).join('');
    let busy = false;
    host.addEventListener('click', async event => {
      const button = event.target.closest('[data-emoji]');
      if (!button || busy) return;
      busy = true;
      host.classList.add('is-cooling');
      const burst = document.createElement('span');
      burst.className = 'reaction-burst';
      burst.textContent = button.dataset.emoji;
      button.append(burst);
      setTimeout(() => burst.remove(), 700);
      try { await send(button.dataset.emoji); } catch (_) {}
      setTimeout(() => { busy = false; host.classList.remove('is-cooling'); }, COOLDOWN_MS);
    });
    const sync = () => { host.hidden = !on(); };
    document.addEventListener('sylasphere:settings', sync);
    sync();
  }

  /** Bühne für fliegende Reaktionen (Beamer, Moderator). nameOf(playerId) → Name */
  let stage = null;
  function show({ playerId, emoji }, nameOf = () => '') {
    if (!on() || !emoji) return;
    if (!stage || !stage.isConnected) { stage = document.createElement('div'); stage.className = 'reaction-stage'; stage.setAttribute('aria-hidden', 'true'); document.body.append(stage); }
    if (stage.childElementCount >= MAX_FLYING) stage.firstElementChild?.remove();
    const node = document.createElement('div');
    node.className = 'reaction-fly';
    const name = nameOf(playerId);
    node.innerHTML = `<span class="reaction-emoji">${esc(emoji)}</span>${name ? `<span class="reaction-name">${esc(name)}</span>` : ''}`;
    node.style.setProperty('--x', `${Math.round(Math.random() * 80 + 10)}%`);
    node.style.setProperty('--drift', `${Math.round(Math.random() * 60 - 30)}px`);
    node.style.setProperty('--dur', `${(2.6 + Math.random() * 1.2).toFixed(2)}s`);
    stage.append(node);
    node.addEventListener('animationend', () => node.remove());
    setTimeout(() => node.remove(), 5000);
  }

  window.SylasphereReactions = { EMOJIS, attachBar, show, COOLDOWN_MS };
})();
