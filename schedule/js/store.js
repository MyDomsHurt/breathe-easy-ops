/**
 * Scheduling App store — writer over ../../shared/store.js.
 *
 * Signed-in: Firestore jobs collection.
 * Otherwise: local be-ops-jobs fallback.
 * Does not auto-upload the historical archive on boot.
 */

import { TEAM_META } from './config.js';
import { loadSeedJobs, buildSeedJobs } from './seed.js';
import { acsLabel, jobTypeOf } from './utils.js';
import {
  createStore,
  defaultAdapter,
  loadExistingCanonicalJobs,
} from '../../shared/store.js';
import { fromScheduleJob } from '../../shared/job.js';
import { shouldUseFirestore } from '../../shared/firebase-config.js';

const listeners = new Set();

let ops = null;
let ready = false;
let readyPromise = null;

const HISTORY_LIMIT = 20;
let undoStack = [];
let redoStack = [];
let recording = true;

export async function initStore(user) {
  if (ready && ops) return allJobs();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const adapter = defaultAdapter({ user });
    try {
      ops = createStore({ adapter, user });
      await ops.ready;
    } catch (err) {
      console.warn('Live store failed, using local fallback', err);
      ops = createStore({ adapter: defaultAdapter({ user: null }) });
      await ops.ready;
    }
    ops.subscribe((event) => {
      if (event.type === 'remote' || event.type === 'load') emit();
    });
    if (ops.adapter === 'local' && ops.listJobs({ includeDeleted: true }).length === 0) {
      const seed = await loadSeedJobs();
      ops.importJobs(seed.map((row) => fromScheduleJob(row)));
    }
    ready = true;
    emit();
    return allJobs();
  })();
  return readyPromise;
}

export function storeAdapterName() {
  return (ops && ops.adapter) || 'local';
}

export function usingFirestore() {
  return storeAdapterName() === 'firestore' || shouldUseFirestore();
}

export function allJobs() {
  if (!ops) return [];
  return ops.listJobs();
}

export function getJob(id) {
  if (!ops || id == null || id === '') return null;
  const job = ops.getJob(id);
  if (!job || job.deleted) return null;
  return job;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const jobs = allJobs();
  listeners.forEach((fn) => fn(jobs));
}

function snapshot(job) {
  return job ? JSON.parse(JSON.stringify(job)) : null;
}

function pushHistory(entry) {
  if (!recording) return;
  undoStack.push(entry);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

function clearHistory() {
  undoStack = [];
  redoStack = [];
}

function toCanonical(input, prev) {
  const type = input.job_type || (input.is_return ? 'return' : 'cleaning');
  const acs = type === 'return'
    ? ''
    : (input.acs || acsLabel(input.units || {}) || (prev && prev.acs) || '');
  return fromScheduleJob({
    ...(prev || {}),
    ...input,
    job_id: input.job_id || (prev && prev.job_id),
    acs,
    job_type: type,
    is_return: type === 'return',
    team_members:
      input.team_members
      || (prev && prev.team_members)
      || TEAM_META[input.team_lead]?.members
      || input.team_lead,
    source: (prev && prev.source) || input.source || 'local',
    deleted: false,
  });
}

function writeJob(job) {
  return ops.upsertJob({ ...job, deleted: false });
}

function eraseJob(id) {
  return ops.removeJob(id);
}

function updateKind(before, after) {
  if (before.date !== after.date || before.team_lead !== after.team_lead) return 'move';
  if (before.stack_order !== after.stack_order) return 'move';
  return 'edit';
}

export function addJob(input) {
  const job = writeJob(toCanonical(input));
  pushHistory({ type: 'add', job: snapshot(job) });
  emit();
  return job;
}

export function updateJob(id, input) {
  const prev = getJob(id);
  if (!prev) return null;
  const job = writeJob(toCanonical({ ...input, job_id: id }, prev));
  pushHistory({
    type: 'update',
    kind: updateKind(prev, job),
    before: snapshot(prev),
    after: snapshot(job),
  });
  emit();
  return job;
}

export function removeJob(id) {
  const prev = getJob(id);
  if (!prev) return;
  eraseJob(id);
  pushHistory({ type: 'remove', job: snapshot(prev) });
  emit();
}

export function reorderStack(orderedIds) {
  const current = orderedIds.map((id, i) => ({ prev: getJob(id), i })).filter((x) => x.prev);
  if (!current.length) return false;
  const same = current.every(({ prev, i }) => Number(prev.stack_order) === i);
  if (same) return false;
  const befores = [];
  const afters = [];
  recording = false;
  for (const { prev, i } of current) {
    befores.push(snapshot(prev));
    const next = writeJob(toCanonical({ ...prev, stack_order: i }, prev));
    afters.push(snapshot(next));
  }
  recording = true;
  pushHistory({ type: 'reorder', kind: 'move', before: befores, after: afters });
  emit();
  return true;
}

export function undo() {
  const entry = undoStack.pop();
  if (!entry) return null;
  recording = false;
  if (entry.type === 'add') eraseJob(entry.job.job_id);
  else if (entry.type === 'remove') writeJob(entry.job);
  else if (entry.type === 'reorder') entry.before.forEach((j) => writeJob(j));
  else if (entry.type === 'update') writeJob(entry.before);
  recording = true;
  redoStack.push(entry);
  emit();
  return { action: 'undo', type: entry.type, kind: entry.kind || entry.type };
}

export function redo() {
  const entry = redoStack.pop();
  if (!entry) return null;
  recording = false;
  if (entry.type === 'add') writeJob(entry.job);
  else if (entry.type === 'remove') eraseJob(entry.job.job_id);
  else if (entry.type === 'reorder') entry.after.forEach((j) => writeJob(j));
  else if (entry.type === 'update') writeJob(entry.after);
  recording = true;
  undoStack.push(entry);
  emit();
  return { action: 'redo', type: entry.type, kind: entry.kind || entry.type };
}

export function resetDemo() {
  if (usingFirestore()) {
    return { blocked: true };
  }
  const seed = buildSeedJobs().map((row) => fromScheduleJob({ ...row, deleted: false }));
  const seedIds = new Set(seed.map((j) => j.job_id));
  if (ops) {
    for (const job of ops.listJobs({ includeDeleted: true })) {
      if (seedIds.has(job.job_id)) continue;
      if (job.source === 'local') ops.removeJob(job.job_id, { hard: true });
    }
    for (const job of seed) writeJob(job);
  }
  clearHistory();
  emit();
  return { blocked: false };
}

/**
 * One-time, explicit upload of seed + TD archive. Never called on boot.
 */
export async function importExistingJobs() {
  if (!ops) throw new Error('Store is not ready');
  const baseUrl = new URL('../../', import.meta.url).href;
  const { jobs, stats } = await loadExistingCanonicalJobs({ baseUrl });
  await ops.importJobs(jobs);
  emit();
  return { count: jobs.length, stats };
}

export { jobTypeOf };
