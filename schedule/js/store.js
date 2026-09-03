import { STORAGE_KEY, TEAM_META } from './config.js';
import { loadSeedJobs, buildSeedJobs } from './seed.js';
import { acsLabel, jobTypeOf, uid, weekNumber } from './utils.js';

const listeners = new Set();

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { extras: [], removed: [], overrides: {} };
    const data = JSON.parse(raw);
    return {
      extras: Array.isArray(data.extras) ? data.extras : [],
      removed: Array.isArray(data.removed) ? data.removed : [],
      overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
    };
  } catch {
    return { extras: [], removed: [], overrides: {} };
  }
}

function savePersisted(state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      extras: state.extras,
      removed: [...state.removed],
      overrides: state.overrides,
    })
  );
}

function createState(seed) {
  const persisted = loadPersisted();
  return {
    seed: seed || [],
    extras: persisted.extras,
    overrides: persisted.overrides,
    removed: new Set(persisted.removed),
  };
}

function buildJob(input, prev) {
  const type = input.job_type || (input.is_return ? 'return' : 'cleaning');
  const acs = input.acs || acsLabel(input.units || {}) || '';
  const base = prev || {};
  return {
    ...base,
    job_id: input.job_id || base.job_id || uid(`${input.date}-${(input.team_lead || 'team').toLowerCase()}`),
    date: input.date,
    week: weekNumber(input.date),
    team_lead: input.team_lead,
    team_members: input.team_members || TEAM_META[input.team_lead]?.members || input.team_lead,
    client_name: input.client_name,
    time: input.time || '',
    mobile: input.mobile || '',
    address: input.address || '',
    acs: type === 'return' ? '' : acs,
    notes: input.notes || null,
    amount: type === 'cleaning'
      ? (input.amount === '' || input.amount == null ? (base.amount ?? null) : Number(input.amount))
      : null,
    invoice: input.invoice !== undefined ? input.invoice : (base.invoice || null),
    receipt: input.receipt !== undefined ? input.receipt : (base.receipt || null),
    payment: input.payment || 'Unpaid',
    is_return: type === 'return',
    district: input.district || '',
    job_type: type,
    status: input.status === 'tentative' || input.status === 'confirmed'
      ? input.status
      : (base.status === 'tentative' ? 'tentative' : 'confirmed'),
    source: base.source || input.source || 'local',
    stack_order: input.stack_order != null && input.stack_order !== ''
      ? Number(input.stack_order)
      : (base.stack_order ?? null),
  };
}

let state = createState([]);
let ready = false;
let readyPromise = null;

export async function initStore() {
  if (ready) return allJobs();
  readyPromise = (async () => {
    const seed = await loadSeedJobs();
    state = createState(seed);
    ready = true;
    emit();
    return allJobs();
  })();
  return readyPromise;
}

export function allJobs() {
  const extras = state.extras.filter((j) => !state.removed.has(j.job_id));
  const seed = state.seed
    .filter((j) => !state.removed.has(j.job_id))
    .map((j) => state.overrides[j.job_id] || j);
  return [...seed, ...extras].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.time || '').localeCompare(String(b.time || ''));
  });
}

export function getJob(id) {
  return allJobs().find((j) => j.job_id === id) || null;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(allJobs()));
}

const HISTORY_LIMIT = 20;
let undoStack = [];
let redoStack = [];
let recording = true;

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

function writeJob(job) {
  const id = job.job_id;
  const extraIdx = state.extras.findIndex((j) => j.job_id === id);
  if (extraIdx >= 0) {
    const next = state.extras.slice();
    next[extraIdx] = snapshot(job);
    state.extras = next;
  } else if (state.seed.some((j) => j.job_id === id)) {
    state.overrides = { ...state.overrides, [id]: snapshot(job) };
  } else {
    state.extras = [...state.extras, snapshot(job)];
  }
  state.removed.delete(id);
}

function eraseJob(id) {
  state.extras = state.extras.filter((j) => j.job_id !== id);
  const next = { ...state.overrides };
  delete next[id];
  state.overrides = next;
  state.removed.add(id);
}

function updateKind(before, after) {
  if (before.date !== after.date || before.team_lead !== after.team_lead) return 'move';
  if (before.stack_order !== after.stack_order) return 'move';
  return 'edit';
}

export function addJob(input) {
  const job = buildJob(input);
  state.extras = [...state.extras, job];
  pushHistory({ type: 'add', job: snapshot(job) });
  persist();
  emit();
  return job;
}

export function updateJob(id, input) {
  const prev = getJob(id);
  if (!prev) return null;
  const job = buildJob({ ...input, job_id: id }, prev);
  writeJob(job);
  pushHistory({
    type: 'update',
    kind: updateKind(prev, job),
    before: snapshot(prev),
    after: snapshot(job),
  });
  persist();
  emit();
  return job;
}

export function removeJob(id) {
  const prev = getJob(id);
  if (!prev) return;
  const wasExtra = state.extras.some((j) => j.job_id === id);
  eraseJob(id);
  pushHistory({ type: 'remove', job: snapshot(prev), wasExtra });
  persist();
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
    const next = buildJob({ ...prev, stack_order: i }, prev);
    writeJob(next);
    afters.push(snapshot(next));
  }
  recording = true;
  pushHistory({ type: 'reorder', kind: 'move', before: befores, after: afters });
  persist();
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
  persist();
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
  persist();
  emit();
  return { action: 'redo', type: entry.type, kind: entry.kind || entry.type };
}

export function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  const seed = state.seed.length ? state.seed : buildSeedJobs();
  state = createState(seed);
  clearHistory();
  emit();
}

function persist() {
  savePersisted(state);
}

export { jobTypeOf };
