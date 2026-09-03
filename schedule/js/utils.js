import { DISTRICTS, TODAY, UNIT_TYPES } from './config.js';

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function mondayOf(iso) {
  const d = parseISO(iso);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toISO(d);
}

export function weekDays(mondayIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
}

export function formatDay(iso, opts = {}) {
  const d = parseISO(iso);
  const fmt = {
    weekday: opts.weekday || 'short',
    day: 'numeric',
    month: opts.month || 'short',
  };
  if (opts.year) fmt.year = opts.year;
  return d.toLocaleDateString('en-HK', fmt);
}

export function workWeekDays(mondayIso) {
  return Array.from({ length: 6 }, (_, i) => addDays(mondayIso, i));
}

export function formatWeekLabel(mondayIso) {
  const end = addDays(mondayIso, 5);
  const a = parseISO(mondayIso);
  const b = parseISO(end);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString('en-HK', { day: 'numeric', month: 'short' });
  const right = b.toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' });
  return sameMonth
    ? `${a.getDate()}–${right}`
    : `${left} – ${right}`;
}

export function mondayOfMonth(yearMonth) {
  return mondayOf(`${yearMonth}-01`);
}

export function monthKey(iso) {
  return String(iso || '').slice(0, 7);
}

export function districtChipsHtml(districts) {
  const list = [...new Set((districts || []).filter(Boolean))];
  if (!list.length) return '';
  return `<span class="dist-chips">${list.map((d) => {
    const meta = DISTRICTS[d];
    const bg = meta?.bg || '#e2e8f0';
    const ink = meta?.text || '#334155';
    return `<span class="dist-chip" style="background:${bg};color:${ink}">${esc(d)}</span>`;
  }).join('')}</span>`;
}

export function isToday(iso) {
  return iso === TODAY;
}

export function isWeekend(iso) {
  const day = parseISO(iso).getDay();
  return day === 0 || day === 6;
}

export function timeToMinutes(t) {
  if (!t) return 9999;
  const s = String(t).toLowerCase().replace(/\s+/g, '');
  const m = s.match(/(\d{1,2})(?:[.:](\d{2}))?(am|pm)?/);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : 0;
  const ap = m[3] || '';
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}

function rawTime(job) {
  if (job == null) return '';
  if (typeof job === 'object') return job.time;
  return job;
}

function formatClock(token, fallbackAp) {
  const s = String(token || '').toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?:[:.]\d{2})?(am|pm)?$/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : 0;
  let ap = m[3] || fallbackAp || '';
  if (!ap) {
    if (h === 12) ap = 'pm';
    else if (h >= 8 && h <= 11) ap = 'am';
    else if (h >= 13 && h <= 23) {
      h -= 12;
      ap = 'pm';
    } else {
      ap = 'pm';
    }
  }
  if (h === 0) {
    h = 12;
    ap = 'am';
  } else if (h > 12) {
    h -= 12;
    if (!m[3]) ap = 'pm';
  }
  return `${String(h).padStart(2, '0')}.${String(min).padStart(2, '0')}${ap}`;
}

/** Card start time: 09.00am. Ranges and “11.30am => 10.30am” use the actual start. */
export function shortTime(job) {
  const raw = String(rawTime(job) || '').trim();
  if (!raw) return '—';
  const current = raw.split(/\s*=>\s*/).pop().trim();
  const apMatch = current.match(/[ap]m/i);
  const ap = apMatch ? apMatch[0].toLowerCase() : '';
  const start = current.split(/\s*-\s*/)[0].trim();
  return formatClock(start, ap) || raw;
}

/** Minutes from midnight for conflict checks. Blank/unparseable times are not conflicts. */
export function startMinutes(job) {
  const raw = String(rawTime(job) || '').trim();
  if (!raw) return null;
  const label = shortTime(job);
  if (!label || label === '—') return null;
  const mins = timeToMinutes(label);
  return mins === 9999 ? null : mins;
}

export function shortAddress(job, max = 42) {
  let s = String(job && job.address || '').replace(/\s+/g, ' ').trim();
  if (!s) s = String(job && job.district || '').trim();
  if (!s) return '—';
  if (s.length > max) return `${s.slice(0, max - 1).trim()}…`;
  return s;
}

export function shortNotes(job, max = 96) {
  let s = String(job && job.notes || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/https?:\/\/\S+/gi, '');
  s = s.replace(/\bpin:\s*/gi, '');
  s = s.replace(/\bR[,.]?Q\b/gi, 'RQ');
  s = s.replace(/\s*\/\/\s*/g, ' // ');
  s = s.replace(/\s{2,}/g, ' ').replace(/^\/\/\s*|\s*\/\/$/g, '').trim();
  if (!s) return '';
  if (s.length > max) return `${s.slice(0, max - 1).trim()}…`;
  return s;
}

const ACS_ALIASES = {
  S: 'S',
  W: 'W',
  B: 'B',
  C: 'C',
  UC: 'UC',
  OU: 'OU',
  SWG: 'SwG',
  SW: 'SwG',
};

export function emptyUnits() {
  return Object.fromEntries(UNIT_TYPES.map((u) => [u.id, 0]));
}

export function parseAcs(acs) {
  const counts = emptyUnits();
  if (!acs) return counts;
  const re = /(\d+)\s*([A-Za-z]+)/g;
  let m;
  while ((m = re.exec(String(acs))) !== null) {
    const id = ACS_ALIASES[m[2].toUpperCase()];
    if (id) counts[id] = (counts[id] || 0) + parseInt(m[1], 10);
  }
  return counts;
}

export function acsLabel(counts) {
  return UNIT_TYPES.map((u) => (counts[u.id] ? `${counts[u.id]}${u.id}` : null))
    .filter(Boolean)
    .join(' ');
}

export function acsTotal(countsOrString) {
  const counts = typeof countsOrString === 'string' || countsOrString == null
    ? parseAcs(countsOrString)
    : countsOrString;
  return UNIT_TYPES.reduce((n, u) => n + (counts[u.id] || 0), 0);
}

export function jobTypeOf(job) {
  if (job.job_type) return job.job_type;
  if (job.is_return) return 'return';
  const notes = String(job.notes || '').toLowerCase();
  if (notes.includes('influencer')) return 'influencer';
  return 'cleaning';
}

export function jobStatus(job) {
  return job && job.status === 'tentative' ? 'tentative' : 'confirmed';
}

export function formatMoney(n) {
  if (n == null || n === '') return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-HK');
}

export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function firstName(name) {
  if (!name) return 'Job';
  return String(name).trim().split(/\s+/)[0];
}

export function digits(mobile) {
  return String(mobile || '').replace(/[^\d+]/g, '');
}

export function weekNumber(iso) {
  const d = parseISO(iso);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

export function uid(prefix = 'job') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
