/**
 * Default job-store adapter: memory + optional localStorage copy.
 *
 * Storage key is be-ops-jobs — not the Scheduling App key
 * (be-scheduler-v2-roster). That old key is not the final store.
 *
 * Not imported by /schedule or /td yet.
 */

export const OPS_JOBS_KEY = 'be-ops-jobs';
export const LEGACY_SCHEDULE_KEY = 'be-scheduler-v2-roster';

export function createLocalAdapter(options = {}) {
  const persist = options.persist !== false;
  const storageKey = options.storageKey || OPS_JOBS_KEY;
  const storage = persist ? pickStorage(options.storage) : null;
  let memory = [];

  return {
    name: 'local',
    storageKey,
    load() {
      if (!storage) return memory.slice();
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return memory.slice();
        const data = JSON.parse(raw);
        const jobs = Array.isArray(data) ? data : data && Array.isArray(data.jobs) ? data.jobs : [];
        memory = jobs.slice();
        return memory.slice();
      } catch {
        return memory.slice();
      }
    },
    save(jobs) {
      memory = Array.isArray(jobs) ? jobs.slice() : [];
      if (!storage) return;
      try {
        storage.setItem(
          storageKey,
          JSON.stringify({ version: 1, key: storageKey, jobs: memory })
        );
      } catch {
        // Quota / private mode: keep memory; persistence is best-effort.
      }
    },
    subscribeRemote() {
      // Local adapter has no remote feed. Store.subscribe still fires on local writes.
      // Later Firestore (or similar) implements this with onSnapshot.
      return () => {};
    },
  };
}

function pickStorage(override) {
  if (override === null) return null;
  if (override) return override;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}
