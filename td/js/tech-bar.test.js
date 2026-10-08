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

const html = readSrc('index.html');
const css = readSrc('app.css');
const src = readSrc('app.js');

const barAt = html.indexOf('id="techRangeBar"');
assert(barAt !== -1, '1 techRangeBar');
const barEnd = html.indexOf('id="viewTitle"', barAt);
const bar = html.slice(barAt, barEnd);
assert(bar.indexOf('id="techTeamSelect"') !== -1, '1 techTeamSelect');
assert(bar.indexOf('id="rangeSelect"') !== -1, '1 rangeSelect');
assert(bar.indexOf('id="prevDay"') !== -1, '1 prevDay');
assert(bar.indexOf('id="nextDay"') !== -1, '1 nextDay');
assert(bar.indexOf('This week') !== -1, '1 This week');
assert(bar.indexOf('tech-bar-tech') === -1, '1 one row, no stacked tech wrap');
assert(bar.indexOf('new booking') === -1, '1 no booking button');
assert(bar.indexOf('draggable') === -1, '1 no drag');
assert(bar.indexOf('data-day-full') === -1, '1 no close button');
print('ok 1 one row under the header');

const innerAt = css.indexOf('.tech-bar-inner');
assert(innerAt !== -1, '2 tech-bar-inner');
const inner = css.slice(innerAt, css.indexOf('.tech-select'));
assert(inner.indexOf('flex-direction: row') !== -1, '2 row');
assert(inner.indexOf('flex-direction: column') === -1, '2 not stacked');
assert(css.indexOf('.tech-select') !== -1, '2 tech-select');
const techCss = css.slice(css.indexOf('.tech-select'), css.indexOf('.tech-select:focus'));
assert(techCss.indexOf('width: 100%') === -1, '2 tech select does not stretch');
assert(techCss.indexOf('flex: 0 0 auto') !== -1, '2 tech select hugs');
const rangeCss = css.slice(css.indexOf('.range-seg'), css.indexOf('.range-select:focus'));
assert(rangeCss.indexOf('width: 100%') === -1, '2 week control does not stretch');
assert(rangeCss.indexOf('flex: 0 0 auto') !== -1, '2 week control hugs');
assert(src.indexOf('function sizeSelectToName') !== -1, '2 sized to the name');
print('ok 2 technician sized to the name; week control in the same row');

const cardAt = src.indexOf('function jobCard');
assert(cardAt !== -1, '3 jobCard stays');
const cardBody = src.slice(cardAt, src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('compact-time') !== -1, '3 time');
assert(cardBody.indexOf('liveAcsBadges') !== -1, '3 units');
assert(cardBody.indexOf('compact-name') !== -1, '3 name');
assert(cardBody.indexOf('detailed-phone') !== -1, '3 phone');
assert(cardBody.indexOf('compact-addr') !== -1, '3 address');
assert(cardBody.indexOf('compact-notes') !== -1, '3 one note');
assert(cardBody.indexOf('compact-col-meta') === -1, '3 no stamp');
assert(html.indexOf('Performance') === -1, '3 Performance stays gone');
assert(html.indexOf('css/app.css?v=47') !== -1, '3 css cache');
assert(html.indexOf('js/app.js?v=46') !== -1, '3 js cache');
print('ok 3 jobCard unchanged; cache css/app.css?v=47 js/app.js?v=46; no Performance');

print('ok tech-bar cases');
