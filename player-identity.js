(function () {
  'use strict';

  const LEGACY_PREFIX = 'schmobin:player:';
  const CHANNEL_PREFIX = 'jhquiz:player-presence:';

  function uid(prefix = 'tab') {
    if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }

  class PlayerIdentity {
    constructor(code) {
      this.code = String(code || '').toUpperCase();
      this.storageKey = `${LEGACY_PREFIX}${this.code}`;
      this.tabId = uid('tab'); // deliberately memory-only: duplicated tabs must get a new id
      this.playerId = '';
      this.channel = null;
    }

    storedPlayerId() {
      return sessionStorage.getItem(this.storageKey) || '';
    }

    async reusablePlayerId(timeout = 180) {
      const candidate = this.storedPlayerId();
      if (!candidate) return '';

      // Without BroadcastChannel we prefer safety for local multiplayer: a manual join
      // becomes a new player instead of risking that another tab is overwritten.
      if (typeof BroadcastChannel !== 'function') return '';

      const requestId = uid('probe');
      const probe = new BroadcastChannel(`${CHANNEL_PREFIX}${this.code}`);

      return new Promise(resolve => {
        let settled = false;
        const finish = value => {
          if (settled) return;
          settled = true;
          try { probe.close(); } catch (_) {}
          resolve(value);
        };

        probe.onmessage = event => {
          const msg = event.data || {};
          if (
            msg.type === 'presence-response' &&
            msg.requestId === requestId &&
            msg.playerId === candidate &&
            msg.tabId !== this.tabId
          ) finish('');
        };

        try {
          probe.postMessage({
            type: 'presence-probe',
            requestId,
            playerId: candidate,
            tabId: this.tabId
          });
        } catch (_) {
          finish('');
          return;
        }

        // No other live tab claimed the id: treat it as a reload/reconnect of this player.
        setTimeout(() => finish(candidate), timeout);
      });
    }

    activate(playerId) {
      this.playerId = String(playerId || '');
      sessionStorage.setItem(this.storageKey, this.playerId);
      // Old builds stored player identity globally. Remove that shared key forever.
      localStorage.removeItem(this.storageKey);

      try { this.channel?.close(); } catch (_) {}
      this.channel = null;
      if (!this.playerId || typeof BroadcastChannel !== 'function') return;

      this.channel = new BroadcastChannel(`${CHANNEL_PREFIX}${this.code}`);
      this.channel.onmessage = event => {
        const msg = event.data || {};
        if (
          msg.type === 'presence-probe' &&
          msg.playerId === this.playerId &&
          msg.tabId !== this.tabId
        ) {
          try {
            this.channel.postMessage({
              type: 'presence-response',
              requestId: msg.requestId,
              playerId: this.playerId,
              tabId: this.tabId
            });
          } catch (_) {}
        }
      };
    }

    destroy() {
      try { this.channel?.close(); } catch (_) {}
      this.channel = null;
    }
  }

  window.JHQuizPlayerIdentity = PlayerIdentity;
})();
