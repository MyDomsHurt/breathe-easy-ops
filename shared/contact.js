/**
 * HubSpot contact record for Booking Contacts.
 * Lives in Firestore collection `contacts`. Never mixed with jobs.
 */

export const CONTACT_FIELDS = [
  'hubspot_id',
  'first_name',
  'last_name',
  'phone',
  'address',
  'address_line1',
  'address_street',
  'address_place',
  'address_territory',
  'deals',
  'revenue',
];

function textOrEmpty(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function cleanLastName(value) {
  const s = textOrEmpty(value);
  return s === '.' ? '' : s;
}

export function normalizePhone(raw) {
  const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (!digits) return '';
  let local = digits;
  if (digits.length >= 11 && digits.slice(0, 3) === '852') local = digits.slice(-8);
  else if (digits.length === 8) local = digits;
  else if (digits.length > 8) local = digits.slice(-8);
  if (local.length !== 8) return '';
  return '+852' + local;
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function normalizeContact(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const id = textOrEmpty(input.hubspot_id);
  return {
    hubspot_id: id,
    first_name: textOrEmpty(input.first_name),
    last_name: cleanLastName(input.last_name),
    phone: normalizePhone(input.phone),
    address: textOrEmpty(input.address),
    address_line1: textOrEmpty(input.address_line1),
    address_street: textOrEmpty(input.address_street),
    address_place: textOrEmpty(input.address_place),
    address_territory: textOrEmpty(input.address_territory),
    deals: asNumber(input.deals),
    revenue: asNumber(input.revenue),
  };
}

export function contactDisplayName(c) {
  const parts = [c && c.first_name, c && c.last_name].map((x) => textOrEmpty(x)).filter(Boolean);
  return parts.join(' ') || '—';
}

export default {
  CONTACT_FIELDS,
  cleanLastName,
  normalizePhone,
  normalizeContact,
  contactDisplayName,
};
