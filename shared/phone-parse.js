/**
 * Local phone cleaner for Booking jobs.
 * Full is always + country + national, no spaces. Empty stays empty.
 */

const CALLING_CODES = [
  '852', '853', '971', '966', '353', '351',
  '86', '44', '61', '64', '65', '66', '81', '82', '84', '91',
  '33', '34', '39', '49', '1', '7',
].slice().sort((a, b) => b.length - a.length);

function strip(raw) {
  return String(raw || '').replace(/[\s\-()[\].]/g, '');
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function splitKnown(digits) {
  for (const code of CALLING_CODES) {
    if (digits.startsWith(code) && digits.length > code.length) {
      return { country: code, national: digits.slice(code.length) };
    }
  }
  return null;
}

export function composePhone(country, national) {
  const c = digitsOnly(country) || '852';
  const n = digitsOnly(national);
  if (!n) return '';
  return '+' + c + n;
}

export function parsePhone(raw) {
  const original = String(raw == null ? '' : raw);
  if (!original.trim()) {
    return { country: '852', national: '', full: '', resolved: true };
  }
  let s = strip(original);
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const hadPlus = s.startsWith('+');
  const digits = digitsOnly(s);
  if (!digits) {
    return { country: '852', national: '', full: '', resolved: true };
  }

  function ok(country, national, resolved) {
    const c = digitsOnly(country);
    const n = digitsOnly(national);
    return {
      country: c,
      national: n,
      full: n ? '+' + c + n : '',
      resolved: resolved !== false,
    };
  }

  if (hadPlus) {
    const known = splitKnown(digits);
    if (known) return ok(known.country, known.national, true);
    for (const len of [3, 2, 1]) {
      if (digits.length > len) return ok(digits.slice(0, len), digits.slice(len), true);
    }
    return ok(digits, '', true);
  }

  if (digits.startsWith('852') && digits.length >= 11) {
    return ok('852', digits.slice(3), true);
  }
  if (digits.length === 8) {
    return ok('852', digits, true);
  }
  if (digits.startsWith('86') && digits.length === 13 && digits.charAt(2) === '1') {
    return ok('86', digits.slice(2), true);
  }
  if (digits.startsWith('853') && digits.length >= 4) {
    return ok('853', digits.slice(3), true);
  }

  return ok('852', digits, false);
}

export const FIXTURES = [
  { id: 'empty', raw: '', expect: { country: '852', national: '', full: '', resolved: true } },
  { id: 'spaces', raw: '  ', expect: { full: '', resolved: true } },
  { id: 'naked-8', raw: '9123 4567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: 'dashes', raw: '9123-4567', expect: { full: '+85291234567', resolved: true } },
  { id: 'brackets', raw: '(9123) 4567', expect: { full: '+85291234567', resolved: true } },
  { id: 'plus-852', raw: '+852 9123 4567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: '852-prefix', raw: '85291234567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: '00-prefix', raw: '0085291234567', expect: { country: '852', national: '91234567', full: '+85291234567', resolved: true } },
  { id: 'cn-86', raw: '8613812345678', expect: { country: '86', national: '13812345678', full: '+8613812345678', resolved: true } },
  { id: 'plus-86', raw: '+86 138 1234 5678', expect: { country: '86', national: '13812345678', full: '+8613812345678', resolved: true } },
  { id: 'plus-853', raw: '+853 6234 5678', expect: { country: '853', national: '62345678', full: '+85362345678', resolved: true } },
  { id: '853-prefix', raw: '85362345678', expect: { country: '853', national: '62345678', full: '+85362345678', resolved: true } },
  { id: 'keep-plus-44', raw: '+44 7700 900123', expect: { country: '44', national: '7700900123', full: '+447700900123', resolved: true } },
  { id: 'already-e164', raw: '+85291234567', expect: { full: '+85291234567', resolved: true } },
  { id: 'unresolved-leftover', raw: '12345', expect: { country: '852', national: '12345', full: '+85212345', resolved: false } },
  { id: 'compose', raw: null, expect: { composed: '+85291234567' }, country: '852', national: '9123 4567' },
];
