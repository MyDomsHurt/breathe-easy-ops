/**
 * Shared van crew for a team-day.
 *
 * One job-shaped note in the live jobs store, not localStorage:
 *   job_id: crew-YYYY-MM-DD-{team}
 *   source: team-day-crew
 *   date, team_lead, team_members
 *
 * Booking writes this note and copies team_members onto real jobs that day.
 * TD Who's on reads the same note. Notes are not bookings — hide them from
 * cards, search, and job counts.
 */

export const CREW_SOURCE = 'team-day-crew';

export function crewNoteId(date, team) {
  const d = String(date || '').trim();
  const t = String(team || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `crew-${d}-${t}`;
}

export function isCrewNote(job) {
  if (!job) return false;
  if (job.source === CREW_SOURCE) return true;
  return String(job.job_id || '').indexOf('crew-') === 0;
}

export function realJobs(jobs) {
  return (jobs || []).filter((job) => !isCrewNote(job));
}

export function findCrewNote(jobs, date, team) {
  const id = crewNoteId(date, team);
  let found = null;
  for (const job of jobs || []) {
    if (job.deleted) continue;
    if (job.job_id === id && isCrewNote(job)) return job;
    if (isCrewNote(job) && job.date === date && job.team_lead === team) found = job;
  }
  return found;
}

/** Most common non-empty team_members among real jobs that team-day. */
export function consensusTeamMembers(jobs, date, team) {
  const counts = new Map();
  for (const job of jobs || []) {
    if (isCrewNote(job) || job.deleted) continue;
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

/** Shared note first, then consensus of real jobs. No roster default. */
export function cellTeamMembers(jobs, date, team) {
  const note = findCrewNote(jobs, date, team);
  const fromNote = note && String(note.team_members || '').trim();
  if (fromNote) return fromNote;
  return consensusTeamMembers(jobs, date, team);
}

const api = {
  CREW_SOURCE,
  crewNoteId,
  isCrewNote,
  realJobs,
  findCrewNote,
  consensusTeamMembers,
  cellTeamMembers,
};

export default api;

if (typeof window !== 'undefined') window.BETeamDay = api;
