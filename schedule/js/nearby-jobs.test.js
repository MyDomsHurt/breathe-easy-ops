import { createStore } from '../../shared/store.js';
import { loadNearbyOrAll, nearbyJobsRange } from '../../shared/store-firestore.js';
import { CREW_SOURCE, crewNoteId } from './team-day.js';

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

function job(id, date, extra) {
  return {
    job_id: id,
    date,
    team_lead: 'Josh',
    client_name: extra && extra.client_name != null ? extra.client_name : id,
    source: (extra && extra.source) || 'test',
  };
}

const now = new Date(2026, 8, 25);
const range = nearbyJobsRange(now);
assert(range.from === '2026-08-01', 'range from ' + range.from);
assert(range.to === '2026-10-31', 'range to ' + range.to);

const jan = job('jan', '2026-01-12');
const aug = job('aug', '2026-08-10');
const sep = job('sep', '2026-09-22');
const oct = job('oct', '2026-10-15');
const crew = job(crewNoteId('2026-09-22', 'Josh'), '2026-09-22', {
  client_name: '',
  source: CREW_SOURCE,
});
const windowJobs = [aug, sep, oct, crew];
const fullJobs = [jan, aug, sep, oct, crew];

function inWindow(j) {
  return j.date >= range.from && j.date <= range.to;
}

// 1. First adapter load can return only the 3-month window.
const first = await loadNearbyOrAll(async () => windowJobs, async () => fullJobs);
assert(first.length === windowJobs.length, '1 window length ' + first.length);
assert(first.every(inWindow), '1 not all in window');
assert(!first.some((j) => j.job_id === 'jan'), '1 january in window');
assert(first.some((j) => j.source === CREW_SOURCE), '1 crew note missing');
print('ok 1 first load is 3-month window');

// 2. After hydrate, allJobs() includes January and next-month.
let remoteCb = null;
let remoteStarted = 0;
const adapter = {
  name: 'fake',
  load() { return windowJobs; },
  subscribeRemote(cb) {
    remoteStarted += 1;
    remoteCb = cb;
    return () => {};
  },
};
const store = createStore({ adapter, deferRemote: true });
await store.ready;
assert(remoteStarted === 0, '2 remote started before paint');
const before = store.listJobs();
assert(!before.some((j) => j.date && j.date.indexOf('2026-01') === 0), '2 jan before hydrate');
assert(before.some((j) => j.job_id === 'oct'), '2 next-month missing before hydrate');
store.startRemote();
assert(remoteStarted === 1, '2 remote not started');
remoteCb(fullJobs);
const after = store.listJobs();
assert(after.some((j) => j.job_id === 'jan'), '2 jan after hydrate');
assert(after.some((j) => j.job_id === 'oct'), '2 next-month after hydrate');
print('ok 2 hydrate includes January and next-month');

// 3. Range-get failure path still returns the full list.
const fallback = await loadNearbyOrAll(async () => { throw new Error('failed-precondition'); }, async () => fullJobs);
assert(fallback.some((j) => j.job_id === 'jan'), '3 jan missing on failure');
assert(fallback.length === fullJobs.length, '3 full length');
print('ok 3 range failure returns full list');

// 4. Export helper still reads allJobs(), not the window.
const exportSrc = readSrc('export-roster.js');
assert(exportSrc.indexOf('allJobs()') !== -1, '4 export missing allJobs()');
assert(exportSrc.indexOf('nearbyJobsRange') === -1, '4 export uses nearby range');
assert(exportSrc.indexOf('loadNearbyOrAll') === -1, '4 export uses window loader');
print('ok 4 export reads allJobs()');

print('ok 4 nearby-jobs cases');
