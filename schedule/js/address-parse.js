/**
 * Local HK address cleaner for Booking.
 * Parses messy paste into HubSpot billing fields + Extra.
 */

export const AREA_CODES = ['N-TW', 'N-T', 'S-K', 'L-T', 'L-M', 'HKN', 'HKS', 'KLN'];

const STREET_SUFFIX = 'Road|Street|Avenue|Ave|Drive|Path|Lane|Rd|St';
const EXTRA_WORD = 'walk[\\s-]?ups?|helpers?|ceilings?|fees?';

function collapse(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function takeOne(s, re, pick) {
  const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags.replace('g', '') : re.flags);
  const m = copy.exec(s);
  if (!m) return { s, value: '', match: null };
  const value = pick ? pick(m) : m[0];
  const next = collapse(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length));
  return { s: next, value, match: m };
}

function normCode(raw) {
  const up = String(raw || '').toUpperCase();
  const hit = AREA_CODES.find((c) => c.toUpperCase() === up);
  return hit || '';
}

function normFloor(raw) {
  const t = collapse(raw);
  if (/^g$/i.test(t) || /^g\s*\/?\s*f$/i.test(t)) return 'G/F';
  const n = t.match(/(\d{1,2})/);
  if (n) return n[1] + '/F';
  return t;
}

function nearFloor(unitMatch, floorMatch, s) {
  if (!unitMatch || !floorMatch) return false;
  const u0 = unitMatch.index;
  const u1 = u0 + unitMatch[0].length;
  const f0 = floorMatch.index;
  const f1 = f0 + floorMatch[0].length;
  const between = u1 <= f0 ? s.slice(u1, f0) : s.slice(f1, u0);
  return collapse(between) === '';
}

export function composeLine1(parts) {
  const bits = [parts.flat || parts.unitKeep, parts.floor, parts.block, parts.building]
    .map((x) => collapse(x))
    .filter(Boolean);
  return bits.join(', ');
}

export function composeFullAddress(parts) {
  const bits = [parts.line1, parts.street, parts.city].map((x) => collapse(x)).filter(Boolean);
  return bits.join(', ');
}

export function parseAddress(raw) {
  let s = collapse(raw);
  const extra = [];

  const moneyFee = /\$?\s*\d+(?:\.\d+)?\s*(?:hkd\s*)?fees?|fees?\s*\$?\s*\d+(?:\.\d+)?/gi;
  s = s.replace(moneyFee, (m) => {
    extra.push(collapse(m));
    return ' ';
  });
  s = collapse(s);
  const extraWord = new RegExp('\\b(?:' + EXTRA_WORD + ')\\b', 'gi');
  s = s.replace(extraWord, (m) => {
    extra.push(collapse(m).toLowerCase().replace(/\s+/g, '-').replace(/walkup/i, 'walk-up'));
    return ' ';
  });
  s = collapse(s);

  let city = '';
  const areaRe = new RegExp('\\b(' + AREA_CODES.map(escapeRe).join('|') + ')\\b', 'i');
  for (;;) {
    const got = takeOne(s, areaRe, (m) => normCode(m[1]));
    if (!got.match) break;
    if (!city) city = got.value;
    s = got.s;
  }

  const streetRe = new RegExp(
    '\\b(\\d+[A-Za-z]?)\\s+([A-Za-z][A-Za-z\'’.\\-]*(?:\\s+[A-Za-z][A-Za-z\'’.\\-]*){0,4})\\s+(' + STREET_SUFFIX + ')\\b',
    'i'
  );
  let street = '';
  {
    const got = takeOne(s, streetRe, (m) => collapse(m[1] + ' ' + m[2] + ' ' + m[3].replace(/^Rd$/i, 'Road').replace(/^St$/i, 'Street').replace(/^Ave$/i, 'Avenue')));
    street = got.value;
    s = got.s;
  }

  const floorRe = /\b(?:G\s*\/?\s*F|Floor\s+(?:G|\d{1,2})|(?:\d{1,2})(?:st|nd|rd|th)?\s*\/?\s*F(?:loor)?|(?:\d{1,2})(?:st|nd|rd|th)\s+floors?)\b/i;
  const unitReEarly = /\bUnit\s*[A-Za-z0-9][A-Za-z0-9\-]*/i;
  const unitByFloor = nearFloor(unitReEarly.exec(s), floorRe.exec(s), s);
  let floor = '';
  {
    const got = takeOne(s, floorRe, (m) => normFloor(m[0]));
    floor = got.value;
    s = got.s;
  }

  const blockRe = /\b(Tower|Block|Blk|Phase)\s*([A-Za-z0-9]+)\b/i;
  const blocks = [];
  for (;;) {
    const got = takeOne(s, blockRe, (m) => {
      const kind = m[1].replace(/^Blk$/i, 'Blk').replace(/^Block$/i, 'Block').replace(/^Tower$/i, 'Tower').replace(/^Phase$/i, 'Phase');
      return kind + ' ' + m[2].toUpperCase().replace(/^(\d+)$/, '$1');
    });
    if (!got.match) break;
    blocks.push(got.value);
    s = got.s;
  }
  const block = blocks.join(', ');
  const hasBlock = blocks.length > 0;

  const flatRe = /\b(Flat|Apt|Rm|Room|Shop)\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
  let flat = '';
  {
    const got = takeOne(s, flatRe, (m) => {
      const kind = /^(Rm|Room)$/i.test(m[1]) ? 'Rm' : (/^Apt$/i.test(m[1]) ? 'Apt' : (/^Shop$/i.test(m[1]) ? 'Shop' : 'Flat'));
      return kind + ' ' + m[2].toUpperCase();
    });
    flat = got.value;
    s = got.s;
  }

  const unitRe = /\bUnit\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
  let unitKeep = '';
  {
    const got = takeOne(s, unitRe, (m) => m[1].toUpperCase());
    if (got.value) {
      const asFlat = hasBlock || unitByFloor;
      if (asFlat && !flat) flat = 'Flat ' + got.value;
      else if (!asFlat) unitKeep = 'Unit ' + got.value;
    }
    s = got.s;
  }

  const building = collapse(s).replace(/^[,/.\-]+|[,/.\-]+$/g, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',');

  const parts = {
    city,
    country: 'Hong Kong',
    flat,
    floor,
    block,
    building,
    unitKeep,
    street,
    extra: extra.filter(Boolean).join(', '),
    line1: '',
    composed: '',
  };
  parts.line1 = composeLine1(parts);
  parts.composed = composeFullAddress(parts);
  return parts;
}

