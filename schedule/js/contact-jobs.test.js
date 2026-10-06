import { CREW_SOURCE, crewNoteId } from './team-day.js';
import {
  contactJobFields,
  contactJobHref,
  contactJobLine,
  isSundayDate,
  jobsForContact,
  readJobLink,
  splitJobsForContact,
} from './contact-jobs.js';
import { paneHtml } from './contacts.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name, 'schedule/' + name, 'schedule/css/' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

function job(extra) {
  return Object.assign({
    job_id: '2026-09-22-josh-1',
    date: '2026-09-22',
    time: '09:00',
    team_lead: 'Josh',
    client_name: 'Ann Chan',
    mobile: '+85261105262',
    address: '31 Conduit Road',
    notes: 'gate code',
    invoice: 'Inv 12',
    acs: '2S',
    amount: 800,
    hubspot_id: '201',
  }, extra || {});
}

const contactId = '201';
const listed = jobsForContact([
  job(),
  job({ job_id: '2026-09-27-josh-2', date: '2026-09-27', time: '11:00', acs: '1W', amount: 400 }),
  job({ job_id: 'other', hubspot_id: '999' }),
  job({ job_id: 'empty', hubspot_id: '' }),
  job({ job_id: 'none', hubspot_id: null, client_name: 'Ann Chan', mobile: '+85261105262' }),
  job({
    job_id: crewNoteId('2026-09-22', 'Josh'),
    source: CREW_SOURCE,
    hubspot_id: '201',
  }),
  job({ job_id: 'gone', deleted: true, hubspot_id: '201' }),
], contactId);

assert(listed.length === 2, 'two matching jobs ' + listed.length);
assert(listed[0].date === '2026-09-27', 'newest date first');
assert(listed[1].date === '2026-09-22', 'older second');
assert(!listed.some((j) => j.job_id === 'other'), 'other id excluded');
assert(!listed.some((j) => j.job_id === 'empty' || j.job_id === 'none'), 'empty id excluded');
assert(!listed.some((j) => j.deleted), 'deleted excluded');
assert(!listed.some((j) => j.source === CREW_SOURCE), 'crew excluded');
print('ok 1 exact hubspot_id match; skip crew, deleted, empty, name/phone');

assert(jobsForContact([job()], '').length === 0, 'empty contact id');
assert(jobsForContact([job()], '201').length === 1, 'one match');
assert(jobsForContact([], '201').length === 0, 'empty list is empty');
print('ok 2 empty list when no matching jobs');

const today = '2026-10-06';
const grouped = splitJobsForContact([
  job({ job_id: 'next-late', date: '2026-10-20', time: '11:00', acs: '1W', amount: 400 }),
  job({ job_id: 'next-today', date: '2026-10-06', time: '09:00' }),
  job({ job_id: 'past-new', date: '2026-10-01', time: '14:00' }),
  job({ job_id: 'past-old', date: '2026-09-22', time: '09:00' }),
  job({ job_id: 'by-name', date: '2026-10-20', hubspot_id: '999', client_name: 'Jeff Lamb' }),
], contactId, today);
assert(grouped.next.map((j) => j.job_id).join(',') === 'next-today,next-late', 'next soonest first ' + grouped.next.map((j) => j.job_id));
assert(grouped.past.map((j) => j.job_id).join(',') === 'past-new,past-old', 'past newest first ' + grouped.past.map((j) => j.job_id));
assert(!grouped.next.some((j) => j.job_id === 'by-name') && !grouped.past.some((j) => j.job_id === 'by-name'), 'do not match jobs by name');
print('ok 2b next soonest; past newest; hubspot_id only');

const fields = contactJobFields(job());
assert(fields.date === '2026-09-22' && fields.time === '09:00', 'date time');
assert(fields.team === 'Josh' && fields.acs === '2S', 'team acs');
assert(fields.amount.indexOf('800') !== -1, 'amount ' + fields.amount);
const line = contactJobLine(job());
assert(line.indexOf('31 Conduit') === -1, 'no address');
assert(line.indexOf('gate code') === -1, 'no notes');
assert(line.indexOf('61105262') === -1, 'no phone');
assert(line.toLowerCase().indexOf('inv') === -1, 'no invoice');
assert(line.indexOf('Ann') === -1, 'no client name');
print('ok 3 row is date, time, team, ACs, amount');

