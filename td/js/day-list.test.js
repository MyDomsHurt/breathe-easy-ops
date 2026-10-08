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
    'td/' + name,
    'td/js/' + name,
    '../' + name,
    '../td/' + name,
    '../css/' + name,
    'td/css/' + name,
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
const css = readSrc('app.css');
const html = readSrc('index.html');

assert(src.indexOf("textContent = 'Jobs by Date'") === -1, '1 Jobs by Date gone');
assert(src.indexOf('Jobs by Date') === -1, '1 no Jobs by Date string');
assert(css.indexOf('#viewTitle') !== -1, '1 viewTitle hidden');
print('ok 1 Jobs by Date removed');

const lunchAt = src.indexOf('function cardsWithLunch');
const lunchBody = src.slice(lunchAt, src.indexOf('function dayLunchHtml'));
assert(lunchBody.indexOf('lunchesOnDate') !== -1, '2 lunches in the list');
assert(lunchBody.indexOf('lunchRowHtml') !== -1, '2 lunch row');
assert(lunchBody.indexOf('mins <= mins') !== -1 || lunchBody.indexOf('.mins <=') !== -1, '2 lunch at its time');
const byDateBody = src.slice(src.indexOf('function renderByDate'), src.indexOf('function renderByTeam'));
assert(byDateBody.indexOf('dayLunchHtml') === -1, '2 not in the header');
assert(byDateBody.indexOf('cardsWithLunch') !== -1, '2 cardsWithLunch paints the list');
print('ok 2 lunch sits in the day list at its time');

const strip = css.slice(css.indexOf('#jobsContainer.jobs-week-strip {'), css.indexOf('#jobsContainer.jobs-week-strip.space-y-6'));
assert(strip.indexOf('align-items: flex-start') !== -1, '3 hug cards');
assert(strip.indexOf('align-items: stretch') === -1, '3 not stretch to tallest');
assert(strip.indexOf('overflow-x: auto') !== -1, '3 week scrolls sideways');
assert(strip.indexOf('height: auto') !== -1, '3 strip height auto');
const col = css.slice(css.indexOf('#jobsContainer.jobs-week-strip > .day-section {'), css.indexOf('#jobsContainer.jobs-week-strip > .day-section .day-header-sticky'));
assert(col.indexOf('height: auto') !== -1, '3 column height of its cards');
assert(col.indexOf('height: 100%') === -1, '3 column is not the tallest day');
print('ok 3 day column is the height of its cards; week scrolls sideways');

eval(
  'var DAY_HEAD_WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];\n' +
  'var DAY_HEAD_MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];\n' +
  fnBody(src, 'formatDayHeading') + '\n' +
  'globalThis.__mon = formatDayHeading("2026-10-12");\n' +
  'globalThis.__fri = formatDayHeading("2026-10-16");\n'
);
assert(globalThis.__mon === 'Mon, 12 Oct', '4 Monday heading is Mon, 12 Oct got ' + globalThis.__mon);
assert(globalThis.__fri === 'Fri, 16 Oct', '4 Friday heading is Fri, 16 Oct got ' + globalThis.__fri);
assert(src.indexOf("'Oct'") !== -1, '4 Oct is not clipped to O');
assert(css.indexOf('.day-heading-date') !== -1, '4 heading date does not wrap');
print('ok 4 Friday heading is Fri, 16 Oct');

const headCss = css.slice(css.indexOf('.day-header-sticky {'), css.indexOf('.day-section > .grid'));
assert(headCss.indexOf('position: sticky') === -1, '5 heading is not painted over the card');
assert(headCss.indexOf('z-index: 2') === -1, '5 heading is not stacked on the card');
assert(byDateBody.indexOf('day-header-sticky') < byDateBody.indexOf('cardsWithLunch'), '5 heading first, then cards');
const cardBody = src.slice(src.indexOf('function jobCard'), src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('compact-time') !== -1, '5 jobCard fields stay');
assert(cardBody.indexOf('liveAcsBadges') !== -1, '5 units');
assert(cardBody.indexOf('compact-name') !== -1, '5 name');
assert(cardBody.indexOf('day-heading-date') === -1, '5 date is not inside jobCard');
assert(cardBody.indexOf('day-whos-on') === -1, '5 team line is not inside jobCard');
assert(src.indexOf('function vanRequestText') !== -1, '5 vanRequestText stays');
assert(html.indexOf('js/auth.js?v=4') !== -1, '5 auth cache stays');
assert(html.indexOf('css/app.css?v=49') !== -1, '5 css cache');
assert(html.indexOf('js/app.js?v=48') !== -1, '5 js cache');
print('ok 5 heading sits above the card, not inside it; cache v=49/v=48');

print('ok day-list cases');
