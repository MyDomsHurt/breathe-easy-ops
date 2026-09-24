/**
 * Local HK address cleaner for Booking.
 * Line 1, Street, District (neighbourhood), Territory (label + code).
 */

export const AREA_CODES = ['N-TW', 'N-T', 'S-K', 'L-T', 'L-M', 'HKN', 'HKS', 'KLN', 'TKO', 'LT'];

export const TERRITORIES = [
  { code: 'HKN', label: 'Hong Kong Island' },
  { code: 'HKS', label: 'Hong Kong South' },
  { code: 'KLN', label: 'Kowloon' },
  { code: 'N-T', label: 'New Territories' },
  { code: 'S-K', label: 'Sai Kung' },
  { code: 'L-T', label: 'Lantau' },
  { code: 'L-M', label: 'Lamma Island' },
];

const CODE_ALIASES = { 'N-TW': 'N-T', TKO: 'S-K', LT: 'L-T' };

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
  'Central', 'Admiralty', 'Ma Wan', 'Wong Chuk Hang', 'Kai Tak', 'Diamond Hill',
  'Kowloon Bay', 'Fo Tan', 'Wong Tai Sin', 'Sham Tseng', 'Sai Wan', 'Heng Fa Chuen',
  'Ngau Chi Wan', 'Wu Kai Sha', 'Po Lam', 'Tai Po Kau', 'Chung Hom Kok', 'Science Park',
  'Kau To Shan', 'Pak Shek Kok', 'Shek Tong Tsui', 'Prince Edward', 'Sha Tau Kok',
  'Kwai Hing', 'Kam Tin', 'Park Island', 'South Horizons', 'Lai King', 'Braemar Hill',
  "Jardine's Lookout", 'Siu Sai Wan', 'Cyberport', 'Sandy Bay', 'Hung Shui Kiu',
  'Ting Kau', 'Lam Tei', 'Tai Ping Shan', 'Shek Yam', 'Tsz Wan Shan', 'West Kowloon',
  'Aldrich Bay', 'Choi Hung', 'Olympic', 'Nam Cheong', 'Shek Kong', 'Lok Fu', 'Kornhill',
  'Sau Mau Ping', 'Ma Tau Kok', 'Shek Kip Mei', 'Kwai Fong', 'Whampoa',
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
  cwb: 'Causeway Bay',
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
  midlevel: 'Mid-Levels',
  'mid level': 'Mid-Levels',
  'mid-level': 'Mid-Levels',
  'mid levels west': 'Mid-Levels',
  'mid-levels west': 'Mid-Levels',
  'midlevels west': 'Mid-Levels',
  'mid levels east': 'Mid-Levels',
  'midlevels east': 'Mid-Levels',
  'west mid levels': 'Mid-Levels',
  'mid-levels central': 'Mid-Levels',
  'mid levels central': 'Mid-Levels',
  tko: 'Tseung Kwan O',
  'tseung kwan o': 'Tseung Kwan O',
  'tseng kwan o': 'Tseung Kwan O',
  'lohas park': 'Tseung Kwan O',
  lohas: 'Tseung Kwan O',
  'clearwater bay': 'Clear Water Bay',
  'clear water bay': 'Clear Water Bay',
  'deepwater bay': 'Deep Water Bay',
  'sai yin pun': 'Sai Ying Pun',
  homantin: 'Ho Man Tin',
  'ho man tin': 'Ho Man Tin',
  mongkok: 'Mong Kok',
  tst: 'Tsim Sha Tsui',
  'tsim sha tsui': 'Tsim Sha Tsui',
  'taikoo shing': 'Tai Koo',
  'tai koo shing': 'Tai Koo',
  taikoo: 'Tai Koo',
  'tuen mum': 'Tuen Mun',
  'tuen muen': 'Tuen Mun',
  'kwun tung': 'Kwun Tong',
  'repluse bay': 'Repulse Bay',
  'lai chi kwok': 'Lai Chi Kok',
  'sham sheung po': 'Sham Shui Po',
  'shek kip mein': 'Shek Kip Mei',
  'tin saui wai': 'Tin Shui Wai',
  saikung: 'Sai Kung',
  'sai kung': 'Sai Kung',
  northpoint: 'North Point',
  taiwai: 'Tai Wai',
  'mei foo sun chuen': 'Mei Foo',
  'jardines lookout': "Jardine's Lookout",
  'whampoa garden': 'Whampoa',
  'residence bel-air': 'Pok Fu Lam',
  'residence bel air': 'Pok Fu Lam',
};

