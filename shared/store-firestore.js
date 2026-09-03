/**
 * STUB — Firestore jobs adapter.
 *
 * Not the live job store. Do not call this from /schedule or /td yet.
 *
 * TD already uses Firebase for Google sign-in (and the Performance
 * dashboard). That auth app is not a jobs collection. Do not treat it
 * as the source of truth.
 *
 * Do not create a Firebase project from this file.
 * Do not put API keys, client secrets, or service-account JSON here.
 *
 * Later: a jobs collection of canonical records (shared/job-model.md),
 * Scheduling App writes, TD reads, onSnapshot → adapter.subscribeRemote.
 */

function notImplemented(method) {
  return new Error(
    `Firestore jobs adapter is a stub (${method}). ` +
      'It is not the live job store. Use the local adapter until a later slice wires a jobs collection. ' +
      'Do not reuse TD Firebase auth config as the job database.'
  );
}

export function createFirestoreAdapter(options = {}) {
  const collection = options.collection || 'jobs';

  return {
    name: 'firestore',
    collection,
    async load() {
      throw notImplemented('load');
    },
    async save() {
      throw notImplemented('save');
    },
    subscribeRemote(_onChange) {
      // Later: unsubscribe = onSnapshot(jobsCollection, snap => onChange(docs)).
      // Hook exists so Store.subscribe can forward remote updates without an API change.
      return () => {};
    },
  };
}
