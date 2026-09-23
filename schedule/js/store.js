/**
 * Scheduling App store — writer over ../../shared/store.js.
 *
 * Signed-in: Firestore jobs collection.
 * Otherwise: local be-ops-jobs fallback.
 * Does not auto-upload the historical archive on boot.
 */

import { JOB_TYPES, TEAM_META } from './config.js';
import { loadSeedJobs, buildSeedJobs } from './seed.js';
import { acsLabel, jobTypeOf } from './utils.js';
import {
  createStore,
  defaultAdapter,
  loadExistingCanonicalJobs,
} from '../../shared/store.js';
import { appendChange, asChanges, fromScheduleJob } from '../../shared/job.js';
import { isJeffEmail, shouldUseFirestore } from '../../shared/firebase-config.js';
import { CREW_SOURCE, cellTeamMembers, crewNoteId, isCrewNote } from './team-day.js';
import { planSlotTake, slotCountFor, slotFloor } from './capacity.js';

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

function pickTeamMembers(input, prev) {
  if (Object.prototype.hasOwnProperty.call(input, 'team_members')) {
    return input.team_members == null ? '' : String(input.team_members).trim();
  }
  const lead = input.team_lead || (prev && prev.team_lead);
  return (prev && prev.team_members)
    || TEAM_META[lead]?.members
    || lead
    || '';
}

function toCanonical(input, prev) {
  const type = jobTypeOf({ ...prev, ...input });
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
    team_members: pickTeamMembers(input, prev),
    source: (prev && prev.source) || input.source || 'local',
    deleted: false,
  });
}

function denyJeffOnly(action) {
  const msg = 'Only Jeff can ' + action;
  try {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(denyJeffOnly._t);
      denyJeffOnly._t = setTimeout(() => el.classList.remove('show'), 2600);
    }
  } catch (e) { /* ignore */ }
  throw new Error(msg);
}

function requireJeff(action) {
  if (isJeffEmail(currentActorEmail())) return;
  denyJeffOnly(action);
}

function currentActorEmail() {
  try {
    const email = typeof firebase !== 'undefined'
      && firebase.auth
      && firebase.auth().currentUser
      && firebase.auth().currentUser.email;
    const s = String(email || '').trim();
    return s || null;
  } catch {
    return null;
  }
}

const DIFF_FIELDS = [
  ['team_lead', 'Team'],
  ['client_name', 'Client'],
  ['date', 'Date'],
  ['time', 'Time'],
  ['mobile', 'Mobile'],
  ['district', 'District'],
  ['address', 'Address'],
  ['address_line1', 'Line 1'],
  ['address_street', 'Street'],
  ['address_place', 'Place'],
  ['address_extra', 'Extra'],
  ['acs', 'ACs'],
  ['notes', 'Notes 1'],
  ['notes_long', 'Notes 2'],
  ['payment', 'Payment'],
  ['amount', 'Amount'],
  ['invoice', 'Invoice'],
  ['job_type', 'Type'],
  ['status', 'Status'],
];

function typeLabel(id) {
  const hit = JOB_TYPES.find((t) => t.id === id);
  return hit ? hit.label : (id || '—');
}

