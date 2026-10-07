/**
 * Scheduling App store — writer over ../../shared/store.js.
 *
 * Signed-in: Firestore jobs collection.
 * Otherwise: local be-ops-jobs fallback.
 * Does not auto-upload the historical archive on boot.
 */

import { JOB_TYPES, TEAM_META, TEAMS } from './config.js';
import { loadSeedJobs, buildSeedJobs } from './seed.js';
import { acsLabel, formatTime24, jobTypeOf } from './utils.js';
import {
  createStore,
  defaultAdapter,
  loadExistingCanonicalJobs,
} from '../../shared/store.js?v=2';
import { appendChange, asChanges, fromScheduleJob } from '../../shared/job.js';
import { matchHubspotIdByPhone, parsePhone } from '../../shared/phone-parse.js';
import { allContacts } from './contacts-store.js?v=1';
import { CONTACTS_COLLECTION, isJeffEmail, isOfficeEmail, JOBS_COLLECTION, shouldUseFirestore } from '../../shared/firebase-config.js';
import { CREW_SOURCE, canPlaceJobOnTeamDay, cellTeamMembers, crewNoteId, dayMarkOf, hongKongToday, isClosingDayMark, isCompanyDay, isCrewNote } from './team-day.js?v=5';
import { planSlotTake, slotCountFor, slotFloor } from './capacity.js';

const listeners = new Set();

let ops = null;
let ready = false;
let readyPromise = null;

const HISTORY_LIMIT = 20;
let undoStack = [];
let redoStack = [];
let recording = true;
let holdEmit = 0;

const PHONE_PATCH_URL = './data/phone-format-2026-09-24.json';
const PHONE_PATCH_CHUNK = 10;

export async function initStore(user) {
  if (ready && ops) return allJobs();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const adapter = defaultAdapter({ user });
    try {
      ops = createStore({ adapter, user, deferRemote: true });
      await ops.ready;
    } catch (err) {
      console.warn('Live store failed, using local fallback', err);
      ops = createStore({ adapter: defaultAdapter({ user: null }), deferRemote: true });
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
    if (ops && typeof ops.startRemote === 'function') ops.startRemote();
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

export function isStoreReady() {
  return !!(ops && typeof ops.upsertJob === 'function');
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
  if (holdEmit) return;
  const jobs = allJobs();
  listeners.forEach((fn) => fn(jobs));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  if (code === 'resource-exhausted' || code === '429') return true;
  if (err.status === 429 || err.statusCode === 429) return true;
  return /429|resource-exhausted|too many requests/i.test(String(err.message || ''));
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
  ['phone_cc', 'Country'],
  ['phone_national', 'National'],
  ['hubspot_id', 'HubSpot'],
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
  const skipAudit = isCrewNote(next) || isCompanyDay(next);
  const diffs = action && !skipAudit ? fieldDiffs(prev, next) : [];
  if (action === 'created' && !skipAudit) {
    next.changes = appendChange(prior, { at: now, by: email, action, diffs });
  } else if (action && diffs.length && !skipAudit) {
    next.changes = appendChange(prior, { at: now, by: email, action, diffs });
  } else {
    next.changes = asChanges(prior);
  }
  return next;
}

export function writeJob(job, action) {
  if (!ops || typeof ops.upsertJob !== 'function') return null;
  const id = job && job.job_id;
  const prev = id ? getJob(id) : null;
  const stamped = stampAudit({ ...job, deleted: false }, prev, action);
  const pending = ops.upsertJob(stamped);
  if (pending && typeof pending.then === 'function') pending.catch(() => {});
  return ops.getJob(stamped.job_id) || stamped;
}

function writeJobRemote(job, action) {
  if (!ops || typeof ops.upsertJob !== 'function') return Promise.resolve(null);
  const id = job && job.job_id;
  const prev = id ? getJob(id) : null;
  const stamped = stampAudit({ ...job, deleted: false }, prev, action);
  return Promise.resolve(ops.upsertJob(stamped));
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
  if (!ops) return null;
  const job = writeJob(toCanonical(input), 'created');
  if (!job) return null;
  pushHistory({ type: 'add', job: snapshot(job) });
  expandSlotsIfNeeded(job.date, job.team_lead, job.stack_order);
  emit();
  return job;
}

export function placeJobInSlot(jobId, date, team, targetSlot) {
  const job = getJob(jobId);
  if (!job) return null;
  if (!canPlaceJobOnTeamDay(allJobs(), date, team, job)) return job;
  const destJobs = allJobs().filter((j) => !isCrewNote(j) && !isCompanyDay(j) && j.date === date && j.team_lead === team);
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
  const list = allJobs().filter((j) => !isCrewNote(j) && !isCompanyDay(j) && j.date === date && j.team_lead === team);
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

export function setTeamDayFull(date, team, on, actorEmail) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const today = hongKongToday();
  const past = String(date || '') < String(today);
  const lockOn = !!on;
  if (lockOn && past && !prevNote) return;
  const actor = actorEmail !== undefined ? actorEmail : currentActorEmail();
  if (!lockOn && !isOfficeEmail(actor)) return;
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
    lunch_slot: prevNote && prevNote.lunch_slot,
    day_slots: prevNote && prevNote.day_slots,
    day_full: lockOn,
    day_locked: lockOn,
    day_unlocked: !lockOn && (past || isClosingDayMark(prevNote)),
  }, prevNote));
  emit();
}

