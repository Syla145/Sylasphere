(function () {
  'use strict';

  /*
   * Nutzungs-Dashboard (v33) – Rechenlogik ohne DOM (in tests/v33 geprüft)
   * ------------------------------------------------------------------
   * 1. ownStats(): Zahlen aus der eigenen Datenbank (Uploads, Konten, Quizze, Räume …)
   * 2. Cloud Monitoring API (REST, direkt aus dem Browser): echte Google-Cloud-Zahlen.
   *    Das Zugriffstoken kommt aus der Google-Anmeldung des Admins (Scope monitoring.read)
   *    und bleibt nur im Speicher.
   * 3. evaluate(): Ampel gegen die Freikontingente aus usage-limits.js + grobe Kostenschätzung.
   */
  const DAY = 86400000;
  const MONITORING = 'https://monitoring.googleapis.com/v3/projects';
  const SCOPE = 'https://www.googleapis.com/auth/monitoring.read';

  // ---------------------------------------------------------------- Teil 1: eigene Daten
  const monthStart = (now = Date.now()) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  /**
   * input: { userMedia: { uid: { id: { size, createdAt } } }, moderators: { uid: { name } }, admins?: { uid: name },
   *          accounts: number, quizzes: number, games: number, rooms: number }
   */
  function ownStats(input = {}, now = Date.now()) {
    const since = monthStart(now);
    const names = Object.assign({}, ...Object.entries(input.moderators || {}).map(([uid, m]) => ({ [uid]: m?.name || m?.email || '' })), input.admins || {});
    const perUser = Object.entries(input.userMedia || {}).map(([uid, files]) => {
      const list = Object.values(files || {}).filter(f => f && typeof f === 'object');
      const bytes = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      const month = list.filter(f => Number(f.createdAt) >= since).reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      return { uid, name: names[uid] || `Konto ${uid.slice(0, 6)}…`, count: list.length, bytes, monthBytes: month };
    }).filter(u => u.count).sort((a, b) => b.bytes - a.bytes);
    return {
      uploads: { bytes: perUser.reduce((s, u) => s + u.bytes, 0), count: perUser.reduce((s, u) => s + u.count, 0), monthBytes: perUser.reduce((s, u) => s + u.monthBytes, 0), perUser },
      accounts: Number(input.accounts) || 0,
      moderators: Object.keys(input.moderators || {}).length,
      games: Number(input.games) || 0,
      quizzes: Number(input.quizzes) || 0,
      rooms: Number(input.rooms) || 0
    };
  }
  /** Gespielte Spiele aus modStats/<uid>/<quiz>/games */
  function countGames(modStats) {
    return Object.values(modStats || {}).reduce((sum, perQuiz) => sum + Object.values(perQuiz || {}).reduce((s, q) => s + (Number(q?.games) || 0), 0), 0);
  }

  // ---------------------------------------------------------------- Teil 2: Cloud Monitoring
  /** Cloud-Storage-Zugriffe in Class A / Class B einteilen (Löschen ist kostenlos) */
  function classify(method) {
    const m = String(method || '');
    if (/delete/i.test(m)) return 'free';
    if (/^(read|get)/i.test(m)) return 'B';
    return 'A';
  }
  /** Eine Abfrage pro Metrik: letzte 30 Tage in Tages-Schritten (bis jetzt) */
  function requestFor(item, projectId, now = Date.now()) {
    const params = new URLSearchParams();
    params.set('filter', `metric.type="${item.metric}"`);
    params.set('interval.startTime', new Date(now - 30 * DAY).toISOString());
    params.set('interval.endTime', new Date(now).toISOString());
    params.set('aggregation.alignmentPeriod', '86400s');
    params.set('aggregation.perSeriesAligner', item.kind === 'gauge' ? 'ALIGN_MAX' : 'ALIGN_SUM');
    params.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
    if (item.classify) params.append('aggregation.groupByFields', 'metric.label.method');
    return `${MONITORING}/${encodeURIComponent(projectId)}/timeSeries?${params.toString()}`;
  }
  const pointValue = p => Number(p?.value?.int64Value ?? p?.value?.doubleValue ?? 0) || 0;
  /** Antwort → Tageswerte [{ end, value }] aufsteigend; bei classify nur die passende Zugriffsklasse */
  function parseSeries(json, item) {
    const byEnd = new Map();
    (json?.timeSeries || []).forEach(series => {
      if (item.classify && classify(series?.metric?.labels?.method) !== item.classify) return;
      (series.points || []).forEach(p => {
        const end = Date.parse(p?.interval?.endTime || '') || 0;
        byEnd.set(end, (byEnd.get(end) || 0) + pointValue(p));
      });
    });
    return [...byEnd.entries()].sort((a, b) => a[0] - b[0]).map(([end, value]) => ({ end, value }));
  }
  /** Wert für den Zeitraum: aktueller Stand (gauge), Summe seit Monatsbeginn oder letzte 24 Std. */
  function periodValue(series, item, now = Date.now()) {
    if (!series.length) return 0;
    if (item.period === 'now') return series[series.length - 1].value;
    if (item.period === 'day') return series[series.length - 1].value;
    const since = monthStart(now);
    return series.filter(p => p.end > since).reduce((s, p) => s + p.value, 0);
  }
  /**
   * Alle Metriken abrufen. fetchFn = window.fetch (im Test nachgebaut).
   * Ergebnis: { values: { id: { value, series } }, errors: [{ id, status, message }] }
   */
  async function fetchMonitoring({ token, projectId, limits, fetchFn = fetch, now = Date.now() }) {
    const out = { values: {}, errors: [] };
    const cache = new Map(); // request_count nur einmal abfragen (Class A + B)
    for (const item of limits.items) {
      if (!item.metric) continue;
      const url = requestFor(item, projectId, now);
      try {
        if (!cache.has(url)) cache.set(url, (async () => {
          const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
          const json = await response.json().catch(() => ({}));
          if (!response.ok) throw Object.assign(new Error(json?.error?.message || `HTTP ${response.status}`), { status: response.status, reason: json?.error?.status || '' });
          return json;
        })());
        const json = await cache.get(url);
        const series = parseSeries(json, item);
        out.values[item.id] = { value: periodValue(series, item, now), series };
      } catch (error) {
        out.errors.push({ id: item.id, status: Number(error.status) || 0, reason: error.reason || '', message: String(error.message || error) });
      }
    }
    return out;
  }
  /** Verständliche Meldung für typische API-Fehler */
  function explainError(error) {
    const status = Number(error?.status) || 0;
    const text = `${error?.reason || ''} ${error?.message || ''}`;
    if (status === 401) return 'Die Google-Verbindung ist abgelaufen – bitte erneut „Mit Google Cloud verbinden“.';
    if (status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(text)) return 'Die Cloud Monitoring API ist im Projekt noch nicht aktiviert (siehe FIREBASE_SETUP.md, Abschnitt v33).';
    if (status === 403) return 'Keine Berechtigung für Cloud Monitoring. Ist dein Google-Konto Inhaber/Betrachter des Projekts?';
    if (status === 429) return 'Zu viele Abfragen – bitte eine Minute warten.';
    if (!status) return 'Keine Verbindung zur Google Cloud (Netzwerk oder Browser blockiert die Anfrage).';
    return `Google Cloud meldet: ${error?.message || status}`;
  }

  // ---------------------------------------------------------------- Teil 3: Ampel + Kosten
  function level(pct, warnAt = 0.7) { return pct >= 1 ? 'over' : pct >= warnAt ? 'warn' : 'ok'; }
  const LEVEL_TEXT = { ok: '✓ im Freikontingent', warn: '⚠ knapp', over: '⛔ über dem Freikontingent', none: '– keine Daten', manual: 'ℹ nur in der Konsole' };
  /** Kosten über dem Freikontingent in USD (Firestore: pro Tag, auf den Monat hochgerechnet über die Tageswerte) */
  function overageCost(item, entry, now = Date.now()) {
    if (!entry) return 0;
    const unitCost = item.price / item.per;
    if (item.period === 'day') {
      const since = monthStart(now);
      return entry.series.filter(p => p.end > since).reduce((s, p) => s + Math.max(0, p.value - item.free) * unitCost, 0);
    }
    return Math.max(0, entry.value - item.free) * unitCost;
  }
  function evaluate(limits, monitoring, now = Date.now()) {
    const items = limits.items.map(item => {
      const entry = monitoring?.values?.[item.id] || null;
      if (!entry) return Object.assign({}, item, { value: null, pct: null, level: item.kind === 'manual' ? 'manual' : 'none', costUsd: 0, series: [] });
      const pct = item.free > 0 ? entry.value / item.free : 0;
      const costUsd = overageCost(item, entry, now);
      return Object.assign({}, item, { value: entry.value, pct, level: level(pct, limits.warnAt), costUsd, series: entry.series });
    });
    const costUsd = items.reduce((s, i) => s + i.costUsd, 0);
    return { items, costUsd, costEur: costUsd * (Number(limits.usdToEur) || 1), worst: items.some(i => i.level === 'over') ? 'over' : items.some(i => i.level === 'warn') ? 'warn' : items.some(i => i.level === 'ok') ? 'ok' : 'none' };
  }

  // ---------------------------------------------------------------- Formatierung
  const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  function fmtBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${Math.round(b)} B`;
    const units = ['KB', 'MB', 'GB', 'TB']; let v = b / 1024; let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${nf.format(v)} ${units[i]}`;
  }
  const fmtCount = n => new Intl.NumberFormat('de-DE').format(Math.round(Number(n) || 0));
  const fmtValue = (item, v) => (item.unit === 'bytes' ? fmtBytes(v) : fmtCount(v));
  const fmtMoney = (v, currency = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
  const PERIOD_TEXT = { now: 'aktuell', month: 'seit Monatsbeginn', day: 'letzte 24 Std.' };

  window.SylasphereUsage = { SCOPE, DAY, monthStart, ownStats, countGames, classify, requestFor, parseSeries, periodValue, fetchMonitoring, explainError, level, LEVEL_TEXT, evaluate, overageCost, fmtBytes, fmtCount, fmtValue, fmtMoney, PERIOD_TEXT };
})();
