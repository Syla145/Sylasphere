(function () {
  'use strict';
  class TimerEngine {
    constructor(onTick, onEnd) {
      this.onTick = onTick || (() => {});
      this.onEnd = onEnd || (() => {});
      this.timer = null;
      this.endAt = 0;
      this.finished = false;
    }
    start(endAt) {
      this.stop();
      this.endAt = Number(endAt) || 0;
      this.finished = false;
      this.tick();
      this.timer = setInterval(() => this.tick(), 200);
    }
    tick() {
      if (!this.endAt) { this.onTick(null, null); return; }
      const remainingMs = Math.max(0, this.endAt - Date.now());
      const seconds = Math.ceil(remainingMs / 1000);
      this.onTick(seconds, remainingMs);
      if (remainingMs <= 0 && !this.finished) {
        this.finished = true;
        this.stop(false);
        this.onEnd();
      }
    }
    stop(reset = true) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (reset) { this.endAt = 0; this.finished = false; }
    }
  }
  window.SchmobinTimer = TimerEngine;
})();
