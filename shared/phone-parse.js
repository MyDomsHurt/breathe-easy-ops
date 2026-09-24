/**
 * Phone cleaner for Booking jobs.
 * libphonenumber-js parse. Empty stays empty.
 */

import { parsePhoneNumberFromString } from './vendor/libphonenumber-js.min.js';

function strip(raw) {
  return String(raw || '').replace(/[\s\-()[\].]/g, '');
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function emptyResult() {
  return { country: '', national: '', full: '', resolved: true };
}

function fromParsed(p) {
  if (!p || !p.countryCallingCode || p.nationalNumber == null || String(p.nationalNumber) === '') return null;
  const country = String(p.countryCallingCode);
  const national = String(p.nationalNumber);
  const full = p.number || ('+' + country + national);
  return { country, national, full, resolved: true };
}

function tryParse(text, defaultCountry) {
  if (!text) return null;
  try {
    const p = defaultCountry
      ? parsePhoneNumberFromString(text, defaultCountry)
      : parsePhoneNumberFromString(text);
    return fromParsed(p);
  } catch {
    return null;
  }
}

export function composePhone(country, national) {
  const c = digitsOnly(country);
  const n = digitsOnly(national);
  if (!n) return '';
  const p = tryParse('+' + c + n) || (!c || c === '852' ? tryParse(n, 'HK') : null);
  if (p) return p.full;
  return c ? '+' + c + n : '';
}

export function parsePhone(raw) {
  const original = String(raw == null ? '' : raw);
  if (!original.trim()) return emptyResult();
  let s = strip(original);
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const digits = digitsOnly(s);
  if (!digits) return emptyResult();

  let p = tryParse(s);
  if (!p && !s.startsWith('+')) {
    if (digits.length === 8) p = tryParse(digits, 'HK');
    else p = tryParse('+' + digits);
  }
  if (!p) p = tryParse(s, 'HK');
  if (!p && !s.startsWith('+')) p = tryParse(digits, 'HK');
  if (p) return p;
  return { country: '', national: digits, full: '', resolved: false };
}

export const FIXTURES = [
  { id: 'empty', raw: '', expect: { country: '', national: '', full: '', resolved: true } },
  { id: 'naked-hk', raw: '9123 4567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: 'hk-dashes', raw: '9123-4567', expect: { full: '+85291234567', resolved: true } },
  { id: 'hk-plus', raw: '+852 9123 4567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: 'hk-e164', raw: '+85291234567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: 'sg-65', raw: '6598765432', expect: { country: '65', national: '98765432', full: '+6598765432', resolved: true } },
  { id: 'sg-plus', raw: '+65 9876 5432', expect: { country: '65', national: '98765432', full: '+6598765432', resolved: true } },
  { id: 'cn-86', raw: '8613812345678', expect: { country: '86', national: '13812345678', full: '+8613812345678', resolved: true } },
  { id: 'cn-plus', raw: '+86 138 1234 5678', expect: { country: '86', national: '13812345678', full: '+8613812345678', resolved: true } },
  { id: 'mo-plus', raw: '+853 6234 5678', expect: { country: '853', national: '62345678', full: '+85362345678', resolved: true } },
  { id: 'mo-prefix', raw: '85362345678', expect: { country: '853', national: '62345678', full: '+85362345678', resolved: true } },
  { id: 'compose-sg', raw: null, expect: { composed: '+6598765432' }, country: '65', national: '98765432' },
];
