function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = [
    name,
    'td/' + name,
    'td/js/' + name,
    '../' + name,
    '../td/' + name,
  ];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

function fnBody(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) fail('missing ' + name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail('unclosed ' + name);
}

const src = readSrc('app.js');
const html = readSrc('index.html');

const dispAt = src.indexOf('function displayAddress');
assert(dispAt !== -1, '1 displayAddress');
const dispBody = src.slice(dispAt, src.indexOf('function mapsHref'));
assert(dispBody.indexOf('stripDistrictTag') === -1, '1 does not strip the area tag');
assert(dispBody.indexOf('shortDistrictCode') !== -1, '1 appends from district');
const cardBody = src.slice(src.indexOf('function jobCard'), src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('displayAddress(j.address, j.district)') !== -1, '1 card uses district');
print('ok 1 displayAddress keeps the area tag');

const colorsAt = src.indexOf('const DISTRICT_COLORS');
const colorsEnd = src.indexOf('const DISTRICT_FALLBACK');
const tagAt = src.indexOf('const DISTRICT_TAG');
const tagEnd = src.indexOf(';', tagAt) + 1;
eval(
  src.slice(colorsAt, colorsEnd) + '\n' +
  src.slice(tagAt, tagEnd) + '\n' +
  fnBody(src, 'tidyAddress') + '\n' +
  fnBody(src, 'shortDistrictCode') + '\n' +
  fnBody(src, 'addressHasDistrictTag') + '\n' +
  fnBody(src, 'displayAddress') + '\n' +
  'globalThis.__disp = displayAddress;\n' +
  'globalThis.__short = shortDistrictCode;\n'
);

const want = 'Flat E, 11/F, Tower 9, Centra Horizon, 18 Chong San Road, Pak Shek Kok (N-T)';
const full = 'Flat E, 11/F, Tower 9, Centra Horizon, 18 Chong San Road, Pak Shek Kok (N-T)';
const noTag = 'Flat E, 11/F, Tower 9, Centra Horizon, 18 Chong San Road, Pak Shek Kok';
assert(globalThis.__disp(full, 'N-T') === want, '2 keeps full line with tag');
assert(globalThis.__disp(noTag, 'N-T') === want, '2 appends (N-T) when missing');
assert(globalThis.__disp(noTag, 'New Territories') === want, '2 New Territories becomes (N-T)');
assert(globalThis.__short('New Territories') === 'N-T', '2 short code is N-T');
assert(globalThis.__disp(full, 'N-T').indexOf('New Territories') === -1, '2 not New Territories');
assert(globalThis.__disp(full, 'N-T').indexOf('18 Chong San Road') !== -1, '2 keeps the street');
assert(globalThis.__disp(full, 'N-T').indexOf('Flat E') !== -1, '2 keeps the unit');
assert(globalThis.__disp(full, 'N-T').indexOf('Pak Shek Kok') !== -1, '2 keeps the place');
print('ok 2 cleaned card is unit, street, place, (N-T)');

assert(html.indexOf('js/app.js?v=71') !== -1, '3 js cache');
assert(html.indexOf('css/app.css?v=57') !== -1, '3 css cache');
print('ok 3 cache js/app.js?v=71');

print('ok display-address cases');