const EMPTY_MARK = {
  day_mark: '',
  day_mark_name: '',
  day_mark_time: '',
  day_mark_end: '',
  day_mark_all_day: false,
};

function teamsForDate(date) {
  const seen = new Set();
  const out = [];
  function add(name) {
    const t = String(name || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  }
  TEAMS.forEach(add);
  const d = String(date || '').trim();
  for (const job of allJobs()) {
    if (job.deleted) continue;
    if (!isCrewNote(job) || job.date !== d) continue;
    add(job.team_lead);
  }
  return out;
}

function writeCrewNote(date, team, extra) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  return writeJob(toCanonical({
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
    lunch_slot: prevNote && prevNote.lunch_slot,
    day_slots: prevNote && prevNote.day_slots,
    day_full: !!(prevNote && prevNote.day_full),
    day_locked: !!(prevNote && prevNote.day_locked),
    day_unlocked: !!(prevNote && prevNote.day_unlocked),
    day_mark: prevNote && prevNote.day_mark || '',
    day_mark_name: prevNote && prevNote.day_mark_name || '',
    day_mark_time: prevNote && prevNote.day_mark_time || '',
    day_mark_end: prevNote && prevNote.day_mark_end || '',
    day_mark_all_day: !!(prevNote && prevNote.day_mark_all_day),
    ...(extra || {}),
  }, prevNote));
}

export function setDateMark(date, spec, actorEmail) {
  const actor = actorEmail !== undefined ? actorEmail : currentActorEmail();
  if (!isOfficeEmail(actor)) return;
  const d = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  const kind = spec && spec.kind;
  if (kind !== 'holiday' && kind !== 'meeting' && kind !== 'building') return;
  const known = new Set(TEAMS);
  const ticked = kind === 'holiday'
    ? TEAMS.slice()
    : (Array.isArray(spec.teams) ? spec.teams : [])
      .map((t) => String(t || '').trim())
      .filter((t) => known.has(t));
  if (kind !== 'holiday' && !ticked.length) return;
  let name = '';
  let time = '';
  let end = '';
  let allDay = false;
  if (kind === 'holiday') {
    name = String(spec.name == null ? '' : spec.name).trim() || 'Public holiday';
  } else if (kind === 'meeting') {
    allDay = !!spec.allDay;
    if (!allDay) {
      time = formatTime24(spec.time);
      end = formatTime24(spec.end);
      if (!time || !end) return;
    }
  } else {
    allDay = !!spec.allDay;
    if (!allDay) {
      time = formatTime24(spec.time);
      if (!time) return;
    }
  }
  const targets = new Set(kind === 'holiday' ? teamsForDate(d) : ticked);
  const consider = new Set(teamsForDate(d));
  ticked.forEach((t) => consider.add(t));
  const closes = kind === 'holiday' || (kind === 'building' && allDay);
  recording = false;
  consider.forEach((team) => {
    const prev = getJob(crewNoteId(d, team));
    if (targets.has(team)) {
      writeCrewNote(d, team, {
        day_mark: kind,
        day_mark_name: name,
        day_mark_time: time,
        day_mark_end: end,
        day_mark_all_day: allDay,
        day_unlocked: closes ? false : !!(prev && prev.day_unlocked),
      });
    } else if (prev && dayMarkOf(prev)) {
      writeCrewNote(d, team, EMPTY_MARK);
    }
  });
  recording = true;
  emit();
}

export function clearDateMark(date, actorEmail) {
  const actor = actorEmail !== undefined ? actorEmail : currentActorEmail();
  if (!isOfficeEmail(actor)) return;
  const d = String(date || '').trim();
  recording = false;
  for (const team of teamsForDate(d)) {
    const prev = getJob(crewNoteId(d, team));
    if (!prev || !dayMarkOf(prev)) continue;
    writeCrewNote(d, team, EMPTY_MARK);
  }
  recording = true;
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
    lunch_slot: prevNote && prevNote.lunch_slot,
    day_slots: slots,
    day_full: !!(prevNote && prevNote.day_full),
    day_locked: !!(prevNote && prevNote.day_locked),
    day_unlocked: !!(prevNote && prevNote.day_unlocked),
  }, prevNote));
  emit();
}