function fieldText(key, value) {
  if (key === 'job_type') return typeLabel(value);
  if (key === 'status') return value === 'tentative' ? 'Tentative' : 'Confirmed';
  if (key === 'amount') {
    if (value == null || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : '—';
  }
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function fieldKey(key, value) {
  if (key === 'amount') {
    if (value == null || value === '') return '';
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : '';
  }
  if (value == null) return '';
  return String(value).trim();
}

function fieldDiffs(prev, next) {
  if (!prev || !next) return [];
  const diffs = [];
  for (const [key, label] of DIFF_FIELDS) {
    if (fieldKey(key, prev[key]) === fieldKey(key, next[key])) continue;
    diffs.push({
      field: label,
      from: fieldText(key, prev[key]),
      to: fieldText(key, next[key]),
    });
  }
  return diffs;
}

function stampAudit(job, prev, action) {
  const email = currentActorEmail();
  const now = new Date().toISOString();
  const next = { ...job };
  if (prev) {
    next.created_by = prev.created_by || null;
    next.created_at = prev.created_at || null;
  } else {
    if (!next.created_by) next.created_by = email;
    if (!next.created_at) next.created_at = now;
  }
  next.updated_by = email;
  next.updated_at = now;
  const prior = prev && prev.changes != null ? prev.changes : next.changes;
  const diffs = action && !isCrewNote(next) ? fieldDiffs(prev, next) : [];
  if (action === 'created' && !isCrewNote(next)) {
    next.changes = appendChange(prior, { at: now, by: email, action, diffs });
  } else if (action && diffs.length && !isCrewNote(next)) {
    next.changes = appendChange(prior, { at: now, by: email, action, diffs });
  } else {
    next.changes = asChanges(prior);
  }
  return next;
}

function writeJob(job, action) {
  const id = job && job.job_id;
  const prev = id ? getJob(id) : null;
  return ops.upsertJob(stampAudit({ ...job, deleted: false }, prev, action));
}

function eraseJob(id) {
  return ops.removeJob(id);
}

function updateKind(before, after) {
  if (before.date !== after.date || before.team_lead !== after.team_lead) return 'move';
  if (before.stack_order !== after.stack_order) return 'move';
  return 'edit';
}

function expandSlotsIfNeeded(date, team, stackOrder) {
  const i = Number(stackOrder);
  if (!Number.isFinite(i) || i < 0) return;
  const need = Math.floor(i) + 1;
  if (need > slotCountFor(allJobs(), date, team)) setTeamDaySlots(date, team, need);
}

export function addJob(input) {
  const job = writeJob(toCanonical(input), 'created');
  pushHistory({ type: 'add', job: snapshot(job) });
  expandSlotsIfNeeded(job.date, job.team_lead, job.stack_order);
  emit();
  return job;
}

export function placeJobInSlot(jobId, date, team, targetSlot) {
  const job = getJob(jobId);
  if (!job) return null;
  const destJobs = allJobs().filter((j) => !isCrewNote(j) && j.date === date && j.team_lead === team);
  const currentSlots = slotCountFor(allJobs(), date, team);
  const plan = planSlotTake(destJobs, currentSlots, jobId, targetSlot);
  const destChanged = job.date !== date || job.team_lead !== team;
  recording = false;
  if (plan.slotCount > currentSlots) setTeamDaySlots(date, team, plan.slotCount);
  for (const row of plan.assigns) {
    const prev = getJob(row.id);
    if (!prev) continue;
    if (row.id === jobId) {
      writeJob(toCanonical({
        ...prev,
        date,
        team_lead: team,
        time: prev.time,
        stack_order: row.slot,
      }, prev), destChanged ? 'moved' : null);
    } else {
      writeJob(toCanonical({ ...prev, stack_order: row.slot }, prev), null);
    }
  }
  recording = true;
  emit();
  return getJob(jobId);
}

export function setTeamDayMembers(date, team, members) {
  const value = String(members || '').trim();
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const list = allJobs().filter((j) => !isCrewNote(j) && j.date === date && j.team_lead === team);
  const befores = [];
  const afters = [];
  recording = false;
  const nextNote = writeJob(toCanonical({
    job_id: noteId,
    date,
    team_lead: team,
    team_members: value,
    client_name: '',
    time: '',
    acs: '',
    job_type: 'cleaning',
    is_return: false,
    source: CREW_SOURCE,
    status: 'confirmed',
    highlight_members: prevNote ? !!prevNote.highlight_members : false,
  }, prevNote));
  for (const prev of list) {
    if (String(prev.team_members || '').trim() === value) continue;
    befores.push(snapshot(prev));
    afters.push(snapshot(writeJob(toCanonical({ ...prev, team_members: value }, prev))));
  }
  recording = true;
  pushHistory({
    type: 'crew',
    kind: 'edit',
    noteId,
    noteBefore: prevNote ? snapshot(prevNote) : null,
    noteAfter: snapshot(nextNote),
    before: befores,
    after: afters,
  });
  emit();
  return { count: afters.length, members: value };
}

export function setTeamDayHighlight(date, team, on) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  writeJob(toCanonical({
    job_id: noteId,
    date,
    team_lead: team,
    team_members: members,
    client_name: '',
    time: '',
    acs: '',
    job_type: 'cleaning',
    is_return: false,
    source: CREW_SOURCE,
    status: 'confirmed',
    highlight_members: !!on,
  }, prevNote));
  emit();
}

export function setTeamDayFull(date, team, on) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  writeJob(toCanonical({
    job_id: noteId,
    date,
    team_lead: team,
    team_members: members,
    client_name: '',
    time: '',
    acs: '',
    job_type: 'cleaning',
    is_return: false,
    source: CREW_SOURCE,
    status: 'confirmed',
    highlight_members: prevNote ? !!prevNote.highlight_members : false,
    lunch: prevNote && prevNote.lunch || null,
    day_slots: prevNote && prevNote.day_slots,
    day_full: !!on,
  }, prevNote));
  emit();
}

