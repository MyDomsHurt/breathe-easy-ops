import { CREW_SOURCE, isCrewNote } from '../../shared/team-day.js';
import { formatTime24 } from './utils.js';
import {
  liveSeptemberJobs,
  mismatchLine,
  planCheckSeptember,
  planCheckSeptemberLines,
} from './september-check.js';
import { REFUSE_MSG, validateSeptemberGlance } from './september-load.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const nawelFile = {
  job_id: '2026-09-22-matthew-nawel-berardo-0900',
  date: '2026-09-22',
  time: '09.00am',
  team_lead: 'Matthew',
  client_name: 'Nawel BERARDO',
};

const aligned = {
  job_id: '2026-09-01-matthew-yim-kai-hung-1030',
  date: '2026-09-01',
  time: '10.30am',
  team_lead: 'Matthew',
  client_name: 'Yim Kai Hung',
};

print('ok 0 helpers ' + formatTime24('09.00am'));

const liveNawel = {
  ...nawelFile,
  date: '2026-09-25',
  time: '09:00',
  mobile: '+85290137006',
};
const liveAligned = {
  ...aligned,
  time: '10:30',
};
const live = [
  liveNawel,
  liveAligned,
  { job_id: 'crew-2026-09-22-matthew', date: '2026-09-22', source: CREW_SOURCE, team_lead: 'Matthew' },
  { job_id: 'gone-sep', date: '2026-09-10', client_name: 'Gone', deleted: true, team_lead: 'Matthew', time: '09:00' },
  { job_id: 'oct-job', date: '2026-10-02', client_name: 'October', team_lead: 'Matthew', time: '09:00' },
  { job_id: 'aug-job', date: '2026-08-31', client_name: 'August', team_lead: 'Matthew', time: '09:00' },
];

assert(isCrewNote(live[2]), 'fixture crew');
const sepOnly = liveSeptemberJobs(live);
assert(sepOnly.length === 2, 'live sep skips crew deleted oct aug ' + sepOnly.length);
assert(sepOnly.every((j) => j.job_id === nawelFile.job_id || j.job_id === aligned.job_id), 'live ids');
print('ok 1 live September jobs skip crew deleted other months');

const plan = planCheckSeptember([nawelFile, aligned], live);
assert(plan.missingCount === 0, 'missing ' + plan.missingCount);
assert(plan.extraCount === 0, 'extra ' + plan.extraCount);
assert(plan.mismatchCount === 1, 'mismatches ' + plan.mismatchCount);
assert(plan.mismatches[0].job_id === nawelFile.job_id, 'nawel id');
assert(plan.mismatches[0].fileDate === '2026-09-22', 'file date');
assert(plan.mismatches[0].boardDate === '2026-09-25', 'board date');
assert(plan.mismatches[0].time === '09.00am', 'file time is source ' + plan.mismatches[0].time);
assert(plan.mismatches[0].client_name === 'Nawel BERARDO', 'file client');
assert(plan.mismatches[0].team_lead === 'Matthew', 'file team');
assert(plan.mismatches[0].base.mobile === '+85290137006', 'keep live row for phones');
const lines = planCheckSeptemberLines(plan);
assert(lines[0] === '0 in the file, missing on the board', lines[0]);
assert(lines[1] === '0 on the board, not in the file', lines[1]);
assert(lines[2] === '1 same job, wrong date or team', lines[2]);
assert(lines[3] === 'Nawel BERARDO file 22 Sep / board 25 Sep', lines[3]);
assert(lines.length === 4, 'counts plus mismatch names only ' + lines.length);
print('ok 2 Nawel file 22 Sep / board 25 Sep');

const teamMove = planCheckSeptember([nawelFile], [{
  ...nawelFile,
  team_lead: 'Tiago',
  time: '09:00',
}]);
assert(teamMove.mismatchCount === 1, 'team mismatch');
assert(
  mismatchLine(teamMove.mismatches[0]) === 'Nawel BERARDO file 22 Sep Matthew / board 22 Sep Tiago',
  mismatchLine(teamMove.mismatches[0]),
);
print('ok 3 team mismatch names the two teams');

const missingPlan = planCheckSeptember([nawelFile, aligned], [liveAligned]);
assert(missingPlan.missingCount === 1, 'missing count');
assert(missingPlan.extraCount === 0, 'missing extra');
assert(missingPlan.mismatchCount === 0, 'missing is not a mismatch');
assert(planCheckSeptemberLines(missingPlan).length === 3, 'missing is count only');
print('ok 4 missing on the board is a count');

