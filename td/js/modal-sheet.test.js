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
    '../css/' + name,
    'td/css/' + name,
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
const css = readSrc('app.css');
const html = readSrc('index.html');

const header = html.slice(html.indexOf('id="modal"'), html.indexOf('id="modalBody"'));
assert(header.indexOf('id="modalTitle"') !== -1, '1 name in the header');
assert(header.indexOf('id="modalChips"') !== -1, '1 chips in the header');
assert(header.indexOf('id="modalSub"') !== -1, '1 date time team in the header');
assert(header.indexOf('id="modalChips"') > header.indexOf('id="modalTitle"'), '1 chips under the name');
assert(header.indexOf('id="modalSub"') > header.indexOf('id="modalChips"'), '1 date time team under the chips');
assert(header.indexOf('bg-brand-800') === -1, '1 sheet header is a card');
print('ok 1 header keeps name, chips, date, time, team');

const openAt = src.indexOf('function openModal');
const openBody = src.slice(openAt, src.indexOf('function closeModal'));
assert(openBody.indexOf('modalChipsHtml') !== -1, '2 chips from openModal');
assert(openBody.indexOf('modalBodyHtml') !== -1, '2 body from openModal');
assert(openBody.indexOf('To next') !== -1, '2 keep To next');
assert(openBody.indexOf('Open place') !== -1, '2 Open place');
assert(openBody.indexOf('Directions') !== -1, '2 Directions');
assert(openBody.indexOf('District') === -1, '2 no district row');
assert(openBody.indexOf('Job ID') === -1, '2 no job id');
assert(openBody.indexOf('<dt') === -1, '2 not a form');
assert(openBody.indexOf('bindTechNotes') !== -1, '2 technician notes load on open');
assert(src.indexOf('function vanRequestText') !== -1, '2 vanRequestText stays');
const cardBody = src.slice(src.indexOf('function jobCard'), src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('compact-time') !== -1, '2 week card time stays');
assert(cardBody.indexOf('compact-name') !== -1, '2 week card name stays');
print('ok 2 sheet is a card; vanRequestText and week card stay');

eval(
  'function displayAddress(raw){ return String(raw || ""); }\n' +
  fnBody(src, 'esc') + '\n' +
  fnBody(src, 'timeToMinutes') + '\n' +
  fnBody(src, 'parseLunchMinutes') + '\n' +
  fnBody(src, 'formatLunch24') + '\n' +
  fnBody(src, 'displayTime') + '\n' +
  fnBody(src, 'liveAcsBadges') + '\n' +
  fnBody(src, 'jobIsPaid') + '\n' +
  fnBody(src, 'formatMobile') + '\n' +
  fnBody(src, 'modalDayLabel') + '\n' +
  fnBody(src, 'modalSubText') + '\n' +
  fnBody(src, 'modalChipsHtml') + '\n' +
  fnBody(src, 'modalPhoneHtml') + '\n' +
  fnBody(src, 'modalNotesHtml') + '\n' +
  fnBody(src, 'techNotesBoxHtml') + '\n' +
  fnBody(src, 'modalBodyHtml') + '\n' +
  'globalThis.__modalDayLabel = modalDayLabel;\n' +
  'globalThis.__modalSubText = modalSubText;\n' +
  'globalThis.__modalChipsHtml = modalChipsHtml;\n' +
  'globalThis.__modalBodyHtml = modalBodyHtml;\n'
);

const jenny = {
  client_name: 'Jenny Ho',
  date: '2026-10-14',
  time: '13:00',
  team_lead: 'Matthew',
  acs: '8B',
  payment_status: 'UNPAID',
  mobile: '+85261234567',
  address: '12 Foo Road, Tai Po (N-T)',
  district: 'N-T',
  notes: 'side gate',
  notes_long: 'do not show as technician notes',
  job_id: '2026-10-14-matthew-jenny',
};
assert(globalThis.__modalDayLabel('2026-10-14') === 'Wed 14 Oct', '3 Wed 14 Oct');
assert(globalThis.__modalSubText(jenny) === 'Wed 14 Oct \u00b7 13:00 \u00b7 Matthew', '3 header date time team');
const chips = globalThis.__modalChipsHtml(jenny);
assert(chips.indexOf('8B') !== -1, '3 8B chip');
assert(chips.indexOf('Unpaid') !== -1, '3 Unpaid chip');
assert(chips.indexOf('modal-chip-unpaid') !== -1, '3 unpaid chip class');
const maps = '<div class="job-map-actions"><a>Open place</a><a>Directions</a><a>To next</a></div>';
const body = globalThis.__modalBodyHtml(jenny, maps);
assert(body.indexOf('href="tel:+85261234567"') !== -1, '3 phone taps');
assert(body.indexOf('class="modal-phone"') !== -1, '3 phone is a row');
assert(body.indexOf('12 Foo Road, Tai Po (N-T)') !== -1, '3 address is the body');
assert(body.indexOf('Open place') !== -1, '3 Open place on the address');
assert(body.indexOf('Directions') !== -1, '3 Directions on the address');
assert(body.indexOf('To next') !== -1, '3 keep To next');
assert(body.indexOf('side gate') !== -1, '3 notes under the address');
assert(body.indexOf('modal-address') < body.indexOf('modal-notes'), '3 notes sit under the address');
assert(body.indexOf('Technician notes') !== -1, '3 technician notes box');
assert(body.indexOf('side gate') < body.indexOf('Technician notes'), '3 technician notes under office notes');
assert(body.indexOf('do not show as technician notes') === -1, '3 office notes stay job.notes');
assert(body.indexOf('District') === -1, '3 no district row');
assert(body.indexOf('2026-10-14-matthew-jenny') === -1, '3 no job id');
assert(body.indexOf('copyVanBtn') !== -1, '3 copy van request');
assert(body.indexOf('van-copy-btn-quiet') !== -1, '3 pin is quieter');
assert(body.indexOf('copyVanBtn') < body.indexOf('copyVanPinBtn'), '3 pin under the green button');
assert(css.indexOf('.van-copy-btn-quiet') !== -1, '3 quiet pin css');
assert(css.indexOf('.modal-chips') !== -1, '3 chips css');
print('ok 3 Jenny Ho card: chips, phone, address, notes, one green van button');

assert(html.indexOf('css/app.css?v=50') !== -1, '4 css cache');
assert(html.indexOf('js/app.js?v=55') !== -1, '4 js cache');
assert(html.indexOf('js/auth.js?v=4') !== -1, '4 auth cache stays');
print('ok 4 cache css/app.css?v=50 js/app.js?v=55');

print('ok modal-sheet cases');
