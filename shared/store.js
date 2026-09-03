/**
 * Shared live job store — future source of truth for both faces.
 *
 * Scheduling App = writer. Technician Dashboard = reader.
 * /schedule is the writer (see schedule/js/store.js). /td is not wired yet.
 * Default adapter is local (memory + be-ops-jobs). Firestore is a stub.
 * Google Sheet backup comes later.
 *
 * All records are canonical (shared/job-model.md). time is free-form.
 */

import { normalizeJob } from './job.js';
import { createLocalAdapter, OPS_JOBS_KEY, LEGACY_SCHEDULE_KEY } from './store-local.js';
import { createFirestoreAdapter } from './store-firestore.js';
import {
  combineExistingJobs,
  loadExistingCanonicalJobs,
  mergeCanonicalJobs,
  seedStore,
} from './store-import.js';

export {
  createLocalAdapter,
  createFirestoreAdapter,
  combineExistingJobs,
  loadExistingCanonicalJobs,
  mergeCanonicalJobs,
  seedStore,
  OPS_JOBS_KEY,
  LEGACY_SCHEDULE_KEY,
};

export function createStore(options = {}) {
  const adapter = options.adapter || createLocalAdapter(options);
  const nowFn = options.now || (() => new Date().toISOString());
  const jobs = new Map();
  const listeners = new Set();
  let remoteUnsub = null;

  function snapshot(includeDeleted) {
    const list = [];
    for (const job of jobs.values()) {
      if (includeDeleted || !job.deleted) list.push(job);
    }
    list.sort(compareJobs);
    return list;
  }

  function persist() {
    const all = [];
    for (const job of jobs.values()) all.push(job);
    const result = adapter.save && adapter.save(all);
    return result && typeof result.then === 'function' ? result : undefined;
  }

  function notify(event) {
    const payload = {
      type: event.type,
      job: event.job || null,
      jobs: snapshot(true),
      adapter: adapter.name || 'unknown',
    };
    for (const cb of listeners) {
      try {
        cb(payload);
      } catch {
        // Subscriber errors must not break writes.
      }
    }
  }

  function hydrate(list) {
    jobs.clear();
    for (const raw of Array.isArray(list) ? list : []) {
      const job = normalizeJob(raw);
      if (job.job_id) jobs.set(job.job_id, job);
    }
  }

  const loaded = adapter.load ? adapter.load() : [];
  if (loaded && typeof loaded.then !== 'function') hydrate(loaded);

  const ready = Promise.resolve(loaded).then((list) => {
    if (loaded && typeof loaded.then === 'function') hydrate(list);
    notify({ type: 'load' });
    return api;
  });

  if (typeof adapter.subscribeRemote === 'function') {
    remoteUnsub = adapter.subscribeRemote((list) => {
      hydrate(list);
      notify({ type: 'remote' });
    });
  }

  const api = {
    ready,
    adapter: adapter.name || 'unknown',

    listJobs({ includeDeleted } = {}) {
      return snapshot(!!includeDeleted);
    },

    getJob(jobId) {
      if (jobId == null || jobId === '') return null;
      return jobs.get(String(jobId)) || null;
    },

    upsertJob(input) {
      const incoming = input && typeof input === 'object' ? input : {};
      const id = String(incoming.job_id || '').trim() || assignJobId(incoming);
      const prev = jobs.get(id) || null;
      const merged = prev
        ? normalizeJob({ ...prev, ...incoming, job_id: id })
        : normalizeJob({ ...incoming, job_id: id });
      merged.job_id = id;
      merged.updated_at = nowFn();
      jobs.set(id, merged);
      persist();
      notify({ type: 'upsert', job: merged });
      return merged;
    },

    removeJob(jobId, { hard } = {}) {
      const id = String(jobId || '').trim();
      const prev = jobs.get(id);
      if (!prev) return null;
      if (hard) {
        jobs.delete(id);
        persist();
        const tombstone = { job_id: id, deleted: true, hard: true, updated_at: nowFn() };
        notify({ type: 'remove', job: tombstone });
        return tombstone;
      }
      const next = normalizeJob({ ...prev, deleted: true });
      next.deleted = true;
      next.updated_at = nowFn();
      jobs.set(id, next);
      persist();
      notify({ type: 'remove', job: next });
      return next;
    },

    importJobs(rawJobs) {
      const incoming = Array.isArray(rawJobs) ? rawJobs : [];
      const stamp = nowFn();
      const imported = [];
      for (const raw of incoming) {
        const job = normalizeJob(raw);
        if (!job.job_id || !String(job.client_name || '').trim()) continue;
        const prev = jobs.get(job.job_id);
        const next = prev ? mergeCanonicalJobs(prev, job) : job;
        next.updated_at = stamp;
        jobs.set(next.job_id, next);
        imported.push(next);
      }
      persist();
      notify({ type: 'import', job: null });
      return imported;
    },

    subscribe(callback) {
      if (typeof callback !== 'function') return () => {};
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    destroy() {
      if (typeof remoteUnsub === 'function') remoteUnsub();
      remoteUnsub = null;
      listeners.clear();
    },
  };

  return api;
}

function assignJobId(input) {
  const date = input.date || 'undated';
  const team = String(input.team_lead || 'team').toLowerCase().replace(/\s+/g, '-');
  const rand = Math.random().toString(36).slice(2, 7);
  return `${date}-${team}-${Date.now().toString(36)}-${rand}`;
}

function compareJobs(a, b) {
  if (a.date !== b.date) return String(a.date || '').localeCompare(String(b.date || ''));
  if (a.team_lead !== b.team_lead) return String(a.team_lead || '').localeCompare(String(b.team_lead || ''));
  const ao = a.stack_order;
  const bo = b.stack_order;
  if (ao != null && bo != null && ao !== bo) return ao - bo;
  if (a.time !== b.time) return String(a.time || '').localeCompare(String(b.time || ''));
  return String(a.job_id || '').localeCompare(String(b.job_id || ''));
}

const storeApi = {
  createStore,
  createLocalAdapter,
  createFirestoreAdapter,
  combineExistingJobs,
  loadExistingCanonicalJobs,
  mergeCanonicalJobs,
  seedStore,
  OPS_JOBS_KEY,
  LEGACY_SCHEDULE_KEY,
};

export default storeApi;

if (typeof window !== 'undefined') window.BEStore = storeApi;
