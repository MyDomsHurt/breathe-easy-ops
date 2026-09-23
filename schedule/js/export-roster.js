/**
 * Jeff-only master-roster .xlsx export from the live job store.
 * Layout: week tabs, lead blocks, 6-wide day bands (widened if a day has >6 jobs).
 */
import { TEAMS } from './config.js';
import { isCrewNote, cellTeamMembers } from './team-day.js';
import { addDays, formatDay, mondayOf, pad, timeToMinutes } from './utils.js';
import { allJobs, initStore, usingFirestore } from './store.js';

const SHEETJS_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const FIELD_ROWS = [
  ['Name', 'client_name'],
  ['Time', 'time'],
  ['Mobile', 'mobile'],
  ['Address', 'address'],
  ['ACs', 'acs'],
  ['Notes', 'notes'],
  ['Amount', 'amount'],
  ['Invoice', 'invoice'],
  ['Receipt', 'receipt'],
  ['Payment', 'payment'],
];
const BAND_MIN = 6;

function loadSheetJS() {
  if (window.XLSX && window.XLSX.utils) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SHEETJS_SRC;
    s.async = true;
    s.onload = () => {
      if (window.XLSX && window.XLSX.utils) resolve(window.XLSX);
      else reject(new Error('Spreadsheet library did not load'));
    };
    s.onerror = () => reject(new Error('Could not load spreadsheet library'));
    document.head.appendChild(s);
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sortByTime(jobs) {
  return jobs.slice().sort((a, b) => {
    const d = timeToMinutes(a.time) - timeToMinutes(b.time);
    if (d) return d;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
}

function jobField(job, key) {
  if (!job) return '';
  if (key === 'amount') {
    if (job.amount == null || job.amount === '') return '';
    const n = Number(job.amount);
    return Number.isFinite(n) ? n : String(job.amount);
  }
  const v = job[key];
  return v == null ? '' : v;
}

function weekNInMonth(mondayIso) {
  const month = mondayIso.slice(0, 7);
  let d = mondayOf(`${month}-01`);
  if (d.slice(0, 7) !== month) d = addDays(d, 7);
  let n = 0;
  while (d <= mondayIso && d.slice(0, 7) === month) {
    n += 1;
    d = addDays(d, 7);
  }
  return n || 1;
}

function sheetName(mondayIso, used) {
  let name = `Week ${weekNInMonth(mondayIso)}`;
  if (used.has(name)) name = mondayIso;
  name = String(name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
  if (used.has(name)) name = mondayIso.slice(0, 31);
  used.add(name);
  return name;
}

function whoOnWeek(all, leadJobs, lead) {
  const counts = {};
  leadJobs.forEach((j) => {
    const w = cellTeamMembers(all, j.date, lead) || String(j.team_members || '').trim();
    if (!w) return;
    counts[w] = (counts[w] || 0) + 1;
  });
  let best = '';
  let n = 0;
  Object.keys(counts).forEach((k) => {
    if (counts[k] > n) {
      n = counts[k];
      best = k;
    }
  });
  return best;
}

function buildWeekGrid(mondayIso, weekJobs, all) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
  const byLead = {};
  TEAMS.forEach((lead) => { byLead[lead] = []; });
  weekJobs.forEach((j) => {
    const lead = String(j.team_lead || '').trim();
    if (!byLead[lead]) return;
    byLead[lead].push(j);
  });
  const leads = TEAMS.filter((lead) => byLead[lead].length);
  const widths = days.map((date) => {
    let max = 0;
    leads.forEach((lead) => {
      const n = byLead[lead].filter((j) => j.date === date).length;
      if (n > max) max = n;
    });
    return Math.max(BAND_MIN, max);
  });
  const starts = [];
  let col = 1;
  widths.forEach((w) => {
    starts.push(col);
    col += w;
  });
  const totalCols = col;
  const rows = [];
  function blankRow() {
    return Array.from({ length: totalCols }, () => '');
  }
  const dateRow = blankRow();
  days.forEach((date, i) => {
    dateRow[starts[i]] = formatDay(date, { weekday: 'short', month: 'short' });
  });
  rows.push(dateRow);

  leads.forEach((lead, li) => {
    if (li) rows.push(blankRow());
    const who = whoOnWeek(all, byLead[lead], lead);
    const head = blankRow();
    head[0] = who ? `${lead} · ${who}` : lead;
    rows.push(head);
    FIELD_ROWS.forEach(([label]) => {
      const row = blankRow();
      row[0] = label;
      rows.push(row);
    });
    const fieldStart = rows.length - FIELD_ROWS.length;
    days.forEach((date, di) => {
      const dayJobs = sortByTime(byLead[lead].filter((j) => j.date === date));
      const origin = starts[di];
      dayJobs.forEach((job, ji) => {
        FIELD_ROWS.forEach(([, key], fi) => {
          rows[fieldStart + fi][origin + ji] = jobField(job, key);
        });
      });
    });
  });
  return rows;
}

function exportJobs(jobs) {
  const real = (jobs || []).filter((j) => j && !j.deleted && !isCrewNote(j) && j.date);
  if (!real.length) {
    throw new Error('No jobs to export');
  }
  const byWeek = {};
  real.forEach((j) => {
    const mon = mondayOf(j.date);
    (byWeek[mon] || (byWeek[mon] = [])).push(j);
  });
  const mondays = Object.keys(byWeek).sort();
  const used = new Set();
  const wb = window.XLSX.utils.book_new();
  mondays.forEach((mon) => {
    const aoa = buildWeekGrid(mon, byWeek[mon], jobs);
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName(mon, used));
  });
  const name = `breathe-easy-roster-${todayIso()}.xlsx`;
  window.XLSX.writeFile(wb, name);
  return { weeks: mondays.length, jobs: real.length, name };
}

export async function exportMasterRoster() {
  await initStore();
  if (!usingFirestore()) {
    throw new Error('Sign in to export the live roster');
  }
  const jobs = allJobs();
  if (!Array.isArray(jobs)) {
    throw new Error('Live job store is unavailable');
  }
  await loadSheetJS();
  return exportJobs(jobs);
}
