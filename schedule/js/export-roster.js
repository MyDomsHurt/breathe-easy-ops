/**
 * Jeff-only live-jobs .xlsx export: one Jobs sheet, one row per job.
 * Unit columns use the same ACS rules as td/dashboard/score-jobs.js
 * (last unit-token segment, half-clean 0.5, BEP parsed but excluded from Units).
 */
import { TEAMS } from './config.js';
import { isCrewNote, cellTeamMembers } from './team-day.js';
import { pad, timeToMinutes } from './utils.js';
import { isJeffEmail } from '../../shared/firebase-config.js';
import { allJobs, initStore, usingFirestore } from './store.js';

const SHEETJS_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const LEAD_MAP = {
  matthew: 'Matthew', tiago: 'Tiago', nick: 'Nick', alun: 'Alun',
  iggi: 'Iggi', josh: 'Josh', jut: 'Josh',
};
const UNIT_TYPES = ['S', 'W', 'WP', 'B', 'C', 'UC', 'TV', 'OU', 'SwG', 'EF', 'PAU'];
const ALIASES = {
  S: 'S', W: 'W', WP: 'WP', B: 'B', C: 'C', UC: 'UC', TV: 'TV', OU: 'OU',
  SWG: 'SwG', SW: 'SwG', EF: 'EF', PAU: 'PAU',
  OUTDOOR: 'OU', OUTDOORS: 'OU',
};
const HAS_UNIT_RE = /\d+(?:\.\d+)?\s*(?:SwG|SWG|UC|TV|OU|PAU|EF|BEP|WP|OUTDOORS?|[SWBC])\b/i;
const PAREN_S_RE = /\(\s*S\s*\)/i;
const NOISE_WORDS = {
  HALF: 1, PRICE: 1, CLEAN: 1, CLEANED: 1, CREDIT: 1, REFUND: 1, SAVE: 1, SAVED: 1,
  TOTAL: 1, FULL: 1, HOUR: 1, HOURS: 1, PM: 1, AM: 1, AS: 1, AND: 1, NEED: 1, ACS: 1,
  BEDROOM: 1, BEDROOMS: 1, TODAY: 1, DID: 1, ONLY: 1, FILTER: 1, FILTERS: 1, FAN: 1,
  FANS: 1, COIL: 1, KITCHEN: 1, MASTER: 1, LIVING: 1, ROOM: 1, ROOMS: 1, CANNOT: 1,
  CANT: 1, ACCESS: 1, FOR: 1, THE: 1, WITH: 1, FROM: 1, WILL: 1, COME: 1, BACK: 1,
  AFTER: 1, MR: 1, WONG: 1, FIXED: 1, BROKEN: 1, IS: 1, IN: 1, OF: 1, TO: 1, A: 1,
  PLUS: 1, ALL: 1, THERE: 1, TAKE: 1, OUT: 1, UNIT: 1, UNITS: 1, PER: 1, OFF: 1,
  RESCHEDULE: 1, RESCHEDULED: 1, RETURN: 1, RETURNS: 1, VISIT: 1, FREE: 1,
  INFLUENCER: 1, COLLAB: 1, DAY: 1, FINISHED: 1, G: 1, F: 1, OTHER: 1, BOTH: 1,
  DINING: 1, HELPER: 1, POOR: 1, INSTALLATION: 1, SEE: 1, NICK: 1, CHAT: 1,
  SUPER: 1, HEAVY: 1, PPL: 1, PEOPLE: 1, KIDS: 1, BABY: 1, TOILET: 1, SPACE: 1,
  ENOUGH: 1, NOT: 1, NO: 1, SO: 1, DIDNT: 1, DIDN: 1, REPAIR: 1, NEXT: 1, BY: 1,
  ON: 1, AT: 1, INTO: 1, TWO: 1, ACCOUNTS: 1, DIVIDED: 1, WINE: 1, CHILLERS: 1,
  CHILLER: 1, THERMAL: 1, AUG: 1, MAY: 1, JUN: 1, JUL: 1, SEP: 1, OCT: 1, NOV: 1,
  DEC: 1, JAN: 1, FEB: 1, MAR: 1, APR: 1, ADDRESSES: 1, BRAND: 1, NEW: 1,
  GRILLS: 1, GRILL: 1, REACH: 1, HE: 1, DEDUCT: 1, DEDCUT: 1, SMASH: 1,
};
const EQUIPMENT_UNKNOWN = {
  VENTILATOR: 1, VENTILATIOR: 1, DEHUMIDIFIER: 1, FS: 1, PH: 1, LEAK: 1,
  LEAKING: 1, INTERVIEW: 1, FILMING: 1, BATHROOM: 1, TECHNICIAN: 1,
};
const HEADERS = [
  'Job ID', 'Date', 'Time', 'Team', 'Who\u2019s on', 'Client', 'Mobile', 'Country', 'National', 'Address',
  'Line 1', 'Street', 'Place', 'Extra', 'ACs',
  'S', 'W', 'WP', 'B', 'C', 'UC', 'TV', 'OU', 'SwG', 'EF', 'PAU', 'BEP',
  'Units', 'Return', 'Amount', 'Invoice', 'Receipt', 'Payment', 'Notes 1', 'Notes 2',
];
const TEXT_COLS = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1,
  28: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1,
};
const NUM_COLS = {
  15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 29: 1,
};
const TEAM_RANK = {};
TEAMS.forEach((t, i) => { TEAM_RANK[t] = i; });

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

