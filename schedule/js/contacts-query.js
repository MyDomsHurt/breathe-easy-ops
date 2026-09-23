import { contactDisplayName, contactHasAddress, phoneDigits, phoneTail8 } from '../../shared/contact.js';

export function matchesContactQuery(c, query) {
  const s = String(query || '').trim().toLowerCase();
  if (!s) return true;
  if (contactDisplayName(c).toLowerCase().includes(s)) return true;
  if (String(c.instagram || '').toLowerCase().includes(s)) return true;
  if (String(c.stream || '').toLowerCase().includes(s)) return true;
  if (String(c.tag || '').toLowerCase().includes(s)) return true;
  const qDigits = s.replace(/\D/g, '');
  if (qDigits) {
    const all = phoneDigits(c.phone);
    const tail = phoneTail8(c.phone);
    if (tail && (tail === qDigits || tail.endsWith(qDigits) || qDigits.endsWith(tail))) return true;
    if (all && all.includes(qDigits)) return true;
  }
  return false;
}

function dealsOf(c) {
  const n = Number(c && c.deals);
  return Number.isFinite(n) ? n : 0;
}

function revenueOf(c) {
  const n = Number(c && c.revenue);
  return Number.isFinite(n) ? n : 0;
}

export function queryContacts(list, opts = {}) {
  const rows = Array.isArray(list) ? list : [];
  const q = opts.query || '';
  const stream = String(opts.stream || '').trim();
  const tag = String(opts.tag || '').trim();
  const language = String(opts.language || '').trim();
  const hasAddress = !!opts.hasAddress;
  const all = !!opts.all;
  const sort = opts.sort || 'name';
  const searching = !!String(q).trim();
  const out = rows.filter((c) => {
    if (!matchesContactQuery(c, q)) return false;
    if (!all && !searching && dealsOf(c) <= 0) return false;
    if (stream && String(c.stream || '') !== stream) return false;
    if (tag && String(c.tag || '') !== tag) return false;
    if (language && String(c.language || '') !== language) return false;
    if (hasAddress && !contactHasAddress(c)) return false;
    return true;
  });
  out.sort((a, b) => {
    if (sort === 'deals') return dealsOf(b) - dealsOf(a) || contactDisplayName(a).localeCompare(contactDisplayName(b));
    if (sort === 'revenue') return revenueOf(b) - revenueOf(a) || contactDisplayName(a).localeCompare(contactDisplayName(b));
    return contactDisplayName(a).localeCompare(contactDisplayName(b));
  });
  return out;
}

export function uniqueContactValues(list, field) {
  const set = new Set();
  (list || []).forEach((c) => {
    const v = String(c && c[field] || '').trim();
    if (v) set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}
