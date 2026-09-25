import { renderWeekBoard, rosterCellHtml } from './board.js';
import { CREW_SOURCE, crewNoteId } from './team-day.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const date = '2026-09-22';
const team = 'Josh';

function job(id, extra) {
  return {
    job_id: id,
    date,
    team_lead: team,
    client_name: id,
    source: 'test',
    ...(extra || {}),
  };
}

function crew(over) {
  return {
    job_id: crewNoteId(date, team),
    date,
    team_lead: team,
    source: CREW_SOURCE,
    client_name: '',
    day_full: false,
    ...(over || {}),
  };
}

// 1. Week Open cell HTML has no empty-slot and no empty-slot-slim.
const openHtml = rosterCellHtml([], [], date, team, 'week', [], date);
assert(openHtml.indexOf('Open') !== -1, '1 Open');
assert(openHtml.indexOf('empty-slot') === -1, '1 empty-slot');
assert(openHtml.indexOf('empty-slot-slim') === -1, '1 empty-slot-slim');
assert(openHtml.indexOf('cell-add') !== -1, '1 missing +');
print('ok 1 week Open has no empty-slot');

// 2. Week has-jobs (not Full) HTML has no leftover empty-slot rows.
const two = [job('a'), job('b')];
const hasHtml = rosterCellHtml(two, two, date, team, 'week', two, date);
assert(hasHtml.indexOf('has-jobs') !== -1, '2 has-jobs');
assert(hasHtml.indexOf('empty-slot') === -1, '2 leftover empty-slot');
print('ok 2 week has-jobs has no empty-slot rows');

// 3. Week Full cell has no empty-slot.
const fullJobs = [job('a'), crew({ day_full: true })];
const fullHtml = rosterCellHtml(fullJobs, fullJobs, date, team, 'week', fullJobs, date);
assert(fullHtml.indexOf('is-full') !== -1, '3 is-full');
assert(fullHtml.indexOf('empty-slot') === -1, '3 full empty-slot');
print('ok 3 week Full has no empty-slot');

// 4. Day view still has empty-slot buttons.
const dayHtml = rosterCellHtml([], [], date, team, 'day', [], date);
assert(dayHtml.indexOf('empty-slot') !== -1, '4 day missing empty-slot');
assert(dayHtml.indexOf('data-empty-slot') !== -1, '4 day missing data-empty-slot');
print('ok 4 day view has empty-slot buttons');

// 5. Today’s day-col-head and today’s week cells have a today class.
const el = { innerHTML: '' };
renderWeekBoard(el, {
  jobs: [],
  days: ['2026-09-21', '2026-09-22', '2026-09-23'],
  teams: ['Josh'],
  today: '2026-09-22',
});
const html = el.innerHTML;
assert(html.indexOf('day-col-head today') !== -1 || html.indexOf('day-col-head  today') !== -1, '5 head today class');
assert(html.indexOf('data-open-day="2026-09-22"') !== -1, '5 today head missing');
assert(/day-col-head[^>]*today/.test(html) || html.indexOf('class="day-col-head today') !== -1, '5 head class');
assert(html.indexOf('week-cell today') !== -1 || html.indexOf('week-cell  today') !== -1 || /week-cell[^"]*today/.test(html), '5 week cell today');
assert(html.indexOf('data-date="2026-09-21"') !== -1, '5 other day missing');
const i21 = html.indexOf('data-date="2026-09-21"');
const cell21 = html.slice(html.lastIndexOf('<div class="roster-cell', i21), i21);
assert(cell21.indexOf('today') === -1, '5 other cell has today: ' + cell21.slice(0, 80));
print('ok 5 today class on head and today cells');

// 6. Week with no lunch has a header Lunch control; no lunch-card.
assert(openHtml.indexOf('data-edit-lunch') !== -1, '6 missing lunch add');
assert(openHtml.indexOf('>Lunch<') !== -1, '6 Lunch label');
assert(openHtml.indexOf('lunch-card') === -1, '6 lunch-card without lunch');
print('ok 6 week no-lunch has header Lunch');

// 7. Week with lunch keeps the yellow card and has no second header Lunch.
const withLunch = [job('a'), crew({ lunch: '13:00' })];
const lunchHtml = rosterCellHtml(withLunch, withLunch, date, team, 'week', withLunch, date);
assert(lunchHtml.indexOf('lunch-card') !== -1, '7 missing lunch-card');
assert(lunchHtml.indexOf('cell-lunch is-empty') === -1, '7 second header Lunch');
print('ok 7 week with lunch has card only');

print('ok quiet-week cases');
