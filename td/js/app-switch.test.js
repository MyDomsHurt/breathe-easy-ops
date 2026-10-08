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
const dash = readSrc('dashboard/index.html');

const switchAt = html.indexOf('id="be-app-switch"');
assert(switchAt !== -1, '1 app switch');
const switchEnd = html.indexOf('</nav>', switchAt);
const nav = html.slice(switchAt, switchEnd);
assert(nav.indexOf('Live Schedule') !== -1, '1 Live Schedule stays');
assert(nav.indexOf('Performance') === -1, '1 Performance link gone');
assert(nav.indexOf('dashboard/') === -1, '1 no dashboard href');
print('ok 1 TD header has Live Schedule only');

assert(html.indexOf('css/app.css?v=49') !== -1, '2 css cache');
assert(html.indexOf('js/app.js?v=48') !== -1, '2 js cache');
print('ok 2 cache css/app.css?v=49 js/app.js?v=48');

assert(dash.indexOf("location.replace('/')") !== -1, '3 dashboard returns to schedule');
assert(dash.indexOf('href="/"') !== -1, '3 schedule link');
assert(dash.indexOf('score-jobs') === -1, '3 score page gone');
assert(dash.indexOf('Performance') === -1, '3 Performance chrome gone');
print('ok 3 /dashboard/ lands on the schedule');

print('ok app-switch cases');
