function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

const src = readSrc('app.js');

const boot = src.lastIndexOf('startScheduleAuth()');
assert(boot !== -1, '1 no startScheduleAuth()');
const tail = src.slice(boot);
const iStore = tail.indexOf('initStore(user)');
const iPaint = tail.indexOf('paint()');
const iContacts = tail.indexOf('initContactsStore()');
assert(iStore !== -1 && iPaint !== -1 && iContacts !== -1, '1 missing boot calls');
assert(iStore < iPaint, '1 initStore before paint');
assert(iPaint < iContacts, '1 paint before initContactsStore');
assert(tail.indexOf('Promise.all') === -1, '1 Promise.all still in boot');
print('ok 1 boot initStore → paint → initContactsStore');

assert(src.indexOf('subscribeContacts(paint)') === -1, '2 subscribeContacts(paint)');
assert(src.indexOf('subscribeContacts(paintContacts)') !== -1, '2 contacts subscribe missing');
print('ok 2 no subscribeContacts(paint)');

const fn = src.indexOf('function paintContacts');
assert(fn !== -1, '3 no paintContacts');
const body = src.slice(fn, src.indexOf('function paint()', fn));
assert(body.indexOf('renderContacts') !== -1, '3 paintContacts does not renderContacts');
assert(src.indexOf('subscribeContacts(paintContacts)') !== -1, '3 notify not wired');
print('ok 3 contacts page re-renders on notify');

const boardFn = src.indexOf('function paintBoard');
assert(boardFn !== -1, '4 no paintBoard');
const boardBody = src.slice(boardFn, src.indexOf('function paintContacts', boardFn));
assert(boardBody.indexOf('allContacts') === -1, '4 paintBoard reads allContacts');
assert(boardBody.indexOf('renderWeekBoard') !== -1, '4 paintBoard missing week grid');
print('ok 4 week grid paint does not read contacts');

print('ok 4 boot-paint cases');