function canonicalLead(job) {
  const raw = String(job && job.team_lead || '').trim();
  return LEAD_MAP[raw.toLowerCase()] || '';
}

function emptyUnits() {
  const o = {};
  UNIT_TYPES.forEach((k) => { o[k] = 0; });
  return o;
}
function canonicalType(token) {
  const t = String(token || '').toUpperCase();
  if (t === 'BEP') return 'BEP';
  return ALIASES[t] || null;
}
function addUnit(counts, typ, n) {
  if (typ === 'BEP' || !typ) return;
  counts[typ] = (counts[typ] || 0) + Number(n);
}
function unitsDictCounts(job) {
  const units = job && job.units;
  if (!units || typeof units !== 'object' || Array.isArray(units)) return null;
  const counts = emptyUnits();
  Object.keys(units).forEach((k) => {
    const typ = canonicalType(k);
    if (typ && typ !== 'BEP') {
      const n = Number(units[k] || 0);
      if (!isNaN(n)) addUnit(counts, typ, n);
    }
  });
  return UNIT_TYPES.some((k) => counts[k]) ? counts : null;
}
function isEmptyAcs(job) {
  const acs = job && job.acs;
  return acs == null || String(acs).trim() === '';
}
function isReturn(job) {
  if (job && job.is_return === true) return true;
  if (String(job && job.job_type || '').trim().toLowerCase() === 'return') return true;
  return isEmptyAcs(job) && unitsDictCounts(job) == null;
}
function hasUnitTokens(text) {
  return HAS_UNIT_RE.test(text || '');
}
function lastUnitSegment(acs) {
  let s = String(acs || '').replace(/\u00a0/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/=\s*>/g, '=>');
  const parts = s.split(/\s*=>\s*|\s*>\s*/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return s;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (hasUnitTokens(parts[i]) || /half\s*clean/i.test(parts[i])) return parts[i];
  }
  return parts[parts.length - 1];
}
function stripHalfPrice(text) {
  let s = String(text || '').replace(/\([^)]*half\s*price[^)]*\)/gi, ' ');
  s = s.replace(/half\s*prices?/gi, ' ');
  return s;
}
function impliedType(acs) {
  const found = [];
  const re = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
  let m;
  while ((m = re.exec(acs || ''))) {
    const typ = canonicalType(m[2]);
    if (typ && typ !== 'BEP' && found.indexOf(typ) === -1) found.push(typ);
  }
  return found.length === 1 ? found[0] : null;
}
function halfToken(n, typ) {
  return ' ' + (Number(n) * 0.5) + typ + ' ';
}
function replaceAll(s, re, fn) {
  return s.replace(re, fn);
}
function replaceOnce(s, re, fn) {
  let done = false;
  return s.replace(re, function () {
    if (done) return arguments[0];
    done = true;
    return fn.apply(null, arguments);
  });
}
function rewriteHalfClean(segment, original) {
  let s = segment;
  s = s.replace(/\([^)]*need return[^)]*\)/gi, ' ');
  s = s.replace(/need return for \d+(?:\.\d+)?\s*[A-Za-z]+/gi, ' ');
  const uncleanRe = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*(?:cannot be cleaned|can'?t clean|no access|didn'?t clean|didnt clean)/i;
  let m = uncleanRe.exec(s);
  while (m) {
    const typ = canonicalType(m[2]);
    const n = parseFloat(m[1]);
    const prefix = s.slice(0, m.index);
    const suffix = s.slice(m.index + m[0].length);
    const precededByPlus = /\+\s*$/.test(prefix);
    let nextPrefix = prefix;
    if (typ && typ !== 'BEP' && !precededByPlus) {
      nextPrefix = replaceOnce(prefix, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/, function (all, num, tok) {
        if (canonicalType(tok) !== typ) return all;
        const left = parseFloat(num) - n;
        return left > 0 ? ' ' + left + typ + ' ' : ' ';
      });
    }
    s = nextPrefix + ' ' + suffix;
    uncleanRe.lastIndex = 0;
    m = uncleanRe.exec(s);
  }
  s = s.replace(/\(\s*,\s*/g, '(');
  function halfNType(all, num, tok) {
    const typ = canonicalType(tok);
    if (!typ || typ === 'BEP') return all;
    return halfToken(num, typ);
  }
  function splitNM(all, num, tok, halfN) {
    const typ = canonicalType(tok);
    if (!typ || typ === 'BEP') return all;
    const n = parseFloat(num);
    const hn = parseFloat(halfN);
    return ' ' + Math.max(n - hn, 0) + typ + ' ' + (hn * 0.5) + typ + ' ';
  }
  s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?[^)]*\)?/gi, splitNM);
  const restateRe = /\(\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+half\s*clean(?:ed)?[^)]*\)/gi;
  let restated = false;
  s = s.replace(restateRe, function (all, num, tok, offset, whole) {
    if (restated) return all;
    const typ = canonicalType(tok);
    if (!typ || typ === 'BEP') return all;
    const n = parseFloat(num);
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + all.length);
    const pattern = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + typ + '\\b', 'i');
    if (pattern.test(before)) {
      restated = true;
      const dropped = replaceOnce(before, pattern, function (mm, cnt) {
        const left = parseFloat(cnt) - n;
        if (left <= 0) return halfToken(n, typ);
        return ' ' + left + typ + ' ' + halfToken(n, typ);
      });
      s = dropped + after;
      return all;
    }
    return halfToken(num, typ);
  });
  s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*half\s*(?:clean(?:ed)?)?[^)]*\)/gi, halfNType);
  s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\(?\s*half\s*clean(?:ed)?\b[^)]*\)?/gi, halfNType);
  m = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+can only half clean/i.exec(s);
  if (m) {
    const typ = canonicalType(m[2]);
    const n = parseFloat(m[1]);
    if (typ && typ !== 'BEP') {
      const prefix = s.slice(0, m.index);
      const suffix = s.slice(m.index + m[0].length);
      const pattern = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + typ + '\\b', 'i');
      if (pattern.test(prefix)) {
        s = replaceOnce(prefix, pattern, function (all, cnt) {
          const left = parseFloat(cnt) - n;
          if (left <= 0) return halfToken(n, typ);
          return ' ' + left + typ + ' ' + halfToken(n, typ);
        }) + suffix;
      } else {
        s = prefix + halfToken(n, typ) + suffix;
      }
    }
  }
  function fullPlusHalf(all, a, b) {
    const typ = impliedType(original) || impliedType(segment);
    if (!typ) return all;
    return ' ' + (parseFloat(a) + parseFloat(b) * 0.5) + typ + ' ';
  }
  s = replaceAll(s, /(\d+(?:\.\d+)?)\s*full(?:\s*clean)?s?\s*\+?\s*(\d+(?:\.\d+)?)\s*half\s*clean/gi, fullPlusHalf);
  s = replaceAll(s, /(\d+(?:\.\d+)?)\s*full\s+(\d+(?:\.\d+)?)\s*half\s*clean/gi, fullPlusHalf);
  if (/both\s+half\s*clean/i.test(s)) {
    s = s.replace(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g, function (all, num, tok) {
      const typ = canonicalType(tok);
      if (!typ || typ === 'BEP') return all;
      return halfToken(num, typ);
    });
    s = s.replace(/both\s+half\s*clean(?:ed)?/gi, ' ');
  }
  let leftover = /half\s*clean/i.test(s);
  if (leftover) {
    const m3 = /(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?/i.exec(s);
    const typ = impliedType(original);
    if (m3 && typ) {
      const n = parseFloat(m3[1]);
      s = replaceOnce(s, /(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?/i, function () { return halfToken(n, typ); });
      s = replaceOnce(s, new RegExp('(\\d+(?:\\.\\d+)?)\\s*(' + typ + ')\\b', 'i'), function (all, cnt, tok) {
        if (canonicalType(tok) !== typ) return all;
        const left = parseFloat(cnt) - n;
        return left <= 0 ? ' ' : ' ' + left + typ + ' ';
      });
    }
  }
  leftover = /half\s*clean/i.test(s);
  return [s, !leftover];
}
function parsePlainUnits(text) {
  const counts = emptyUnits();
  const unknown = [];
  const re = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const typ = canonicalType(m[2]);
    if (typ === 'BEP') continue;
    if (typ) { addUnit(counts, typ, parseFloat(m[1])); continue; }
    const word = m[2].toUpperCase();
    if (NOISE_WORDS[word] || word === 'FULL' || word === 'HALF' || EQUIPMENT_UNKNOWN[word]) continue;
    unknown.push(m[1] + m[2]);
  }
  return [counts, unknown];
}
function parseAcs(acs) {
  const raw = String(acs || '').replace(/\u00a0/g, ' ').trim();
  if (!raw) return [emptyUnits(), true, 'empty_return'];
  if (/team\s*meeting/i.test(raw)) return [emptyUnits(), true, 'zero_skip'];
  if (/\bleak(?:ing)?\b/i.test(raw)) return [emptyUnits(), true, 'zero_day'];
  if (/\brefunds?\b/i.test(raw) && !hasUnitTokens(raw) && !PAREN_S_RE.test(raw)) return [emptyUnits(), true, 'zero_day'];
  if (/\bcall\b/i.test(raw) && !hasUnitTokens(raw) && !PAREN_S_RE.test(raw)) return [emptyUnits(), true, 'zero_day'];
  if (/^(PH|INTERVIEW|FILMING|TECHNICIAN INTERVIEW)$/i.test(raw)) return [emptyUnits(), false, 'non-unit ACS'];
  let segment = lastUnitSegment(raw);
  segment = stripHalfPrice(segment);
  const hw = rewriteHalfClean(segment, raw);
  const rewritten = hw[0];
  const halfSure = hw[1];
  if (/half\s*clean/i.test(segment) && !halfSure) return [emptyUnits(), false, 'ambiguous half-clean'];
  const pu = parsePlainUnits(rewritten);
  let counts = pu[0];
  const unknown = pu[1];
  if (!UNIT_TYPES.some((k) => counts[k]) && (PAREN_S_RE.test(raw) || PAREN_S_RE.test(rewritten))) {
    addUnit(counts, 'S', 1);
  }
  if (!UNIT_TYPES.some((k) => counts[k])) {
    if (unknown.length) return [emptyUnits(), false, 'unparsed ACS'];
    return [emptyUnits(), false, 'no countable units'];
  }
  return [counts, true, ''];
}
function unitsFromJob(job) {
  const dictCounts = unitsDictCounts(job);
  if (isEmptyAcs(job)) {
    if (dictCounts) return [dictCounts, true, ''];
    return [emptyUnits(), true, 'empty_return'];
  }
  return parseAcs(job.acs);
}
function countBep(text) {
  let n = 0;
  const re = /(\d+(?:\.\d+)?)\s*BEP\b/gi;
  let m;
  while ((m = re.exec(text || ''))) n += parseFloat(m[1]);
  return n;
}
function scoreTypes(job) {
  const out = emptyUnits();
  out.BEP = 0;
  if (isReturn(job)) return out;
  const u = unitsFromJob(job);
  UNIT_TYPES.forEach((k) => { out[k] = Number(u[0][k] || 0); });
  const raw = String(job && job.acs || '').replace(/\u00a0/g, ' ').trim();
  if (raw) {
    const seg = stripHalfPrice(lastUnitSegment(raw));
    const hw = rewriteHalfClean(seg, raw);
    out.BEP = countBep(hw[0]);
  } else if (job && job.units && job.units.BEP != null) {
    const n = Number(job.units.BEP);
    out.BEP = isNaN(n) ? 0 : n;
  }
  return out;
}

