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
assert(openBody.indexOf('Open Location') !== -1, '2 Open Location');
assert(openBody.indexOf('Open place') === -1, '2 Open place is gone');
assert(openBody.indexOf('Directions') === -1, '2 no Directions');
assert(openBody.indexOf('jobDirBtn') === -1, '2 no Directions button');
assert(openBody.indexOf('To Office') !== -1, '2 To Office on a last job');
assert(openBody.indexOf('Gravity, 29 Hing Yip Street') !== -1, '2 To Office is Gravity');
assert(openBody.indexOf('nextJobSameDayLead') !== -1, '2 next job helper');
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
const maps = '<div class="job-map-actions"><a>Open Location</a><a>To next</a></div>';
const body = globalThis.__modalBodyHtml(jenny, maps);
assert(body.indexOf('href="tel:+85261234567"') !== -1, '3 phone taps');
assert(body.indexOf('class="modal-phone"') !== -1, '3 phone is a row');
assert(body.indexOf('12 Foo Road, Tai Po (N-T)') !== -1, '3 address is the body');
assert(body.indexOf('Open Location') !== -1, '3 Open Location on the address');
assert(body.indexOf('Directions') === -1, '3 no Directions');
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
assert(body.indexOf('copyVanBtn') < body.indexOf('copyVanPinBtn'), '3 pin after van');
assert(css.indexOf('.van-copy-btn-quiet') !== -1, '3 quiet pin css');
assert(css.indexOf('.modal-chips') !== -1, '3 chips css');
print('ok 3 Jenny Ho card: chips, phone, address, notes, van and pin');

eval(
  'var window = globalThis.window || (globalThis.window = {});\n' +
  'const DISTRICT_TAG = \'HKN|HKS|HKIS|KLN|TKO|TSW|N\\\\s*-?\\\\s*TW?|NTW?|S\\\\s*-?\\\\s*K|L\\\\s*-?\\\\s*[TM]|LT|LM\';\n' +
  'const DISTRICT_COLORS = {};\n' +
  fnBody(src, 'tidyAddress') + '\n' +
  fnBody(src, 'shortDistrictCode') + '\n' +
  fnBody(src, 'addressHasDistrictTag') + '\n' +
  fnBody(src, 'displayAddress') + '\n' +
  fnBody(src, 'cleanAddressForMaps') + '\n' +
  fnBody(src, 'mapsDirQuery') + '\n' +
  fnBody(src, 'mapsDirHref') + '\n' +
  fnBody(src, 'timeToMinutes') + '\n' +
  fnBody(src, 'jobSortMinutes') + '\n' +
  fnBody(src, 'isCrewNote') + '\n' +
  fnBody(src, 'isPaintedDayJob') + '\n' +
  fnBody(src, 'jobDateKey') + '\n' +
  fnBody(src, 'sameTeamLead') + '\n' +
  fnBody(src, 'nextJobSameDayLead') + '\n' +
  'var allJobs = [];\n' +
  'globalThis.__mapsDirHref = mapsDirHref;\n' +
  'globalThis.__setJobs = function (rows) { allJobs = rows; };\n' +
  'globalThis.__nextJobSameDayLead = nextJobSameDayLead;\n'
);
const firstJob = {
  job_id: '2026-10-14-matthew-first',
  date: '2026-10-14',
  team_lead: 'Matthew',
  time: '09:00',
  client_name: 'First',
  address: '12 Foo Road, Tai Po (N-T)'
};
const lastJob = {
  job_id: '2026-10-14-matthew-last',
  date: '2026-10-14',
  team_lead: 'Matthew',
  time: '13:00',
  client_name: 'Last',
  address: '88 Foo Road, Tai Po (N-T)'
};
globalThis.__setJobs([firstJob, lastJob]);
const nextOfFirst = globalThis.__nextJobSameDayLead(firstJob);
const nextOfLast = globalThis.__nextJobSameDayLead(lastJob);
assert(nextOfFirst && nextOfFirst.job_id === lastJob.job_id, '6 a job with a next');
assert(nextOfLast == null, '6 a last job has no next');
assert(openBody.indexOf('>Open Location</a>') !== -1, '6 Open Location');
assert(openBody.indexOf('>To next</a>') !== -1, '6 To next when there is a next job');
assert(openBody.indexOf('>To Office</a>') !== -1, '6 To Office when there is no next job');
const officeDir = globalThis.__mapsDirHref('Gravity, 29 Hing Yip Street', lastJob.address);
assert(officeDir.indexOf('https://www.google.com/maps/dir/?api=1&destination=') === 0, '6 To Office is a maps dir URL');
assert(decodeURIComponent(officeDir).indexOf('Gravity, 29 Hing Yip Street') !== -1, '6 To Office goes to Gravity');
assert(openBody.indexOf('Directions') === -1, '6 no Directions');
print('ok 6 a job with a next shows Open Location and To next; a last job shows Open Location and To Office; no Directions');

