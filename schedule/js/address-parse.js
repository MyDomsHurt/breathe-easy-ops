/**
 * Local HK address cleaner for Booking.
 * Line 1, Street, District (neighbourhood), Territory (label + code).
 */

export const AREA_CODES = ['N-TW', 'N-T', 'S-K', 'L-T', 'L-M', 'HKN', 'HKS', 'KLN'];

export const TERRITORIES = [
  { code: 'HKN', label: 'Hong Kong Island' },
  { code: 'HKS', label: 'Hong Kong South' },
  { code: 'KLN', label: 'Kowloon' },
  { code: 'N-T', label: 'New Territories' },
  { code: 'S-K', label: 'Sai Kung' },
  { code: 'L-T', label: 'Lantau' },
  { code: 'L-M', label: 'Lamma Island' },
];

const CODE_ALIASES = { 'N-TW': 'N-T' };

const NEIGHBOURHOODS = [
  'Mid-Levels', 'The Peak', 'Happy Valley', 'Causeway Bay', 'Wan Chai', 'Sheung Wan',
  'Sai Ying Pun', 'Kennedy Town', 'Pok Fu Lam', 'Repulse Bay', 'Deep Water Bay',
  'Stanley', 'Aberdeen', 'Ap Lei Chau', 'Tai Hang', 'North Point', 'Quarry Bay',
  'Tai Koo', 'Sai Wan Ho', 'Shau Kei Wan', 'Chai Wan', 'Shek O', 'Tai Tam',
  'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok', 'Sham Shui Po', 'Cheung Sha Wan',
  'Lai Chi Kok', 'Mei Foo', 'Kowloon Tong', 'Ho Man Tin', 'Hung Hom', 'To Kwa Wan',
  'Tai Kok Tsui', 'Kowloon City', 'San Po Kong', 'Kwun Tong', 'Ngau Tau Kok', 'Lam Tin', 'Yau Tong',
  'Sha Tin', 'Tai Wai', 'Ma On Shan', 'Tai Po', 'Fanling', 'Sheung Shui',
  'Tuen Mun', 'Yuen Long', 'Tin Shui Wai', 'Tsuen Wan', 'Kwai Chung', 'Tsing Yi',
  'Tung Chung', 'Discovery Bay', 'Mui Wo', 'Tai O', 'Sai Kung', 'Clear Water Bay',
  'Hang Hau', 'Tseung Kwan O', 'Tiu Keng Leng', 'Fortress Hill', 'Tin Hau',
  'Central', 'Admiralty',
].slice().sort((a, b) => b.length - a.length);

const NEIGHBOURHOOD_ALIASES = {
  pokfulam: 'Pok Fu Lam',
  'pok fu lam': 'Pok Fu Lam',
  'pok-fu-lam': 'Pok Fu Lam',
  shatin: 'Sha Tin',
  'sha tin': 'Sha Tin',
  'tai kok tsui': 'Tai Kok Tsui',
  taikoktsui: 'Tai Kok Tsui',
  'sai wan ho': 'Sai Wan Ho',
  saiwanho: 'Sai Wan Ho',
  'kennedy town': 'Kennedy Town',
  kennedytown: 'Kennedy Town',
  'happy valley': 'Happy Valley',
  happyvalley: 'Happy Valley',
  'causeway bay': 'Causeway Bay',
  causewaybay: 'Causeway Bay',
  'wan chai': 'Wan Chai',
  wanchai: 'Wan Chai',
  'sheung wan': 'Sheung Wan',
  sheungwan: 'Sheung Wan',
  'hung hom': 'Hung Hom',
  hunghom: 'Hung Hom',
  'tsing yi': 'Tsing Yi',
  tsingyi: 'Tsing Yi',
  'mid levels': 'Mid-Levels',
  midlevels: 'Mid-Levels',
  'mid-levels': 'Mid-Levels',
};

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

function titleCaseName(s) {
  return collapse(s).split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok)) return tok;
    return tok.split('-').map((p) => {
      if (!p) return p;
      if (/^\d+[A-Za-z]?$/.test(p)) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join('-');
  }).join('');
}

function expandStreetSuffix(raw) {
  if (/^rd$/i.test(raw)) return 'Road';
  if (/^st$/i.test(raw)) return 'Street';
  if (/^ave$/i.test(raw)) return 'Avenue';
  if (/^avenue$/i.test(raw)) return 'Avenue';
  return titleCaseName(raw);
}

function normCode(raw) {
  const up = String(raw || '').toUpperCase();
  const aliased = CODE_ALIASES[up] || up;
  const hit = TERRITORIES.find((t) => t.code === aliased);
  return hit ? hit.code : '';
}

export function territoryLabel(code) {
  const hit = TERRITORIES.find((t) => t.code === code);
  return hit ? `${hit.label} (${hit.code})` : '';
}

export function codeFromTerritory(label) {
  const m = /\(([A-Z0-9-]+)\)\s*$/.exec(String(label || ''));
  return m ? m[1] : '';
}