const PLACE_TERRITORY = {
  'Tseung Kwan O': 'S-K',
  'Sai Kung': 'S-K',
  'Hang Hau': 'S-K',
  'Tiu Keng Leng': 'S-K',
  'Po Lam': 'S-K',
  'Clear Water Bay': 'S-K',
};

const STREET_WORD_ALT = 'Broadway|Junction|Crescent|Terrace|Circuit|Avenue|Street|Praya|Drive|Close|Lane|Path|Rise|Road|Row|Fong|Ave|Cres|Ln|Rd|Dr|St';
const STREET_WORD_RE = new RegExp('\\b(?:' + STREET_WORD_ALT + ')\\b', 'i');
const EXTRA_WORD = 'walk[\\s-]?ups?|helpers?|ceilings?|fees?';

function collapse(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
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
  if (/^ln$/i.test(raw)) return 'Lane';
  if (/^dr$/i.test(raw)) return 'Drive';
  if (/^cres$/i.test(raw)) return 'Crescent';
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

export function hasStreetWord(text) {
  return STREET_WORD_RE.test(String(text || ''));
}

function normFloor(raw) {
  const t = collapse(raw);
  if (/^g$/i.test(t) || /^g\s*\/?\s*f$/i.test(t)) return 'G/F';
  const n = t.match(/(\d{1,2})/);
  if (n) return n[1] + '/F';
  return t;
}

function aliasKey(raw) {
  return collapse(raw).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function placePatterns() {
  const out = [];
  const seen = new Set();
  function add(phrase, name) {
    const key = aliasKey(phrase) + '=>' + name;
    if (seen.has(key)) return;
    seen.add(key);
    const body = escapeRe(phrase)
      .replace(/\\-/g, '[-\\s]?')
      .replace(/ /g, '[-\\s]+');
    out.push({ name, re: new RegExp('\\b' + body + '\\b', 'i') });
  }
  for (const name of NEIGHBOURHOODS) add(name, name);
  Object.keys(NEIGHBOURHOOD_ALIASES).forEach((k) => add(k, NEIGHBOURHOOD_ALIASES[k]));
  out.sort((a, b) => b.re.source.length - a.re.source.length);
  return out;
}

const PLACE_PATTERNS = placePatterns();

function findLastPlace(s) {
  let best = null;
  for (const { name, re } of PLACE_PATTERNS) {
    const copy = new RegExp(re.source, 'gi');
    let m;
    while ((m = copy.exec(s))) {
      const end = m.index + m[0].length;
      if (!best || end > best.end || (end === best.end && m[0].length > best.len)) {
        best = { name, index: m.index, end, len: m[0].length };
      }
    }
  }
  return best;
}

function findLastStreet(s) {
  const num = '(?:No\\.?\\s*)?(\\d+[A-Za-z]?(?:\\s*[-–~～]\\s*\\d+[A-Za-z]?)?)';
  const name0 = "((?:[A-Za-z][A-Za-z'’.\\-]*\\s+){0,5})";
  const name1 = "((?:[A-Za-z][A-Za-z'’.\\-]*\\s+){1,5})";
  const reA = new RegExp(num + '\\s*[,.]?\\s+' + name0 + '(' + STREET_WORD_ALT + ')\\b', 'gi');
  const reB = new RegExp(name1 + '(' + STREET_WORD_ALT + ')\\s+(?:No\\.?\\s*)(\\d+[A-Za-z]?)\\b', 'gi');
  let best = null;
  let m;
  while ((m = reA.exec(s))) {
    const end = m.index + m[0].length;
    if (!best || end >= best.end) {
      best = {
        index: m.index,
        end,
        number: m[1],
        name: collapse(m[2]),
        suffix: m[3],
      };
    }
  }
  while ((m = reB.exec(s))) {
    const end = m.index + m[0].length;
    if (!best || end > best.end) {
      best = {
        index: m.index,
        end,
        number: m[3],
        name: collapse(m[1]),
        suffix: m[2],
      };
    }
  }
  if (!best) return null;
  const street = collapse(
    best.number
    + (best.name ? ' ' + titleCaseName(best.name) : '')
    + ' '
    + expandStreetSuffix(best.suffix)
  );
  return { index: best.index, end: best.end, street };
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

function stripTerritoryHints(s, code) {
  const hints = [
    { re: /(?:,|^)\s*(hong\s*kong\s*islands?|hk\s*islands?|hongkong\s*islands?)\s*$/i, code: 'HKN' },
    { re: /(?:,|^)\s*(hong\s*kong\s*south)\s*$/i, code: 'HKS' },
    { re: /(?:,|^)\s*(southern\s+district)\s*$/i, code: 'HKS' },
    { re: /(?:,|^)\s*(new\s*territories)\s*$/i, code: 'N-T' },
    { re: /(?:,|^)\s*(n\.?\s*t\.?)\s*$/i, code: 'N-T' },
    { re: /(?:,|^)\s*(kowloon)\s*$/i, code: 'KLN' },
    { re: /(?:,|^)\s*(lantau(?:\s+island)?)\s*$/i, code: 'L-T' },
    { re: /(?:,|^)\s*(lamma(?:\s+island)?)\s*$/i, code: 'L-M' },
    { re: /(?:,|^)\s*(hong\s*kongs?|hongkong|\bhk)\s*$/i, code: '' },
  ];
  let next = s;
  let found = code;
  for (;;) {
    let hit = null;
    for (const h of hints) {
      const m = h.re.exec(next);
      if (m) {
        hit = h;
        break;
      }
    }
    if (!hit) break;
    if (hit.code && !found) found = hit.code;
    next = collapse(next.replace(hit.re, ' '));
  }
  return { s: next, code: found };
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
  let s = collapse(raw)
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/，/g, ',')
    .replace(/\(\s*\)/g, ' ');
  const extra = [];
  let tkoPlace = false;

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
  s = s.replace(/\(?\s*new\s+address\s*\)?/gi, () => {
    extra.push('New Address');
    return ' ';
  });
  s = collapse(s);

  let code = '';
  const areaRe = new RegExp('\\(?\\b(' + AREA_CODES.map(escapeRe).join('|') + ')\\b\\)?', 'i');
  for (;;) {
    const got = takeOne(s, areaRe, (m) => {
      const rawCode = String(m[1] || '').toUpperCase();
      if (rawCode === 'TKO') tkoPlace = true;
      return normCode(m[1]);
    });
    if (!got.match) break;
    if (!code) code = got.value;
    s = got.s;
  }
  s = collapse(s.replace(/\(\s*\)/g, ' '));

  const hinted = stripTerritoryHints(s, code);
  s = hinted.s;
  code = hinted.code;

  let street = '';
  let before = s;
  let after = '';
  const streetHit = findLastStreet(s);
  if (streetHit) {
    street = streetHit.street;
    before = collapse(s.slice(0, streetHit.index).replace(/[,/]+$/, ''));
    after = collapse(s.slice(streetHit.end).replace(/^[,/]+/, ''));
  }

  let district = '';
  let placeHit = findLastPlace(after);
  let placeFrom = 'after';
  if (!placeHit) {
    placeHit = findLastPlace(before);
    placeFrom = 'before';
  }
  if (placeHit) {
    district = placeHit.name;
    const src = placeFrom === 'after' ? after : before;
    const next = collapse(src.slice(0, placeHit.index) + ' ' + src.slice(placeHit.end));
    if (placeFrom === 'after') after = next;
    else before = next;
  }
  if (tkoPlace && !district) district = 'Tseung Kwan O';
  if (!code && district && PLACE_TERRITORY[district]) code = PLACE_TERRITORY[district];

  if (after) {
    const moreExtra = new RegExp('\\b(?:' + EXTRA_WORD + '|new\\s+address)\\b', 'gi');
    after = collapse(after.replace(moreExtra, (m) => {
      const t = collapse(m);
      extra.push(/new\s+address/i.test(t) ? 'New Address' : t.toLowerCase().replace(/\s+/g, '-').replace(/walkup/, 'walk-up'));
      return ' ';
    }));
    if (after) before = collapse([before, after].filter(Boolean).join(', '));
    after = '';
  }

  s = before;

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
  {
    id: 'yau-king-ln',
    raw: 'Flat A2, 3/F, Greenwood Tower 5, Phase 1, Silicon Hill, 63 Yau King Ln, Tai Po (N-T)',
    expect: {
      code: 'N-T',
      street: '63 Yau King Lane',
      district: 'Tai Po',
      flat: 'Flat A2',
      floor: '3/F',
      block: 'Tower 5, Phase 1',
      building: 'Greenwood Silicon Hill',
      line1: 'Flat A2, 3/F, Tower 5, Phase 1, Greenwood Silicon Hill',
    },
  },
  {
    id: 'welsby-court-no-street',
    raw: 'Flat 1, G/F, Welsby Court, Mid-levels',
    expect: {
      street: '',
      district: 'Mid-Levels',
      flat: 'Flat 1',
      floor: 'G/F',
      building: 'Welsby Court',
      line1: 'Flat 1, G/F, Welsby Court',
      composed: 'Flat 1, G/F, Welsby Court, Mid-Levels',
    },
  },
  {
    id: 'greenfield-villa-sai-kung',
    raw: 'House 79 Greenfield Villa, Sai Kung',
    expect: {
      street: '',
      district: 'Sai Kung',
      code: 'S-K',
      building: 'House 79 Greenfield Villa',
      line1: 'House 79 Greenfield Villa',
      composed: 'House 79 Greenfield Villa, Sai Kung (S-K)',
    },
  },
  {
    id: 'lai-chi-kok-rd-no-1',
    raw: 'Flat B, 11/F, Carprio Mansion, Lai Chi Kok Rd No.1, Prince Edward',
    expect: {
      street: '1 Lai Chi Kok Road',
      district: 'Prince Edward',
      flat: 'Flat B',
      floor: '11/F',
      building: 'Carprio Mansion',
      line1: 'Flat B, 11/F, Carprio Mansion',
    },
  },
  {
    id: 'tko-maps-to-sk',
    raw: '8 Tong Yin Street, Tseung Kwan O (TKO)',
    expect: {
      street: '8 Tong Yin Street',
      district: 'Tseung Kwan O',
      code: 'S-K',
      territory: 'Sai Kung (S-K)',
    },
  },
  {
    id: 'lohas-park-is-tko-place',
    raw: 'Tower 1, Lohas Park, TKO',
    expect: {
      district: 'Tseung Kwan O',
      code: 'S-K',
      street: '',
    },
  },
  {
    id: 'paren-1s-is-not-code',
    raw: '12A, The Morgan, 31 Conduit Road, Mid-Levels (1S)',
    expect: {
      code: '',
      district: 'Mid-Levels',
      street: '31 Conduit Road',
    },
  },
  {
    id: 'trailing-kowloon-is-territory',
    raw: 'Flat C, 11/F, Tower 2, Harbour Place, No.8 Oi King Street, Kowloon (New Address)',
    expect: {
      street: '8 Oi King Street',
      code: 'KLN',
      district: '',
      extra: 'New Address',
      block: 'Tower 2',
    },
  },
  {
    id: 'n-tw-alias',
    raw: '2/F, 32 Ka Choi Lane, Nim Wan Tseun, Tuen Mun (N-TW)',
    expect: {
      street: '32 Ka Choi Lane',
      district: 'Tuen Mun',
      code: 'N-T',
    },
  },
  {
    id: 'lt-alias',
    raw: '96 Seabee Lane Discovery Bay (LT)',
    expect: {
      street: '96 Seabee Lane',
      district: 'Discovery Bay',
      code: 'L-T',
    },
  },
];
