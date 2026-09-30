/**
 * Jeff-only one-time cleanup: job time is one start clock (HH:MM).
 * Office arrows in the Time cell become change-log rows.
 * Does not write. Apply lives on the signed-in store.
 */

import { formatTime24 } from './utils.js';
import { isCrewNote } from '../../shared/team-day.js';

export const TIMES_CLEANED_KEY = 'be-ops-job-times-cleaned';

const ARROW_RE = /\s*(?:=>|->|→|⇒)\s*/;

export function hasTimeArrow(raw) {
  return ARROW_RE.test(String(raw == null ? '' : raw));
}

export function cleanJobTime(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) {
    return { time: '', arrow: false, from: null, to: null, changed: false };
  }
  if (hasTimeArrow(s)) {
    const parts = s.split(ARROW_RE).map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const prev = parts.length >= 2 ? parts[parts.length - 2] : '';
    const to = formatTime24(last);
    if (!to) {
      return { time: s, arrow: false, from: null, to: null, changed: false };
    }
    const from = formatTime24(prev) || (prev ? prev : '—');
    return {
      time: to,
      arrow: true,
      from,
      to,
      changed: s !== to,
    };
  }
  const hhmm = formatTime24(s);
  if (!hhmm) {
    return { time: s, arrow: false, from: null, to: null, changed: false };
  }
  return {
    time: hhmm,
    arrow: false,
    from: null,
    to: null,
    changed: s !== hhmm,
  };
}

function skipJob(job) {
  if (!job || !job.job_id) return true;
  if (isCrewNote(job)) return true;
  if (job.deleted === true || job.deleted === 'true') return true;
  return false;
}

export function planCleanTimes(liveJobs) {
  const updates = [];
  let alreadyClean = 0;
  for (const job of liveJobs || []) {
    if (skipJob(job)) continue;
    const cleaned = cleanJobTime(job.time);
    if (!cleaned.changed) {
      alreadyClean += 1;
      continue;
    }
    updates.push({
      job_id: String(job.job_id),
      time: cleaned.time,
      arrow: cleaned.arrow,
      from: cleaned.from,
      to: cleaned.to,
      base: job,
    });
  }
  return {
    wouldChange: updates.length,
    arrowLogs: updates.filter((u) => u.arrow).length,
    alreadyClean,
    updates,
  };
}

export function planCleanTimesLines(plan) {
  const change = plan && plan.wouldChange != null ? plan.wouldChange : 0;
  const arrows = plan && plan.arrowLogs != null ? plan.arrowLogs : 0;
  const clean = plan && plan.alreadyClean != null ? plan.alreadyClean : 0;
  return [
    change + ' jobs would change',
    arrows + ' arrows become change-log rows',
    clean + ' already clean',
  ];
}

export function timesCleanedDone() {
  try {
    return localStorage.getItem(TIMES_CLEANED_KEY) === '1';
  } catch {
    return false;
  }
}

function setLocalDone() {
  try {
    localStorage.setItem(TIMES_CLEANED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function markTimesCleanedDone() {
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
      { job_times_cleaned: true },
      { merge: true },
    );
  } catch {
    /* hide still sticks in localStorage */
  }
}

export async function readTimesCleanedDone() {
  if (timesCleanedDone()) return true;
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
    if (data.job_times_cleaned) {
      setLocalDone();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
