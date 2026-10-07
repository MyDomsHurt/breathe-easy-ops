import { bookingFieldsFromContact, matchesBookingClient, searchBookingClients } from './contacts-query.js';
import { commitBooking, sidePanelHtml } from './booking.js';
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

const kay = {
  first_name: 'Kay',
  last_name: 'Lo',
  hubspot_id: '468000000001',
  phone: '+85261108888',
  address: '88 Foo Road, Tai Po',
  address_street: '88 Foo Road',
  address_place: 'Tai Po',
  address_territory: 'New Territories',
  deals: 2,
};
const kayJob = {
  job_id: '2026-10-08-alun-1',
  date: '2026-10-08',
  time: '16:30',
  team_lead: 'Alun',
  acs: '2S',
  amount: 1800,
  notes: 'side gate',
  hubspot_id: '468000000001',
  client_name: 'Kay Lo',
};
const nameOnly = {
  job_id: '2026-10-08-name-only',
  date: '2026-10-08',
  time: '11:00',
  team_lead: 'Josh',
  acs: '99S',
  amount: 1,
  hubspot_id: '999',
  client_name: 'Kay Lo',
};
const kayForm = {
  job_id: kayJob.job_id,
  hubspot_id: '468000000001',
  changes: [
    { at: '2026-10-01T10:00:00.000Z', by: 'jefflamb1992@gmail.com', action: 'created', diffs: [] },
  ],
};
const kayHtml = sidePanelHtml({
  form: kayForm,
  contacts: [kay],
  jobs: [kayJob, nameOnly],
  hits: [],
  picked: null,
  editing: true,
  today: '2026-10-06',
});
const railAt = kayHtml.indexOf('id="contactRail"');
const logAt = kayHtml.indexOf('id="changeLog"');
assert(railAt !== -1, 'contact card rail is present');
assert(logAt > railAt, 'card then change log then drawer');
assert(kayHtml.indexOf('id="contactRail" hidden') === -1, 'card stays open with the change log');
assert(kayHtml.indexOf('id="changeLog" hidden') === -1, 'change log stays open with the card');
assert(kayHtml.indexOf('Kay Lo') !== -1, 'kay name');
assert(kayHtml.indexOf('468000000001') !== -1, 'kay hubspot id');
assert(kayHtml.indexOf('88 Foo Road, Tai Po, New Territories') !== -1, 'one address block');
assert(kayHtml.indexOf('Full address') === -1, 'full address is not its own row');
assert(kayHtml.indexOf('>Street<') === -1, 'street is not its own row');
assert(kayHtml.indexOf('Billing split') === -1, 'billing split is not its own row');
assert(kayHtml.indexOf('>Place<') === -1, 'place is not its own row');
assert(kayHtml.indexOf('>Territory<') === -1, 'territory is not its own row');
assert(kayHtml.indexOf('HubSpot deals') !== -1, 'deals labelled HubSpot deals');
assert(kayHtml.indexOf('contact-job-line') !== -1, 'job row is one line');
assert(kayHtml.indexOf('compact-row') === -1, 'job row is not a compact card');
const lineAt = kayHtml.indexOf('contact-job-line');
const lineHtml = lineAt === -1 ? '' : kayHtml.slice(lineAt, kayHtml.indexOf('</a>', lineAt));
assert(lineHtml.indexOf('8 Oct') !== -1, '8 Oct on the job line');
assert(lineHtml.indexOf('16:30') !== -1, '16:30 on the job line');
assert(lineHtml.indexOf('Alun') !== -1, 'Alun on the job line');
assert(lineHtml.indexOf('2S') !== -1, '2S on the job line');
assert(lineHtml.indexOf('1800') !== -1, '1800 on the job line');
assert(lineHtml.indexOf('side gate') !== -1, 'note on the job line');
assert(kayHtml.indexOf('History') !== -1, 'change log lists history');
assert(kayHtml.indexOf('Job created') !== -1, 'change log lists the existing change');
assert(kayHtml.indexOf('Use this contact') === -1, 'job that already has the id has no use button');
assert(kayHtml.indexOf('99S') === -1, 'do not match jobs by name');
assert(kayHtml.indexOf('—') === -1, 'no dash rows ' + kayHtml);
const searchCard = sidePanelHtml({
  form: { job_id: '', hubspot_id: '' },
  contacts: [kay],
  jobs: [kayJob],
  hits: [kay],
  picked: kay,
  editing: false,
});
assert(searchCard.indexOf('Use this contact') !== -1, 'unconfirmed search still has Use this contact');
const searchList = sidePanelHtml({
  form: kayForm,
  contacts: [kay],
  jobs: [kayJob],
  hits: [kay, noJob],
  picked: null,
  editing: true,
});
assert(searchList.indexOf('data-pick-i') !== -1, 'search list before first click');
assert(searchList.indexOf('Use this contact') === -1, 'list is not the summary');
assert(searchList.indexOf('id="changeLog" hidden') === -1, 'search list keeps the change log');
const dough = {
  first_name: 'Dough',
  last_name: 'Bros',
  hubspot_id: '468000000002',
  phone: '+85261109999',
  address: '1 Baker Street, Central',
};
const doughHtml = sidePanelHtml({
  form: { job_id: '', hubspot_id: dough.hubspot_id, changes: [] },
  contacts: [dough],
  jobs: [],
  hits: [],
  picked: null,
  editing: false,
});
const doughRail = doughHtml.indexOf('id="contactRail"');
const doughLog = doughHtml.indexOf('id="changeLog"');
assert(doughRail !== -1, 'Dough Bros card is present');
assert(doughLog > doughRail, 'history sits between the card and the drawer');
assert(doughHtml.indexOf('id="contactRail" hidden') === -1, 'new booking keeps the card');
assert(doughHtml.indexOf('id="changeLog" hidden') === -1, 'empty history stays open');
assert(doughHtml.indexOf('Dough Bros') !== -1, 'Dough Bros name');
assert(doughHtml.indexOf('History') !== -1, 'history panel heading');
assert(doughHtml.indexOf('no changes yet') !== -1, 'empty log reads no changes yet');
assert(doughHtml.indexOf('No history yet') === -1, 'old empty copy is gone');
print('ok 6 Kay Lo and Dough Bros keep the history panel open');