function amountOf(job) {
  if (job.amount == null || job.amount === '') return '';
  const n = Number(job.amount);
  return Number.isFinite(n) ? n : '';
}

function listExportJobs(jobs) {
  const real = (jobs || []).filter((j) => {
    if (!j || j.deleted || isCrewNote(j)) return false;
    const date = String(j.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return Boolean(canonicalLead(j));
  });
  real.sort((a, b) => {
    const da = String(a.date).localeCompare(String(b.date));
    if (da) return da;
    const ta = TEAM_RANK[canonicalLead(a)] - TEAM_RANK[canonicalLead(b)];
    if (ta) return ta;
    const tm = timeToMinutes(a.time) - timeToMinutes(b.time);
    if (tm) return tm;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  return real;
}

function sheetRow(j, all) {
  const lead = canonicalLead(j);
  const types = scoreTypes(j);
  const units = UNIT_TYPES.reduce((s, k) => s + Number(types[k] || 0), 0);
  const ret = isReturn(j);
  return [
    String(j.job_id || ''),
    String(j.date || '').trim(),
    j.time == null ? '' : String(j.time),
    lead,
    cellTeamMembers(all, j.date, lead) || '',
    j.client_name == null ? '' : String(j.client_name),
    j.mobile == null ? '' : String(j.mobile),
    j.phone_cc == null ? '' : String(j.phone_cc),
    j.phone_national == null ? '' : String(j.phone_national),
    j.address == null ? '' : String(j.address),
    j.address_line1 == null ? '' : String(j.address_line1),
    j.address_street == null ? '' : String(j.address_street),
    j.address_place == null ? '' : String(j.address_place),
    j.address_extra == null ? '' : String(j.address_extra),
    j.acs == null ? '' : String(j.acs),
    types.S, types.W, types.WP, types.B, types.C, types.UC, types.TV, types.OU, types.SwG, types.EF, types.PAU, types.BEP,
    units,
    ret ? 'Y' : '',
    amountOf(j),
    j.invoice == null ? '' : String(j.invoice),
    j.receipt == null ? '' : String(j.receipt),
    j.payment == null ? '' : String(j.payment),
    j.notes == null ? '' : String(j.notes),
    j.notes_long == null ? '' : String(j.notes_long),
  ];
}

function asText(v) {
  return v == null ? '' : String(v);
}

function changeLogRows(real) {
  const out = [];
  real.forEach((j) => {
    const lead = canonicalLead(j);
    const jobId = String(j.job_id || '');
    const date = String(j.date || '').trim();
    const client = j.client_name == null ? '' : String(j.client_name);
    const entries = Array.isArray(j.changes) ? j.changes : [];
    entries.forEach((ch) => {
      if (!ch || typeof ch !== 'object') return;
      const base = [
        jobId,
        date,
        client,
        lead,
        asText(ch.at),
        asText(ch.by),
        asText(ch.action),
      ];
      const diffs = Array.isArray(ch.diffs) ? ch.diffs : [];
      if (!diffs.length) {
        out.push(base.concat(['', '', '']));
        return;
      }
      diffs.forEach((d) => {
        const row = d && typeof d === 'object' ? d : {};
        out.push(base.concat([asText(row.field), asText(row.from), asText(row.to)]));
      });
    });
  });
  return out;
}

function cellFor(c, v, textCols, numCols) {
  if (v == null || v === '') return null;
  const text = textCols || TEXT_COLS;
  const nums = numCols || NUM_COLS;
  if (nums[c] && typeof v === 'number' && isFinite(v)) {
    return { t: 'n', v: v };
  }
  if (text[c]) {
    return { t: 's', v: String(v), z: '@' };
  }
  if (typeof v === 'number' && isFinite(v)) return { t: 'n', v: v };
  return { t: 's', v: String(v) };
}

function toSheet(headers, rows, spec) {
  const XLSX = window.XLSX;
  const textCols = spec && spec.textCols ? spec.textCols : TEXT_COLS;
  const numCols = spec && spec.numCols ? spec.numCols : NUM_COLS;
  const widthFor = spec && spec.widthFor ? spec.widthFor : function (c) {
    if (c === 0) return { wch: 18 };
    if (c === 1) return { wch: 12 };
    if (c === 5 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13 || c === 14 || c === 33 || c === 34) return { wch: 28 };
    if (c === 4) return { wch: 18 };
    if (NUM_COLS[c]) return { wch: 8 };
    return { wch: 14 };
  };
  const ws = {};
  const cols = headers.length;
  const lastR = rows.length;
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: c })] = { t: 's', v: h };
  });
  rows.forEach((row, i) => {
    const r = i + 1;
    row.forEach((v, c) => {
      const cell = cellFor(c, v, textCols, numCols);
      if (cell) ws[XLSX.utils.encode_cell({ r: r, c: c })] = cell;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastR, 0), c: cols - 1 } });
  ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', state: 'frozen' };
  ws['!cols'] = headers.map((h, c) => widthFor(c));
  return ws;
}

