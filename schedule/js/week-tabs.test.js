import { mondayOf } from './utils.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = [
    name,
    'schedule/js/' + name,
    'js/' + name,
    '../' + name,
    '../js/' + name,
    'schedule/' + name.replace(/^\.\.\//, ''),
  ];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

function fnBody(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) fail('missing ' + name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail('unclosed ' + name);
}

const src = readSrc('app.js');
const html = readSrc('../index.html');
const css = readSrc('../css/app.css');
const booking = readSrc('booking.js');

const header = html.slice(html.indexOf('class="app-header"'), html.indexOf('</header>'));
assert(header.indexOf('id="weekTabBar"') !== -1, '1 tab bar under the header');
assert(header.indexOf('id="weekTabBar"') > header.indexOf('header-inner'), '1 tab bar is under the header row');
assert(src.indexOf('function addWeekTab') !== -1, '1 plus adds a tab');
assert(src.indexOf('function selectWeekTab') !== -1, '1 click shows that week');
assert(src.indexOf('function closeWeekTab') !== -1, '1 close a tab');
print('ok 1 tab bar under the header; a tab is a week');

const pickAt = src.indexOf('function pickCalDay');
const pickBody = src.slice(pickAt, src.indexOf('function goCalToday'));
assert(pickBody.indexOf('state.monday = mondayOf(day)') !== -1, '2 date click moves the week');
assert(pickBody.indexOf('syncCurrentWeekTab') !== -1, '2 date click moves the current tab');
assert(pickBody.indexOf('addWeekTab') === -1, '2 date click does not open a tab');
const closeBody = fnBody(src, 'closeWeekTab');
assert(closeBody.indexOf('removeJob') === -1, '2 close does not delete jobs');
assert(closeBody.indexOf('importJobs') === -1, '2 close does not write jobs');
assert(src.indexOf('createStore') === -1, '2 one job store');
assert(booking.indexOf('id="saveBooking"') !== -1, '2 drawer Save stays');
print('ok 2 date click moves the current tab; close leaves the jobs');

const thisWeek = mondayOf('2026-10-13');
assert(thisWeek === '2026-10-12', '3 this week monday');
assert(mondayOf('2026-08-17') === '2026-08-17', '3 17 Aug is a Monday');
const jobs = [{ job_id: 'keep-me', date: '2026-08-17' }];
let removed = 0;
const state = {
  monday: thisWeek,
  weekTabs: [{ id: 1, monday: thisWeek }],
  weekTabId: 1,
  weekTabSeq: 1,
  mode: 'week',
  day: thisWeek,
  calMenu: 'x',
  calOpen: true,
};
function paint() {}
function isSunday() { return false; }
function removeJob() { removed += 1; }

eval(
  fnBody(src, 'weekTabLabel') + '\n' +
  fnBody(src, 'syncCurrentWeekTab') + '\n' +
  fnBody(src, 'addWeekTab') + '\n' +
  fnBody(src, 'selectWeekTab') + '\n' +
  fnBody(src, 'closeWeekTab') + '\n' +
  fnBody(src, 'pickCalDay') + '\n' +
  'globalThis.__addWeekTab = addWeekTab;\n' +
  'globalThis.__selectWeekTab = selectWeekTab;\n' +
  'globalThis.__closeWeekTab = closeWeekTab;\n' +
  'globalThis.__pickCalDay = pickCalDay;\n' +
  'globalThis.__weekTabLabel = weekTabLabel;\n'
);

globalThis.__addWeekTab();
assert(state.weekTabs.length === 2, '3 plus adds the current week');
assert(state.weekTabs[0].monday === thisWeek, '3 first tab stays this week');
assert(state.weekTabs[1].monday === thisWeek, '3 plus copies the current week');
globalThis.__pickCalDay('2026-08-17');
assert(state.weekTabs.length === 2, '3 date click does not open a tab');
assert(state.weekTabs[0].monday === thisWeek, '3 first tab is this week');
assert(state.weekTabs[1].monday === '2026-08-17', '3 current tab is 17 Aug');
assert(globalThis.__weekTabLabel('2026-08-17') === '17 Aug', '3 17 Aug label');
assert(state.monday === '2026-08-17', '3 board shows 17 Aug');
globalThis.__selectWeekTab(1);
assert(state.monday === thisWeek, '3 clicking this week shows that week');
globalThis.__selectWeekTab(2);
assert(state.monday === '2026-08-17', '3 clicking 17 Aug shows that week');
globalThis.__closeWeekTab(2);
assert(state.weekTabs.length === 1, '3 closing one leaves a tab');
assert(removed === 0, '3 closing does not delete jobs');
assert(jobs[0].job_id === 'keep-me', '3 jobs stay');
print('ok 3 two tabs 17 Aug and this week; close leaves the jobs');

assert(css.indexOf('.week-tab-bar') !== -1, '4 tab bar css');
assert(css.indexOf('.week-tab-add') !== -1, '4 plus css');
assert(html.indexOf('js/app.js?v=101') !== -1, '4 app cache');
assert(html.indexOf('css/app.css?v=67') !== -1, '4 css cache');
assert(src.indexOf("from './booking.js?v=53'") !== -1, '4 booking cache stays');
print('ok 4 cache app.js?v=101 app.css?v=67');

print('ok week-tabs cases');
