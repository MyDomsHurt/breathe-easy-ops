import { CREW_SOURCE, isCrewNote } from '../../shared/team-day.js';
import {
  EXPECT_CREW,
  EXPECT_JOBS,
  REFUSE_MSG,
  glanceDatesOnlySeptember,
  planSeptemberLines,
  planSeptemberLoad,
  validateSeptemberGlance,
} from './september-load.js';
import { loadGlance, softDeleteIds } from '../../scripts/september-glance.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const glanceJob = {
  jobId: '2026-09-01-matthew-yim-kai-hung-1030',
  date: '2026-09-01',
  time: '10.30am',
  team: 'Matthew',
  whosOn: 'Matthew + Seth',
  client: 'Yim Kai Hung',
  mobile: '+85294222692',
  acs: '2W',
  district: 'HKN',
  source: 'September-2026-live.xlsx:Week 1',
};

const glanceCrew = {
  jobId: 'crew-2026-09-01-josh',
  date: '2026-09-01',
  team: 'Josh',
  whosOn: 'Josh',
  source: 'team-day-crew',
};

assert(EXPECT_JOBS === 397, 'expect 397 jobs');
assert(EXPECT_CREW === 180, 'expect 180 crew');
print('ok 1 expected counts');

assert(glanceDatesOnlySeptember({ jobs: [glanceJob], crew_notes: [glanceCrew] }), 'sep dates ok');
assert(!glanceDatesOnlySeptember({
  jobs: [glanceJob, { ...glanceJob, jobId: 'oct', date: '2026-10-01', client: 'Oct' }],
  crew_notes: [glanceCrew],
}), 'refuse October in jobs');
assert(!glanceDatesOnlySeptember({
  jobs: [glanceJob],
  crew_notes: [{ ...glanceCrew, date: '2026-08-31' }],
}), 'refuse August crew');
print('ok 2 dates 1–30 Sep only');

const refused = validateSeptemberGlance({ jobs: [glanceJob], crew_notes: [glanceCrew] });
assert(refused.ok === false, 'small file refused');
assert(refused.error === REFUSE_MSG, 'refuse message');
print('ok 3 refuse unless 397/180');

const live = [
  { job_id: 'old-sep', date: '2026-09-05', client_name: 'A' },
  { job_id: glanceJob.jobId, date: '2026-09-01', client_name: 'Yim' },
  { job_id: 'crew-2026-09-05-josh', date: '2026-09-05', source: CREW_SOURCE },
  { job_id: 'aug', date: '2026-08-31', client_name: 'Aug' },
  { job_id: 'already', date: '2026-09-05', client_name: 'X', deleted: true },
];
const jobs = [{ job_id: glanceJob.jobId, date: '2026-09-01', client_name: 'Yim' }];
const crew = [{ job_id: glanceCrew.jobId, date: '2026-09-01', source: CREW_SOURCE }];
const plan = planSeptemberLoad(live, jobs, crew);
assert(plan.jobUpserts === 1, 'plan job upserts');
assert(plan.crewUpserts === 1, 'plan crew upserts');
assert(plan.softDeletes.length === 1 && plan.softDeletes[0] === 'old-sep', 'plan N');
assert(softDeleteIds(live, jobs.map((j) => j.job_id)).join() === plan.softDeletes.join(), 'reuse softDeleteIds');
const lines = planSeptemberLines(plan);
assert(lines[0] === '1 job upserts', lines[0]);
assert(lines[1] === '1 crew upserts', lines[1]);
assert(lines[2] === '1 live September jobs would be soft-deleted', lines[2]);
print('ok 4 plan lines and N');

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
const applyAt = storeSrc.indexOf('function applySeptemberLoad');
assert(applyAt !== -1, '5 applySeptemberLoad missing');
const applyBody = storeSrc.slice(applyAt, storeSrc.indexOf('\nexport ', applyAt + 10) === -1
  ? storeSrc.length
  : storeSrc.indexOf('\nexport ', applyAt + 10));
assert(applyBody.indexOf('ops.importJobs(jobList)') !== -1, '5 jobs go through importJobs');
assert(applyBody.indexOf('ops.importJobs(crew') === -1, '5 crew must not go through importJobs');
assert(applyBody.indexOf('crewList') !== -1 && applyBody.indexOf('upsertJob') !== -1, '5 crew merge via upsertJob');
print('ok 5 crew notes stay off importJobs');

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
    const ok = validateSeptemberGlance(raw);
    assert(ok.ok === true, '6 approved file refused: ' + (ok.error || ''));
    assert(ok.jobs.length === 397, '6 jobs ' + ok.jobs.length);
    assert(ok.crew.length === 180, '6 crew ' + ok.crew.length);
    assert(ok.jobs.every((j) => !isCrewNote(j)), '6 jobs are bookings');
    const mapped = loadGlance(raw);
    assert(mapped.jobs.length === 397 && mapped.crew.length === 180, '6 mapper still 397/180');
    print('ok 6 approved file validates 397/180 Sep-only');
  } else {
    print('ok 6 approved file not in place — skipped');
  }
}

print('ok september-load cases');