const JSON_KEYS = [
  'jobId', 'date', 'time', 'team', 'whosOn', 'client', 'mobile', 'phoneCc', 'phoneNational', 'address',
  'addressLine1', 'addressStreet', 'addressPlace', 'addressExtra', 'acs',
  'S', 'W', 'WP', 'B', 'C', 'UC', 'TV', 'OU', 'SwG', 'EF', 'PAU', 'BEP',
  'units', 'return', 'amount', 'invoice', 'receipt', 'payment', 'notes1', 'notes2',
];

function rowToJson(row, job) {
  const o = {};
  JSON_KEYS.forEach((key, i) => {
    let v = row[i];
    if (key === 'date') v = String(v || '').trim();
    else if (key === 'return') v = v ? 'Y' : '';
    else if (v == null) v = '';
    o[key] = v;
  });
  o.createdAt = asText(job && job.created_at);
  o.createdBy = asText(job && job.created_by);
  o.updatedAt = asText(job && job.updated_at);
  o.updatedBy = asText(job && job.updated_by);
  o.changes = Array.isArray(job && job.changes) ? job.changes : [];
  return o;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const CHANGE_HEADERS = ['Job ID', 'Date', 'Client', 'Team', 'At', 'By', 'Action', 'Field', 'From', 'To'];
const CHANGE_TEXT_COLS = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };

