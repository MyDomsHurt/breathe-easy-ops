/**
 * TD live job source: Firestore via shared/store.js when signed in.
 * Empty Firestore does not upload the archive; app.js falls back to jobs.json.
 */

import { createStore, createFirestoreAdapter } from '../../shared/store.js';
import { ensureFirebaseApp, shouldUseFirestore } from '../../shared/firebase-config.js';

window.BELoadLiveJobs = async function BELoadLiveJobs() {
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
      if (typeof window.BEOnJobsChanged === 'function') {
        window.BEOnJobsChanged(next);
      }
    });
    return store.listJobs();
  } catch (err) {
    console.warn('Live job store unavailable, using jobs.json', err);
    return null;
  }
};
