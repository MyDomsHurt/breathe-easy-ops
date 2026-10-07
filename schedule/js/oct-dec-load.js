/**
 * Jeff-only Oct–Dec glance load. Maps with scripts/september-glance.js loadGlance.
 * PH and team meeting become crew flags. Does not write. Apply lives on the store.
 */

import {
  loadGlance,
  OCT_FROM,
  OCT_TO,
  softDeleteIds,
} from '../../scripts/september-glance.js';
import { CREW_SOURCE, crewNoteId } from '../../shared/team-day.js';

export { OCT_FROM, OCT_TO };

export const OCT_DEC_REFUSE = 'Dates must be 2026-10-01 to 2027-01-03.';

function rowDate(row) {
  return String((row && row.date) || '').slice(0, 10);
}

function rawRows(data) {
  const root = data && typeof data === 'object' ? data : {};
  const jobs = Array.isArray(data) ? data : (Array.isArray(root.jobs) ? root.jobs : []);
  const crew = Array.isArray(data) ? [] : (Array.isArray(root.crew_notes) ? root.crew_notes : []);
  return { jobs, crew, rows: jobs.concat(crew) };
}

export function glanceDatesInOctDec(data) {
  const { rows } = rawRows(data);
  if (!rows.length) return false;
  for (const row of rows) {
    const d = rowDate(row);
    if (!d || d < OCT_FROM || d > OCT_TO) return false;
  }
  return true;
}

export function flagKind(row) {
  if (!row || typeof row !== 'object') return '';
  const client = String(row.client || row.client_name || '').trim();
  const acs = String(row.acs || '').trim();
  const time = String(row.time || '').trim();
  const notes = String(row.notes1 || row.notes || '').trim();
  if (client === 'PH' || /^ph$/i.test(client)) return 'holiday';
  if (/\bpublic holiday\b/i.test(client) || /\bpublic holiday\b/i.test(notes)) return 'holiday';
  if (/\bteam meeting\b/i.test(client) || /\bteam meeting\b/i.test(acs)
    || /\bteam meeting\b/i.test(time) || /\bteam meeting\b/i.test(notes)) {
    return 'meeting';
  }
  return '';
}

export function flagToCrew(row, kind) {
  const date = rowDate(row);
  const team = String((row && (row.team || row.team_lead)) || '').trim();
  const members = row && row.whosOn != null
    ? String(row.whosOn)
    : String((row && row.team_members) || '');
  return {
    job_id: crewNoteId(date, team),
    date,
    team_lead: team,
    team_members: members,
    source: CREW_SOURCE,
    deleted: false,
    day_mark: kind,
    day_mark_name: kind === 'holiday' ? 'Public holiday' : '',
    day_mark_time: '',
    day_mark_end: '',
    day_mark_all_day: true,
  };
}

export function validateOctDecGlance(data) {
  if (!glanceDatesInOctDec(data)) {
    return { ok: false, error: OCT_DEC_REFUSE };
  }
  const raw = rawRows(data);
  const bookingRows = [];
  const flags = [];
  for (const row of raw.jobs) {
    const kind = flagKind(row);
    if (kind) flags.push(flagToCrew(row, kind));
    else bookingRows.push(row);
  }
  const mapped = loadGlance(
    { jobs: bookingRows, crew_notes: raw.crew },
    { from: OCT_FROM, to: OCT_TO },
  );
  const byId = new Map();
  for (const note of mapped.crew) {
    if (note && note.job_id) byId.set(note.job_id, note);
  }
  for (const flag of flags) {
    if (!flag || !flag.job_id) continue;
    const prev = byId.get(flag.job_id);
    if (prev) {
      byId.set(flag.job_id, {
        ...prev,
        day_mark: flag.day_mark,
        day_mark_name: flag.day_mark_name,
        day_mark_time: flag.day_mark_time,
        day_mark_end: flag.day_mark_end,
        day_mark_all_day: flag.day_mark_all_day,
      });
    } else {
      byId.set(flag.job_id, flag);
    }
  }
  return { ok: true, jobs: mapped.jobs, crew: Array.from(byId.values()) };
}

export function planOctDecLoad(liveJobs, jobs, crew) {
  const jobList = Array.isArray(jobs) ? jobs : [];
  const crewList = Array.isArray(crew) ? crew : [];
  const deletes = softDeleteIds(
    liveJobs,
    jobList.map((j) => j.job_id),
    { from: OCT_FROM, to: OCT_TO },
  );
  return {
    jobUpserts: jobList.length,
    crewUpserts: crewList.length,
    softDeletes: deletes,
  };
}

export function planOctDecLines(plan) {
  const n = plan && Array.isArray(plan.softDeletes) ? plan.softDeletes.length : 0;
  const jobs = plan && plan.jobUpserts != null ? plan.jobUpserts : 0;
  const crew = plan && plan.crewUpserts != null ? plan.crewUpserts : 0;
  return [
    jobs + ' job upserts',
    crew + ' crew upserts',
    n + ' live jobs in that range would be soft-deleted',
  ];
}
