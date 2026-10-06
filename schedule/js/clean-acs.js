/**
 * Jeff-only one-time cleanup: job.acs is the current unit string.
 * Office arrows in the ACs cell move the full cell into notes.
 * BEP is not a unit; that token moves into notes.
 * Does not write. Apply lives on the signed-in store.
 */

import { isCrewNote } from '../../shared/team-day.js';

export const ACS_CLEANED_KEY = 'be-ops-job-acs-cleaned';

const UNIT_IDS = new Set([
  'S', 'W', 'WP', 'B', 'BH', 'B½', 'C', 'UC', 'OU', 'SWG', 'SW',
  'TV', 'EF', 'PAU', 'OUTDOOR', 'OUTDOORS',
]);
const TOKEN_RE = /(\d+(?:\.\d+)?)\s*(B½|BEP|WP|SwG|SWG|UC|OU|PAU|TV|EF|Bh|OUTDOORS?|[A-Za-z]+)/gi;
const BEP_RE = /(\d+(?:\.\d+)?)\s*BEP\b/gi;
const ARROW_RE = /\s*=>\s*|\s*>\s*/;

export function hasAcsArrow(raw) {
  const s = String(raw == null ? '' : raw).replace(/\u00a0/g, ' ').replace(/=\s*>/g, '=>');
  return ARROW_RE.test(s);
}

export function isUnitString(side) {
  const s = String(side == null ? '' : side).replace(/\u00a0/g, ' ').trim();
  if (!s) return false;
  let foundUnit = false;
  const leftover = s.replace(TOKEN_RE, (m, _n, typ) => {
    const t = String(typ || '').replace('½', 'H').toUpperCase();
    if (t === 'BEP') return ' ';
    if (UNIT_IDS.has(t) || UNIT_IDS.has(String(typ || '').toUpperCase())) {
      foundUnit = true;
      return ' ';
    }
    return m;
  });
  const rest = leftover.replace(/[+,/&()[\]\-.·|]/g, ' ').replace(/\s+/g, ' ').trim();
  return foundUnit && !rest;
}

function splitAcsArrow(raw) {
  const s = String(raw == null ? '' : raw).replace(/\u00a0/g, ' ').replace(/=\s*>/g, '=>').trim();
  if (!s || !ARROW_RE.test(s)) return { arrow: false, parts: s ? [s] : [] };
  const parts = s.split(ARROW_RE).map((p) => p.trim()).filter(Boolean);
  return { arrow: parts.length >= 2, parts };
}

function bepTokens(acs) {
  const tokens = [];
  const re = new RegExp(BEP_RE.source, 'gi');
  let m;
  const s = String(acs == null ? '' : acs);
  while ((m = re.exec(s)) !== null) {
    tokens.push(m[0].replace(/\s+/g, ' ').trim());
  }
  return tokens;
}

