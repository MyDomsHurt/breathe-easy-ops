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
    'schedule/css/' + name,
    'schedule/js/' + name,
    'css/' + name,
    '../css/' + name,
    '../' + name,
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

const css = readSrc('app.css');
const html = readSrc('../index.html');
const booking = readSrc('booking.js');
const appSrc = readSrc('app.js');

const gridAt = css.indexOf('.grid-3 {');
assert(gridAt !== -1, '1 .grid-3');
const gridBody = css.slice(gridAt, css.indexOf('.typeahead {'));
assert(gridBody.indexOf('auto-fit') !== -1, '1 grid-3 wraps');
assert(gridBody.indexOf('minmax') !== -1, '1 grid-3 shrinks');
assert(gridBody.indexOf('min-width: 0') !== -1, '1 grid-3 min-width 0');
assert(css.indexOf('.grid-3 > .field { margin-bottom: 0; min-width: 0; }') !== -1
  || css.indexOf('grid-3 > .field') !== -1 && css.indexOf('min-width: 0') !== -1, '1 fields shrink');
print('ok 1 Type Payment Amount and Invoice rows wrap or shrink');

const bodyAt = css.indexOf('.drawer-body {');
assert(bodyAt !== -1, '2 drawer-body');
const bodyCss = css.slice(bodyAt, css.indexOf('.form-block {'));
assert(bodyCss.indexOf('overflow-x: hidden') !== -1, '2 no sideways scroll');
assert(bodyCss.indexOf('overflow-y: auto') !== -1, '2 body still scrolls down');
assert(css.indexOf('.drawer .field textarea') !== -1, '2 notes stay in the drawer');
print('ok 2 drawer does not scroll sideways; notes are not clipped');

const footAt = css.indexOf('.drawer-foot {');
assert(footAt !== -1, '3 drawer-foot');
const footCss = css.slice(footAt, css.indexOf('.modal {'));
assert(footCss.indexOf('flex-wrap: wrap') !== -1, '3 foot wraps');
assert(footCss.indexOf('.foot-actions') !== -1 && footCss.indexOf('flex-wrap: wrap') !== -1, '3 actions wrap');
assert(css.indexOf('.tent-btn') !== -1, '3 Tentative stays');
assert(booking.indexOf('id="saveTentative"') !== -1, '3 Tentative button');
assert(booking.indexOf('id="saveBooking"') !== -1, '3 Save button');
assert(booking.indexOf('class="grid-3"') !== -1, '3 Type Payment Amount row');
assert(booking.indexOf('creditNoteInput') !== -1, '3 Credit note');
print('ok 3 Tentative and Save stay inside the drawer');

assert(css.indexOf('width: 520px') !== -1, '4 contact card width stays');
assert(css.indexOf('right: calc(min(540px, 100%) + 300px)') !== -1, '4 card sits left of the log');
assert(css.indexOf('.log-rail {') !== -1, '4 log rail stays');
assert(css.indexOf('width: 300px') !== -1, '4 log width stays');
print('ok 4 three panels unchanged');

assert(html.indexOf('css/app.css?v=67') !== -1, '5 css cache');
assert(html.indexOf('js/app.js?v=102') !== -1, '5 app cache');
assert(appSrc.indexOf("from './booking.js?v=54'") !== -1, '5 booking cache');
print('ok 5 cache app.css?v=67 app.js?v=102');

print('ok drawer-fit cases');
