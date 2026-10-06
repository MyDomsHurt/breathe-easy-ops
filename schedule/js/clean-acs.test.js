import { CREW_SOURCE, isCrewNote } from '../../shared/team-day.js';
import { appendChange } from '../../shared/job.js';
import {
  appendNote,
  cleanJobAcs,
  hasAcsArrow,
  isUnitString,
  planCleanAcs,
  planCleanAcsLines,
} from './clean-acs.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const empty = cleanJobAcs({ job_id: 'e', acs: '', notes: '' });
assert(empty.acs === '', 'empty stays empty');
assert(empty.changed === false, 'empty not changed');
assert(empty.arrow === false, 'empty not arrow');
assert(cleanJobAcs({ acs: '   ' }).acs === '', 'whitespace empty');
print('ok 1 empty acs stays empty');

assert(isUnitString('2S 2W') === true, '2S 2W is a unit string');
assert(isUnitString('3S 3BEP') === true, '3S 3BEP is a unit string');
assert(isUnitString('3BEP') === false, 'BEP alone is not a unit');
assert(isUnitString('client cancelled') === false, 'sentence is not a unit string');
assert(isUnitString('2S then cancelled') === false, 'mixed sentence');
print('ok 2 unit string vs sentence');

const matthew = cleanJobAcs({
  job_id: '2026-01-07-matthew-10',
  acs: '3W 1S => 2S 2W',
  notes: '3W 1S => 2S 2W',
});
assert(matthew.acs === '2S 2W', 'matthew acs ' + matthew.acs);
assert(matthew.notes.indexOf('3W 1S => 2S 2W') !== -1, 'matthew notes keep old cell');
assert(matthew.arrow === true, 'matthew is arrow');
assert(matthew.from === '3W 1S => 2S 2W', 'matthew from old cell');
assert(matthew.to === '2S 2W', 'matthew to new string');
assert(matthew.changed === true, 'matthew changes');
print('ok 3 2026-01-07-matthew-10 last side is current count');

const gt = cleanJobAcs({ job_id: 'gt', acs: '3S > 2S', notes: '' });
assert(hasAcsArrow('3S > 2S'), 'has > arrow');
assert(gt.acs === '2S', 'gt last side ' + gt.acs);
assert(gt.notes.indexOf('3S > 2S') !== -1, 'gt notes get full cell');
assert(gt.arrow === true, 'gt is arrow');
print('ok 4 > last side is current count');

const bep = cleanJobAcs({ job_id: 'bep', acs: '3S 3BEP', notes: '' });
assert(bep.acs === '3S', 'bep acs ' + bep.acs);
assert(bep.notes.indexOf('3BEP') !== -1, 'bep notes gain 3BEP ' + bep.notes);
assert(bep.arrow === false, 'bep only is not an arrow');
assert(bep.changed === true, 'bep changes');
print('ok 5 3S 3BEP becomes acs 3S and notes gain 3BEP');

const both = cleanJobAcs({
  job_id: 'both',
  acs: '3S 3BEP => 2S 1BEP',
  notes: 'call first',
});
assert(both.acs === '2S', 'both acs ' + both.acs);
assert(both.notes.indexOf('3S 3BEP => 2S 1BEP') !== -1, 'both notes keep full cell');
assert(both.notes.indexOf('1BEP') !== -1, 'both notes gain BEP token');
assert(both.notes.indexOf('call first') !== -1, 'existing notes stay');
assert(both.arrow === true, 'both is arrow');
assert(both.to === '2S', 'both to after BEP strip');
print('ok 6 arrow and BEP on the same Apply');

const kept = cleanJobAcs({
  job_id: 'kept',
  acs: '2S 2W',
  notes: 'gate code 12',
});
assert(kept.changed === false, 'already clean');
assert(kept.acs === '2S 2W', 'keep unit string');
assert(kept.notes === 'gate code 12', 'notes untouched when already clean');
print('ok 7 already clean notes stay');

const sentence = cleanJobAcs({
  job_id: 'sent',
  acs: '3S => client cancelled the extra units',
  notes: '',
});
assert(sentence.listed === true, 'sentence listed');
assert(sentence.changed === false, 'sentence not written');
assert(sentence.acs === '3S => client cancelled the extra units', 'sentence acs unchanged');
assert(sentence.notes === '', 'sentence notes unchanged');
print('ok 8 sentence last side listed not written');

assert(appendNote('call', '3BEP') === 'call 3BEP', 'append joins');
assert(appendNote('3W 1S => 2S 2W', '3W 1S => 2S 2W') === '3W 1S => 2S 2W', 'do not drop existing cell');
print('ok 9 notes append keeps the old count');

