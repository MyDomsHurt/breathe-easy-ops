import {
  applyJobDrop,
  handleCellClick,
  pointerJobUp,
} from './board-drag.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function spies() {
  const s = { placed: [], opened: [] };
  s.deps = {
    date: '2026-09-22',
    team: 'Josh',
    slot: 2,
    placeJobInSlot(id, date, team, slot) {
      s.placed.push({ id, date, team, slot });
    },
    openBooking(payload) {
      s.opened.push(payload);
    },
    getJob(id) {
      return { job_id: id, client_name: 'Ada' };
    },
  };
  return s;
}

// 1. Pointer-up on a cell with a captured job id → placeJobInSlot, not openBooking.
const s1 = spies();
const r1 = pointerJobUp({
  moved: true,
  capturedId: 'job-abc',
  overDate: '2026-09-23',
  overTeam: 'Matthew',
  slot: 1,
  placeJobInSlot: s1.deps.placeJobInSlot,
  openBooking: s1.deps.openBooking,
  getJob: s1.deps.getJob,
});
assert(r1 === 'move', '1 kind ' + r1);
assert(s1.placed.length === 1 && s1.placed[0].id === 'job-abc', '1 placeJobInSlot');
assert(s1.placed[0].date === '2026-09-23' && s1.placed[0].team === 'Matthew', '1 target');
assert(s1.opened.length === 0, '1 opened drawer');
print('ok 1 pointer-up with job id moves');

// 2. Pointer-up with no move on a job → open that job.
const s2 = spies();
const r2 = pointerJobUp({
  moved: false,
  capturedId: 'job-abc',
  overJobId: 'job-abc',
  overDate: '2026-09-22',
  overTeam: 'Josh',
  placeJobInSlot: s2.deps.placeJobInSlot,
  openBooking: s2.deps.openBooking,
  getJob: s2.deps.getJob,
});
assert(r2 === 'open-job', '2 kind ' + r2);
assert(s2.opened.length === 1 && s2.opened[0].job_id === 'job-abc', '2 open job');
assert(s2.placed.length === 0, '2 placed');
print('ok 2 no-move on job opens that job');

// 3. Pointer-up with no move on empty paper → openBooking New.
const s3 = spies();
const r3 = pointerJobUp({
  moved: false,
  capturedId: '',
  overDate: '2026-09-22',
  overTeam: 'Josh',
  slot: 0,
  placeJobInSlot: s3.deps.placeJobInSlot,
  openBooking: s3.deps.openBooking,
  getJob: s3.deps.getJob,
});
assert(r3 === 'open-new', '3 kind ' + r3);
assert(s3.opened.length === 1, '3 openBooking');
assert(!s3.opened[0].job_id, '3 opened existing job');
assert(s3.opened[0].team_lead === 'Josh', '3 team');
assert(s3.placed.length === 0, '3 placed');
print('ok 3 no-move on empty paper opens New');

// 4. After a move, the next click is ignored.
const s4 = spies();
pointerJobUp({
  moved: true,
  capturedId: 'job-abc',
  overDate: '2026-09-22',
  overTeam: 'Josh',
  slot: 2,
  placeJobInSlot: s4.deps.placeJobInSlot,
  openBooking: s4.deps.openBooking,
  getJob: s4.deps.getJob,
});
const click4 = handleCellClick((payload) => { s4.opened.push(payload); }, {
  date: '2026-09-22',
  team_lead: 'Josh',
});
assert(click4 === 'suppressed', '4 ' + click4);
assert(s4.opened.length === 0, '4 leftover click opened');
print('ok 4 leftover click ignored after move');

print('ok 4 pointer-job cases');
