import { glanceCrewToCanonical, glanceJobToCanonical, loadGlance, softDeleteIds } from './september-glance.js';
import { CREW_SOURCE, isCrewNote } from '../shared/team-day.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const glance = {
  jobId: '2026-09-01-matthew-yim-kai-hung-1030',
  date: '2026-09-01',
  time: '10.30am',
  team: 'Matthew',
  whosOn: 'Matthew + Seth',
  client: 'Yim Kai Hung',
  mobile: '+85294222692',
  country: '852',
  national: '94222692',
  address: '5/F, 22 Ventris Road, Happy Valley (HKN)',
  line1: '',
  street: '',
  place: 'HKN',
  extra: '',
  acs: '2W',
  return: '',
  amount: 1200,
  invoice: 'Inv 6984',
  notes1: 'see chat',
  notes2: '',
  district: 'HKN',
  source: 'September-2026-live.xlsx:Week 1',
  S: 0,
  units: 2,
};

const job = glanceJobToCanonical(glance);
assert(job.job_id === glance.jobId, 'jobId → job_id');
assert(job.team_lead === 'Matthew', 'team → team_lead');
assert(job.client_name === 'Yim Kai Hung', 'client → client_name');
assert(job.team_members === 'Matthew + Seth', 'whosOn → team_members');
assert(job.acs === '2W', 'acs copied as written');
assert(job.job_id && !('jobId' in job), 'fresh object has no jobId');
assert(!('team' in job) || job.team === undefined, 'no glance team key');
assert(!('client' in job), 'no glance client key');
assert(!('whosOn' in job), 'no glance whosOn key');
assert(job.district === 'HKN', 'district');
assert(job.address_place == null, 'territory place is not address_place');
assert(job.phone_cc === '852', 'country → phone_cc');
assert(job.deleted === false, 'not deleted');
assert(job.units == null || typeof job.units !== 'number', 'do not store glance units count');
print('ok 1 glance job maps onto a fresh canonical record');

const ret = glanceJobToCanonical({
  jobId: '2026-09-01-matthew-mrs-yuen-0900',
  date: '2026-09-01',
  team: 'Matthew',
  client: 'Mrs. Yuen',
  acs: '',
  return: 'Y',
});
assert(ret.job_type === 'return', 'return Y → job_type return');
assert(ret.is_return === true, 'is_return');
assert(ret.acs === '' || ret.acs == null, 'empty acs on return');
print('ok 2 return flag');

const note = glanceCrewToCanonical({
  jobId: 'crew-2026-09-01-josh',
  date: '2026-09-01',
  team: 'Josh',
  whosOn: 'Josh',
  source: 'team-day-crew',
});
assert(note.source === CREW_SOURCE, 'crew source');
assert(isCrewNote(note), 'isCrewNote');
assert(note.team_lead === 'Josh', 'crew team');
assert(note.team_members === 'Josh', 'crew whosOn');
print('ok 3 crew note mapping');

const loaded = loadGlance({
  jobs: [
    glance,
    { jobId: 'oct-1', date: '2026-10-01', team: 'Josh', client: 'Oct', acs: '1S' },
    { jobId: 'crew-2026-09-03-alun', date: '2026-09-03', team: 'Alun', whosOn: 'Alun', source: 'team-day-crew' },
  ],
  crew_notes: [
    { jobId: 'crew-2026-09-01-josh', date: '2026-09-01', team: 'Josh', whosOn: 'Josh', source: 'team-day-crew' },
  ],
});
assert(loaded.jobs.length === 1, 'drop October and crew from job upserts');
assert(loaded.crew.length === 2, 'crew from both arrays');
assert(loaded.jobs.every((j) => !isCrewNote(j)), 'jobs are not crew notes');
print('ok 4 loadGlance splits jobs/crew and drops October');

const dels = softDeleteIds([
  { job_id: 'old-sep', date: '2026-09-05', client_name: 'A' },
  { job_id: glance.jobId, date: '2026-09-01' },
  { job_id: 'crew-2026-09-05-josh', date: '2026-09-05', source: CREW_SOURCE },
  { job_id: 'aug', date: '2026-08-31' },
  { job_id: 'already', date: '2026-09-05', deleted: true },
], [glance.jobId]);
assert(dels.length === 1 && dels[0] === 'old-sep', 'soft-delete only live Sep real jobs missing from the file, got ' + JSON.stringify(dels));
print('ok 5 soft-delete ids');

if (typeof readFile === 'function') {
  let raw = null;
  const paths = [
    '/Users/jefflamb/Downloads/breathe-easy-jobs-2026-september.json',
    'breathe-easy-jobs-2026-september.json',
  ];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s) { raw = JSON.parse(String(s)); break; }
    } catch (e) {}
  }
  if (raw) {
    const full = loadGlance(raw);
    assert(full.jobs.length === 397, '397 job upserts, got ' + full.jobs.length);
    assert(full.crew.length === 180, '180 crew upserts, got ' + full.crew.length);
    assert(full.jobs.every((j) => j.date >= '2026-09-01' && j.date <= '2026-09-30'), 'job dates in September');
    assert(full.crew.every((c) => c.source === CREW_SOURCE), 'crew source');
    print('ok 6 approved file: 397 job upserts, 180 crew upserts');
  } else {
    print('ok 6 approved file not in place — skipped');
  }
}

print('ok september-glance cases');
