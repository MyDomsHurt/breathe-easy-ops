import { CREW_SOURCE, crewNoteId } from './team-day.js';
import {
  CONTACT_HEADERS,
  HEADERS,
  JSON_KEYS,
  contactSheetRow,
  listExportContacts,
  listExportJobs,
  sheetRow,
} from './export-roster.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name, 'schedule/' + name];
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
    client_name: 'Ann',
    mobile: '+85261105262',
    phone_cc: '852',
    phone_national: '61105262',
    hubspot_id: '',
  }, extra || {});
}

const mobileIdx = HEADERS.indexOf('Mobile');
const hubspotIdx = HEADERS.indexOf('HubSpot ID');
assert(mobileIdx === 6, 'Mobile column ' + mobileIdx);
assert(hubspotIdx === mobileIdx + 1, 'HubSpot ID next to Mobile');
assert(HEADERS[hubspotIdx + 1] === 'Country', 'Country stays after HubSpot ID');
assert(HEADERS.length === JSON_KEYS.length, 'JSON_KEYS length ' + JSON_KEYS.length);
assert(JSON_KEYS[hubspotIdx] === 'hubspotId', 'JSON hubspotId at HubSpot ID');
assert(JSON_KEYS[mobileIdx] === 'mobile', 'JSON mobile at Mobile');
print('ok 1 HubSpot ID sits next to Mobile');

const unmatched = sheetRow(job({ hubspot_id: '' }), []);
assert(unmatched[hubspotIdx] === '', 'empty id stays empty');
assert(unmatched[mobileIdx] === '+85261105262', 'mobile still there');
const attached = sheetRow(job({ hubspot_id: '201' }), []);
assert(attached[hubspotIdx] === '201', 'job HubSpot ID ' + attached[hubspotIdx]);
const spaced = sheetRow(job({ hubspot_id: ' 201 ' }), []);
assert(spaced[hubspotIdx] === '201', 'trim job HubSpot ID');
print('ok 2 empty job id stays empty; attached id writes through');

assert(CONTACT_HEADERS.join('|') === 'HubSpot ID|First|Last|Phone|Address|Stream|Tag|Owner|Deals|Revenue', 'contact headers');
const contact = {
  hubspot_id: '201',
  first_name: 'Ann',
  last_name: 'Chan',
  phone: '+85261105262',
  address: '31 Conduit Road',
  stream: 'Residential',
  tag: 'VIP',
  owner: '42',
  deals: 3,
  revenue: 1200,
};
const crow = contactSheetRow(contact);
assert(crow[0] === '201', 'contact HubSpot ID');
assert(crow[1] === 'Ann' && crow[2] === 'Chan', 'name');
assert(crow[3] === '+85261105262', 'phone');
assert(crow[4] === '31 Conduit Road', 'address');
assert(crow[5] === 'Residential' && crow[6] === 'VIP' && crow[7] === '42', 'stream tag owner');
assert(crow[8] === 3 && crow[9] === 1200, 'deals revenue numbers');
assert(contactSheetRow({ hubspot_id: '9', deals: '', revenue: null })[8] === '', 'empty deals');
assert(contactSheetRow({ hubspot_id: '9', deals: '', revenue: null })[9] === '', 'empty revenue');
print('ok 3 Contacts columns');

const jobId = attached[hubspotIdx];
const listed = listExportContacts([
  contact,
  { hubspot_id: '', first_name: 'Skip' },
  { hubspot_id: '   ', first_name: 'Blank' },
  { hubspot_id: '100', first_name: 'Bea', last_name: 'Ng' },
]);
assert(listed.length === 2, 'skip empty contact ids ' + listed.length);
assert(listed[0].hubspot_id === '201' && listed[1].hubspot_id === '100', 'sort last then first');
assert(listed.some((c) => String(c.hubspot_id) === jobId), 'job id finds a Contacts row');
assert(contactSheetRow(listed.find((c) => c.hubspot_id === jobId))[0] === jobId, 'same HubSpot ID on both sheets');
print('ok 4 job id joins Contacts; empty contact ids skipped');

const crew = job({
  job_id: crewNoteId('2026-09-22', 'Josh'),
  source: CREW_SOURCE,
  client_name: '',
});
const gone = job({ job_id: '2026-09-22-josh-gone', deleted: true });
const exported = listExportJobs([job(), crew, gone]);
assert(exported.length === 1, 'skip crew and deleted ' + exported.length);
assert(exported[0].job_id === '2026-09-22-josh-1', 'kept real job');
print('ok 5 skip crew notes and deleted jobs');

const src = readSrc('export-roster.js');
assert(src.indexOf("book_append_sheet") !== -1, 'appends sheets');
assert(src.indexOf("'Contacts'") !== -1, 'Contacts sheet name');
assert(src.indexOf('listContactsForPhoneClean') !== -1, 'reads Firestore contacts');
assert(src.indexOf("allJobs()") !== -1, 'export still allJobs()');
assert(/export async function exportMasterRoster/.test(src), 'one exportMasterRoster');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal|crm\.objects/.test(src), 'no HubSpot writes');
const jobsPos = src.indexOf("'Jobs'");
const contactsPos = src.indexOf("'Contacts'");
const logPos = src.indexOf("'Change log'");
assert(jobsPos !== -1 && contactsPos > jobsPos && logPos > contactsPos, 'sheet order Jobs, Contacts, Change log');
print('ok 6 one export, Contacts sheet, no HubSpot writes');

const appSrc = readSrc('app.js');
assert((appSrc.match(/export-roster\.js\?v=/g) || []).length === 1, 'one export-roster import');
assert(appSrc.indexOf("toast('Exported ' + result.jobs + ' jobs')") !== -1, 'toast stays job count');
assert((appSrc.match(/exportMasterRoster/g) || []).length === 2, 'one import and one call');
const html = readSrc('../index.html');
assert((html.match(/id="exportRoster"/g) || []).length === 1, 'one Export roster button');
assert(html.indexOf('id="exportContacts"') === -1, 'no second export control');
assert(html.indexOf('exportContactsBlock') === -1, 'no new Settings export control');
print('ok 7 same Export click; no new Settings control');

print('ok export-roster cases');