const paika = {
  job_id: '2026-10-15-matthew-paika',
  date: '2026-10-15',
  team_lead: 'Matthew',
  time: '10:00',
  client_name: 'Paika Liu',
  address: '6D Tower 2, The Visionary, Tung Chung (L-T)'
};
const katie = {
  job_id: '2026-10-15-matthew-katie',
  date: '2026-10-15',
  team_lead: 'Matthew',
  time: '11:00',
  client_name: 'Katie',
  address: '1/2 Floor, 62 Tai Hang Hau Road, Clear Water Bay'
};
const lobster = {
  job_id: '2026-10-15-tiago-lobster',
  date: '2026-10-15',
  team_lead: 'Tiago',
  time: '10:30',
  client_name: 'Lobster Bay Villa',
  address: 'Lobster Bay Villa, Sai Kung'
};
const paikaCrew = {
  job_id: 'crew-2026-10-15-matthew',
  date: '2026-10-15',
  team_lead: 'Matthew',
  time: '10:15',
  client_name: 'Crew',
  source: 'team-day-crew'
};
const paikaGone = {
  job_id: '2026-10-15-matthew-gone',
  date: '2026-10-15',
  team_lead: 'Matthew',
  time: '10:20',
  client_name: 'Deleted',
  deleted: true
};
globalThis.__setJobs([paika, lobster, paikaCrew, paikaGone, katie]);
const nextOfPaika = globalThis.__nextJobSameDayLead(paika);
assert(nextOfPaika && nextOfPaika.client_name === 'Katie', '6 Paika Liu next is Katie');
assert(String(nextOfPaika.address).indexOf('62 Tai Hang Hau Road') !== -1, '6 Katie is 62 Tai Hang Hau Road');
assert(nextOfPaika.client_name !== 'Lobster Bay Villa', '6 does not pick Lobster Bay Villa');
assert(nextOfPaika.team_lead === 'Matthew', '6 does not pick another lead');
const paikaToNext = globalThis.__mapsDirHref(nextOfPaika.address, paika.address);
assert(decodeURIComponent(paikaToNext).indexOf('62 Tai Hang Hau Road') !== -1, '6 To next opens directions to Katie at Tai Hang Hau Road');
assert(decodeURIComponent(paikaToNext).indexOf('Clear Water Bay') !== -1, '6 Clear Water Bay');
assert(decodeURIComponent(paikaToNext).indexOf('Lobster Bay Villa') === -1, '6 To next does not open Lobster Bay Villa');
assert(openBody.indexOf('>Open Location</a>') !== -1, '6 Open Location stays');
assert(fnBody(src, 'mapsHref').indexOf('cleanAddressForMaps') !== -1, '6 Open Location stays on mapsHref');
assert(src.indexOf('function tidyAddress') !== -1, '6 address cleaning stays');
print('ok 6b Paika Liu To next is Katie at Tai Hang Hau Road, not Lobster Bay Villa');

const poon = {
  client_name: 'Poon Kit Tung',
  date: '2026-10-14',
  time: '13:00',
  team_lead: 'Matthew',
  acs: '1B',
  payment_status: 'UNPAID',
  mobile: '+85261112222',
  address: '88 Foo Road, Tai Po (N-T)',
  district: 'N-T',
  notes: 'call first',
  job_id: '2026-10-14-matthew-poon',
};
const poonBody = globalThis.__modalBodyHtml(poon, maps);
assert(poonBody.indexOf('sheet-identity') !== -1, '5 identity block');
assert(poonBody.indexOf('sheet-place') !== -1, '5 place block');
assert(poonBody.indexOf('sheet-notes') !== -1, '5 notes block');
assert(poonBody.indexOf('sheet-action') !== -1, '5 action block');
assert(poonBody.indexOf('sheet-identity') < poonBody.indexOf('sheet-place'), '5 identity then place');
assert(poonBody.indexOf('sheet-place') < poonBody.indexOf('sheet-notes'), '5 place then notes');
assert(poonBody.indexOf('sheet-notes') < poonBody.indexOf('sheet-action'), '5 notes then action');
assert(poonBody.indexOf('sheet-identity-time') !== -1 && poonBody.indexOf('13:00') !== -1, '5 time is large');
assert(poonBody.indexOf('sheet-place') < poonBody.indexOf('modal-phone'), '5 phone in place');
assert(poonBody.indexOf('sheet-place') < poonBody.indexOf('Open Location'), '5 short map row in place');
assert(poonBody.indexOf('sheet-notes') < poonBody.indexOf('call first'), '5 office note in notes');
assert(poonBody.indexOf('sheet-notes') < poonBody.indexOf('techNotesSave'), '5 Save on the box');
assert(poonBody.indexOf('sheet-action') < poonBody.indexOf('copyVanBtn'), '5 van in action');
assert(poonBody.indexOf('sheet-action') < poonBody.indexOf('copyVanPinBtn'), '5 pin in action');
assert(css.indexOf('border-radius: 8px') !== -1, '5 8px radius');
assert(css.indexOf("Libre Franklin") !== -1, '5 Libre Franklin');
assert(css.indexOf('#075985') !== -1, '5 primary blue');
assert(css.indexOf('rgba(7, 89, 133, 0.08)') !== -1, '5 quiet wash');
assert(css.indexOf('.sheet-identity-time') !== -1 && css.indexOf('font-size: 32px') !== -1, '5 time is large');
assert(css.indexOf('.sheet-action') !== -1 && css.indexOf('flex-direction: row') !== -1, '5 van and pin side by side');
assert(css.indexOf('.van-copy-btn') !== -1, '5 van button');
assert(css.indexOf('width: auto') !== -1, '5 van not full width');
assert(css.indexOf('#059669') === -1, '5 not a green bar');
print('ok 5 Poon Kit Tung shows the four blocks; time is large; van and pin sit side by side');

assert(html.indexOf('css/app.css?v=56') !== -1, '4 css cache');
assert(html.indexOf('js/app.js?v=70') !== -1, '4 js cache');
assert(html.indexOf('js/auth.js?v=4') !== -1, '4 auth cache stays');
print('ok 4 cache css/app.css?v=56 js/app.js?v=70');

print('ok modal-sheet cases');
