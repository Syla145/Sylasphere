(function () {
  'use strict';

  /*
   * Freikontingente und Preise für das Nutzungs-Dashboard (admin.html, v33)
   * ------------------------------------------------------------------
   * HIER ANPASSEN, wenn Google/Firebase die Preise oder Kontingente ändert.
   * Stand: Firebase-Preisseite (Blaze), Cloud Storage Bucket in US-CENTRAL1.
   * Preise in US-Dollar, grob gerundet – die echte Rechnung steht in der Google Cloud Console.
   *
   *   free   = Freikontingent (Bytes bzw. Anzahl) pro Zeitraum
   *   price  = Preis in USD pro „per“ Einheiten über dem Freikontingent
   *   period = 'now' (aktueller Stand), 'month' (seit Monatsbeginn), 'day' (letzte 24 Std.)
   */
  const GB = 1024 ** 3;
  const LIMITS = {
    usdToEur: 0.92,          // Umrechnung für die Kostenschätzung
    warnAt: 0.7,             // ab 70 % gelb, ab 100 % rot
    region: 'US-CENTRAL1',
    items: [
      { id: 'storage-stored', group: 'Cloud Storage (Uploads)', label: 'Gespeichert', metric: 'storage.googleapis.com/storage/total_bytes', kind: 'gauge', unit: 'bytes', period: 'now', free: 5 * GB, price: 0.02, per: GB, priceNote: 'pro GB und Monat' },
      { id: 'storage-download', group: 'Cloud Storage (Uploads)', label: 'Download', metric: 'storage.googleapis.com/network/sent_bytes_count', kind: 'delta', unit: 'bytes', period: 'month', free: 100 * GB, price: 0.12, per: GB, priceNote: 'pro GB' },
      { id: 'storage-class-a', group: 'Cloud Storage (Uploads)', label: 'Class-A-Zugriffe (Hochladen, Auflisten)', metric: 'storage.googleapis.com/api/request_count', kind: 'delta', unit: 'count', period: 'month', classify: 'A', free: 5000, price: 0.05, per: 10000, priceNote: 'pro 10.000' },
      { id: 'storage-class-b', group: 'Cloud Storage (Uploads)', label: 'Class-B-Zugriffe (Lesen)', metric: 'storage.googleapis.com/api/request_count', kind: 'delta', unit: 'count', period: 'month', classify: 'B', free: 50000, price: 0.004, per: 10000, priceNote: 'pro 10.000' },
      { id: 'rtdb-stored', group: 'Realtime Database (Räume, Quizze)', label: 'Gespeichert', metric: 'firebasedatabase.googleapis.com/storage/total_bytes', kind: 'gauge', unit: 'bytes', period: 'now', free: 1 * GB, price: 5, per: GB, priceNote: 'pro GB und Monat' },
      { id: 'rtdb-download', group: 'Realtime Database (Räume, Quizze)', label: 'Download', metric: 'firebasedatabase.googleapis.com/network/sent_bytes_count', kind: 'delta', unit: 'bytes', period: 'month', free: 10 * GB, price: 1, per: GB, priceNote: 'pro GB' },
      { id: 'firestore-reads', group: 'Firestore (Upload-Freigaben)', label: 'Lesezugriffe', metric: 'firestore.googleapis.com/document/read_count', kind: 'delta', unit: 'count', period: 'day', free: 50000, price: 0.06, per: 100000, priceNote: 'pro 100.000' },
      { id: 'firestore-writes', group: 'Firestore (Upload-Freigaben)', label: 'Schreibzugriffe', metric: 'firestore.googleapis.com/document/write_count', kind: 'delta', unit: 'count', period: 'day', free: 20000, price: 0.18, per: 100000, priceNote: 'pro 100.000' },
      { id: 'firestore-stored', group: 'Firestore (Upload-Freigaben)', label: 'Gespeichert', metric: '', kind: 'manual', unit: 'bytes', period: 'now', free: 1 * GB, price: 0.18, per: GB, priceNote: 'pro GB und Monat', note: 'Nicht per Monitoring abrufbar – bei Sylasphere nur ein paar Einträge (Upload-Freigaben).' }
    ],
    links: {
      billing: 'https://console.cloud.google.com/billing',
      budgets: 'https://console.cloud.google.com/billing/budgets',
      usage: 'https://console.firebase.google.com/project/jh-quiz/usage',
      pricing: 'https://firebase.google.com/pricing'
    }
  };
  window.SylasphereUsageLimits = LIMITS;
})();
