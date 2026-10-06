import { bookingFieldsFromContact, matchesBookingClient, searchBookingClients } from './contacts-query.js';
import { commitBooking } from './booking.js';
import { contactJobLine, jobsForContact } from './contact-jobs.js';
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
const jeffs = [];
for (let i = 0; i < 12; i += 1) {
  jeffs.push({ hubspot_id: 'j' + i, first_name: 'Jeff', last_name: 'N' + i, phone: '' });
}
jeffs.push({ hubspot_id: 'ann', first_name: 'Ann', last_name: 'Chan', phone: '' });
const namedJeff = jeffs.filter((c) => matchesBookingClient(c, 'Jeff'));
assert(namedJeff.length === 12, 'every Jeff matches, no cap ' + namedJeff.length);
assert(namedJeff.every((c) => c.first_name === 'Jeff'), 'Jeff name match');
assert(!namedJeff.some((c) => c.hubspot_id === 'ann'), 'Ann stays out of Jeff');
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

const jeff = {
  hubspot_id: '6110',
  first_name: 'Jeff',
  last_name: 'Lamb',
  phone: '+85261105262',
  address: '12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)',
};
const jeffJobs = [
  { job_id: 'old', date: '2026-09-22', time: '09:00', team_lead: 'Josh', acs: '2S', amount: 800, hubspot_id: '6110' },
  { job_id: 'new', date: '2026-10-01', time: '10:30', team_lead: 'Josh', acs: '1W', amount: 400, hubspot_id: '6110' },
  { job_id: 'other', date: '2026-10-02', time: '11:00', team_lead: 'Josh', acs: '1S', amount: 200, hubspot_id: '999' },
];
const jeffListed = jobsForContact(jeffJobs, jeff.hubspot_id);
assert(jeffListed.length === 2, '5 Jeff jobs by hubspot_id');
assert(jeffListed[0].date === '2026-10-01', '5 newest first');
assert(contactJobLine(jeffListed[0]).indexOf('2026-10-01') !== -1, '5 line date');
assert(contactJobLine(jeffListed[0]).indexOf('10:30') !== -1, '5 line time');
assert(contactJobLine(jeffListed[0]).indexOf('Josh') !== -1, '5 line team');
assert(contactJobLine(jeffListed[0]).indexOf('1W') !== -1, '5 line ACs');
print('ok 5 Jeff Lamb jobs newest first; date time team ACs amount');

const bookingSrc = readSrc('booking.js');
const appSrc = readSrc('app.js');
const html = readSrc('../index.html');
assert(bookingSrc.indexOf('uniqueClientsFrom') === -1, 'box does not search jobs');
assert(bookingSrc.indexOf('function bookingClientHits') !== -1, 'box lists contacts');
assert(bookingSrc.indexOf('matchesBookingClient') !== -1, 'same match as 61105262');
assert(bookingSrc.indexOf('s.length < 2') === -1, 'empty box stays open');
assert(bookingSrc.indexOf("addEventListener('focus'") !== -1, 'focus opens the list');
assert(bookingSrc.indexOf('.slice(0, 7)') === -1, 'no 7 cap');
assert(bookingSrc.indexOf("el.id = 'clientFlyout'") !== -1, 'hits open in a flyout');
assert(bookingSrc.indexOf('document.body.appendChild') !== -1, 'flyout beside the drawer');
assert(bookingSrc.indexOf('class="typeahead-list"') === -1, 'hits not a list under the field');
assert(bookingSrc.indexOf('jobsForContact') !== -1, 'helper jobsForContact');
assert(bookingSrc.indexOf('contactJobLine') !== -1, 'job line helper');
assert(bookingSrc.indexOf('Use this contact') !== -1, 'confirm click');
assert(bookingSrc.indexOf('hits.length > 1') !== -1, 'first click shows that contact only');
const openAt = bookingSrc.indexOf('function bookingClientHits');
const openBody = bookingSrc.slice(openAt, bookingSrc.indexOf('function renderHits'));
assert(openBody.indexOf('applyPickedContact') === -1, 'opening the list must not fill the booking');
const showAt = bookingSrc.indexOf('function showClientHit');
assert(showAt !== -1, 'first click shows the contact');
const showBody = bookingSrc.slice(showAt, bookingSrc.indexOf('function useClientHit'));
assert(showBody.indexOf('applyPickedContact') === -1, 'first click must not fill the booking');
assert(showBody.indexOf('paintClientFlyout') !== -1, 'first click paints the summary');
const useAt = bookingSrc.indexOf('function useClientHit');
const useBody = bookingSrc.slice(useAt, bookingSrc.indexOf('function paintClientFlyout'));
assert(useBody.indexOf('applyPickedContact') !== -1, 'Use this contact fills');
assert(useBody.indexOf('closeClientFlyout') !== -1, 'Use this contact closes the flyout');
assert(bookingSrc.indexOf('form.hubspot_id = picked.hubspot_id') !== -1, 'pick keeps hubspot id');
assert(bookingSrc.indexOf("from './contact-jobs.js?v=3'") !== -1, 'booking contact-jobs cache');
assert(bookingSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'booking contacts-query cache');
assert(appSrc.indexOf("from './booking.js?v=47'") !== -1, 'app booking cache');
assert(appSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'app contacts-query cache');
assert(html.indexOf('js/app.js?v=91') !== -1, 'index app cache');
assert(html.indexOf('css/app.css?v=58') !== -1, 'index css cache');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(bookingSrc), 'no HubSpot write');
print('ok 6 flyout; first click summary; Use this contact fills; no HubSpot write');

print('ok booking-client cases');