const live = [
  { job_id: '2026-01-07-matthew-10', acs: '3W 1S => 2S 2W', notes: '3W 1S => 2S 2W' },
  { job_id: 'bep-only', acs: '3S 3BEP', notes: '' },
  { job_id: 'clean', acs: '1S', notes: '' },
  { job_id: 'empty', acs: '', notes: '' },
  { job_id: 'sent', acs: '2S => please only windows', notes: '' },
  { job_id: 'crew-1', acs: '3S => 1S', source: CREW_SOURCE, team_lead: 'Josh' },
  { job_id: 'gone', acs: '3S => 1S', deleted: true },
];
assert(isCrewNote(live[5]), 'fixture crew');
const plan = planCleanAcs(live);
assert(plan.wouldChange === 2, 'would change ' + plan.wouldChange);
assert(plan.arrowLogs === 1, 'arrow logs ' + plan.arrowLogs);
assert(plan.bepMoves === 1, 'bep moves ' + plan.bepMoves);
assert(plan.alreadyClean === 2, 'already clean ' + plan.alreadyClean);
assert(plan.listed.length === 1, 'listed ' + plan.listed.length);
assert(plan.listed[0].job_id === 'sent', 'listed sent');
assert(plan.updates.every((u) => u.job_id !== 'crew-1' && u.job_id !== 'gone'), 'skip crew and deleted');
const matthewRow = plan.updates.find((u) => u.job_id === '2026-01-07-matthew-10');
assert(matthewRow && matthewRow.acs === '2S 2W', 'plan matthew acs');
assert(matthewRow.notes.indexOf('3W 1S => 2S 2W') !== -1, 'plan matthew notes keep cell');
const bepRow = plan.updates.find((u) => u.job_id === 'bep-only');
assert(bepRow && bepRow.acs === '3S', 'plan bep acs');
assert(bepRow.notes.indexOf('3BEP') !== -1, 'plan bep notes');
const lines = planCleanAcsLines(plan);
assert(lines[0] === '2 jobs would change', lines[0]);
assert(lines[1] === '1 arrows become change-log rows', lines[1]);
assert(lines[2] === '1 BEP tokens move to notes', lines[2]);
assert(lines[3] === '2 already clean', lines[3]);
assert(lines[4] === '1 sentences listed not written', lines[4]);
print('ok 10 plan counts skip crew and deleted; plan shows the count');

const logged = appendChange([], {
  at: '2026-01-07T00:00:00.000Z',
  by: 'jefflamb1992@gmail.com',
  action: 'saved',
  diffs: [{ field: 'ACs', from: '3W 1S => 2S 2W', to: '2S 2W' }],
});
assert(logged.length === 1, 'appendChange row');
assert(logged[0].action === 'saved', 'action saved');
assert(logged[0].diffs[0].field === 'ACs', 'field ACs');
assert(logged[0].diffs[0].from === '3W 1S => 2S 2W' && logged[0].diffs[0].to === '2S 2W', 'from old cell to new');
print('ok 11 appendChange saved ACs from→to');

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
const applyAt = storeSrc.indexOf('function applyCleanAcs');
assert(applyAt !== -1, '12 applyCleanAcs missing');
const nextExport = storeSrc.indexOf('\nexport ', applyAt + 10);
const applyBody = storeSrc.slice(applyAt, nextExport === -1 ? storeSrc.length : nextExport);
assert(applyBody.indexOf('importJobs') === -1, '12 acs must not use importJobs');
assert(applyBody.indexOf('upsertJob') !== -1, '12 acs go through upsertJob');
assert(applyBody.indexOf('appendChange') !== -1, '12 arrows use appendChange');
assert(applyBody.indexOf("field: 'ACs'") !== -1, '12 field ACs');
assert(applyBody.indexOf('writeJob(') === -1, '12 skip writeJob auto diffs');
print('ok 12 apply uses upsert + appendChange field ACs, not importJobs');

const appSrc = readSrc('app.js');
assert(appSrc.indexOf('planCleanAcs') !== -1, '13 app plans acs');
assert(appSrc.indexOf('applyCleanAcs') !== -1, '13 app applies acs');
assert(appSrc.indexOf('listJobsForTimeClean') !== -1, '13 live jobs');
assert(appSrc.indexOf('september-glance') === -1, '13 no master file');
print('ok 13 Settings plan-then-Apply reads live jobs');

print('ok clean-acs cases');
