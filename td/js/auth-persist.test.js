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

const auth = readSrc('auth.js');
const html = readSrc('index.html');
const sw = readSrc('sw.js');

assert(auth.indexOf('Auth.Persistence.LOCAL') !== -1, '1 LOCAL persistence');
assert(auth.indexOf('setPersistence') !== -1, '1 setPersistence');
assert(auth.indexOf('hideLoginWall') !== -1, '1 hide login until auth');
const bootAt = auth.indexOf('function boot');
const boot = auth.slice(bootAt);
assert(boot.indexOf('hideLoginWall()') !== -1, '1 boot hides wall first');
assert(boot.indexOf('hideLoginWall()') < boot.indexOf('onAuthStateChanged'), '1 hide before onAuthStateChanged');
assert(boot.indexOf('setPersistence') < boot.indexOf('onAuthStateChanged'), '1 persistence before listener');
assert(auth.indexOf('signInWithRedirect') === -1, '1 no redirect');
assert(auth.indexOf('getRedirectResult') === -1, '1 no redirect result');
assert(auth.indexOf('signInWithPopup') !== -1, '1 popup stays');
print('ok 1 LOCAL persistence; Google hidden until no user; no redirect');

const loginAt = html.indexOf('id="loginScreen"');
assert(loginAt !== -1, '2 loginScreen');
const loginTag = html.slice(html.lastIndexOf('<div', loginAt), html.indexOf('>', loginAt) + 1);
assert(loginTag.indexOf('hidden') !== -1, '2 login wall starts hidden');
const btnAt = html.indexOf('id="btnGoogle"');
const btnTag = html.slice(html.lastIndexOf('<button', btnAt), html.indexOf('>', btnAt) + 1);
assert(btnTag.indexOf('hidden') !== -1, '2 Google button starts hidden');
assert(html.indexOf('js/auth.js?v=4') !== -1, '2 auth cache');
assert(html.indexOf('js/app.js?v=48') !== -1, '2 app.js cache');
assert(html.indexOf('css/app.css?v=49') !== -1, '2 css cache');
print('ok 2 auth.js?v=4; Google button hidden in HTML');

assert(sw.indexOf("path === '/js/auth.js'") !== -1, '3 auth.js network-only');
assert(sw.indexOf("path === '/'") !== -1, '3 index network-only');
assert(sw.indexOf("req.mode === 'navigate'") !== -1, '3 navigations not cached');
assert(sw.indexOf("'/js/auth.js'") === sw.lastIndexOf("'/js/auth.js'"), '3 auth.js not in SHELL');
assert(sw.indexOf("'/index.html'") === sw.lastIndexOf("'/index.html'"), '3 index.html not in SHELL');
print('ok 3 service worker does not cache the login screen');

print('ok auth-persist cases');