export function setTeamDayLunch(date, team, lunch, slot) {
  const noteId = crewNoteId(date, team);
  const prevNote = getJob(noteId);
  const members = prevNote
    ? String(prevNote.team_members || '').trim()
    : cellTeamMembers(allJobs(), date, team);
  const slotN = Number(slot);
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
    lunch_slot: lunch && Number.isFinite(slotN) ? slotN : null,
    day_full: !!(prevNote && prevNote.day_full),
    day_locked: !!(prevNote && prevNote.day_locked),
    day_unlocked: !!(prevNote && prevNote.day_unlocked),
  }, prevNote));
  emit();
}

async function persistPhoneRow(row) {
  const next = toCanonical({
    ...row.job,
    mobile: row.mobile,
    phone_cc: row.cc,
    phone_national: row.nat,
  }, row.job);
  const saved = await writeJobRemote(next, 'saved');
  if (ops && typeof ops.holdJobPhones === 'function') ops.holdJobPhones(saved);
  return saved;
}

async function persistPhoneChunk(chunk) {
  const run = () => Promise.allSettled(chunk.map((row) => persistPhoneRow(row)));
  let settled = await run();
  if (settled.some((s) => s.status === 'rejected' && is429(s.reason))) {
    await sleep(2000);
    settled = await run();
  }
  let written = 0;
  let failed = 0;
  settled.forEach((s) => {
    if (s.status === 'fulfilled') written += 1;
    else failed += 1;
  });
  return { written, failed };
}

