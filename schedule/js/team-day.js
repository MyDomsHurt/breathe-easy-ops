/**
 * Who is on the van for a team-day.
 *
 * Live value lives on existing job.team_members. Editing the cell writes
 * that string to every job on the team-day.
 *
 * Empty days (zero jobs): stored as a local note in localStorage
 * `be-ops-team-day-members`, keyed by `YYYY-MM-DD|TeamLead`. The first job
 * created that team-day copies the note onto team_members (see
 * teamMembersOnDay). Notes are per-browser until a job exists; they are
 * not a new Firestore collection.
 */

const STORAGE_KEY = 'be-ops-team-day-members';

function noteId(date, team) {
  return `${date}|${team}`;
}

export function readTeamDayNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

export function getTeamDayNote(date, team) {
  const value = readTeamDayNotes()[noteId(date, team)];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function setTeamDayNote(date, team, members) {
  const all = readTeamDayNotes();
  const key = noteId(date, team);
  const value = String(members || '').trim();
  if (value) all[key] = value;
  else delete all[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** Most common non-empty team_members string on that team-day. */
export function consensusTeamMembers(jobs, date, team) {
  const counts = new Map();
  for (const job of jobs || []) {
    if (job.date !== date || job.team_lead !== team) continue;
    const value = String(job.team_members || '').trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value.localeCompare(best) < 0)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** What the cell should show: jobs first, then the empty-day note. No roster default. */
export function cellTeamMembers(jobs, date, team) {
  return consensusTeamMembers(jobs, date, team) || getTeamDayNote(date, team);
}
