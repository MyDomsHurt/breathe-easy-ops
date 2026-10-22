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

const src = readSrc('app.js');
const css = readSrc('app.css');
const html = readSrc('index.html');

const cardAt = src.indexOf('function jobCard');
assert(cardAt !== -1, '1 jobCard');
const cardBody = src.slice(cardAt, src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('compact-time') !== -1, '1 time');
assert(cardBody.indexOf('liveAcsBadges') !== -1, '1 unit chips');
assert(cardBody.indexOf('compactTypeBadge') !== -1, '1 type badge');
assert(cardBody.indexOf('unitsBit') < cardBody.indexOf('typeBit'), '1 type badge sits with the unit chips');
assert(cardBody.indexOf('compact-name') !== -1, '1 name');
assert(cardBody.indexOf('detailed-phone') !== -1, '1 phone');
assert(cardBody.indexOf('compact-addr') !== -1, '1 address');
assert(cardBody.indexOf('compact-notes') !== -1, '1 note line');
assert(cardBody.indexOf('detailed-notes2') === -1, '1 one note line');
assert(cardBody.indexOf('compact-col-meta') === -1, '1 no stamp column');
assert(cardBody.indexOf('compact-pay') === -1, '1 no pay stamp');
assert(cardBody.indexOf('Unpaid') === -1, '1 no Unpaid');
assert(cardBody.indexOf('Service') === -1, '1 no Service');
assert(cardBody.indexOf('border-left:4px solid') !== -1, '1 coloured left edge');
assert(cardBody.indexOf('job-card-detailed') !== -1, '1 white detailed card');
assert(cardBody.indexOf('day-heading-date') === -1, '1 no date in jobCard');
assert(cardBody.indexOf('day-whos-on') === -1, '1 no team line in jobCard');
assert(cardBody.indexOf('formatDayHeading') === -1, '1 date stays out of jobCard');
print('ok 1 jobCard is time, units, name, phone, address, one note');

const lunchAt = src.indexOf('function cardsWithLunch');
const lunchBody = src.slice(lunchAt, src.indexOf('function dayLunchHtml'));
assert(lunchBody.indexOf('lunchRowHtml') !== -1, '2 lunch is a row in the list');
assert(lunchBody.indexOf('jobCard') !== -1, '2 cardsWithLunch paints jobs');
const byDateAt = src.indexOf('function renderByDate');
const byDateBody = src.slice(byDateAt, src.indexOf('function renderByTeam'));
assert(byDateBody.indexOf('dayLunchHtml') === -1, '2 lunch is not in the day header');
assert(byDateBody.indexOf('cardsWithLunch') !== -1, '2 lunch via cardsWithLunch');
assert(byDateBody.indexOf('day-header-sticky') !== -1, '2 day header');
assert(byDateBody.indexOf('new booking') === -1, '2 no new booking');
assert(byDateBody.indexOf('draggable') === -1, '2 no drag');
assert(byDateBody.indexOf('close button') === -1 && byDateBody.indexOf('data-day-full') === -1, '2 no close button');
print('ok 2 lunch is a row in that day list at its time');

const whenAt = src.indexOf('function dayWhenBadge');
const whenBody = src.slice(whenAt, src.indexOf('function sortJobs'));
assert(whenBody.indexOf('Today') !== -1, '3 Today mark');
assert(whenBody.indexOf('Tomorrow') === -1, '3 Tomorrow is not a badge');
assert(byDateBody.indexOf('dayWhenBadge') !== -1, '3 today uses dayWhenBadge');
assert(byDateBody.indexOf('is-closed') !== -1, '3 closed class');
assert(byDateBody.indexOf('is-open') !== -1, '3 open class');
assert(css.indexOf('.day-section.is-open') !== -1, '3 open white');
assert(css.indexOf('background: #fff') !== -1, '3 white panel');
assert(css.indexOf('.day-section.is-closed') !== -1, '3 closed grey');
assert(css.indexOf('#e8eef3') !== -1, '3 closed grey fill');
assert(css.indexOf('#86efac') === -1, '3 today is not a green box');
assert(css.indexOf('day-flag-tomorrow') === -1, '3 no tomorrow badge style');
assert(css.indexOf('-webkit-line-clamp: 1') !== -1, '3 one note line');
print('ok 3 open white, closed grey, today marked, not a green box');

assert(html.indexOf('css/app.css?v=56') !== -1, '4 css cache');
assert(html.indexOf('js/app.js?v=70') !== -1, '4 js cache');
assert(html.indexOf('Performance') === -1, '4 Performance stays gone');
assert(html.indexOf('id="be-app-switch"') !== -1, '4 Live Schedule header');
print('ok 4 cache css/app.css?v=56 js/app.js?v=70; no Performance');

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

eval(
  fnBody(src, 'esc') + '\n' +
  fnBody(src, 'jobTypeOf') + '\n' +
  fnBody(src, 'compactTypeMark') + '\n' +
  fnBody(src, 'compactTypeBadge') + '\n' +
  'globalThis.__jobTypeOf = jobTypeOf;\n' +
  'globalThis.__compactTypeMark = compactTypeMark;\n' +
  'globalThis.__compactTypeBadge = compactTypeBadge;\n'
);

assert(globalThis.__jobTypeOf({ job_type: 'influencer' }) === 'influencer', '5 influencer type');
assert(globalThis.__compactTypeMark({ job_type: 'influencer' }).label === 'Collab', '5 influencer is Collab');
assert(globalThis.__compactTypeMark({ job_type: 'influencer' }).kind === 'collab', '5 Collab kind');
assert(globalThis.__compactTypeBadge({ job_type: 'influencer' }).indexOf('Collab') !== -1, '5 Collab badge text');
assert(globalThis.__compactTypeBadge({ job_type: 'influencer' }).indexOf('is-collab') !== -1, '5 Collab class');
assert(globalThis.__compactTypeMark({ job_type: 'return' }).label === 'Return', '5 return is Return');
assert(globalThis.__compactTypeBadge({ is_return: true }).indexOf('Return') !== -1, '5 return job shows Return');
assert(globalThis.__compactTypeMark({ job_type: 'inspection' }).label === 'Inspection', '5 inspection is Inspection');
assert(globalThis.__compactTypeMark({ job_type: 'other' }).label === 'Other', '5 other is Other');
assert(globalThis.__compactTypeMark({ job_type: 'cleaning' }) == null, '5 cleaning has no type badge');
assert(css.indexOf('.compact-type.is-collab') !== -1, '5 Collab css');
assert(css.indexOf('#7c3aed') !== -1, '5 Collab badge is purple');
assert(css.indexOf('.compact-type.is-return') !== -1, '5 Return css');
assert(src.indexOf('function techNotesBoxHtml') !== -1, '5 notes log stays');
assert(src.indexOf('copyVanBtn') !== -1, '5 van button stays');
assert(src.indexOf('day-header-sticky') !== -1, '5 day headers stay');
assert(src.indexOf('function formatDayHeading') !== -1, '5 day heading stays');
print('ok 5 week view: influencer shows purple Collab; return shows Return; badges match Booking');

print('ok job-card cases');