function stripBep(acs) {
  const tokens = bepTokens(acs);
  const next = String(acs == null ? '' : acs)
    .replace(BEP_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { acs: next, tokens };
}

export function appendNote(existing, extra) {
  const have = existing == null ? '' : String(existing);
  const add = String(extra == null ? '' : extra).trim();
  if (!add) return have;
  if (have.indexOf(add) !== -1) return have;
  const trimmed = have.replace(/\s+$/, '');
  if (!trimmed) return add;
  return trimmed + ' ' + add;
}

export function cleanJobAcs(job) {
  const raw = String(job && job.acs != null ? job.acs : '').replace(/\u00a0/g, ' ').trim();
  const notes0 = job && job.notes != null ? String(job.notes) : '';
  if (!raw) {
    return {
      acs: '',
      notes: notes0,
      arrow: false,
      from: null,
      to: null,
      changed: false,
      listed: false,
      listedSide: '',
      bepTokens: [],
    };
  }

  const split = splitAcsArrow(raw);
  if (split.arrow) {
    const last = split.parts[split.parts.length - 1] || '';
    if (!isUnitString(last)) {
      return {
        acs: raw,
        notes: notes0,
        arrow: false,
        from: null,
        to: null,
        changed: false,
        listed: true,
        listedSide: last,
        bepTokens: [],
      };
    }
    let acs = last;
    let notes = appendNote(notes0, raw);
    const bep = stripBep(acs);
    acs = bep.acs;
    for (const token of bep.tokens) notes = appendNote(notes, token);
    return {
      acs,
      notes,
      arrow: true,
      from: raw,
      to: acs,
      changed: acs !== raw || notes !== notes0,
      listed: false,
      listedSide: '',
      bepTokens: bep.tokens,
    };
  }

  const bep = stripBep(raw);
  if (!bep.tokens.length) {
    return {
      acs: raw,
      notes: notes0,
      arrow: false,
      from: null,
      to: null,
      changed: false,
      listed: false,
      listedSide: '',
      bepTokens: [],
    };
  }
  let notes = notes0;
  for (const token of bep.tokens) notes = appendNote(notes, token);
  return {
    acs: bep.acs,
    notes,
    arrow: false,
    from: null,
    to: null,
    changed: bep.acs !== raw || notes !== notes0,
    listed: false,
    listedSide: '',
    bepTokens: bep.tokens,
  };
}

function skipJob(job) {
  if (!job || !job.job_id) return true;
  if (isCrewNote(job)) return true;
  if (job.deleted === true || job.deleted === 'true') return true;
  return false;
}

export function planCleanAcs(liveJobs) {
  const updates = [];
  const listed = [];
  let alreadyClean = 0;
  for (const job of liveJobs || []) {
    if (skipJob(job)) continue;
    const cleaned = cleanJobAcs(job);
    if (cleaned.listed) {
      listed.push({
        job_id: String(job.job_id),
        side: cleaned.listedSide,
      });
      continue;
    }
    if (!cleaned.changed) {
      alreadyClean += 1;
      continue;
    }
    updates.push({
      job_id: String(job.job_id),
      acs: cleaned.acs,
      notes: cleaned.notes,
      arrow: cleaned.arrow,
      from: cleaned.from,
      to: cleaned.to,
      bepTokens: cleaned.bepTokens,
      base: job,
    });
  }
  return {
    wouldChange: updates.length,
    arrowLogs: updates.filter((u) => u.arrow).length,
    bepMoves: updates.reduce((n, u) => n + ((u.bepTokens && u.bepTokens.length) || 0), 0),
    alreadyClean,
    listed,
    updates,
  };
}

export function planCleanAcsLines(plan) {
  const change = plan && plan.wouldChange != null ? plan.wouldChange : 0;
  const arrows = plan && plan.arrowLogs != null ? plan.arrowLogs : 0;
  const bep = plan && plan.bepMoves != null ? plan.bepMoves : 0;
  const clean = plan && plan.alreadyClean != null ? plan.alreadyClean : 0;
  const listed = plan && Array.isArray(plan.listed) ? plan.listed : [];
  const lines = [
    change + ' jobs would change',
    arrows + ' arrows become change-log rows',
    bep + ' BEP tokens move to notes',
    clean + ' already clean',
  ];
  if (listed.length) {
    lines.push(listed.length + ' sentences listed not written');
    listed.forEach((row) => {
      lines.push(String(row.job_id || '') + ' ' + String(row.side || ''));
    });
  }
  return lines;
}

export function acsCleanedDone() {
  try {
    return localStorage.getItem(ACS_CLEANED_KEY) === '1';
  } catch {
    return false;
  }
}

function setLocalDone() {
  try {
    localStorage.setItem(ACS_CLEANED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function markAcsCleanedDone() {
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
      { job_acs_cleaned: true },
      { merge: true },
    );
  } catch {
    /* hide still sticks in localStorage */
  }
}

export async function readAcsCleanedDone() {
  if (acsCleanedDone()) return true;
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
    if (data.job_acs_cleaned) {
      setLocalDone();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
