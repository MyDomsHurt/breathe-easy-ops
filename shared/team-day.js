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
 *
 * One company-day holiday per date in the same jobs collection:
 *   job_id: holiday-YYYY-MM-DD
 *   source: company-day
 *   notes: the label (default Public holiday)
 * It is not a booking. isTeamDayFull reads it so every team that date is Closed.
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

export const COMPANY_SOURCE = 'company-day';

export function holidayId(date) {
  return `holiday-${String(date || '').trim()}`;
}

export function isCompanyDay(job) {
  if (!job) return false;
  if (job.source === COMPANY_SOURCE) return true;
  return String(job.job_id || '').indexOf('holiday-') === 0;
}

export function findCompanyDay(jobs, date) {
  const d = String(date || '').trim();
  const id = holidayId(d);
  let found = null;
  for (const job of jobs || []) {
    if (job.deleted) continue;
    if (!isCompanyDay(job)) continue;
    if (job.job_id === id) return job;
    if (job.date === d) found = job;
  }
  return found;
}

export function companyDayName(job) {
  const s = job && job.notes != null ? String(job.notes).trim() : '';
  return s || 'Public holiday';
}

export function realJobs(jobs) {
  return (jobs || []).filter((job) => !isCrewNote(job) && !isCompanyDay(job));
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

function flagOn(value) {
  return value === true || value === 'true';
}

/** Calendar day in Asia/Hong_Kong as YYYY-MM-DD. */
export function hongKongToday(now) {
  const d = now instanceof Date ? now : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Closed when day_unlocked is off and any of: date before HKT today,
 * a company-day holiday, day_full, day_locked. Unlock beats the past-day
 * rule, a holiday, and day_locked. A past day needs no crew note.
 */
export function isTeamDayFull(jobs, date, team, today) {
  const note = findCrewNote(jobs, date, team);
  if (note && flagOn(note.day_unlocked)) return false;
  const todayIso = today || hongKongToday();
  if (String(date || '') < String(todayIso)) return true;
  if (findCompanyDay(jobs, date)) return true;
  if (note && (flagOn(note.day_full) || flagOn(note.day_locked))) return true;
  return false;
}

/** Locked days block new bookings, drag on, drag off, and card save. */
export function canPlaceJobOnTeamDay(jobs, date, team, existing, today) {
  if (existing && isTeamDayFull(jobs, existing.date, existing.team_lead, today)) return false;
  return !isTeamDayFull(jobs, date, team, today);
}

/** Most common non-empty team_members among real jobs that team-day. */
export function consensusTeamMembers(jobs, date, team) {
  const counts = new Map();
  for (const job of jobs || []) {
    if (isCrewNote(job) || isCompanyDay(job) || job.deleted) continue;
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
  COMPANY_SOURCE,
  holidayId,
  isCompanyDay,
  findCompanyDay,
  companyDayName,
  realJobs,
  findCrewNote,
  hongKongToday,
  isTeamDayFull,
  canPlaceJobOnTeamDay,
  consensusTeamMembers,
  cellTeamMembers,
};

export default api;

if (typeof window !== 'undefined') window.BETeamDay = api;