const extraPlan = planCheckSeptember([aligned], [liveAligned, liveNawel]);
assert(extraPlan.extraCount === 1, 'extra count');
assert(extraPlan.missingCount === 0, 'extra missing');
assert(extraPlan.mismatchCount === 0, 'extra is not a mismatch');
assert(planCheckSeptemberLines(extraPlan)[1] === '1 on the board, not in the file', 'extra line');
print('ok 5 extra on the board is a count');

const minted = {
  job_id: '2026-09-25-matthew-nawel-berardo-0900',
  date: '2026-09-25',
  time: '09:00',
  team_lead: 'Matthew',
  client_name: 'Nawel BERARDO',
};
const mintedPlan = planCheckSeptember([nawelFile], [minted]);
assert(mintedPlan.mismatchCount === 0, 'new id is not a job_id match');
assert(mintedPlan.missingCount === 1, 'file 22 missing');
assert(mintedPlan.extraCount === 1, 'board 25 extra');
print('ok 6 new id is missing+extra, not a mismatch');

const slotFile = {
  job_id: 'file-slot',
  date: '2026-09-10',
  time: '09.00am',
  team_lead: 'Matthew',
  client_name: 'Hoo Wai Yee',
};
const slotBoard = {
  job_id: 'board-slot',
  date: '2026-09-10',
  time: '09:00',
  team_lead: 'matthew',
  client_name: 'hoo wai yee',
};
const slotPlan = planCheckSeptember([slotFile], [slotBoard]);
assert(slotPlan.missingCount === 0 && slotPlan.extraCount === 0 && slotPlan.mismatchCount === 0, 'slot match');
print('ok 7 team+date+client+start clock aligns 09.00am with 09:00');

const otherMonth = planCheckSeptember([nawelFile], [{
  ...nawelFile,
  date: '2026-10-02',
}]);
assert(otherMonth.missingCount === 1, 'oct live is not compared');
assert(otherMonth.mismatchCount === 0, 'do not treat oct as a mismatch');
print('ok 8 October live jobs are out of the compare');

const refused = validateSeptemberGlance({ jobs: [nawelFile], crew_notes: [] });
assert(refused.ok === false && refused.error === REFUSE_MSG, 'same refuse as Load');
print('ok 9 same JSON refuse as Load September');

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
const applyAt = storeSrc.indexOf('function applySeptemberFixes');
assert(applyAt !== -1, '10 applySeptemberFixes missing');
const nextExport = storeSrc.indexOf('\nexport ', applyAt + 10);
const applyBody = storeSrc.slice(applyAt, nextExport === -1 ? storeSrc.length : nextExport);
assert(applyBody.indexOf('importJobs') === -1, '10 must not use importJobs');
assert(applyBody.indexOf('writeJob(') === -1, '10 skip writeJob auto diffs');
assert(applyBody.indexOf('upsertJob') !== -1, '10 writes through upsertJob');
assert(applyBody.indexOf('mobile') === -1, '10 do not reload phones');
assert(applyBody.indexOf('cleanJobTime') === -1, '10 do not reclean times');
assert(applyBody.indexOf('beginPhoneHold') === -1, '10 no phone hold');
assert(applyBody.indexOf('inSeptember') !== -1, '10 Sep-only write guard');
assert(applyBody.indexOf('team_lead: row.team_lead') !== -1, '10 team from file');
assert(applyBody.indexOf('time: row.time') !== -1, '10 time from file');
assert(applyBody.indexOf('client_name: row.client_name') !== -1, '10 client from file');
assert(applyBody.indexOf('date: row.date') !== -1, '10 date from file');
print('ok 10 apply writes file date/team/time/client via upsertJob');

const appSrc = readSrc('app.js');
assert(appSrc.indexOf('checkSeptemberBtn') !== -1, '11 Check September file bound');
assert(appSrc.indexOf('fixSeptemberBtn') !== -1, '11 Fix September bound');
assert(appSrc.indexOf('checkSeptemberFile') !== -1, '11 own file input');
assert(appSrc.indexOf('markSeptemberLoadDone') !== -1, '11 Load hide stays');
assert(appSrc.indexOf('checkSeptember') !== -1 && appSrc.indexOf('markCheckSeptember') === -1, '11 Check does not hide');
print('ok 11 Settings Check then Fix, no hide');

print('ok september-check cases');
