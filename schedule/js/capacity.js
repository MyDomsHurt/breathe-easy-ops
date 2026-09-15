import { TEAM_META, TEAMS } from './config.js';
import { startMinutes, timeToMinutes } from './utils.js';
import { cellTeamMembers, findCrewNote, isCrewNote } from './team-day.js';

export const SLOT_MAX = 24;
export const SLOT_MIN = 6;

export function sortByTime(jobs) {
  return jobs.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function stackKey(job) {
  const n = Number(job && job.stack_order);
  if (Number.isFinite(n)) return n;
  const mins = timeToMinutes(job && job.time);
  return 1e6 + (mins === 9999 ? 0 : mins);
}

export function sortByStack(jobs) {
  return jobs.slice().sort((a, b) => {
    const ta = startMinutes(a);
    const tb = startMinutes(b);
    if (ta != null && tb != null) {
      const d = ta - tb;
      if (d) return d;
      return String(a.job_id || '').localeCompare(String(b.job_id || ''));
    }
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    const sa = Number(a && a.stack_order);
    const sb = Number(b && b.stack_order);
    const aN = Number.isFinite(sa);
    const bN = Number.isFinite(sb);
    if (aN && bN && sa !== sb) return sa - sb;
    if (aN && !bN) return -1;
    if (!aN && bN) return 1;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
}

export function jobsForTeamDay(jobs, date, team) {
  return sortByStack(jobs.filter((j) => !isCrewNote(j) && j.date === date && j.team_lead === team));
}

export function nextStackOrder(jobs, date, team, exceptId) {
  return firstEmptySlotIndex(jobs, date, team, exceptId);
}

export function slotIndex(job) {
  const n = Number(job && job.stack_order);
  if (!Number.isFinite(n) || n < 0 || n !== Math.floor(n) || n >= SLOT_MAX) return null;
  return n;
}

export function daySlotsOf(note) {
  const n = Number(note && note.day_slots);
  if (Number.isFinite(n) && n >= SLOT_MIN) return Math.min(SLOT_MAX, Math.floor(n));
  return SLOT_MIN;
}

export function slotCountFor(jobs, date, team) {
  return daySlotsOf(findCrewNote(jobs, date, team));
}

function clockKey(job) {
  const t = startMinutes(job);
  return t == null ? 1e6 : t;
}

export function layoutSlots(jobs, slotCount) {
  const n = Math.max(SLOT_MIN, Math.min(SLOT_MAX, slotCount || SLOT_MIN));
  const slots = Array(n).fill(null);
  const rest = [];
  for (const j of jobs || []) {
    const i = slotIndex(j);
    if (i == null || i >= n || slots[i]) rest.push(j);
    else slots[i] = j;
  }
  rest.sort((a, b) => {
    const d = clockKey(a) - clockKey(b);
    if (d) return d;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  let cursor = 0;
  for (const j of rest) {
    while (cursor < slots.length && slots[cursor]) cursor += 1;
    if (cursor < slots.length) {
      slots[cursor] = j;
      cursor += 1;
    } else {
      slots.push(j);
    }
  }
  return slots;
}

export function firstEmptySlotIndex(jobs, date, team, exceptId, slotCount) {
  const n = slotCount == null ? slotCountFor(jobs, date, team) : slotCount;
  const taken = new Set();
  for (const j of jobs || []) {
    if (isCrewNote(j) || j.date !== date || j.team_lead !== team) continue;
    if (exceptId && j.job_id === exceptId) continue;
    const i = slotIndex(j);
    if (i != null && i < n) taken.add(i);
  }
  for (let i = 0; i < n; i += 1) {
    if (!taken.has(i)) return i;
  }
  return n;
}

export function maxOccupiedSlot(jobs, date, team) {
  let max = -1;
  for (const j of jobs || []) {
    if (isCrewNote(j) || j.date !== date || j.team_lead !== team) continue;
    const i = slotIndex(j);
    if (i != null && i > max) max = i;
  }
  return max;
}

export function slotFloor(jobs, date, team) {
  const list = (jobs || []).filter((j) => !isCrewNote(j) && j.date === date && j.team_lead === team);
  return Math.max(SLOT_MIN, list.length, maxOccupiedSlot(jobs, date, team) + 1);
}

/** Place movingId at targetIndex. Occupant and the run after it shift down one. */
export function planSlotTake(cellJobs, slotCount, movingId, targetIndex) {
  const target = Math.max(0, Math.floor(Number(targetIndex) || 0));
  let n = Math.max(slotCount || SLOT_MIN, target + 1);
  const map = new Map();
  for (const j of cellJobs || []) {
    if (!j || j.job_id === movingId) continue;
    const i = slotIndex(j);
    if (i == null) continue;
    if (!map.has(i)) map.set(i, j);
  }
  const assigns = [{ id: movingId, slot: target }];
  if (map.has(target)) {
    let i = target;
    let carry = map.get(i);
    map.delete(i);
    while (carry) {
      i += 1;
      if (i >= n) n = i + 1;
      const next = map.get(i) || null;
      map.set(i, carry);
      assigns.push({ id: carry.job_id, slot: i });
      carry = next;
    }
  }
  return { assigns, slotCount: Math.min(SLOT_MAX, n) };
}

/** Keep place in the cell. New / moved jobs take a requested slot or the first empty. */
export function stackOrderOnSave(jobs, date, team, prev, requested) {
  const want = requested == null || requested === ''
    ? null
    : (Number.isFinite(Number(requested)) && Number(requested) >= 0 ? Math.floor(Number(requested)) : null);
  if (prev && prev.job_id && prev.date === date && prev.team_lead === team) {
    const n = slotIndex(prev);
    if (n != null) return n;
    const laid = layoutSlots(jobsForTeamDay(jobs, date, team), slotCountFor(jobs, date, team));
    const vis = laid.findIndex((j) => j && j.job_id === prev.job_id);
    return vis >= 0 ? vis : firstEmptySlotIndex(jobs, date, team, prev.job_id);
  }
  if (want != null) return want;
  return firstEmptySlotIndex(jobs, date, team, prev && prev.job_id);
}

export function teamMembersOnDay(jobs, date, team) {
  return cellTeamMembers(jobs, date, team)
    || TEAM_META[team]?.members
    || team;
}

export function districtsForTeamOnDay(jobs, date, team) {
  return [...new Set(
    jobs.filter((j) => !isCrewNote(j) && j.date === date && j.team_lead === team && j.district).map((j) => j.district)
  )];
}

export function conflictingJobIds(jobs) {
  const groups = new Map();
  for (const j of jobs) {
    const key = startMinutes(j);
    if (key == null) continue;
    const arr = groups.get(key) || [];
    arr.push(j.job_id);
    groups.set(key, arr);
  }
  const ids = new Set();
  for (const arr of groups.values()) {
    if (arr.length > 1) arr.forEach((id) => ids.add(id));
  }
  return ids;
}

export function hasTimeConflict(job, jobs) {
  const key = startMinutes(job);
  if (key == null || !job) return false;
  return jobs.some((j) => (
    !isCrewNote(j)
    && j.job_id !== job.job_id
    && j.date === job.date
    && j.team_lead === job.team_lead
    && startMinutes(j) === key
  ));
}

/**
 * Suggest a team for a date: lighter day first, then same-day district
 * clustering, then home areas. Never a hard quota.
 */
export function suggestTeams(jobs, { date, district, teams = TEAMS } = {}) {
  return teams
    .map((team) => {
      const dayJobs = jobsForTeamDay(jobs, date, team);
      const dayDistricts = districtsForTeamOnDay(jobs, date, team);
      const home = TEAM_META[team]?.home || [];
      let score = 40 - dayJobs.length * 6;
      if (district && dayDistricts.includes(district)) score += 16;
      if (district && home.includes(district)) score += 8;
      if (dayJobs.length === 0) score += 8;
      return {
        team,
        jobCount: dayJobs.length,
        dayDistricts,
        members: teamMembersOnDay(jobs, date, team),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function overlapWarning(jobs, { date, team, time }) {
  const mins = timeToMinutes(time);
  if (!time || mins === 9999) return null;
  const near = jobsForTeamDay(jobs, date, team).find((j) => {
    const other = timeToMinutes(j.time);
    if (other === 9999) return false;
    return Math.abs(other - mins) < 45;
  });
  if (!near) return null;
  return `${near.time || 'Another job'} already on ${team} that day`;
}
