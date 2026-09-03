/**
 * Firestore jobs adapter — live store for signed-in office + TD.
 *
 * Project: breathe-easy-performance
 * Collection: jobs
 * Document id: job.job_id
 * Body: canonical job (shared/job-model.md)
 *
 * Per-document writes only. Do not save the whole archive on every
 * upsert. Bulk import is explicit (adapter.importJobs).
 *
 * Reuses the existing web app; no new Firebase project, no service account.
 */

import { JOBS_COLLECTION } from './firebase-config.js';
import { normalizeJob } from './job.js';

const BATCH_LIMIT = 400;

export function createFirestoreAdapter(options = {}) {
  const collectionName = options.collection || JOBS_COLLECTION;

  function col() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
      throw new Error('Firebase Firestore SDK is not loaded');
    }
    if (!firebase.apps.length) {
      throw new Error('Firebase is not initialised');
    }
    return firebase.firestore().collection(collectionName);
  }

  return {
    name: 'firestore',
    collection: collectionName,

    async load() {
      const snap = await col().get();
      return snap.docs.map(docToJob);
    },

    async upsert(job) {
      if (!job || !job.job_id) return;
      await col().doc(String(job.job_id)).set(toFirestore(job), { merge: true });
    },

    async remove(job, { hard } = {}) {
      const id = job && job.job_id;
      if (!id) return;
      if (hard) {
        await col().doc(String(id)).delete();
        return;
      }
      await col().doc(String(id)).set(toFirestore({ ...job, deleted: true }), { merge: true });
    },

    async importJobs(jobs) {
      const list = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.job_id);
      const db = firebase.firestore();
      const ref = col();
      for (let i = 0; i < list.length; i += BATCH_LIMIT) {
        const chunk = list.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const job of chunk) {
          batch.set(ref.doc(String(job.job_id)), toFirestore(job), { merge: true });
        }
        await batch.commit();
      }
    },

    /** Full replace is not used — would spam-write the archive. */
    save() {
      return Promise.resolve();
    },

    subscribeRemote(onChange) {
      if (typeof onChange !== 'function') return () => {};
      return col().onSnapshot(
        (snap) => {
          onChange(snap.docs.map(docToJob));
        },
        (err) => {
          console.error('Firestore jobs snapshot failed', err);
        }
      );
    },
  };
}

function docToJob(doc) {
  const data = doc.data() || {};
  return normalizeJob({ ...data, job_id: data.job_id || doc.id });
}

function toFirestore(job) {
  const out = {};
  Object.keys(job || {}).forEach((key) => {
    const value = job[key];
    if (value === undefined) return;
    out[key] = value;
  });
  return out;
}