const bookingSrc = readSrc('booking.js');
const appSrc = readSrc('app.js');
const html = readSrc('../index.html');
assert(bookingSrc.indexOf('uniqueClientsFrom') === -1, 'box does not search jobs');
assert(bookingSrc.indexOf('function bookingClientHits') !== -1, 'box lists contacts');
assert(bookingSrc.indexOf('matchesBookingClient') !== -1, 'same match as 61105262');
assert(bookingSrc.indexOf('s.length < 2') === -1, 'empty box stays open');
assert(bookingSrc.indexOf("addEventListener('focus'") !== -1, 'focus opens the list');
assert(bookingSrc.indexOf('.slice(0, 7)') === -1, 'no 7 cap');
assert(bookingSrc.indexOf("el.id = 'clientFlyout'") === -1, 'hits use the drawer panel');
assert(bookingSrc.indexOf('document.body.appendChild') === -1, 'panel is not a second flyout');
assert(bookingSrc.indexOf('class="typeahead-list"') === -1, 'hits not a list under the field');
assert(bookingSrc.indexOf('jobsForContact') !== -1, 'helper jobsForContact');
assert(bookingSrc.indexOf('paneHtml') === -1, 'booking card is not the contacts pane');
assert(bookingSrc.indexOf('function addressBlock') !== -1, 'one address block');
assert(bookingSrc.indexOf('contact-job-line') !== -1, 'job row is one line');
assert(bookingSrc.indexOf('HubSpot deals') !== -1, 'deals labelled HubSpot deals');
assert(bookingSrc.indexOf('Use this contact') !== -1, 'confirm click');
assert(bookingSrc.indexOf('hits.length > 1') !== -1, 'first click shows that contact only');
assert(bookingSrc.indexOf("root.classList.add('log-open')") === -1, 'drawer does not move');
const openAt = bookingSrc.indexOf('function bookingClientHits');
const openBody = bookingSrc.slice(openAt, bookingSrc.indexOf('function renderHits'));
assert(openBody.indexOf('applyPickedContact') === -1, 'opening the list must not fill the booking');
const showAt = bookingSrc.indexOf('function showClientHit');
assert(showAt !== -1, 'first click shows the contact');
const showBody = bookingSrc.slice(showAt, bookingSrc.indexOf('function useClientHit'));
assert(showBody.indexOf('applyPickedContact') === -1, 'first click must not fill the booking');
assert(showBody.indexOf('paintSidePanel') !== -1, 'first click paints the summary');
const useAt = bookingSrc.indexOf('function useClientHit');
const useBody = bookingSrc.slice(useAt, bookingSrc.indexOf('function bookingClientHits'));
assert(useBody.indexOf('applyPickedContact') !== -1, 'Use this contact fills');
assert(useBody.indexOf('closeClientSearch') !== -1, 'Use this contact closes the search');
assert(bookingSrc.indexOf('form.hubspot_id = picked.hubspot_id') !== -1, 'pick keeps hubspot id');
assert(bookingSrc.indexOf("from './contact-jobs.js?v=4'") !== -1, 'booking contact-jobs cache');
assert(bookingSrc.indexOf("from './contacts.js") === -1, 'booking does not import contacts pane');
assert(bookingSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'booking contacts-query cache');
assert(bookingSrc.indexOf('no changes yet') !== -1, 'empty log copy');
assert(appSrc.indexOf("from './booking.js?v=52'") !== -1, 'app booking cache');
assert(appSrc.indexOf("from './contacts-query.js?v=2'") !== -1, 'app contacts-query cache');
assert(html.indexOf('js/app.js?v=98') !== -1, 'index app cache');
assert(html.indexOf('css/app.css?v=65') !== -1, 'index css cache');
const cssSrc = readSrc('../css/app.css');
assert(cssSrc.indexOf('width: 520px') !== -1, 'card is wide enough for a job line');
assert(cssSrc.indexOf('.contact-job-line') !== -1, 'job line class');
assert(cssSrc.indexOf('white-space: nowrap') !== -1, 'job line stays on one line');
assert(cssSrc.indexOf('right: calc(min(540px, 100%) + 300px)') !== -1, 'card sits left of the change log');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(bookingSrc), 'no HubSpot write');
print('ok 7 three panels; first click summary; Use this contact fills; no HubSpot write');

print('ok booking-client cases');
