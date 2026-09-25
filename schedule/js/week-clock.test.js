import { rosterCellHtml, weekClockJobs } from './board.js';
import { pointerJobUp } from './board-drag.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const date = '2026-09-22';
const team = 'Josh';

function job(id, time, acs) {
  return {
    job_id: id,
    date,
    team_lead: team,
    client_name: id,
    time,
    acs: acs || '',
    source: 'test',
  };
}

function countClass(html, cls) {
  const re = new RegExp('class="' + cls + '"', 'g');
  return (html.match(re) || []).length;
}

function cssVars(html, name) {
  const re = new RegExp('--' + name + ':(\\d+)px', 'g');
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

function jobMinOf(html, id) {
  const i = html.indexOf('data-job="' + id + '"');
  assert(i !== -1, 'missing job ' + id);
  const slice = html.slice(i, i + 220);
  const m = slice.match(/--job-min:(\d+)px/);
  assert(m, 'missing --job-min for ' + id + ' in ' + slice.slice(0, 120));
  return Number(m[1]);
}

// 1. 09:00 and 16:00 with no ACS (45 min work) still have one hole.
const latePair = [job('am', '09:00'), job('pm', '16:00')];
const html1 = rosterCellHtml(latePair, latePair, date, team, 'week', latePair, date);
assert(countClass(html1, 'week-hole') === 1, '1 hole count ' + countClass(html1, 'week-hole'));
assert(html1.indexOf('data-job="am"') < html1.indexOf('class="week-hole"'), '1 hole after 09:00');
assert(html1.indexOf('class="week-hole"') < html1.indexOf('data-job="pm"'), '1 hole before 16:00');
assert(html1.indexOf('empty-slot') === -1, '1 empty-slot rows');
print('ok 1 09:00 and 16:00 have one hole');

// 2. 09:00 and 10:00 with no ACS still have no hole (leftover 15).
const packed = [job('nine', '09:00'), job('ten', '10:00')];
const html2 = rosterCellHtml(packed, packed, date, team, 'week', packed, date);
assert(countClass(html2, 'week-hole') === 0, '2 unexpected hole');
assert(html2.indexOf('data-job="nine"') < html2.indexOf('data-job="ten"'), '2 order');
print('ok 2 09:00 and 10:00 have no hole');

// 3. Open day, no jobs → one open area, zero empty-slot rows.
const html3 = rosterCellHtml([], [], date, team, 'week', [], date);
assert(html3.indexOf('Open') !== -1, '3 Open header');
assert(countClass(html3, 'week-open-area') === 1, '3 open area count');
assert(html3.indexOf('empty-slot') === -1, '3 empty-slot rows');
print('ok 3 empty Open day is one open area');

// 4. 16:00 listed before 09:00 in the data → 09:00 still draws above 16:00.
const reversed = [job('late', '16:00'), job('early', '09:00')];
const ordered = weekClockJobs(reversed);
assert(ordered[0].job_id === 'early' && ordered[1].job_id === 'late', '4 sort');
const html4 = rosterCellHtml(reversed, reversed, date, team, 'week', reversed, date);
assert(html4.indexOf('data-job="early"') < html4.indexOf('data-job="late"'), '4 draw order');
print('ok 4 clock order 09:00 above 16:00');

// 5. Pointer-up on a cell with a captured job → placeJobInSlot, not openBooking.
const placed = [];
const opened = [];
const r5 = pointerJobUp({
  moved: true,
  capturedId: 'job-abc',
  overDate: '2026-09-23',
  overTeam: 'Matthew',
  slot: 1,
  placeJobInSlot(id, d, t, slot) { placed.push({ id, d, t, slot }); },
  openBooking(payload) { opened.push(payload); },
  getJob(id) { return { job_id: id }; },
});
assert(r5 === 'move', '5 kind ' + r5);
assert(placed.length === 1 && placed[0].id === 'job-abc', '5 placeJobInSlot');
assert(opened.length === 0, '5 openBooking');
print('ok 5 pointer-up moves captured job');

// 6. 09:00 3S and 11:00 → no hole (135 work).
const split3 = [job('s3', '09:00', '3S'), job('eleven', '11:00')];
const html6 = rosterCellHtml(split3, split3, date, team, 'week', split3, date);
assert(countClass(html6, 'week-hole') === 0, '6 unexpected hole');
print('ok 6 09:00 3S and 11:00 have no hole');

// 7. 09:00 2C and 11:00 → no hole (105 work, 15 leftover).
const cass2 = [job('c2', '09:00', '2C'), job('eleven2', '11:00')];
const html7 = rosterCellHtml(cass2, cass2, date, team, 'week', cass2, date);
assert(countClass(html7, 'week-hole') === 0, '7 unexpected hole');
print('ok 7 09:00 2C and 11:00 have no hole');

// 8. 09:00 2W and 12:00 → one hole (90 work, 90 leftover).
const win2 = [job('w2', '09:00', '2W'), job('noon', '12:00')];
const html8 = rosterCellHtml(win2, win2, date, team, 'week', win2, date);
assert(countClass(html8, 'week-hole') === 1, '8 hole count ' + countClass(html8, 'week-hole'));
assert(html8.indexOf('data-job="w2"') < html8.indexOf('class="week-hole"'), '8 hole after 2W');
assert(html8.indexOf('class="week-hole"') < html8.indexOf('data-job="noon"'), '8 hole before 12:00');
print('ok 8 09:00 2W and 12:00 have one hole');

// 9. 09:00 11B next to 16:30 follows leftover (495 work overruns 16:30 → no hole).
const fat = [job('b11', '09:00', '11B'), job('late2', '16:30')];
const html9 = rosterCellHtml(fat, fat, date, team, 'week', fat, date);
assert(countClass(html9, 'week-hole') === 0, '9 unexpected hole');
assert(jobMinOf(html9, 'b11') === 168, '9 fat card cap ' + jobMinOf(html9, 'b11'));
print('ok 9 09:00 11B and 16:30 have no hole');

assert(jobMinOf(html8, 'w2') < jobMinOf(html7, 'c2'), '2W shorter than 2C');

const allWeek = [html1, html2, html4, html6, html7, html8, html9].join('');
cssVars(allWeek, 'job-min').forEach((n) => {
  assert(n <= 168, '--job-min ' + n);
});
cssVars(allWeek, 'hole-min').forEach((n) => {
  assert(n <= 120, '--hole-min ' + n);
});
print('ok caps --job-min 168 --hole-min 120');

print('ok week-clock cases');