function normFloor(raw) {
  const t = collapse(raw);
  if (/^g$/i.test(t) || /^g\s*\/?\s*f$/i.test(t)) return 'G/F';
  const n = t.match(/(\d{1,2})/);
  if (n) return n[1] + '/F';
  return t;
}

function canonNeighbourhood(raw) {
  const t = collapse(raw).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const compact = t.replace(/\s+/g, '');
  if (NEIGHBOURHOOD_ALIASES[t]) return NEIGHBOURHOOD_ALIASES[t];
  if (NEIGHBOURHOOD_ALIASES[compact]) return NEIGHBOURHOOD_ALIASES[compact];
  for (const name of NEIGHBOURHOODS) {
    const key = name.toLowerCase().replace(/-/g, ' ');
    if (t === key || compact === key.replace(/\s+/g, '')) return name;
  }
  return titleCaseName(raw);
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
  const bits = [parts.flat, parts.floor, parts.block, parts.building]
    .map((x) => collapse(x))
    .filter(Boolean);
  return bits.join(', ');
}

export function composeFullAddress(parts) {
  const head = [parts.line1, parts.street].map(collapse).filter(Boolean).join(', ');
  const dist = collapse(parts.district);
  const code = collapse(parts.code);
  if (dist && code) return `${head}, ${dist} (${code})`;
  if (dist) return head ? `${head}, ${dist}` : dist;
  if (code) return head ? `${head} (${code})` : '';
  return head;
}

