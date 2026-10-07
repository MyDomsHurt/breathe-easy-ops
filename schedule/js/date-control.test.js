import { addDays, mondayOf } from './utils.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name, 'schedule/' + name, 'schedule/css/' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

const src = readSrc('app.js');
const html = readSrc('../index.html');
const css = readSrc('../css/app.css');

assert(html.indexOf('id="dateControl"') !== -1, '1 date control in header');
assert(html.indexOf('class="date-control" id="dateControl"') !== -1, '1 date control is a button slot');
assert(html.indexOf('class="cal-block"') === -1, '1 always-open block left the header');
assert(html.indexOf('id="weekLabel"') === -1, '1 old week label gone');
assert(html.indexOf('id="datePanel"') === -1, '1 date panel gone');
assert(html.indexOf('id="monthSelect"') === -1, '1 second calendar gone');
assert(html.indexOf('data-mode') === -1, '1 Week/Day toggle gone');
assert(html.indexOf('id="prevWeek"') === -1, '1 prev week gone');
assert(html.indexOf('id="nextWeek"') === -1, '1 next week gone');
print('ok 1 date control is a header button; Week/Day and second calendar gone');

const leftAt = html.indexOf('class="header-left"');
const calAt = html.indexOf('id="dateControl"');
const rightAt = html.indexOf('class="header-right"');
const newAt = html.indexOf('id="newBooking"');
const authAt = html.indexOf('class="auth-slot"');
assert(leftAt !== -1 && calAt > leftAt && rightAt > calAt, '2 date control is in the middle');
assert(newAt > rightAt && authAt > newAt, '2 New booking and account are far right');
assert(html.indexOf('id="sundayToggle"') !== -1, '2 Sunday toggle exists');
const boardPrefs = html.indexOf('id="boardPrefsBlock"');
const sundayAt = html.indexOf('id="sundayToggle"');
const sepAt = html.indexOf('id="septemberLoadBlock"');
assert(boardPrefs !== -1 && sundayAt > boardPrefs && sundayAt < sepAt, '2 Sunday is a board preference before Jeff-only cleanup');
assert(html.slice(boardPrefs, sepAt).indexOf('Board') !== -1, '2 Board heading');
print('ok 2 New booking far right; Sunday in Settings Board');

assert(css.indexOf('.date-btn') !== -1, '3 date button');
assert(css.indexOf('.cal-popup') !== -1, '3 popup');
assert(css.indexOf('.cal-popup {\n  position: absolute') !== -1, '3 popup opens under the date control');
assert(css.indexOf('top: calc(100% + 4px)') !== -1, '3 popup opens down');
assert(css.indexOf('.cal-dow-row') !== -1, '3 weekday letters have their own row');
assert(css.indexOf('.cal-block') === -1, '3 always-open block gone from CSS');
assert(css.indexOf('align-items: center') !== -1, '3 header is one line');
assert(css.indexOf('calc(2ch + 4px)') !== -1, '3 day cell is two digits');
assert(css.indexOf('repeat(var(--days, 6), 272px)') !== -1, '3 day columns stay 272');
assert(css.indexOf('.cal-year-list') !== -1, '3 year list');
assert(css.indexOf('.cal-month-list') !== -1, '3 month list');
assert(css.indexOf('.week-nav') === -1, '3 old week-nav gone');
assert(css.indexOf('.date-panel') === -1, '3 old date-panel gone');
print('ok 3 popup under the date button; weekday row; header one line');

assert(src.indexOf('function dateControlHtml') !== -1, '4 no dateControlHtml');
assert(src.indexOf('function paintDateControl') !== -1, '4 no paintDateControl');
assert(src.indexOf('function pickCalDay') !== -1, '4 no pickCalDay');
assert(src.indexOf("CAL_MONTHS") !== -1, '4 month names');
assert(src.indexOf("'October'") !== -1, '4 October label');
assert(src.indexOf('calYear: Number(TODAY.slice(0, 4))') !== -1, '4 year from today');
assert(src.indexOf('calMonth: Number(TODAY.slice(5, 7))') !== -1, '4 month from today');
assert(src.indexOf('calOpen: false') !== -1, '4 popup starts closed');
assert(src.indexOf('id="dateBtn"') !== -1, '4 date button');
assert(src.indexOf('if (!open) return btn') !== -1, '4 month grid is not in the header');
const paintAt = src.indexOf('function paint()');
const paintBody = src.slice(paintAt, src.indexOf('function stripJobLink'));
assert(paintBody.indexOf('paintDateControl()') !== -1, '4 paint paints the date control');
assert(paintBody.indexOf("$('boardMount')") !== -1, '4 paint guards on the board');
print('ok 4 date button; grid only in the popup');

function calendarDays(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  return Array.from({ length: 42 }, (_, i) => addDays(mondayOf(first), i));
}
const oct = calendarDays(2026, 10);
assert(oct[0] === '2026-09-28', '5 October 2026 grid starts Mon 28 Sep');
assert(oct.indexOf('2026-10-08') !== -1, '5 8 Oct is on the October grid');
assert(mondayOf('2026-10-08') === '2026-10-05', '5 8 Oct week starts 5 Oct');
const htmlFn = src.slice(src.indexOf('function dateControlHtml'), src.indexOf('function paintDateControl'));
assert(htmlFn.indexOf('id="dateBtn"') !== -1, '5 date button');
assert(htmlFn.indexOf('id="calPopup"') !== -1, '5 one popup');
assert(htmlFn.indexOf('cal-dow-row') !== -1, '5 weekday row');
assert(htmlFn.indexOf('data-cal-day="${iso}"') !== -1, '5 day buttons');
assert(htmlFn.indexOf('id="calToday"') !== -1, '5 Today stays in the popup');
assert(htmlFn.indexOf('id="calYearBtn"') !== -1, '5 year is in the popup');
assert(htmlFn.indexOf('id="calMonthBtn"') !== -1, '5 month is in the popup');
assert(htmlFn.indexOf('<div class="cal-grid">${dow}') === -1, '5 weekdays are not on the dates');
print('ok 5 clicking the date shows the October grid in one popup');

const pickAt = src.indexOf('function pickCalDay');
const pickBody = src.slice(pickAt, src.indexOf('function goCalToday'));
assert(pickBody.indexOf('state.monday = mondayOf(day)') !== -1, '6 day click moves the board week');
assert(pickBody.indexOf("state.mode = 'week'") !== -1, '6 stays in week mode');
assert(pickBody.indexOf('paint()') !== -1, '6 day click paints');
assert(pickBody.indexOf('state.calOpen = false') !== -1, '6 day click closes the popup');
const bindAt = src.indexOf('function bindDateControl');
const bindBody = src.slice(bindAt, src.indexOf('function visibleDates'));
assert(bindBody.indexOf('#dateBtn') !== -1, '6 date button opens the popup');
assert(bindBody.indexOf('[data-cal-day]') !== -1, '6 day buttons are bound');
assert(bindBody.indexOf('pickCalDay') !== -1, '6 click calls pickCalDay');
print('ok 6 clicking 8 Oct moves the week and closes the popup');

assert(html.indexOf('js/app.js?v=98') !== -1, '7 index app cache');
assert(html.indexOf('css/app.css?v=65') !== -1, '7 index css cache');
assert(src.indexOf("from './booking.js?v=52'") !== -1, '7 booking cache stays');
print('ok 7 cache app.js?v=98 app.css?v=65 booking.js?v=52');

print('ok date-control cases');
