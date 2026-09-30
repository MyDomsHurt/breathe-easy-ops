import { CREW_SOURCE, isCrewNote } from '../../shared/team-day.js';
import { appendChange } from '../../shared/job.js';
import { formatTime24 } from './utils.js';
import {
  cleanJobTime,
  hasTimeArrow,
  planCleanTimes,
  planCleanTimesLines,
} from './clean-times.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const empty = cleanJobTime('');
assert(empty.time === '', 'empty stays empty');
assert(empty.changed === false, 'empty not changed');
assert(empty.arrow === false, 'empty not arrow');
assert(cleanJobTime('   ').time === '', 'whitespace empty');
print('ok 1 empty stays empty');

const arrow = cleanJobTime('04.30pm => 04.00pm');
assert(arrow.time === '16:00', 'arrow last clock ' + arrow.time);
assert(arrow.arrow === true, 'arrow flagged');
assert(arrow.from === '16:30', 'arrow from old ' + arrow.from);
assert(arrow.to === '16:00', 'arrow to new');
assert(arrow.changed === true, 'arrow changes the stored string');
assert(arrow.time === formatTime24('04.30pm => 04.00pm'), 'same HH:MM the board shows');
print('ok 2 arrow last clock is current, previous is old');

const moved = cleanJobTime('11.30am => 10.30am');
assert(moved.time === '10:30', 'moved last ' + moved.time);
assert(moved.from === '11:30', 'moved from ' + moved.from);
assert(moved.arrow === true, 'moved is arrow');
print('ok 3 earlier reschedule');

const unicode = cleanJobTime('09.00am → 10.00am');
assert(unicode.time === '10:00' && unicode.arrow && unicode.from === '09:00', 'unicode arrow');
assert(hasTimeArrow('1pm -> 2pm'), 'ascii ->');
print('ok 4 change arrows');

const window = cleanJobTime('10.30-10.45');
assert(window.time === '10:30', 'window start ' + window.time);
assert(window.arrow === false, 'window is not an arrow');
assert(window.from == null, 'window does not invent an end in the log');
assert(window.time === formatTime24('10.30-10.45'), 'window matches board');
print('ok 5 window keeps start clock only');

const windowPm = cleanJobTime('05.00-5.30pm');
assert(windowPm.time === formatTime24('05.00-5.30pm'), 'window pm matches board ' + windowPm.time);
assert(windowPm.arrow === false, 'hyphen window is not an arrow');
print('ok 6 hyphen window');

const one = cleanJobTime('09.00am');
assert(one.time === '09:00', 'normalise am ' + one.time);
assert(one.arrow === false, 'single clock is not an arrow');
assert(cleanJobTime('02.30pm').time === '14:30', 'normalise pm');
assert(cleanJobTime('9am').time === '09:00', '9am');
print('ok 7 normalise one clock');

const clean = cleanJobTime('09:00');
assert(clean.time === '09:00' && clean.changed === false, 'already HH:MM');
assert(cleanJobTime('14:30').changed === false, 'already 14:30');
print('ok 8 already clean');

const unparsed = cleanJobTime('TBC');
assert(unparsed.changed === false && unparsed.time === 'TBC', 'leave unparsed');
print('ok 9 unparsed left alone');

const live = [
  { job_id: 'a', time: '04.30pm => 04.00pm', client_name: 'A' },
  { job_id: 'b', time: '10.30-10.45', client_name: 'B' },
  { job_id: 'c', time: '09:00', client_name: 'C' },
  { job_id: 'd', time: '', client_name: 'D' },
  { job_id: 'e', time: '09.00am', client_name: 'E' },
  { job_id: 'crew-1', time: '09.00am', source: CREW_SOURCE, team_lead: 'Josh' },
  { job_id: 'gone', time: '1pm => 2pm', deleted: true, client_name: 'Z' },
];
assert(isCrewNote(live[5]), 'fixture crew');
const plan = planCleanTimes(live);
assert(plan.wouldChange === 3, 'would change ' + plan.wouldChange);
assert(plan.arrowLogs === 1, 'arrow logs ' + plan.arrowLogs);
assert(plan.alreadyClean === 2, 'already clean ' + plan.alreadyClean);
assert(plan.updates.every((u) => u.job_id !== 'crew-1' && u.job_id !== 'gone'), 'skip crew and deleted');
const ids = plan.updates.map((u) => u.job_id).sort().join(',');
assert(ids === 'a,b,e', 'update ids ' + ids);
assert(plan.updates.find((u) => u.job_id === 'a').time === '16:00', 'a time');
assert(plan.updates.find((u) => u.job_id === 'a').arrow === true, 'a arrow');
assert(plan.updates.find((u) => u.job_id === 'b').time === '10:30', 'b window');
assert(plan.updates.find((u) => u.job_id === 'b').arrow === false, 'b no log');
const lines = planCleanTimesLines(plan);
assert(lines[0] === '3 jobs would change', lines[0]);
assert(lines[1] === '1 arrows become change-log rows', lines[1]);
assert(lines[2] === '2 already clean', lines[2]);
print('ok 10 plan counts skip crew and deleted');

const logged = appendChange([], {
  at: '2026-09-30T00:00:00.000Z',
  by: 'jefflamb1992@gmail.com',
  action: 'saved',
  diffs: [{ field: 'Time', from: '16:30', to: '16:00' }],
});
assert(logged.length === 1, 'appendChange row');
assert(logged[0].action === 'saved', 'action saved');
assert(logged[0].diffs[0].field === 'Time', 'field Time');
assert(logged[0].diffs[0].from === '16:30' && logged[0].diffs[0].to === '16:00', 'from old to new');
print('ok 11 appendChange saved Time from→to');

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
const applyAt = storeSrc.indexOf('function applyCleanTimes');
assert(applyAt !== -1, '12 applyCleanTimes missing');
const applyBody = storeSrc.slice(applyAt, storeSrc.indexOf('\nexport ', applyAt + 10) === -1
  ? storeSrc.length
  : storeSrc.indexOf('\nexport ', applyAt + 10));
assert(applyBody.indexOf('importJobs') === -1, '12 times must not use importJobs');
assert(applyBody.indexOf('upsertJob') !== -1, '12 times go through upsertJob');
assert(applyBody.indexOf('appendChange') !== -1, '12 arrows use appendChange');
assert(applyBody.indexOf('writeJob(') === -1, '12 skip writeJob auto diffs');
print('ok 12 apply uses upsert + appendChange, not importJobs');

print('ok clean-times cases');