export async function applyPhonePatch() {
  requireJeff('apply the phone patch');
  const res = await fetch(PHONE_PATCH_URL);
  if (!res.ok) throw new Error('Phone patch JSON missing');
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Phone patch JSON invalid');

  let written = 0;
  let matched = 0;
  let failed = 0;
  let missing = 0;
  const pending = [];
  for (const row of rows) {
    const id = String((row && (row.job_id || row.jobId)) || '').trim();
    if (!id) {
      missing += 1;
      continue;
    }
    const job = getJob(id);
    if (!job) {
      missing += 1;
      continue;
    }
    if (isCrewNote(job) || isCompanyDay(job)) continue;
    const mobile = String(row.mobile || '').trim();
    const cc = String(row.phoneCc || row.phone_cc || '').trim();
    const nat = String(row.phoneNational || row.phone_national || '').trim();
    if (
      String(job.mobile || '').trim() === mobile
      && String(job.phone_cc || '').trim() === cc
      && String(job.phone_national || '').trim() === nat
    ) {
      matched += 1;
      continue;
    }
    pending.push({ job, mobile, cc, nat });
  }

  holdEmit += 1;
  recording = false;
  if (ops && typeof ops.beginPhoneHold === 'function') ops.beginPhoneHold();
  try {
    for (let i = 0; i < pending.length; i += PHONE_PATCH_CHUNK) {
      const chunk = pending.slice(i, i + PHONE_PATCH_CHUNK);
      const result = await persistPhoneChunk(chunk);
      written += result.written;
      failed += result.failed;
      await sleep(400);
    }
  } finally {
    if (ops && typeof ops.endPhoneHold === 'function') ops.endPhoneHold();
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return { written, matched, failed, missing };
}

export function formatLiveJobPhones() {
  requireJeff('format phones');
  let formatted = 0;
  let ok = 0;
  let skipped = 0;
  recording = false;
  for (const job of allJobs()) {
    if (isCrewNote(job) || isCompanyDay(job)) continue;
    const raw = String(job.mobile || '').trim();
    if (!raw) {
      skipped += 1;
      continue;
    }
    const parsed = parsePhone(raw);
    if (!parsed.resolved || !parsed.full) {
      skipped += 1;
      continue;
    }
    if (parsed.full === raw) {
      ok += 1;
      continue;
    }
    writeJob(toCanonical({
      ...job,
      mobile: parsed.full,
      phone_cc: parsed.country,
      phone_national: parsed.national,
    }, job), 'saved');
    formatted += 1;
  }
  recording = true;
  emit();
  return { formatted, ok, skipped };
}

export function attachLiveJobContacts() {
  requireJeff('attach phones');
  const contacts = allContacts();
  let attached = 0;
  let already = 0;
  let unmatched = 0;
  let ambiguous = 0;
  recording = false;
  for (const job of allJobs()) {
    if (isCrewNote(job) || isCompanyDay(job)) continue;
    const hit = matchHubspotIdByPhone(job.mobile, contacts);
    const nextId = hit.status === 'one' ? hit.hubspot_id : '';
    const prevId = String(job.hubspot_id || '').trim();
    if (hit.status === 'ambiguous') ambiguous += 1;
    else if (hit.status === 'unmatched' || !nextId) unmatched += 1;
    else if (prevId && prevId === nextId) already += 1;
    else attached += 1;
    if (prevId === nextId) continue;
    writeJob(toCanonical({ ...job, hubspot_id: nextId || null }, job), 'saved');
  }
  recording = true;
  emit();
  return { attached, already, unmatched, ambiguous };
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
  if (!job) return null;
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

export async function applySeptemberLoad({ jobs, crew, deleteIds }) {
  requireJeff('load September');
  if (!ops || typeof ops.importJobs !== 'function' || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to load September');
  const jobList = Array.isArray(jobs) ? jobs : [];
  const crewList = Array.isArray(crew) ? crew : [];
  const ids = Array.isArray(deleteIds) ? deleteIds : [];

  holdEmit += 1;
  recording = false;
  try {
    for (const id of ids) {
      const prev = ops.getJob(id);
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      ops.removeJob(id);
    }
    await ops.importJobs(jobList);
    for (const note of crewList) {
      if (!note || !note.job_id) continue;
      const prev = ops.getJob(note.job_id);
      await ops.upsertJob({
        ...(prev || {}),
        job_id: note.job_id,
        date: note.date,
        team_lead: note.team_lead,
        team_members: note.team_members,
        source: note.source,
        deleted: false,
      });
    }
  } finally {
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return {
    jobUpserts: jobList.length,
    crewUpserts: crewList.length,
    softDeleted: ids.length,
  };
}

export async function applyOctDecLoad({ jobs, crew, deleteIds }) {
  requireJeff('load Oct–Dec');
  if (!ops || typeof ops.importJobs !== 'function' || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to load Oct–Dec');
  function jobDate(row) {
    return String((row && row.date) || '').slice(0, 10);
  }
  const jobList = (Array.isArray(jobs) ? jobs : []).filter((j) => jobDate(j) >= '2026-10-01');
  const crewList = (Array.isArray(crew) ? crew : []).filter((n) => jobDate(n) >= '2026-10-01');
  const ids = Array.isArray(deleteIds) ? deleteIds : [];

  holdEmit += 1;
  recording = false;
  try {
    const live = await listJobsForTimeClean();
    const liveById = new Map();
    for (const row of live) {
      if (row && row.job_id) liveById.set(String(row.job_id), row);
    }
    for (const id of ids) {
      const prev = ops.getJob(id) || liveById.get(String(id));
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      if (isCrewNote(prev) || isCompanyDay(prev)) continue;
      if (jobDate(prev) < '2026-10-01') continue;
      if (ops.getJob(id)) {
        ops.removeJob(id);
      } else {
        await ops.upsertJob({ ...prev, deleted: true });
      }
    }
    await ops.importJobs(jobList);
    for (const note of crewList) {
      if (!note || !note.job_id) continue;
      if (jobDate(note) < '2026-10-01') continue;
      const prev = ops.getJob(note.job_id);
      const mark = note.day_mark
        ? {
            day_mark: note.day_mark,
            day_mark_name: note.day_mark_name || '',
            day_mark_time: note.day_mark_time || '',
            day_mark_end: note.day_mark_end || '',
            day_mark_all_day: !!note.day_mark_all_day,
          }
        : {
            day_mark: (prev && prev.day_mark) || '',
            day_mark_name: (prev && prev.day_mark_name) || '',
            day_mark_time: (prev && prev.day_mark_time) || '',
            day_mark_end: (prev && prev.day_mark_end) || '',
            day_mark_all_day: !!(prev && prev.day_mark_all_day),
          };
      await ops.upsertJob({
        ...(prev || {}),
        job_id: note.job_id,
        date: note.date,
        team_lead: note.team_lead,
        team_members: note.team_members,
        source: note.source,
        deleted: false,
        ...mark,
      });
    }
  } finally {
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return {
    jobUpserts: jobList.length,
    crewUpserts: crewList.length,
    softDeleted: ids.length,
  };
}

export async function listJobsForTimeClean() {
  if (usingFirestore() && typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
    const snap = await firebase.firestore().collection(JOBS_COLLECTION).get();
    return snap.docs.map((doc) => {
      const data = doc.data() || {};
      return { ...data, job_id: data.job_id || doc.id };
    });
  }
  return allJobs();
}

export async function listContactsForPhoneClean() {
  if (usingFirestore() && typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
    const snap = await firebase.firestore().collection(CONTACTS_COLLECTION).get();
    return snap.docs.map((doc) => {
      const data = doc.data() || {};
      return { ...data, hubspot_id: data.hubspot_id || doc.id };
    });
  }
  return allContacts();
}

export async function applyCleanTimes(updates) {
  requireJeff('clean job times');
  if (!ops || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to clean job times');
  const list = Array.isArray(updates) ? updates : [];
  const email = currentActorEmail();

  holdEmit += 1;
  recording = false;
  let written = 0;
  try {
    for (const row of list) {
      if (!row || !row.job_id) continue;
      const prev = ops.getJob(row.job_id) || row.base;
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      if (isCrewNote(prev) || isCompanyDay(prev)) continue;
      const next = { ...prev, time: row.time };
      if (row.arrow) {
        next.changes = appendChange(prev.changes, {
          at: new Date().toISOString(),
          by: email,
          action: 'saved',
          diffs: [{ field: 'Time', from: row.from, to: row.to }],
        });
      }
      await ops.upsertJob(next);
      written += 1;
    }
  } finally {
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return { written };
}

export async function applyCleanAcs(updates) {
  requireJeff('clean job ACs');
  if (!ops || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to clean job ACs');
  const list = Array.isArray(updates) ? updates : [];
  const email = currentActorEmail();

  holdEmit += 1;
  recording = false;
  let written = 0;
  try {
    for (const row of list) {
      if (!row || !row.job_id) continue;
      const prev = ops.getJob(row.job_id) || row.base;
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      if (isCrewNote(prev) || isCompanyDay(prev)) continue;
      const next = { ...prev, acs: row.acs, notes: row.notes };
      if (row.arrow) {
        next.changes = appendChange(prev.changes, {
          at: new Date().toISOString(),
          by: email,
          action: 'saved',
          diffs: [{ field: 'ACs', from: row.from, to: row.to }],
        });
      }
      await ops.upsertJob(next);
      written += 1;
    }
  } finally {
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return { written };
}

export async function applySeptemberFixes(updates) {
  requireJeff('fix September');
  if (!ops || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to fix September');
  const list = Array.isArray(updates) ? updates : [];

  function inSeptember(date) {
    const d = String(date || '').slice(0, 10);
    return d >= '2026-09-01' && d <= '2026-09-30';
  }

  holdEmit += 1;
  recording = false;
  let written = 0;
  try {
    for (const row of list) {
      if (!row || !row.job_id) continue;
      if (!inSeptember(row.date)) continue;
      const prev = ops.getJob(row.job_id) || row.base;
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      if (isCrewNote(prev) || isCompanyDay(prev)) continue;
      if (!inSeptember(prev.date)) continue;
      await ops.upsertJob({
        ...prev,
        job_id: prev.job_id,
        date: row.date,
        team_lead: row.team_lead,
        time: row.time,
        client_name: row.client_name,
      });
      written += 1;
    }
  } finally {
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return { written };
}

export async function applyCleanPhones(updates) {
  requireJeff('clean job phones');
  if (!ops || typeof ops.upsertJob !== 'function') {
    throw new Error('Store is not ready');
  }
  if (!usingFirestore()) throw new Error('Sign in to clean job phones');
  const list = Array.isArray(updates) ? updates : [];

  holdEmit += 1;
  recording = false;
  if (ops && typeof ops.beginPhoneHold === 'function') ops.beginPhoneHold();
  let written = 0;
  try {
    for (const row of list) {
      if (!row || !row.job_id) continue;
      const prev = ops.getJob(row.job_id) || row.base;
      if (!prev || prev.deleted === true || prev.deleted === 'true') continue;
      if (isCrewNote(prev) || isCompanyDay(prev)) continue;
      const saved = await ops.upsertJob({
        ...prev,
        job_id: prev.job_id,
        mobile: row.mobile,
        phone_cc: row.phone_cc,
        phone_national: row.phone_national,
        hubspot_id: row.hubspot_id,
      });
      if (ops && typeof ops.holdJobPhones === 'function') ops.holdJobPhones(saved);
      written += 1;
    }
  } finally {
    if (ops && typeof ops.endPhoneHold === 'function') ops.endPhoneHold();
    recording = true;
    holdEmit = Math.max(0, holdEmit - 1);
    emit();
  }
  return { written };
}

export { jobTypeOf };