export function setTeamDaySlots(date, team, count) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  const n = Number(count);
  const floor = slotFloor(allJobs(), date, team);
  const slots = Number.isFinite(n) ? Math.min(24, Math.max(floor, Math.floor(n))) : floor;
  writeJob(toCanonical({
    job_id: noteId,
    date,
    team_lead: team,
    team_members: members,
    client_name: '',
    time: '',
    acs: '',
    job_type: 'cleaning',
    is_return: false,
    source: CREW_SOURCE,
    status: 'confirmed',
    highlight_members: prevNote ? !!prevNote.highlight_members : false,
    lunch: prevNote && prevNote.lunch || null,
    day_slots: slots,
    day_full: !!(prevNote && prevNote.day_full),
  }, prevNote));
  emit();
}

export function setTeamDayLunch(date, team, lunch) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  writeJob(toCanonical({
    job_id: noteId,
    date,
    team_lead: team,
    team_members: members,
    client_name: '',
    time: '',
    acs: '',
    job_type: 'cleaning',
    is_return: false,
    source: CREW_SOURCE,
    status: 'confirmed',
    highlight_members: prevNote ? !!prevNote.highlight_members : false,
    lunch: lunch || null,
  }, prevNote));
  emit();
}

export function updateJob(id, input) {
  const prev = getJob(id);
  if (!prev) return null;
  const next = toCanonical({ ...input, job_id: id }, prev);
  const kind = updateKind(prev, next);
  let action = 'saved';
  if (kind === 'move') action = 'moved';
  else if (next.status === 'tentative') action = 'tentative';
  const job = writeJob(next, action);
  pushHistory({
    type: 'update',
    kind: updateKind(prev, job),
    before: snapshot(prev),
    after: snapshot(job),
  });
  expandSlotsIfNeeded(job.date, job.team_lead, job.stack_order);
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
    const next = writeJob(toCanonical({ ...prev, stack_order: i }, prev), 'moved');
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
  else if (entry.type === 'reorder' || entry.type === 'batch') entry.before.forEach((j) => writeJob(j));
  else if (entry.type === 'crew') {
    entry.before.forEach((j) => writeJob(j));
    if (entry.noteBefore) writeJob(entry.noteBefore);
    else eraseJob(entry.noteId);
  }
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
  else if (entry.type === 'reorder' || entry.type === 'batch') entry.after.forEach((j) => writeJob(j));
  else if (entry.type === 'crew') {
    entry.after.forEach((j) => writeJob(j));
    if (entry.noteAfter) writeJob(entry.noteAfter);
  }
  else if (entry.type === 'update') writeJob(entry.after);
  recording = true;
  undoStack.push(entry);
  emit();
  return { action: 'redo', type: entry.type, kind: entry.kind || entry.type };
}

export function resetDemo() {
  requireJeff('reset the demo');
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
  requireJeff('import jobs');
  if (!ops) throw new Error('Store is not ready');
  const baseUrl = new URL('../../', import.meta.url).href;
  const { jobs, stats } = await loadExistingCanonicalJobs({ baseUrl });
  await ops.importJobs(jobs);
  emit();
  return { count: jobs.length, stats };
}

export { jobTypeOf };
