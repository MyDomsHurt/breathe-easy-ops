/**
 * Contact pane job list and /?date=&job= deep link.
 * Match is job.hubspot_id === contact hubspot_id only.
 */
import { hongKongToday, isCompanyDay, isCrewNote } from './team-day.js';
import { formatMoney, notes1Text } from './utils.js';

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
    if (isCrewNote(j) || isCompanyDay(j)) return false;
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

function byDateTime(a, b, newestFirst) {
  const dir = newestFirst ? -1 : 1;
  const d = String(a.date || '').localeCompare(String(b.date || ''));
  if (d) return d * dir;
  const t = String(a.time || '').localeCompare(String(b.time || ''));
  if (t) return t * dir;
  return String(a.job_id || '').localeCompare(String(b.job_id || ''));
}

export function splitJobsForContact(jobs, hubspotId, today) {
  const listed = jobsForContact(jobs, hubspotId);
  const todayIso = String(today || hongKongToday());
  const next = listed.filter((j) => String(j.date || '') >= todayIso).sort((a, b) => byDateTime(a, b, false));
  const past = listed.filter((j) => String(j.date || '') < todayIso).sort((a, b) => byDateTime(a, b, true));
  return { next, past };
}

export function contactJobAmount(job) {
  if (!job || job.amount == null || job.amount === '') return '';
  const n = Number(job.amount);
  return Number.isFinite(n) ? formatMoney(n) : '';
}

export function formatContactJobDate(iso) {
  const s = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-HK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function contactJobPay(job) {
  const pay = String(job && job.payment || '').trim();
  if (!pay) return '';
  const lower = pay.toLowerCase();
  if (lower === 'free') return '';
  if (lower === 'unpaid') return 'Unpaid';
  return 'Paid';
}

export function contactJobsSummary(jobs, hubspotId) {
  const listed = jobsForContact(jobs, hubspotId);
  let last = '';
  let total = 0;
  listed.forEach((j) => {
    const date = String(j && j.date || '').trim();
    if (date && (!last || date > last)) last = date;
    if (!j || j.amount == null || j.amount === '') return;
    const n = Number(j.amount);
    if (Number.isFinite(n)) total += n;
  });
  return { count: listed.length, last, total };
}

export function contactJobFields(job) {
  const j = job && typeof job === 'object' ? job : {};
  const acs = j.acs == null ? '' : String(j.acs);
  return {
    date: j.date == null ? '' : String(j.date),
    day: formatContactJobDate(j.date),
    time: j.time == null ? '' : String(j.time),
    team: j.team_lead == null ? '' : String(j.team_lead),
    acs,
    units: acs.trim(),
    amount: contactJobAmount(j),
    pay: contactJobPay(j),
    notes: notes1Text(j),
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