assert(contactJobHref(job()) === '/?date=2026-09-22&job=2026-09-22-josh-1', 'href');
const link = readJobLink('?date=2026-09-22&job=2026-09-22-josh-1');
assert(link && link.date === '2026-09-22' && link.jobId === '2026-09-22-josh-1', 'read link');
assert(readJobLink('') == null, 'no params');
assert(readJobLink('?date=2026-09-22') == null, 'date only');
assert(readJobLink('?job=x') == null, 'job only');
assert(isSundayDate('2026-09-27') === true, 'sunday');
assert(isSundayDate('2026-09-22') === false, 'tuesday');
print('ok 4 /?date=&job= link');

const contactsSrc = readSrc('contacts.js');
assert(contactsSrc.indexOf('<th>Name</th>') !== -1 && contactsSrc.indexOf('<th>Phone</th>') !== -1, 'table name phone');
assert(contactsSrc.indexOf('<th>Place</th>') === -1, 'place left the table');
assert(contactsSrc.indexOf('<th>Stream</th>') === -1, 'stream left the table');
assert(contactsSrc.indexOf('<th>Tag</th>') === -1, 'tag left the table');
assert(contactsSrc.indexOf('<th>Deals</th>') === -1, 'deals left the table');
assert(contactsSrc.indexOf('target="_blank"') !== -1, 'new tab');
assert(contactsSrc.indexOf('contact-jobs-list') !== -1, 'list');
assert(contactsSrc.indexOf('no job has this contact id') !== -1, 'zero jobs line');
assert(contactsSrc.indexOf("client_name") === -1, 'contacts paint does not match jobs by name');
print('ok 5 table Name and Phone only; jobs on the record');

const jeff = {
  first_name: 'Jeff',
  last_name: 'Lamb',
  hubspot_id: '501',
  phone: '+85261105262',
  address: '',
  address_territory: 'New Territories',
  owner: '',
  stream: '',
  tag: '',
  deals: null,
};
const jeffHtml = paneHtml(jeff, {
  today,
  jobs: [
    job({ job_id: 'name-only', date: '2026-10-20', hubspot_id: '999', client_name: 'Jeff Lamb' }),
  ],
});
assert(jeffHtml.indexOf('Jeff Lamb') !== -1, 'jeff name');
assert(jeffHtml.indexOf('501') !== -1, 'jeff hubspot id');
assert(jeffHtml.indexOf('New Territories') !== -1, 'jeff address line');
assert(jeffHtml.indexOf('no job has this contact id') !== -1, 'jeff zero jobs');
assert(jeffHtml.indexOf('—') === -1, 'no dash rows ' + jeffHtml);
assert(jeffHtml.indexOf('2026-10-20') === -1, 'name-matched job stays out');
assert(jeffHtml.indexOf('Stream') === -1 && jeffHtml.indexOf('Deals') === -1, 'empty fields omitted');
print('ok 5b Jeff Lamb record: HubSpot id, New Territories, no job, no dashes');

const appSrc = readSrc('app.js');
assert(appSrc.indexOf('readJobLink(window.location.search)') !== -1, 'boot reads params');
assert(appSrc.indexOf('consumePendingJobLink') !== -1, 'consume on boot paint');
assert(appSrc.indexOf('openBooking(job)') !== -1, 'existing openBooking');
assert(appSrc.indexOf('history.replaceState') !== -1, 'strip params');
assert(appSrc.indexOf("state.view = 'board'") !== -1, 'switch to board');
assert(appSrc.indexOf('a.contact-job') !== -1, 'contact job click stays on contacts');
assert(appSrc.indexOf('goToJob') !== -1, 'goToJob still for search');
assert(appSrc.indexOf('jobs: allJobs()') !== -1, 'pane jobs from allJobs');
print('ok 6 boot URL reader and new tab leaves Contacts');

const html = readSrc('../index.html');
assert(html.indexOf('id="viewContacts"') !== -1, 'same contacts page');
assert(html.indexOf('js/app.js?v=91') !== -1, 'app cache');
assert(html.indexOf('css/app.css?v=58') !== -1, 'css cache');
assert(appSrc.indexOf("from './contacts.js?v=5'") !== -1, 'contacts cache');
assert(appSrc.indexOf("from './contact-jobs.js?v=3'") !== -1, 'contact-jobs cache');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(contactsSrc), 'no HubSpot writes in contacts');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(appSrc), 'no HubSpot writes in app');
print('ok 7 cache bump; no HubSpot write; no second page');

print('ok contact-jobs cases');
