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

function contactNameParts(c) {
  const first = String(c && c.first_name || '').trim();
  const last = String(c && c.last_name || '').trim();
  return { first, last, name: [first, last].filter(Boolean).join(' ') };
}

/** Booking client box: name and phone only. Digit match. No job required. */
export function matchesBookingClient(c, query) {
  const raw = String(query || '').trim();
  if (!raw) return false;
  const s = raw.toLowerCase();
  const parts = contactNameParts(c);
  if (parts.name && parts.name.toLowerCase().includes(s)) return true;
  if (parts.first && parts.first.toLowerCase().includes(s)) return true;
  if (parts.last && parts.last.toLowerCase().includes(s)) return true;
  const qDigits = raw.replace(/\D/g, '');
  if (!qDigits) return false;
  const all = phoneDigits(c && c.phone);
  if (!all) return false;
  if (all === qDigits || all.includes(qDigits) || qDigits.includes(all)) return true;
  const tail = phoneTail8(c && c.phone);
  if (tail && (tail === qDigits || tail.endsWith(qDigits) || qDigits.endsWith(tail))) return true;
  return false;
}

export function searchBookingClients(list, query, limit = 7) {
  const rows = Array.isArray(list) ? list : [];
  const hits = rows.filter((c) => matchesBookingClient(c, query));
  hits.sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b)));
  const n = Number(limit);
  const cap = Number.isFinite(n) && n > 0 ? n : 7;
  return hits.slice(0, cap);
}

export function bookingFieldsFromContact(c) {
  const parts = contactNameParts(c);
  return {
    client_name: parts.name,
    phone: String(c && c.phone || '').trim(),
    address: String(c && c.address || '').trim(),
    address_line1: String(c && c.address_line1 || '').trim(),
    address_street: String(c && c.address_street || '').trim(),
    address_place: String(c && c.address_place || '').trim(),
    address_territory: String(c && c.address_territory || '').trim(),
    hubspot_id: String(c && c.hubspot_id || '').trim(),
  };
}
