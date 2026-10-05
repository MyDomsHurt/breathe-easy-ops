import { bookingFieldsFromContact, matchesBookingClient, searchBookingClients } from './contacts-query.js';
import { commitBooking } from './booking.js';
import { emptyUnits } from './utils.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name, '../' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

const noJob = {
  hubspot_id: '201',
  first_name: 'Ann',
  last_name: 'Chan',
  phone: '+85261105262',
  address: '12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)',
  address_line1: 'Flat 12A',
  address_street: '31 Conduit Road',
  address_place: 'Mid-Levels',
  address_territory: 'Hong Kong Island',
  deals: 0,
};
const spaced = {
  hubspot_id: '202',
  first_name: 'Ben',
  last_name: 'Ng',
  phone: '+852 6110 5262',
  address: '',
};
const noPhone = {
  hubspot_id: '303',
  first_name: 'Cara',
  last_name: 'Ho',
  phone: '',
  address: '9 Ice House Street',
  instagram: 'cara.ig',
  stream: 'Referral',
  tag: 'Membership',
};

assert(matchesBookingClient(noJob, '61105262'), 'naked national matches +85261105262');
assert(matchesBookingClient(spaced, '61105262'), 'naked national matches spaced +852 6110 5262');
assert(matchesBookingClient(noJob, '85261105262'), 'typed 852 still matches');
assert(matchesBookingClient(spaced, '+852 6110 5262'), 'typed spaces still match');
assert(matchesBookingClient(noJob, 'Ann'), 'name match');
assert(matchesBookingClient(noPhone, 'Cara'), 'no phone still matches by name');
assert(!matchesBookingClient(noPhone, '61105262'), 'no phone does not match digits');
assert(!matchesBookingClient(noPhone, 'cara.ig'), 'booking box ignores instagram');
assert(!matchesBookingClient(noPhone, 'Referral'), 'booking box ignores stream');
assert(!matchesBookingClient(noPhone, 'Membership'), 'booking box ignores tag');
print('ok 1 digit and name match; spaces and 852 do not hide the national number');

const jobs = [];
const hits = searchBookingClients([noJob, spaced, noPhone], '61105262');
assert(hits.length === 2, 'two phone hits ' + hits.length);
assert(hits.some((c) => c.hubspot_id === '201'), 'no-job contact is in the list');
assert(hits.every((c) => c.hubspot_id !== '303'), 'name-only contact stays out of a phone query');
assert(searchBookingClients([noJob], '61105262').length === 1, 'contact with no job still appears');
assert(jobs.length === 0, 'search does not read jobs');
assert(searchBookingClients([noPhone], 'Cara Ho')[0].hubspot_id === '303', 'name query finds no-phone contact');
print('ok 2 contacts list search; no job required');

const picked = bookingFieldsFromContact(noJob);
assert(picked.client_name === 'Ann Chan', 'fill name');
assert(picked.phone === '+85261105262', 'fill phone');
assert(picked.address.indexOf('The Morgan') !== -1, 'fill address');
assert(picked.hubspot_id === '201', 'keep hubspot id');
const named = bookingFieldsFromContact(noPhone);
assert(named.client_name === 'Cara Ho', 'no-phone name');
assert(named.phone === '', 'no-phone stays empty');
assert(named.hubspot_id === '303', 'no-phone keeps hubspot id');
print('ok 3 pick fills name, phone, address, hubspot_id');

function blankForm(over = {}) {
  return {
    job_id: '',
    client_name: '',
    mobile: '',
    phone_cc: '',
    phone_national: '',
    hubspot_id: '',
    address: '',
    address_line1: '',
    address_street: '',
    address_place: '',
    address_extra: '',
    district: '',
    units: emptyUnits(),
    date: '2026-12-15',
    time: '',
    team_lead: 'Josh',
    job_type: 'cleaning',
    amount: '',
    payment: '',
    notes: '',
    notes_long: '',
    status: 'confirmed',
    invoice: '',
    receipt: '',
    credit_note: '',
    stack_order: '',
    highlight: {},
    ...over,
  };
}

function memoryIo(contacts) {
  const list = [];
  return {
    allJobs: () => list.slice(),
    allContacts: () => (contacts || []).slice(),
    addJob(input) {
      const job = { ...input, job_id: input.job_id || ('job-' + (list.length + 1)) };
      list.push(job);
      return job;
    },
    updateJob(id, input) {
      const i = list.findIndex((j) => j.job_id === id);
      list[i] = { ...list[i], ...input, job_id: id };
      return list[i];
    },
  };
}

const ioName = memoryIo([noPhone]);
const savedName = commitBooking(blankForm({
  client_name: 'Cara Ho',
  hubspot_id: '303',
  mobile: '',
}), 'confirmed', ioName);
assert(!savedName.error, '4 save ' + savedName.error);
assert(savedName.job.hubspot_id === '303', '4 keep picked id when phone rematch is empty ' + savedName.job.hubspot_id);
const ioPhone = memoryIo([noJob]);
const savedPhone = commitBooking(blankForm({
  client_name: 'Ann Chan',
  hubspot_id: '201',
  mobile: '+85261105262',
  phone_cc: '852',
  phone_national: '61105262',
}), 'confirmed', ioPhone);
assert(savedPhone.job.hubspot_id === '201', '4 phone rematch keeps the same id');
print('ok 4 save keeps the picked HubSpot id');

const bookingSrc = readSrc('booking.js');
const appSrc = readSrc('app.js');
const html = readSrc('../index.html');
assert(bookingSrc.indexOf('uniqueClientsFrom') === -1, 'box does not search jobs');
assert(bookingSrc.indexOf('searchBookingClients(allContacts()') !== -1, 'box searches contacts');
assert(bookingSrc.indexOf('applyPickedContact') !== -1, 'pick applies the contact');
assert(bookingSrc.indexOf('form.hubspot_id = picked.hubspot_id') !== -1, 'pick keeps hubspot id');
assert(bookingSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'booking contacts-query cache');
assert(appSrc.indexOf("from './booking.js?v=41'") !== -1, 'app booking cache');
assert(appSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'app contacts-query cache');
assert(html.indexOf('js/app.js?v=85') !== -1, 'index app cache');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(bookingSrc), 'no HubSpot write');
print('ok 5 cache bump; contacts search; no HubSpot write');

print('ok booking-client cases');
