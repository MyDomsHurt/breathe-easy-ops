/**
 * Performance live job source: Firestore via shared/store.js when signed in.
 * Empty Firestore does not upload the archive; loadData falls back to JSON.
 */

import { createStore, createFirestoreAdapter } from '../shared/store.js';
import { ensureFirebaseApp, shouldUseFirestore } from '../shared/firebase-config.js';

window.BEApplyScoredData = function BEApplyScoredData(jobs) {
  if (typeof window.BEScoreJobs !== 'function') return null;
  const today = typeof window.BEScoreHktToday === 'function'
    ? window.BEScoreHktToday()
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return window.BEScoreJobs(jobs, today);
};

window.BELoadPerfJobs = async function BELoadPerfJobs() {
  try {
    ensureFirebaseApp();
    if (!shouldUseFirestore()) return null;
    const store = createStore({ adapter: createFirestoreAdapter() });
    await store.ready;
    window.BEJobStore = store;
    let usingLive = store.listJobs().length > 0;
    store.subscribe(function (event) {
      if (event.type === 'load') return;
      const next = store.listJobs();
      if (!usingLive && next.length === 0) return;
      usingLive = true;
      if (typeof window.BEOnPerfJobsChanged === 'function') {
        window.BEOnPerfJobsChanged(next);
      }
    });
    return store.listJobs();
  } catch (err) {
    console.warn('Live Performance store unavailable, using data.json', err);
    return null;
  }
};
