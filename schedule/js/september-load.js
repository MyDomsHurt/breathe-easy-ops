/**
 * Jeff-only one-time September glance load. Maps with scripts/september-glance.js.
 * Does not write. Apply lives on the signed-in store.
 */

import {
  inSeptember,
  loadGlance,
  SEP_FROM,
  SEP_TO,
  softDeleteIds,
} from '../../scripts/september-glance.js';

export const EXPECT_JOBS = 397;
export const EXPECT_CREW = 180;
export const SEP_LOADED_KEY = 'be-ops-september-2026-loaded';
export const REFUSE_MSG = 'Need 397 jobs and 180 crew notes, dates 1–30 Sep only.';

function rowDate(row) {
  return String((row && row.date) || '').slice(0, 10);
}

function rawRows(data) {
  const root = data && typeof data === 'object' ? data : {};
  const jobs = Array.isArray(data) ? data : (Array.isArray(root.jobs) ? root.jobs : []);
  const crew = Array.isArray(data) ? [] : (Array.isArray(root.crew_notes) ? root.crew_notes : []);
  return jobs.concat(crew);
}

export function glanceDatesOnlySeptember(data) {
  const rows = rawRows(data);
  if (!rows.length) return false;
  for (const row of rows) {
    const d = rowDate(row);
    if (!d || d < SEP_FROM || d > SEP_TO) return false;
  }
  return true;
}

export function validateSeptemberGlance(data) {
  if (!glanceDatesOnlySeptember(data)) {
    return { ok: false, error: REFUSE_MSG };
  }
  const mapped = loadGlance(data);
  if (mapped.jobs.length !== EXPECT_JOBS || mapped.crew.length !== EXPECT_CREW) {
    return { ok: false, error: REFUSE_MSG };
  }
  if (!mapped.jobs.every((j) => inSeptember(j.date))) {
    return { ok: false, error: REFUSE_MSG };
  }
  if (!mapped.crew.every((c) => inSeptember(c.date))) {
    return { ok: false, error: REFUSE_MSG };
  }
  return { ok: true, jobs: mapped.jobs, crew: mapped.crew };
}

export function planSeptemberLoad(liveJobs, jobs, crew) {
  const jobList = Array.isArray(jobs) ? jobs : [];
  const crewList = Array.isArray(crew) ? crew : [];
  const deletes = softDeleteIds(liveJobs, jobList.map((j) => j.job_id));
  return {
    jobUpserts: jobList.length,
    crewUpserts: crewList.length,
    softDeletes: deletes,
  };
}

export function planSeptemberLines(plan) {
  const n = plan && Array.isArray(plan.softDeletes) ? plan.softDeletes.length : 0;
  const jobs = plan && plan.jobUpserts != null ? plan.jobUpserts : 0;
  const crew = plan && plan.crewUpserts != null ? plan.crewUpserts : 0;
  return [
    jobs + ' job upserts',
    crew + ' crew upserts',
    n + ' live September jobs would be soft-deleted',
  ];
}

export function septemberLoadDone() {
  try {
    return localStorage.getItem(SEP_LOADED_KEY) === '1';
  } catch {
    return false;
  }
}

function setLocalDone() {
  try {
    localStorage.setItem(SEP_LOADED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function markSeptemberLoadDone() {
  setLocalDone();
  try {
    const email = String(
      (typeof firebase !== 'undefined'
        && firebase.auth
        && firebase.auth().currentUser
        && firebase.auth().currentUser.email) || '',
    ).toLowerCase().trim();
    if (!email) return;
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return;
    firebase.firestore().collection('settings').doc(email).set(
      { september_2026_loaded: true },
      { merge: true },
    );
  } catch {
    /* hide still sticks in localStorage */
  }
}

export async function readSeptemberLoadDone() {
  if (septemberLoadDone()) return true;
  try {
    const email = String(
      (typeof firebase !== 'undefined'
        && firebase.auth
        && firebase.auth().currentUser
        && firebase.auth().currentUser.email) || '',
    ).toLowerCase().trim();
    if (!email) return false;
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return false;
    const snap = await firebase.firestore().collection('settings').doc(email).get();
    const data = snap && snap.exists ? (snap.data() || {}) : {};
    if (data.september_2026_loaded) {
      setLocalDone();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
