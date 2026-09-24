import { isCrewNote } from './team-day.js';
import { classifyJobPhone } from '../../shared/phone-parse.js';
import { esc, formatDay } from './utils.js';

const BUCKETS = [
  { id: 'empty', label: 'Empty' },
  { id: 'unparsed', label: 'Unparsed' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'ambiguous', label: 'Ambiguous' },
];

function sortRows(a, b) {
  const da = String(a.job.date || '').localeCompare(String(b.job.date || ''));
  if (da) return da;
  const ta = String(a.job.team_lead || '').localeCompare(String(b.job.team_lead || ''));
  if (ta) return ta;
  return String(a.job.client_name || '').localeCompare(String(b.job.client_name || ''));
}

export function listPhoneOutliers(jobs, contacts) {
  const buckets = { empty: [], unparsed: [], unmatched: [], ambiguous: [] };
  (jobs || []).forEach((j) => {
    if (!j || j.deleted || isCrewNote(j)) return;
    const { bucket, reason } = classifyJobPhone(j, contacts);
    if (!buckets[bucket]) return;
    buckets[bucket].push({ job: j, reason });
  });
  BUCKETS.forEach((b) => buckets[b.id].sort(sortRows));
  return buckets;
}

function rowHtml(item) {
  const j = item.job;
  return `<tr class="outliers-row" data-job="${esc(j.job_id)}">
    <td>${esc(formatDay(j.date) || j.date || '')}</td>
    <td>${esc(j.team_lead || '')}</td>
    <td>${esc(j.client_name || '')}</td>
    <td>${esc(j.mobile || '')}</td>
    <td>${esc(item.reason)}</td>
  </tr>`;
}

export function renderPhoneOutliers(el, jobs, contacts) {
  if (!el) return;
  const buckets = listPhoneOutliers(jobs, contacts);
  const counts = BUCKETS.map((b) => `${b.label} ${buckets[b.id].length}`).join(' · ');
  const sections = BUCKETS.map((b) => {
    const rows = buckets[b.id];
    return `<section class="outliers-bucket">
      <h2>${esc(b.label)} <span>${rows.length}</span></h2>
      ${rows.length ? `<table class="contacts-table outliers-table">
        <thead><tr><th>Date</th><th>Team</th><th>Client</th><th>Mobile</th><th>Reason</th></tr></thead>
        <tbody>${rows.map(rowHtml).join('')}</tbody>
      </table>` : `<p class="outliers-empty">None</p>`}
    </section>`;
  }).join('');
  el.innerHTML = `<p class="outliers-counts">${esc(counts)}</p>${sections}`;
}
