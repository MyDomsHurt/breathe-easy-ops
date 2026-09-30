import { CREW_SOURCE, isCrewNote } from '../../shared/team-day.js';
import { parsePhone } from '../../shared/phone-parse.js';
import {
  planCleanPhones,
  planCleanPhonesLines,
  plannedPhoneFields,
} from './clean-phones.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const contacts = [
  { hubspot_id: '101', phone: '+85291234567' },
  { hubspot_id: '102', phone: '+6598765432' },
  { hubspot_id: '103', phone: '+85291234567' },
  { hubspot_id: '201', phone: '+85261105262' },
];

const naked = plannedPhoneFields({ job_id: 'a', mobile: '9123 4567' }, contacts);
assert(naked.mobile === '+85291234567', 'naked E.164 ' + naked.mobile);
assert(naked.phone_cc === '852', 'naked cc');
assert(naked.phone_national === '91234567', 'naked national');
assert(naked.phoneChanged === true, 'naked phone cleaned');
assert(naked.matchStatus === 'ambiguous', 'naked 91234567 is two contacts');
assert(naked.hubspot_id === '', 'two+ stays empty');
print('ok 1 parse mobile into E.164 + cc + national');

const sg = plannedPhoneFields({ job_id: 'b', mobile: '6598765432' }, contacts);
assert(sg.mobile === parsePhone('6598765432').full, 'sg full');
assert(sg.phone_cc === '65' && sg.phone_national === '98765432', 'sg split');
assert(sg.matchStatus === 'one' && sg.hubspot_id === '102', 'sg one contact');
print('ok 2 one-contact match');

const already = plannedPhoneFields({
  job_id: 'c',
  mobile: '+85261105262',
  phone_cc: '852',
  phone_national: '61105262',
  hubspot_id: '201',
}, contacts);
assert(already.changed === false, 'already clean');
assert(already.matchStatus === 'one', 'already is one-contact');
print('ok 3 already clean keeps one-contact match');

const empty = plannedPhoneFields({
  job_id: 'd',
  mobile: '',
  phone_cc: '852',
  phone_national: '11112222',
  hubspot_id: 'x',
}, contacts);
assert(empty.mobile === '' && empty.phone_cc === '' && empty.phone_national === '', 'empty clears three');
assert(empty.hubspot_id === '', 'empty id stays empty');
assert(empty.phoneChanged === true, 'leftover cc is a phone clean');
print('ok 4 empty phone clears mobile cc national and id');

const unparsed = plannedPhoneFields({
  job_id: 'e',
  mobile: 'TBC',
  phone_cc: '',
  phone_national: '',
}, contacts);
assert(unparsed.mobile === 'TBC', 'unparsed left as-is');
assert(unparsed.phoneChanged === false, 'unparsed not a phone clean');
assert(unparsed.hubspot_id === '', 'unparsed unmatched id empty');
print('ok 5 unparsed left as-is');

const wrongId = plannedPhoneFields({
  job_id: 'f',
  mobile: '+85261105262',
  phone_cc: '852',
  phone_national: '61105262',
  hubspot_id: '999',
}, contacts);
assert(wrongId.hubspot_id === '201', 'replace with the one contact');
assert(wrongId.phoneChanged === false && wrongId.changed === true, 'id-only write');
print('ok 6 one contact overwrites a wrong hubspot_id');

const live = [
  { job_id: 'a', mobile: '9123 4567' },
  { job_id: 'b', mobile: '6598765432' },
  { job_id: 'c', mobile: '+85261105262', phone_cc: '852', phone_national: '61105262', hubspot_id: '201' },
  { job_id: 'd', mobile: '' },
  { job_id: 'e', mobile: '99998888', phone_cc: '852', phone_national: '99998888' },
  { job_id: 'crew-1', mobile: '91234567', source: CREW_SOURCE, team_lead: 'Josh' },
  { job_id: 'gone', mobile: '91234567', deleted: true },
];
assert(isCrewNote(live[5]), 'fixture crew');
const plan = planCleanPhones(live, contacts);
assert(plan.updates.every((u) => u.job_id !== 'crew-1' && u.job_id !== 'gone'), 'skip crew and deleted');
assert(plan.phonesCleaned === 3, 'phones cleaned ' + plan.phonesCleaned);
assert(plan.oneMatches === 2, 'one-contact matches ' + plan.oneMatches);
assert(plan.unmatched === 2, 'unmatched ' + plan.unmatched);
assert(plan.ambiguous === 1, 'ambiguous ' + plan.ambiguous);
assert(plan.alreadyClean === 2, 'already clean ' + plan.alreadyClean);
const ids = plan.updates.map((u) => u.job_id).sort().join(',');
assert(ids === 'a,b,e', 'update ids ' + ids);
assert(plan.updates.find((u) => u.job_id === 'a').hubspot_id === '', 'a ambiguous empty');
assert(plan.updates.find((u) => u.job_id === 'b').hubspot_id === '102', 'b attach');
assert(plan.updates.find((u) => u.job_id === 'e').hubspot_id === '', 'e unmatched empty');
const lines = planCleanPhonesLines(plan);
assert(lines[0] === '3 phones cleaned', lines[0]);
assert(lines[1] === '2 one-contact matches', lines[1]);
assert(lines[2] === '2 unmatched', lines[2]);
assert(lines[3] === '1 ambiguous', lines[3]);
assert(lines[4] === '2 already clean', lines[4]);
print('ok 7 plan counts skip crew and deleted');

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

const storeSrc = readSrc('store.js');
const applyAt = storeSrc.indexOf('function applyCleanPhones');
assert(applyAt !== -1, '8 applyCleanPhones missing');
const nextExport = storeSrc.indexOf('\nexport ', applyAt + 10);
const applyBody = storeSrc.slice(applyAt, nextExport === -1 ? storeSrc.length : nextExport);
assert(applyBody.indexOf('importJobs') === -1, '8 must not use importJobs');
assert(applyBody.indexOf('writeJob(') === -1, '8 skip writeJob auto diffs');
assert(applyBody.indexOf('upsertJob') !== -1, '8 writes through upsertJob');
assert(applyBody.indexOf('mobile: row.mobile') !== -1, '8 mobile from plan');
assert(applyBody.indexOf('phone_cc: row.phone_cc') !== -1, '8 cc from plan');
assert(applyBody.indexOf('phone_national: row.phone_national') !== -1, '8 national from plan');
assert(applyBody.indexOf('hubspot_id: row.hubspot_id') !== -1, '8 hubspot_id from plan');
assert(applyBody.indexOf('importContacts') === -1, '8 do not create contacts');
assert(applyBody.indexOf('cleanJobTime') === -1, '8 no time reclean');
assert(applyBody.indexOf('applySeptember') === -1, '8 no September reload');
assert(applyBody.indexOf('deals') === -1, '8 no HubSpot deals');
print('ok 8 apply writes four fields via upsertJob');

const appSrc = readSrc('app.js');
assert(appSrc.indexOf('planCleanPhonesBtn') !== -1, '9 Clean job phones bound');
assert(appSrc.indexOf('applyCleanPhonesBtn') !== -1, '9 Apply bound');
assert(appSrc.indexOf('markPhonesCleanedDone') !== -1, '9 hide after success');
assert(appSrc.indexOf('formatLiveJobPhones') === -1, '9 skip immediate formatLiveJobPhones');
assert(appSrc.indexOf('attachLiveJobContacts') === -1, '9 skip immediate attachLiveJobContacts');
print('ok 9 Settings plan then Apply, hide after');

print('ok clean-phones cases');
