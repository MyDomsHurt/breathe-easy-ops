import { rosterCellHtml } from './board.js';

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
    'schedule/js/' + name,
    'js/' + name,
    '../' + name,
    '../js/' + name,
    'schedule/' + name.replace(/^\.\.\//, ''),
  ];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

const want = 'Flat E, 11/F, Tower 9, Centra Horizon, 18 Chong San Road, Pak Shek Kok (N-T)';
const noTag = 'Flat E, 11/F, Tower 9, Centra Horizon, 18 Chong San Road, Pak Shek Kok';
const date = '2026-10-13';
const team = 'Josh';

function cardJob(over) {
  return {
    job_id: 'christy',
    date,
    team_lead: team,
    client_name: 'Christy Ngan',
    time: '09:00',
    source: 'test',
    address: want,
    address_street: '18 Chong San Road',
    address_place: 'Pak Shek Kok',
    address_line1: 'Flat E, 11/F, Tower 9, Centra Horizon',
    district: 'N-T',
    ...(over || {}),
  };
}

function weekHtml(job) {
  const jobs = [job];
  return rosterCellHtml(jobs, jobs, date, team, 'week', jobs, date);
}

function cardAddr(html) {
  const m = String(html || '').match(/<p class="compact-addr[^"]*">([^<]*)<\/p>/);
  return m ? m[1] : '';
}

const src = readSrc('board.js');
const weekAt = src.indexOf('function weekAddressLine');
assert(weekAt !== -1, '1 weekAddressLine');
const weekBody = src.slice(weekAt, src.indexOf('function boardCardHtml'));
assert(weekBody.indexOf('address_street') === -1, '1 does not use address_street');
assert(weekBody.indexOf('job.address') !== -1, '1 uses the full line');
assert(weekBody.indexOf('shortDistrictCode') !== -1, '1 appends from district');
print('ok 1 weekAddressLine uses the full line');

const htmlKeep = weekHtml(cardJob());
const addrKeep = cardAddr(htmlKeep);
assert(addrKeep === want, '2 keeps full line with tag');
assert(addrKeep.indexOf('Flat E') !== -1, '2 keeps the unit');
assert(addrKeep.indexOf('18 Chong San Road') !== -1, '2 keeps the street');
assert(addrKeep.indexOf('Pak Shek Kok') !== -1, '2 keeps the place');
assert(addrKeep.indexOf('(N-T)') !== -1, '2 keeps (N-T)');
assert(addrKeep.indexOf('New Territories') === -1, '2 not New Territories');
assert(addrKeep !== '18 Chong San Road', '2 not street only');
print('ok 2 cleaned card is unit, street, place, (N-T)');

const addrAppend = cardAddr(weekHtml(cardJob({ address: noTag, district: 'N-T' })));
assert(addrAppend === want, '3 appends (N-T) when missing');
const addrLabel = cardAddr(weekHtml(cardJob({ address: noTag, district: 'New Territories' })));
assert(addrLabel === want, '3 New Territories becomes (N-T)');
assert(addrLabel.indexOf('New Territories') === -1, '3 does not print New Territories');
print('ok 3 missing tag comes from the job district as (N-T)');

const appSrc = readSrc('app.js');
const html = readSrc('../index.html');
assert(appSrc.indexOf("from './board.js?v=30'") !== -1, '4 board cache');
assert(html.indexOf('js/app.js?v=100') !== -1, '4 app cache');
assert(html.indexOf('css/app.css?v=65') !== -1, '4 css cache stays');
assert(appSrc.indexOf("from './booking.js?v=53'") !== -1, '4 booking cache stays');
print('ok 4 cache board.js?v=30 app.js?v=100');

print('ok week-address cases');
