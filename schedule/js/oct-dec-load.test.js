import { CREW_SOURCE, crewNoteId, isCrewNote } from '../../shared/team-day.js';
import {
  OCT_DEC_REFUSE,
  OCT_FROM,
  OCT_TO,
  flagKind,
  glanceDatesInOctDec,
  planOctDecLines,
  planOctDecLoad,
  validateOctDecGlance,
} from './oct-dec-load.js';
import { loadGlance } from '../../scripts/september-glance.js';

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

const glanceJob = {
  jobId: '2026-10-06-matthew-yim-kai-hung-1030',
  date: '2026-10-06',
  time: '10.30am',
  team: 'Matthew',
  whosOn: 'Matthew + Seth',
  client: 'Yim Kai Hung',
  mobile: '+85294222692',
  acs: '2W',
  district: 'HKN',
};

const glanceCrew = {
  jobId: 'crew-2026-10-06-josh',
  date: '2026-10-06',
  team: 'Josh',
  whosOn: 'Josh',
  source: 'team-day-crew',
};

const janJob = {
  jobId: '2027-01-02-matthew-week5',
  date: '2027-01-02',
  team: 'Matthew',
  client: 'Week five',
  acs: '1S',
};

assert(OCT_FROM === '2026-10-01' && OCT_TO === '2027-01-03', 'range bounds');
assert(glanceDatesInOctDec({ jobs: [glanceJob], crew_notes: [glanceCrew] }), 'oct dates ok');
assert(glanceDatesInOctDec({ jobs: [janJob] }), 'keep 1–3 Jan 2027');
assert(!glanceDatesInOctDec({
  jobs: [glanceJob, { ...glanceJob, jobId: 'sep', date: '2026-09-30', client: 'Sep' }],
}), 'refuse September');
assert(!glanceDatesInOctDec({
  jobs: [{ ...janJob, jobId: 'jan4', date: '2027-01-04' }],
}), 'refuse 4 Jan 2027');
assert(!glanceDatesInOctDec({ jobs: [] }), 'empty file refused');
print('ok 1 refuse dates outside 2026-10-01 to 2027-01-03; keep 1–3 Jan');

const ok = validateOctDecGlance({ jobs: [glanceJob, janJob], crew_notes: [glanceCrew] });
assert(ok.ok === true, 'valid oct-dec file');
assert(ok.jobs.length === 2, '2 bookings');
assert(ok.jobs.some((j) => j.date === '2027-01-02'), 'Jan 2 kept as a booking');
assert(ok.crew.length === 1, '1 crew');
print('ok 2 validate keeps Oct and Jan 1–3');

assert(flagKind({ client: 'PH' }) === 'holiday', 'exact PH');
assert(flagKind({ client: 'ph' }) === 'holiday', 'ph case');
assert(flagKind({ client: 'PCPH Medical Practice' }) === '', 'PCPH is not PH');
assert(flagKind({ client: 'Philippa Wong' }) === '', 'Philippa is not PH');
assert(flagKind({ client: 'Team Meeting (4pm back to office)' }) === 'meeting', 'team meeting client');
assert(flagKind({ client: 'Team buildinig??' }) === '', 'team building is not a flag');
print('ok 3 PH and team meeting flags; PCPH and team building stay bookings');

const flagged = validateOctDecGlance({
  jobs: [
    glanceJob,
    {
      jobId: '2026-10-01-josh-ph-na',
      date: '2026-10-01',
      team: 'Josh',
      client: 'PH',
      time: '',
      acs: '',
    },
    {
      jobId: '2026-10-08-matthew-2207',
      date: '2026-10-08',
      team: 'Matthew',
      client: 'Team Meeting (4pm back to office)',
      time: 'Team Meeting (4pm back to office)',
      acs: 'Team Meeting (4pm back to office)',
      whosOn: 'Matty + Seth',
    },
    glanceCrew,
  ],
});
assert(flagged.ok === true, 'flagged file ok');
assert(flagged.jobs.length === 1 && flagged.jobs[0].job_id === glanceJob.jobId, 'PH and meeting are not bookings');
assert(flagged.jobs.every((j) => !isCrewNote(j)), 'jobs are bookings');
const holiday = flagged.crew.find((c) => c.day_mark === 'holiday');
const meeting = flagged.crew.find((c) => c.day_mark === 'meeting');
assert(holiday && holiday.job_id === crewNoteId('2026-10-01', 'Josh'), 'PH is a holiday crew flag');
assert(holiday.day_mark_name === 'Public holiday' && holiday.day_mark_all_day === true, 'PH all-day name');
assert(meeting && meeting.job_id === crewNoteId('2026-10-08', 'Matthew'), 'meeting is a crew flag');
assert(meeting.day_mark_all_day === true, 'meeting all-day');
assert(flagged.crew.some((c) => c.job_id === glanceCrew.jobId), 'file crew stays');
print('ok 4 PH and team meeting become flagged rows');

const mappedDefault = loadGlance({
  jobs: [glanceJob, { jobId: 'sep-1', date: '2026-09-01', team: 'Josh', client: 'Sep', acs: '1S' }],
});
assert(mappedDefault.jobs.length === 1 && mappedDefault.jobs[0].job_id === 'sep-1', 'loadGlance without bounds still drops October');
const mappedOct = loadGlance(
  { jobs: [glanceJob, janJob, { jobId: 'jan4', date: '2027-01-04', team: 'Josh', client: 'Out', acs: '1S' }] },
  { from: OCT_FROM, to: OCT_TO },
);
assert(mappedOct.jobs.length === 2, 'loadGlance oct bounds keep Oct and Jan 2');
assert(!mappedOct.jobs.some((j) => j.date === '2027-01-04'), 'Jan 4 dropped by mapper');
print('ok 5 loadGlance mapper range');

