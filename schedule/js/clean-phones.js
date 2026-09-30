/**
 * Jeff-only one-time cleanup: parse live job phones and attach one HubSpot contact.
 * Does not write. Apply lives on the signed-in store.
 * Does not create contacts. Does not write HubSpot deals.
 */

import { matchHubspotIdByPhone, parsePhone } from '../../shared/phone-parse.js';
import { isCrewNote } from '../../shared/team-day.js';

export const PHONES_CLEANED_KEY = 'be-ops-job-phones-cleaned';

function skipJob(job) {
  if (!job || !job.job_id) return true;
  if (isCrewNote(job)) return true;
  if (job.deleted === true || job.deleted === 'true') return true;
  return false;
}

function field(value) {
  return String(value == null ? '' : value).trim();
}

export function plannedPhoneFields(job, contacts) {
  const raw = field(job && job.mobile);
  let mobile;
  let phone_cc;
  let phone_national;
  if (!raw) {
    mobile = '';
    phone_cc = '';
    phone_national = '';
  } else {
    const parsed = parsePhone(raw);
    if (parsed.resolved && parsed.full) {
      mobile = parsed.full;
      phone_cc = field(parsed.country);
      phone_national = field(parsed.national);
    } else {
      mobile = raw;
      phone_cc = field(job && job.phone_cc);
      phone_national = field(job && job.phone_national);
    }
  }
  const hit = matchHubspotIdByPhone(mobile, contacts);
  const hubspot_id = hit.status === 'one' ? field(hit.hubspot_id) : '';
  const phoneChanged = field(job && job.mobile) !== mobile
    || field(job && job.phone_cc) !== phone_cc
    || field(job && job.phone_national) !== phone_national;
  const idChanged = field(job && job.hubspot_id) !== hubspot_id;
  return {
    mobile,
    phone_cc,
    phone_national,
    hubspot_id,
    matchStatus: hit.status,
    phoneChanged,
    changed: phoneChanged || idChanged,
  };
}

export function planCleanPhones(liveJobs, contacts) {
  const updates = [];
  let phonesCleaned = 0;
  let oneMatches = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let alreadyClean = 0;
  for (const job of liveJobs || []) {
    if (skipJob(job)) continue;
    const planned = plannedPhoneFields(job, contacts);
    if (planned.matchStatus === 'one') oneMatches += 1;
    else if (planned.matchStatus === 'ambiguous') ambiguous += 1;
    else unmatched += 1;
    if (planned.phoneChanged) phonesCleaned += 1;
    if (!planned.changed) {
      alreadyClean += 1;
      continue;
    }
    updates.push({
      job_id: String(job.job_id),
      mobile: planned.mobile,
      phone_cc: planned.phone_cc,
      phone_national: planned.phone_national,
      hubspot_id: planned.hubspot_id,
      phoneChanged: planned.phoneChanged,
      matchStatus: planned.matchStatus,
      base: job,
    });
  }
  return {
    phonesCleaned,
    oneMatches,
    unmatched,
    ambiguous,
    alreadyClean,
    updates,
  };
}

export function planCleanPhonesLines(plan) {
  const phones = plan && plan.phonesCleaned != null ? plan.phonesCleaned : 0;
  const one = plan && plan.oneMatches != null ? plan.oneMatches : 0;
  const unmatched = plan && plan.unmatched != null ? plan.unmatched : 0;
  const ambiguous = plan && plan.ambiguous != null ? plan.ambiguous : 0;
  const clean = plan && plan.alreadyClean != null ? plan.alreadyClean : 0;
  return [
    phones + ' phones cleaned',
    one + ' one-contact matches',
    unmatched + ' unmatched',
    ambiguous + ' ambiguous',
    clean + ' already clean',
  ];
}

export function phonesCleanedDone() {
  try {
    return localStorage.getItem(PHONES_CLEANED_KEY) === '1';
  } catch {
    return false;
  }
}

function setLocalDone() {
  try {
    localStorage.setItem(PHONES_CLEANED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function markPhonesCleanedDone() {
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
      { job_phones_cleaned: true },
      { merge: true },
    );
  } catch {
    /* hide still sticks in localStorage */
  }
}

export async function readPhonesCleanedDone() {
  if (phonesCleanedDone()) return true;
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
    if (data.job_phones_cleaned) {
      setLocalDone();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
