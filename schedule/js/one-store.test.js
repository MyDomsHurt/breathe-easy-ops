import { emptyUnits } from './utils.js';
import { addJob, allJobs, initStore, isStoreReady, writeJob } from './store.js?v=4';
import { commitBooking } from './booking.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = ['schedule/js/' + name, name, './' + name, '../' + name];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

function storeImportSpec(src) {
  const re = /from\s+['"](\.\/store\.js[^'"]*)['"]/g;
  const found = [];
  let m;
  while ((m = re.exec(src))) found.push(m[1]);
  return found;
}

const appSrc = readSrc('app.js');
const bookingSrc = readSrc('booking.js');
const exportSrc = readSrc('export-roster.js');
const appSpecs = storeImportSpec(appSrc);
const bookingSpecs = storeImportSpec(bookingSrc);
assert(appSpecs.length === 1, '1 app store imports ' + appSpecs.length);
assert(bookingSpecs.length === 1, '1 booking store imports ' + bookingSpecs.length);
assert(appSpecs[0] === bookingSpecs[0], '1 specifier app ' + appSpecs[0] + ' booking ' + bookingSpecs[0]);
print('ok 1 same specifier ' + appSpecs[0]);

const files = {
  'app.js': appSrc,
  'booking.js': bookingSrc,
  'export-roster.js': exportSrc,
};
Object.keys(files).forEach((name) => {
  const specs = storeImportSpec(files[name]);
  specs.forEach((s) => {
    assert(s === appSpecs[0], '2 ' + name + ' uses ' + s + ' want ' + appSpecs[0]);
    assert(s.indexOf('?') !== -1, '2 ' + name + ' missing query ' + s);
  });
});
print('ok 2 every store.js import uses ' + appSpecs[0]);

assert(!isStoreReady(), '3 store should start empty');
let threw = false;
let out;
try {
  out = writeJob({ job_id: 'x', date: '2026-09-25', team_lead: 'Josh', client_name: '' }, 'created');
} catch (err) {
  threw = true;
  assert(String(err && err.message || err).indexOf('upsertJob') === -1, '3 threw upsertJob ' + err);
  fail('3 writeJob threw ' + err);
}
assert(!threw, '3 threw');
assert(out == null, '3 writeJob returned ' + out);
const notReady = commitBooking({
  job_id: '',
  client_name: '',
  units: emptyUnits(),
  date: '2026-09-25',
  team_lead: 'Josh',
  job_type: 'cleaning',
  payment: 'Unpaid',
  highlight: {},
}, 'confirmed');
assert(notReady.error === 'Store not ready', '3 store not ready ' + (notReady && notReady.error));
print('ok 3 writeJob null ops no throw');

const form = {
  job_id: '',
  client_name: '',
  mobile: '',
  phone_cc: '',
  phone_national: '',
  hubspot_id: '',
  address: '',
  address_line1: '',
  address_street: '',
  address_place: '',
  address_extra: '',
  district: '',
  units: emptyUnits(),
  date: '2026-09-25',
  time: '',
  team_lead: 'Josh',
  job_type: 'cleaning',
  amount: '',
  payment: 'Unpaid',
  notes: '',
  notes_long: '',
  status: 'confirmed',
  invoice: '',
  stack_order: '',
  highlight: {},
};

await initStore(null);
assert(isStoreReady(), '4 store ready after init');
const r = commitBooking(form, 'confirmed');
assert(!r.error, '4 error ' + (r && r.error));
assert(r.job && r.job.job_id, '4 job_id');
assert(r.job.client_name === '', '4 name');
assert(allJobs().some((j) => j.job_id === r.job.job_id), '4 not in allJobs — split module?');
assert(typeof addJob === 'function', '4 addJob');
print('ok 4 real addJob ' + r.job.job_id);

print('ok 4 one-store cases');
