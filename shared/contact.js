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
  'stream',
  'tag',
  'language',
  'groups',
  'instagram',
  'owner',
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

export function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** HubSpot internal names → Firestore contact fields. Webhook + CSV. */
export const HUBSPOT_PROPERTY_MAP = {
  firstname: 'first_name',
  lastname: 'last_name',
  profile_phone_number: 'phone',
  full_address_1: 'address',
  billing_address_line_1: 'address_line1',
  billing_street: 'address_street',
  billing_city: 'address_place',
  billing_state: 'address_territory',
  stream: 'stream',
  hubsoot_tags: 'tag',
  language: 'language',
  group: 'groups',
  instagram: 'instagram',
  hubspot_owner_id: 'owner',
  num_associated_deals: 'deals',
  total_revenue: 'revenue',
};

export const HUBSPOT_PROPERTY_NAMES = Object.keys(HUBSPOT_PROPERTY_MAP);

export function mapHubSpotValue(internalName, raw) {
  if (internalName === 'lastname') return cleanLastName(raw);
  if (internalName === 'profile_phone_number') return normalizePhone(raw);
  if (internalName === 'num_associated_deals' || internalName === 'total_revenue') {
    return asNumber(raw);
  }
  if (internalName === 'hubspot_owner_id') {
    return raw == null ? '' : String(raw);
  }
  return textOrEmpty(raw);
}

export function mappedFieldsFromHubSpotProperties(props) {
  const out = {};
  HUBSPOT_PROPERTY_NAMES.forEach((hs) => {
    if (!props || !Object.prototype.hasOwnProperty.call(props, hs)) return;
    out[HUBSPOT_PROPERTY_MAP[hs]] = mapHubSpotValue(hs, props[hs]);
  });
  return out;
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
    stream: textOrEmpty(input.stream),
    tag: textOrEmpty(input.tag),
    language: textOrEmpty(input.language),
    groups: textOrEmpty(input.groups),
    instagram: textOrEmpty(input.instagram),
    owner: textOrEmpty(input.owner),
  };
}

export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function phoneTail8(phone) {
  return phoneDigits(phone).slice(-8);
}

export function contactHasAddress(c) {
  return !!(c && (
    String(c.address || '').trim()
    || String(c.address_line1 || '').trim()
    || String(c.address_street || '').trim()
    || String(c.address_place || '').trim()
  ));
}

export function contactDisplayName(c) {
  const parts = [c && c.first_name, c && c.last_name].map((x) => textOrEmpty(x)).filter(Boolean);
  return parts.join(' ') || '—';
}

export default {
  CONTACT_FIELDS,
  cleanLastName,
  normalizePhone,
  asNumber,
  normalizeContact,
  contactDisplayName,
  phoneDigits,
  phoneTail8,
  contactHasAddress,
  HUBSPOT_PROPERTY_MAP,
  HUBSPOT_PROPERTY_NAMES,
  mapHubSpotValue,
  mappedFieldsFromHubSpotProperties,
};
