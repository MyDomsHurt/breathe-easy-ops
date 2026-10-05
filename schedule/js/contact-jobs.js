/**
 * Contact pane job list and /?date=&job= deep link.
 * Match is job.hubspot_id === contact hubspot_id only.
 */
import { isCrewNote } from './team-day.js';
import { formatMoney } from './utils.js';

function parseQuery(search) {
  const s = String(search || '').replace(/^\?/, '');
  const out = {};
  if (!s) return out;
  s.split('&').forEach((part) => {
    if (!part) return;
    const i = part.indexOf('=');
    const k = decodeURIComponent((i === -1 ? part : part.slice(0, i)).replace(/\+/g, ' '));
    const v = decodeURIComponent((i === -1 ? '' : part.slice(i + 1)).replace(/\+/g, ' '));
    if (k) out[k] = v;
  });
  return out;
}

export function jobsForContact(jobs, hubspotId) {
  if (hubspotId == null || String(hubspotId) === '') return [];
  const id = String(hubspotId);
  const out = (jobs || []).filter((j) => {
    if (!j) return false;
    if (j.deleted === true || j.deleted === 'true') return false;
    if (isCrewNote(j)) return false;
    if (j.hubspot_id == null || String(j.hubspot_id) === '') return false;
    return String(j.hubspot_id) === id;
  });
  out.sort((a, b) => {
    const d = String(b.date || '').localeCompare(String(a.date || ''));
    if (d) return d;
    const t = String(b.time || '').localeCompare(String(a.time || ''));
    if (t) return t;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  return out;
}

export function contactJobAmount(job) {
  if (!job || job.amount == null || job.amount === '') return '';
  const n = Number(job.amount);
  return Number.isFinite(n) ? formatMoney(n) : '';
}

export function contactJobFields(job) {
  const j = job && typeof job === 'object' ? job : {};
  return {
    date: j.date == null ? '' : String(j.date),
    time: j.time == null ? '' : String(j.time),
    team: j.team_lead == null ? '' : String(j.team_lead),
    acs: j.acs == null ? '' : String(j.acs),
    amount: contactJobAmount(j),
  };
}

export function contactJobLine(job) {
  const f = contactJobFields(job);
  return [f.date, f.time, f.team, f.acs, f.amount].filter((x) => x !== '').join(' · ');
}

export function contactJobHref(job) {
  const date = String(job && job.date || '').trim();
  const id = String(job && job.job_id || '').trim();
  if (!date || !id) return '';
  return `/?date=${encodeURIComponent(date)}&job=${encodeURIComponent(id)}`;
}

export function readJobLink(search) {
  const q = parseQuery(search);
  const date = String(q.date || '').trim();
  const jobId = String(q.job || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !jobId) return null;
  return { date, jobId };
}

export function isSundayDate(iso) {
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
}