export function parseAddress(raw) {
  let s = collapse(raw).replace(/\(\s*\)/g, ' ');
  const extra = [];

  const moneyFee = /\$?\s*\d+(?:\.\d+)?\s*(?:hkd\s*)?fees?|fees?\s*\$?\s*\d+(?:\.\d+)?/gi;
  s = s.replace(moneyFee, (m) => {
    extra.push(collapse(m));
    return ' ';
  });
  s = collapse(s);
  const extraWord = new RegExp('\\b(?:' + EXTRA_WORD + ')\\b', 'gi');
  s = s.replace(extraWord, (m) => {
    extra.push(collapse(m).toLowerCase().replace(/\s+/g, '-').replace(/walkup/, 'walk-up'));
    return ' ';
  });
  s = collapse(s);

  let code = '';
  const areaRe = new RegExp('\\(?\\b(' + AREA_CODES.map(escapeRe).join('|') + ')\\b\\)?', 'i');
  for (;;) {
    const got = takeOne(s, areaRe, (m) => normCode(m[1]));
    if (!got.match) break;
    if (!code) code = got.value;
    s = got.s;
  }
  s = collapse(s.replace(/\(\s*\)/g, ' '));

  const streetRe = new RegExp(
    '\\b(\\d+[A-Za-z]?)\\s+([A-Za-z][A-Za-z\'’.\\-]*(?:\\s+[A-Za-z][A-Za-z\'’.\\-]*){0,4})\\s+(' + STREET_SUFFIX + ')\\b',
    'i'
  );
  let street = '';
  let district = '';
  {
    const m = streetRe.exec(s);
    if (m) {
      street = collapse(m[1] + ' ' + titleCaseName(m[2]) + ' ' + expandStreetSuffix(m[3]));
      const after = collapse(s.slice(m.index + m[0].length).replace(/^[,/]+/, ''));
      const before = collapse(s.slice(0, m.index).replace(/[,/]+$/, ''));
      if (after) district = canonNeighbourhood(after);
      s = before;
    }
  }

  const floorRe = /\b(?:G\s*\/?\s*F|Floor\s+(?:G|\d{1,2})|(?:\d{1,2})(?:st|nd|rd|th)?\s*\/?\s*F(?:loor)?|(?:\d{1,2})(?:st|nd|rd|th)\s+floors?)\b/i;
  const unitReEarly = /\b(?:Unit|Apt|Apartment)\s*[A-Za-z0-9][A-Za-z0-9\-]*/i;
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
      const kind = /^Blk$/i.test(m[1]) ? 'Block' : (/^Block$/i.test(m[1]) ? 'Block' : (/^Tower$/i.test(m[1]) ? 'Tower' : 'Phase'));
      const id = /^\d+$/.test(m[2]) ? m[2] : m[2].toUpperCase();
      return kind + ' ' + id;
    });
    if (!got.match) break;
    blocks.push(got.value);
    s = got.s;
  }
  const block = blocks.join(', ');
  const hasBlock = blocks.length > 0;

  let flat = '';
  const dwellingRe = /\b(Flat|Apt|Apts|Apartment|Apartments|Unit)\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
  {
    const got = takeOne(s, dwellingRe, (m) => 'Flat ' + m[2].toUpperCase());
    if (got.value) {
      flat = got.value;
      s = got.s;
    }
  }

  const shopRe = /\bShop\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
  if (!flat) {
    const got = takeOne(s, shopRe, (m) => 'Shop ' + m[1].toUpperCase());
    if (got.value) {
      flat = got.value;
      s = got.s;
    }
  } else {
    const drop = takeOne(s, shopRe);
    s = drop.s;
  }

  const roomRe = /\b(?:Rm|Room)\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
  if (!flat) {
    const got = takeOne(s, roomRe, (m) => 'Room ' + m[1].toUpperCase());
    if (got.value) {
      flat = got.value;
      s = got.s;
    }
  } else {
    const drop = takeOne(s, roomRe);
    s = drop.s;
  }

  if (!flat) {
    const got = takeOne(s, /^\s*(?:,\s*)?(\d{1,4}[A-Za-z])\b/, (m) => 'Flat ' + m[1].toUpperCase());
    if (got.value) {
      flat = got.value;
      s = got.s;
    }
  }

  if (!flat && (hasBlock || unitByFloor)) {
    const unitRe = /\bUnit\s*([A-Za-z0-9][A-Za-z0-9\-]*)\b/i;
    const got = takeOne(s, unitRe, (m) => 'Flat ' + m[1].toUpperCase());
    if (got.value) {
      flat = got.value;
      s = got.s;
    }
  }

  if (!district) {
    for (const name of NEIGHBOURHOODS) {
      const re = new RegExp('\\b' + escapeRe(name).replace(/-/g, '[-\\s]?') + '\\b', 'i');
      const got = takeOne(s, re, () => name);
      if (got.match) {
        district = name;
        s = got.s;
        break;
      }
    }
  }

  const building = titleCaseName(
    collapse(s).replace(/,/g, ' ').replace(/^[\s/.\-]+|[\s/.\-]+$/g, '')
  );

  const parts = {
    code,
    territory: territoryLabel(code),
    district,
    flat,
    floor,
    block,
    building,
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
      code: 'HKN',
      territory: 'Hong Kong Island (HKN)',
      district: '',
      flat: 'Flat A',
      floor: '12/F',
      block: 'Tower 1',
      building: 'Harbour House',
      street: '18 Ice House Street',
      line1: 'Flat A, 12/F, Tower 1, Harbour House',
      extra: '',
      composed: 'Flat A, 12/F, Tower 1, Harbour House, 18 Ice House Street (HKN)',
    },
  },
  {
    id: 'floors',
    raw: 'KLN 20th floor Foo Court 10 Nathan Road',
    expect: {
      code: 'KLN',
      territory: 'Kowloon (KLN)',
      district: '',
      floor: '20/F',
      building: 'Foo Court',
      street: '10 Nathan Road',
      line1: '20/F, Foo Court',
      extra: '',
      composed: '20/F, Foo Court, 10 Nathan Road (KLN)',
    },
  },
  {
    id: 'block-from-tower-phase',
    raw: 'HKS Blk B Phase 2 Riviera 5 Smith Street',
    expect: {
      code: 'HKS',
      territory: 'Hong Kong South (HKS)',
      district: '',
      block: 'Block B, Phase 2',
      building: 'Riviera',
      street: '5 Smith Street',
      line1: 'Block B, Phase 2, Riviera',
      extra: '',
    },
  },
  {
    id: 'flat-from-shop',
    raw: 'N-T Shop 3 3/F Lucky Plaza 123 Sha Tin Road',
    expect: {
      code: 'N-T',
      territory: 'New Territories (N-T)',
      district: '',
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
      code: 'L-T',
      territory: 'Lantau (L-T)',
      district: '',
      flat: 'Flat 5',
      block: '',
      building: 'Sunshine Court',
      street: '9 Ferry Street',
      line1: 'Flat 5, Sunshine Court',
      extra: '',
      composed: 'Flat 5, Sunshine Court, 9 Ferry Street (L-T)',
    },
  },
  {
    id: 'unit-next-to-floor-and-extra',
    raw: 'S-K Unit 8A 12/F Green Villa 22 Sai Kung Road walk-up helper ceiling fee',
    expect: {
      code: 'S-K',
      territory: 'Sai Kung (S-K)',
      district: '',
      flat: 'Flat 8A',
      floor: '12/F',
      building: 'Green Villa',
      street: '22 Sai Kung Road',
      line1: 'Flat 8A, 12/F, Green Villa',
      extra: 'walk-up, helper, ceiling, fee',
      composed: 'Flat 8A, 12/F, Green Villa, 22 Sai Kung Road (S-K)',
    },
  },
  {
    id: 'morgan-mid-levels',
    raw: '12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)',
    expect: {
      code: 'HKN',
      territory: 'Hong Kong Island (HKN)',
      district: 'Mid-Levels',
      flat: 'Flat 12A',
      building: 'The Morgan',
      street: '31 Conduit Road',
      line1: 'Flat 12A, The Morgan',
      extra: '',
      composed: 'Flat 12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)',
    },
  },
  {
    id: 'scenic-villas-pokfulam',
    raw: '4/F Block J, Scenic Villas, 20 Scenic Villa Drive, Pokfulam (HKN)',
    expect: {
      code: 'HKN',
      territory: 'Hong Kong Island (HKN)',
      district: 'Pok Fu Lam',
      floor: '4/F',
      block: 'Block J',
      building: 'Scenic Villas',
      street: '20 Scenic Villa Drive',
      line1: '4/F, Block J, Scenic Villas',
      extra: '',
      composed: '4/F, Block J, Scenic Villas, 20 Scenic Villa Drive, Pok Fu Lam (HKN)',
    },
  },
];
