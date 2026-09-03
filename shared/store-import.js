/**
 * Load current /schedule seed jobs and /td jobs into canonical form.
 *
 * Does not invent clients. Same job_id from both sources is merged, not
 * duplicated. Prefer the richer record; keep both faces’ fields.
 *
 * Not imported by /schedule or /td yet.
 */

import { CANONICAL_FIELDS, fromScheduleJob, fromTdJob, normalizeJob } from './job.js';

export const DEFAULT_SOURCES = {
  scheduleWeek: 'schedule/data/week-2026-08-17.json',
  tdManifest: 'td/data/manifest.json',
  tdJobs: 'td/data/jobs.json',
  tdPartsDir: 'td/data/',
};

export function isUsableJob(job) {
  return !!(job && String(job.job_id || '').trim() && String(job.client_name || '').trim());
}

export function isEmptyValue(value) {
  return value == null || value === '';
}

export function fieldRichness(job) {
  let n = 0;
  for (const key of CANONICAL_FIELDS) {
    if (!isEmptyValue(job[key])) n += 1;
  }
  return n;
}

/**
 * Merge two jobs with the same job_id.
 * Work on the raw records first so normaliser defaults (e.g. status:
 * confirmed) do not wipe a real value from the other face. Filled values
 * beat empty. On a true conflict, the richer record wins, then remaining
 * empties are filled from the other so TD-only and schedule-only fields
 * both survive. Then one normalizeJob pass.
 */
export function mergeCanonicalJobs(a, b) {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  const richer = fieldRichness(right) > fieldRichness(left) ? right : left;
  const other = richer === left ? right : left;
  const out = { ...other, ...richer };
  for (const key of Object.keys(other)) {
    if (isEmptyValue(out[key]) && !isEmptyValue(other[key])) out[key] = other[key];
  }
  return normalizeJob(out);
}

export function combineExistingJobs(scheduleJobs, tdJobs) {
  const byId = new Map();
  const stats = { schedule: 0, td: 0, skipped: 0, merged: 0 };

  function ingest(list, mapFn, counterKey) {
    for (const raw of Array.isArray(list) ? list : []) {
      const job = mapFn(raw);
      if (!isUsableJob(job)) {
        stats.skipped += 1;
        continue;
      }
      stats[counterKey] += 1;
      const prev = byId.get(job.job_id);
      if (prev) {
        byId.set(job.job_id, mergeCanonicalJobs(prev, job));
        stats.merged += 1;
      } else {
        byId.set(job.job_id, job);
      }
    }
  }

  ingest(scheduleJobs, fromScheduleJob, 'schedule');
  ingest(tdJobs, fromTdJob, 'td');

  return { jobs: [...byId.values()], stats };
}

export async function loadScheduleSeedJobs(options = {}) {
  const fetchImpl = options.fetch || globalFetch();
  const url = resolveUrl(options.baseUrl, (options.paths || DEFAULT_SOURCES).scheduleWeek);
  const res = await fetchImpl(url);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function loadTdJobs(options = {}) {
  const fetchImpl = options.fetch || globalFetch();
  const paths = options.paths || DEFAULT_SOURCES;
  const partsDir = resolveUrl(options.baseUrl, paths.tdPartsDir);
  const manifestUrl = resolveUrl(options.baseUrl, paths.tdManifest);

  try {
    const man = await fetchImpl(manifestUrl);
    if (man && man.ok) {
      const files = await man.json();
      if (Array.isArray(files) && files.length) {
        const parts = await Promise.all(
          files.map((file) =>
            fetchImpl(partsDir + file)
              .then((r) => (r && r.ok ? r.json() : []))
              .catch(() => [])
          )
        );
        const flat = parts.flat();
        if (flat.length) return flat;
      }
    }
  } catch {
    // Fall through to jobs.json.
  }

  const res = await fetchImpl(resolveUrl(options.baseUrl, paths.tdJobs));
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function loadExistingCanonicalJobs(options = {}) {
  const [scheduleJobs, tdJobs] = await Promise.all([
    options.scheduleJobs ? Promise.resolve(options.scheduleJobs) : loadScheduleSeedJobs(options),
    options.tdJobs ? Promise.resolve(options.tdJobs) : loadTdJobs(options),
  ]);
  return combineExistingJobs(scheduleJobs, tdJobs);
}

export async function seedStore(store, options = {}) {
  const { jobs, stats } = await loadExistingCanonicalJobs(options);
  const imported = store.importJobs(jobs);
  return { ...stats, imported: imported.length, jobs: imported };
}

function globalFetch() {
  if (typeof fetch === 'function') return fetch;
  throw new Error('fetch is not available; pass { fetch } or { scheduleJobs, tdJobs }');
}

function resolveUrl(baseUrl, path) {
  if (!path) return path;
  if (!baseUrl) return path;
  try {
    return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  } catch {
    return `${String(baseUrl).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  }
}
