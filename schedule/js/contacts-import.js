/**
 * Map a HubSpot all-contacts CSV onto the Booking contact fields.
 * Ignores every other column.
 */

import { normalizeContact } from '../../shared/contact.js';

const COL_ALIASES = {
  hubspot_id: ['record id', 'hs_object_id', 'hubspot id', 'contact id', 'record_id'],
  first_name: ['first name', 'firstname', 'first_name'],
  last_name: ['last name', 'lastname', 'last_name'],
  phone: ['profile phone number', 'profile_phone_number'],
  address: ['full address 1', 'full_address_1'],
  address_line1: ['billing address line 1', 'billing line 1', 'billing_address_line_1'],
  address_street: ['billing street', 'billing_street'],
  address_place: ['billing city', 'billing_city'],
  address_territory: ['billing state', 'billing_state'],
  deals: ['number of associated deals', 'deals', 'num_associated_deals'],
  revenue: ['total revenue', 'revenue', 'total_revenue'],
};

function normHeader(s) {
  return String(s || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function headerIndex(headers) {
  const map = {};
  const list = (headers || []).map(normHeader);
  Object.keys(COL_ALIASES).forEach((field) => {
    const aliases = COL_ALIASES[field];
    let idx = -1;
    for (let i = 0; i < aliases.length; i += 1) {
      idx = list.indexOf(aliases[i]);
      if (idx >= 0) break;
    }
    map[field] = idx;
  });
  return map;
}

export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some((c) => String(c).trim() !== '')) rows.push(row);
  }
  return rows;
}

function cellAt(row, idx) {
  if (idx == null || idx < 0) return '';
  return row[idx] == null ? '' : String(row[idx]).trim();
}

export function rowToContact(row, index) {
  const id = cellAt(row, index.hubspot_id);
  if (!id) return null;
  return normalizeContact({
    hubspot_id: id,
    first_name: cellAt(row, index.first_name),
    last_name: cellAt(row, index.last_name),
    phone: cellAt(row, index.phone),
    address: cellAt(row, index.address),
    address_line1: cellAt(row, index.address_line1),
    address_street: cellAt(row, index.address_street),
    address_place: cellAt(row, index.address_place),
    address_territory: cellAt(row, index.address_territory),
    deals: cellAt(row, index.deals),
    revenue: cellAt(row, index.revenue),
  });
}

export function contactsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const index = headerIndex(rows[0]);
  if (index.hubspot_id < 0) {
    throw new Error('CSV needs a Record ID column');
  }
  const out = [];
  const seen = new Set();
  for (let i = 1; i < rows.length; i += 1) {
    const c = rowToContact(rows[i], index);
    if (!c || seen.has(c.hubspot_id)) continue;
    seen.add(c.hubspot_id);
    out.push(c);
  }
  return out;
}