function changeColWidth(c) {
  if (c === 0) return { wch: 18 };
  if (c === 1) return { wch: 12 };
  if (c === 2) return { wch: 22 };
  if (c === 4 || c === 5) return { wch: 24 };
  if (c === 8 || c === 9) return { wch: 22 };
  return { wch: 14 };
}

function exportJobs(jobs) {
  const real = listExportJobs(jobs);
  const rows = real.map((j) => sheetRow(j, jobs));
  if (!rows.length) throw new Error('No jobs to export');
  const day = todayIso();
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, toSheet(HEADERS, rows), 'Jobs');
  const logRows = changeLogRows(real);
  window.XLSX.utils.book_append_sheet(
    wb,
    toSheet(CHANGE_HEADERS, logRows, { textCols: CHANGE_TEXT_COLS, numCols: {}, widthFor: changeColWidth }),
    'Change log'
  );
  const xlsxName = `breathe-easy-jobs-${day}.xlsx`;
  window.XLSX.writeFile(wb, xlsxName);
  const jsonName = `breathe-easy-jobs-${day}.json`;
  downloadJson(jsonName, real.map((j, i) => rowToJson(rows[i], j)));
  return { jobs: rows.length, name: xlsxName, json: jsonName };
}

function toastJeffOnly() {
  const msg = 'Only Jeff can export the roster';
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastJeffOnly._t);
    toastJeffOnly._t = setTimeout(() => el.classList.remove('show'), 2600);
  }
  throw new Error(msg);
}

export async function exportMasterRoster() {
  const email = (typeof firebase !== 'undefined'
    && firebase.auth
    && firebase.auth().currentUser
    && firebase.auth().currentUser.email) || '';
  if (!isJeffEmail(email)) toastJeffOnly();
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
