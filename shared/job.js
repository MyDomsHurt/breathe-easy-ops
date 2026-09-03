/**
 * Canonical job record + normaliser.
 *
 * Maps current /schedule jobs and current /td jobs into one shape.
 * Not imported by either app yet — do not switch stores in this slice.
 *
 * See shared/job-model.md
 */

export const JOB_TYPES = ['cleaning', 'return', 'influencer'];
export const STATUSES = ['confirmed', 'tentative'];
export const PAYMENT_STATUSES = ['PAID', 'UNPAID'];

/** Unit order used by the Scheduling App when collapsing a units object to acs. */
const UNIT_ORDER = ['S', 'W', 'B', 'C', 'UC', 'OU', 'SwG'];

export const CANONICAL_FIELDS = [
  'job_id',
  'date',
  'time',
  'team_lead',
  'team_members',
  'client_name',
  'mobile',
  'address',
  'district',
  'acs',
  'notes',
  'amount',
  'invoice',
  'receipt',
  'payment',
  'payment_status',
  'job_type',
  'is_return',
  'status',
  'stack_order',
  'week',
  'month',
  'updated_at',
  'deleted',
  'slot',
  'source',
];

const KNOWN = new Set(CANONICAL_FIELDS);

export function normalizeJob(raw, opts) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const options = opts || {};
  const date = asDate(input.date);
  const jobType = inferJobType(input);
  const acs = acsValue(input, jobType);

  const job = {
    job_id: input.job_id != null && String(input.job_id).trim() !== '' ? String(input.job_id) : '',
    date,
    time: input.time == null ? '' : String(input.time),
    team_lead: textOrNull(input.team_lead) || '',
    team_members: textOrNull(input.team_members),
    client_name: textOrNull(input.client_name) || '',
    mobile: textOrNull(input.mobile),
    address: textOrNull(input.address),
    district: textOrNull(input.district),
    acs,
    notes: textOrNull(input.notes),
    amount: asAmount(input.amount),
    invoice: textOrNull(input.invoice),
    receipt: textOrNull(input.receipt),
    payment: textOrNull(input.payment),
    payment_status: inferPaymentStatus(input),
    job_type: jobType,
    is_return: jobType === 'return',
    status: input.status === 'tentative' ? 'tentative' : 'confirmed',
    stack_order: asStackOrder(input.stack_order),
    week: asOptionalNumber(input.week, date ? weekNumber(date) : null),
    month: asOptionalNumber(input.month, date ? monthNumber(date) : null),
    updated_at: asUpdatedAt(input.updated_at, options.now),
    deleted: input.deleted === true || input.deleted === 'true',
    slot: textOrNull(input.slot),
    source: textOrNull(input.source),
  };

  if (options.keepUnknown !== false) {
    for (const key of Object.keys(input)) {
      if (KNOWN.has(key) || key === 'units') continue;
      if (job[key] === undefined) job[key] = input[key];
    }
  }

  return job;
}

export function normalizeJobs(list, opts) {
  return (Array.isArray(list) ? list : []).map((row) => normalizeJob(row, opts));
}

/** Current Scheduling App records (seed, localStorage extras, job-shape.json). */
export function fromScheduleJob(raw, opts) {
  return normalizeJob(raw, opts);
}

/** Current Technician Dashboard records (jobs.json, jobs_part_*, jobs-sample.json). */
export function fromTdJob(raw, opts) {
  return normalizeJob(raw, opts);
}

/** Office master-sheet strip. Later backup must still be able to emit this. */
export function toSheetStrip(job) {
  const j = normalizeJob(job);
  return {
    name: j.client_name,
    time: j.time,
    mobile: j.mobile,
    address: j.address,
    acs: j.acs,
    notes: j.notes,
    amount: j.amount,
    invoice: j.invoice,
    receipt: j.receipt,
    payment: j.payment,
  };
}

export function emptyCanonicalJob() {
  return normalizeJob({});
}

function textOrNull(value) {
  if (value == null) return null;
  const s = String(value);
  return s.trim() === '' ? null : s;
}

function asDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (value == null || value === '' ? '' : String(value));
}

function asAmount(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStackOrder(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asOptionalNumber(value, fallback) {
  if (value != null && value !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback == null ? null : fallback;
}

function asUpdatedAt(value, now) {
  if (value != null && String(value).trim() !== '') return String(value);
  if (now == null || now === false) return null;
  if (now === true) return new Date().toISOString();
  if (now instanceof Date) return now.toISOString();
  return String(now);
}

function inferJobType(input) {
  const t = String(input.job_type || '').toLowerCase().trim();
  if (JOB_TYPES.includes(t)) return t;
  if (input.is_return === true || input.is_return === 'true') return 'return';
  const notes = String(input.notes || '').toLowerCase();
  if (notes.includes('influencer')) return 'influencer';
  return 'cleaning';
}

function acsFromUnits(units) {
  if (!units || typeof units !== 'object') return '';
  return UNIT_ORDER
    .filter((id) => Number(units[id]) > 0)
    .map((id) => `${Number(units[id])}${id}`)
    .join(' ');
}

function acsValue(input, jobType) {
  if (input.acs != null && String(input.acs).trim() !== '') return String(input.acs);
  const fromUnits = acsFromUnits(input.units);
  if (fromUnits) return fromUnits;
  if (jobType === 'return') return input.acs == null ? null : '';
  return textOrNull(input.acs);
}

function inferPaymentStatus(input) {
  if (input.payment_status != null && String(input.payment_status).trim() !== '') {
    const s = String(input.payment_status).trim().toUpperCase();
    if (s === 'PAID' || s === 'UNPAID') return s;
  }
  const pay = String(input.payment || '').trim().toLowerCase();
  if (pay === 'unpaid') return 'UNPAID';
  if (input.receipt != null && String(input.receipt).trim() !== '') return 'PAID';
  return null;
}

/** Same formula as schedule/js/utils.js weekNumber. */
export function weekNumber(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

export function monthNumber(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[2]) : null;
}

const api = {
  JOB_TYPES,
  STATUSES,
  PAYMENT_STATUSES,
  CANONICAL_FIELDS,
  normalizeJob,
  normalizeJobs,
  fromScheduleJob,
  fromTdJob,
  toSheetStrip,
  emptyCanonicalJob,
  weekNumber,
  monthNumber,
};

export default api;

if (typeof window !== 'undefined') window.BEJob = api;