export const FIXTURES = [
  {
    id: 'area-code-first',
    raw: 'HKN Flat A 12/F Tower 1 Harbour House 18 Ice House Street',
    expect: {
      city: 'HKN',
      country: 'Hong Kong',
      flat: 'Flat A',
      floor: '12/F',
      block: 'Tower 1',
      building: 'Harbour House',
      street: '18 Ice House Street',
      line1: 'Flat A, 12/F, Tower 1, Harbour House',
      extra: '',
      composed: 'Flat A, 12/F, Tower 1, Harbour House, 18 Ice House Street, HKN',
    },
  },
  {
    id: 'floors',
    raw: 'KLN 20th floor Foo Court 10 Nathan Road',
    expect: {
      city: 'KLN',
      floor: '20/F',
      building: 'Foo Court',
      street: '10 Nathan Road',
      line1: '20/F, Foo Court',
      extra: '',
      composed: '20/F, Foo Court, 10 Nathan Road, KLN',
    },
  },
  {
    id: 'block-from-tower-phase',
    raw: 'HKS Blk B Phase 2 Riviera 5 Smith Street',
    expect: {
      city: 'HKS',
      block: 'Blk B, Phase 2',
      building: 'Riviera',
      street: '5 Smith Street',
      line1: 'Blk B, Phase 2, Riviera',
      extra: '',
    },
  },
  {
    id: 'flat-from-shop',
    raw: 'N-T Shop 3 3/F Lucky Plaza 123 Sha Tin Road',
    expect: {
      city: 'N-T',
      flat: 'Shop 3',
      floor: '3/F',
      building: 'Lucky Plaza',
      street: '123 Sha Tin Road',
      line1: 'Shop 3, 3/F, Lucky Plaza',
      extra: '',
    },
  },
  {
    id: 'unit-without-block',
    raw: 'L-T Unit 5 Sunshine Court 9 Ferry Street',
    expect: {
      city: 'L-T',
      flat: '',
      block: '',
      unitKeep: 'Unit 5',
      building: 'Sunshine Court',
      street: '9 Ferry Street',
      line1: 'Unit 5, Sunshine Court',
      extra: '',
      composed: 'Unit 5, Sunshine Court, 9 Ferry Street, L-T',
    },
  },
  {
    id: 'unit-next-to-floor-and-extra',
    raw: 'S-K Unit 8A 12/F Green Villa 22 Sai Kung Road walk-up helper ceiling fee',
    expect: {
      city: 'S-K',
      flat: 'Flat 8A',
      floor: '12/F',
      building: 'Green Villa',
      street: '22 Sai Kung Road',
      line1: 'Flat 8A, 12/F, Green Villa',
      extra: 'walk-up, helper, ceiling, fee',
      composed: 'Flat 8A, 12/F, Green Villa, 22 Sai Kung Road, S-K',
    },
  },
];
