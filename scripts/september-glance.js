/**
 * Map the approved September glance JSON into canonical jobs / crew notes.
 * Glance keys are export-style (jobId, team, client, whosOn). Do not pass
 * those objects through normalizeJob — build a fresh canonical record.
 */

import { normalizeJob } from '../shared/job.js';
import { CREW_SOURCE, isCrewNote } from '../shared/team-day.js';

export const SEP_FROM = '2026-09-01';
export const SEP_TO = '2026-09-30';

const TERRITORIES = new Set(['HKN', 'HKS', 'KLN', 'N-T', 'S-K', 'L-T', 'L-M']);

export function inSeptember(date) {
  const d = String(date || '').slice(0, 10);
  return d >= SEP_FROM && d <= SEP_TO;
}

function text(value) {
  if (value == null) return '';
  return String(value);
}

function isGlanceCrew(row) {
  if (!row || typeof row !== 'object') return false;
  if (String(row.source || '') === CREW_SOURCE) return true;
  const id = String(row.jobId || row.job_id || '');
  return id.indexOf('crew-') === 0;
}

function addressPlace(g) {
  const place = g.place != null && g.place !== '' ? g.place : (g.addressPlace || g.address_place);
  if (place == null || String(place).trim() === '') return null;
  const s = String(place).trim();
  if (TERRITORIES.has(s)) return null;
  return s;
}

export function glanceJobToCanonical(raw) {
  const g = raw && typeof raw === 'object' ? raw : {};
  const ret = g.return === 'Y' || g.return === true || g.return === 'true'
    || g.is_return === true || g.is_return === 'true';
  const fresh = {
    job_id: text(g.jobId || g.job_id).trim(),
    date: g.date,
    time: g.time,
    team_lead: g.team || g.team_lead,
    team_members: g.whosOn != null && g.whosOn !== '' ? g.whosOn : g.team_members,
    client_name: g.client || g.client_name,
    mobile: g.mobile,
    phone_cc: g.country || g.phoneCc || g.phone_cc,
    phone_national: g.national || g.phoneNational || g.phone_national,
    address: g.address,
    address_line1: g.line1 || g.addressLine1 || g.address_line1,
    address_street: g.street || g.addressStreet || g.address_street,
    address_place: addressPlace(g),
    address_extra: g.extra || g.addressExtra || g.address_extra,
    district: g.district,
    acs: g.acs,
    notes: g.notes1 != null && g.notes1 !== '' ? g.notes1 : g.notes,
    notes_long: g.notes2 != null && g.notes2 !== '' ? g.notes2 : g.notes_long,
    amount: g.amount,
    invoice: g.invoice,
    receipt: g.receipt,
    credit_note: g.creditNote || g.credit_note,
    payment: g.payment,
    job_type: ret ? 'return' : g.job_type,
    source: g.source,
    deleted: false,
  };
  return normalizeJob(fresh);
}

export function glanceCrewToCanonical(raw) {
  const g = raw && typeof raw === 'object' ? raw : {};
  return {
    job_id: text(g.jobId || g.job_id).trim(),
    date: String(g.date || '').slice(0, 10),
    team_lead: text(g.team || g.team_lead).trim(),
    team_members: g.whosOn != null ? text(g.whosOn) : text(g.team_members),
    source: CREW_SOURCE,
    deleted: false,
  };
}

export function loadGlance(data) {
  const root = data && typeof data === 'object' ? data : {};
  const jobRows = Array.isArray(data) ? data : (Array.isArray(root.jobs) ? root.jobs : []);
  const crewRows = Array.isArray(data) ? [] : (Array.isArray(root.crew_notes) ? root.crew_notes : []);
  const jobs = [];
  const crew = [];
  const seenJobs = new Set();
  const seenCrew = new Set();

  function addCrew(row) {
    const note = glanceCrewToCanonical(row);
    if (!note.job_id || !inSeptember(note.date)) return;
    if (seenCrew.has(note.job_id)) return;
    seenCrew.add(note.job_id);
    crew.push(note);
  }

  for (const row of jobRows) {
    if (isGlanceCrew(row)) {
      addCrew(row);
      continue;
    }
    const job = glanceJobToCanonical(row);
    if (!inSeptember(job.date)) continue;
    if (isCrewNote(job)) {
      addCrew(row);
      continue;
    }
    if (!job.job_id || !String(job.client_name || '').trim()) continue;
    if (seenJobs.has(job.job_id)) continue;
    seenJobs.add(job.job_id);
    jobs.push(job);
  }
  for (const row of crewRows) addCrew(row);
  return { jobs, crew };
}

export function softDeleteIds(liveJobs, fileJobIds) {
  const keep = new Set((fileJobIds || []).map((id) => String(id || '')));
  const out = [];
  for (const job of liveJobs || []) {
    if (!job || isCrewNote(job)) continue;
    if (job.deleted === true || job.deleted === 'true') continue;
    if (!inSeptember(job.date)) continue;
    const id = String(job.job_id || '');
    if (!id || keep.has(id)) continue;
    out.push(id);
  }
  return out;
}