const live = [
  { job_id: 'old-oct', date: '2026-10-05', client_name: 'A' },
  { job_id: glanceJob.jobId, date: '2026-10-06', client_name: 'Yim' },
  { job_id: 'crew-2026-10-05-josh', date: '2026-10-05', source: CREW_SOURCE },
  { job_id: 'sep', date: '2026-09-30', client_name: 'Sep' },
  { job_id: 'already', date: '2026-10-05', client_name: 'X', deleted: true },
  { job_id: 'dec-live', date: '2026-12-20', client_name: 'Dec' },
];
const plan = planOctDecLoad(live, ok.jobs, ok.crew);
assert(plan.jobUpserts === 2, 'plan job upserts');
assert(plan.crewUpserts === 1, 'plan crew upserts');
assert(plan.softDeletes.indexOf('old-oct') !== -1, 'plan deletes live Oct missing from file');
assert(plan.softDeletes.indexOf('dec-live') !== -1, 'plan deletes live Dec missing from file');
assert(plan.softDeletes.indexOf('sep') === -1, 'Jan–Sep stay off the delete list');
assert(plan.softDeletes.indexOf('crew-2026-10-05-josh') === -1, 'crew notes are not deleted');
const lines = planOctDecLines(plan);
assert(lines[0] === '2 job upserts', lines[0]);
assert(lines[1] === '1 crew upserts', lines[1]);
assert(lines[2] === plan.softDeletes.length + ' live jobs in that range would be soft-deleted', lines[2]);
print('ok 6 plan three counts; Jan–Sep stay');

const storeSrc = readSrc('store.js');
const applyAt = storeSrc.indexOf('function applyOctDecLoad');
assert(applyAt !== -1, '7 applyOctDecLoad missing');
const nextExport = storeSrc.indexOf('\nexport ', applyAt + 10);
const applyBody = storeSrc.slice(applyAt, nextExport === -1 ? storeSrc.length : nextExport);
assert(applyBody.indexOf("requireJeff('load Oct–Dec')") !== -1, '7 Jeff-only');
assert(applyBody.indexOf("ops.importJobs(jobList)") !== -1, '7 jobs go through importJobs');
assert(applyBody.indexOf('ops.importJobs(crew') === -1, '7 crew must not go through importJobs');
assert(applyBody.indexOf('crewList') !== -1 && applyBody.indexOf('upsertJob') !== -1, '7 crew merge via upsertJob');
assert(applyBody.indexOf("jobDate(prev) < '2026-10-01'") !== -1, '7 skip live jobs before Oct');
assert(applyBody.indexOf("jobDate(j) >= '2026-10-01'") !== -1, '7 skip file jobs before Oct');
assert(applyBody.indexOf('day_mark') !== -1, '7 crew merge keeps day_mark');
assert(!/api\.hubapi|hubspot\.com|createDeal|writeDeal/.test(applyBody), '7 no HubSpot write');
print('ok 7 apply writes deletes, job upserts, crew merge; no HubSpot; no pre-Oct');

const appSrc = readSrc('app.js');
assert(appSrc.indexOf('function paintOctDecLoad') !== -1, '8 paint');
assert(appSrc.indexOf('function bindOctDecLoad') !== -1, '8 bind');
assert(appSrc.indexOf('octDecPending') !== -1, '8 pending plan');
assert(appSrc.indexOf('listJobsForTimeClean()') !== -1, '8 plan reads full live jobs');
const bindAt = appSrc.indexOf('function bindOctDecLoad');
const bindBody = appSrc.slice(bindAt, appSrc.indexOf('function bindCheckSeptember'));
assert(bindBody.indexOf('validateOctDecGlance') !== -1, '8 plan validates');
assert(bindBody.indexOf('planOctDecLoad') !== -1, '8 plan computes counts');
assert(bindBody.indexOf('applyOctDecLoad') !== -1, '8 Apply is a second click');
assert(bindBody.indexOf('octDecPending = {') !== -1, '8 plan stores pending and stops');
assert(bindBody.indexOf('markSeptemberLoadDone') === -1, '8 does not hide after Apply');
assert(appSrc.indexOf("from './oct-dec-load.js?v=1'") !== -1, '8 oct-dec-load cache');
assert(appSrc.indexOf("from './store.js?v=14'") !== -1, '8 store cache');
print('ok 8 Settings plan then Apply');

const html = readSrc('../index.html');
assert(html.indexOf('id="octDecLoadBlock"') !== -1, '9 settings block');
assert(html.indexOf('id="loadOctDecBtn"') !== -1, '9 Load Oct–Dec file');
assert(html.indexOf('id="applyOctDecBtn"') !== -1, '9 Apply');
assert(html.indexOf('id="octDecGlanceFile"') !== -1, '9 file picker');
assert(html.indexOf('js/app.js?v=98') !== -1, '9 app cache');
assert(html.indexOf('css/app.css?v=65') !== -1, '9 css cache');
print('ok 9 Settings markup and cache');

print('ok oct-dec-load cases');
