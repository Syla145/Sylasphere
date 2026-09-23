(function () {
  'use strict';

  const APP_VERSION = 'v19';

  const App = {
    version: APP_VERSION,
    qs(selector, root = document) { return root.querySelector(selector); },
    qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); },
    uid(prefix = 'id') {
      const random = (crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
      return `${prefix}_${random}`;
    },
    escapeHTML(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[char]);
    },
    sanitizeURL(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^(https?:|data:image\/|blob:)/i.test(raw)) return raw;
      if (/^(\.\.?\/|[a-zA-Z0-9_\-./%]+$)/.test(raw)) return raw;
      return '';
    },
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    readJSONFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(JSON.parse(reader.result)); }
          catch (error) { reject(new Error(`Ungültiges JSON: ${error.message}`)); }
        };
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsText(file, 'utf-8');
      });
    },
    downloadJSON(data, filename = 'quiz.json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    getParam(name) { return new URLSearchParams(location.search).get(name); },
    async copyText(value) {
      const text = String(value ?? '');
      if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
    },
    toast(message, type = 'info', timeout = 3600) {
      let stack = document.getElementById('toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
      }
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = message;
      stack.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));
      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 220);
      }, timeout);
    },
    setText(el, value) { if (el) el.textContent = value ?? ''; },
    formatPoints(value) { return `${Math.round(Number(value) || 0)} P`; },
    avatar(value) { return String(value || '🦊').slice(0, 4); }
  };

  function applyVersion() {
    document.querySelectorAll('[data-app-version]').forEach(el => { if (!String(el.textContent || '').trim()) el.textContent = APP_VERSION; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyVersion);
  else applyVersion();

  window.SchmobinApp = App;
})();
