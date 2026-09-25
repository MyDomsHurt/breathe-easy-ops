import {
  applyJobDrop,
  armClickSuppress,
  beginDrag,
  capturedDragId,
  consumeClickSuppress,
  handleCellClick,
  resolveDropId,
} from './board-drag.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function spies() {
  const s = { placed: [], opened: [], toasts: [] };
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
  };
  return s;
}

// 1. Drop with a real job_id calls placeJobInSlot, not openBooking.
beginDrag('job-abc');
const id1 = resolveDropId('', capturedDragId());
assert(id1 === 'job-abc', '1 resolve empty getData ' + id1);
const s1 = spies();
const r1 = applyJobDrop(id1, s1.deps);
assert(r1 === 'move', '1 kind ' + r1);
assert(s1.placed.length === 1 && s1.placed[0].id === 'job-abc', '1 placeJobInSlot');
assert(s1.opened.length === 0, '1 opened drawer');
print('ok 1 real job drop moves');

// 2. Drop with new-appointment still openBooking.
const s2 = spies();
const r2 = applyJobDrop('new-appointment', s2.deps);
assert(r2 === 'open', '2 kind ' + r2);
assert(s2.opened.length === 1, '2 openBooking');
assert(s2.placed.length === 0, '2 placed');
assert(s2.opened[0].team_lead === 'Josh', '2 team');
print('ok 2 new-appointment opens drawer');

// 3. After a job drop, the next click on that cell is ignored.
beginDrag('job-abc');
const s3 = spies();
applyJobDrop(resolveDropId('', capturedDragId()), s3.deps);
armClickSuppress(300);
const click3 = handleCellClick((payload) => { s3.opened.push(payload); }, {
  date: '2026-09-22',
  team_lead: 'Josh',
});
assert(click3 === 'suppressed', '3 ' + click3);
assert(s3.opened.length === 0, '3 click opened');
print('ok 3 suppressClick after drop');

// 4. A plain click on an Open cell (no drag) still openBooking.
const s4 = spies();
const click4 = handleCellClick((payload) => { s4.opened.push(payload); }, {
  date: '2026-09-22',
  team_lead: 'Josh',
});
assert(click4 === 'open', '4 ' + click4);
assert(s4.opened.length === 1, '4 did not open');
print('ok 4 plain click opens New booking');

print('ok 4 board-drop cases');
