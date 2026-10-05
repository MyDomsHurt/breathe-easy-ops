import { rosterCellHtml, weekCellTitle } from './board.js';
import { commitBooking } from './booking.js';
import { isOfficeEmail } from '../../shared/firebase-config.js';
import { CREW_SOURCE, canPlaceJobOnTeamDay, crewNoteId, hongKongToday, isTeamDayFull } from './team-day.js';
import { emptyUnits } from './utils.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function blankForm(over = {}) {
  return {
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
    date: '',
    time: '',
    team_lead: '',
    job_type: 'cleaning',
    amount: '',
    payment: 'Unpaid',
    notes: '',
    notes_long: '',
    status: 'confirmed',
    invoice: '',
    stack_order: '',
    highlight: {},
    ...over,
  };
}

function memoryIo(jobs) {
  return {
    jobs,
    allJobs: () => jobs.slice(),
    allContacts: () => [],
    addJob(input) {
      const job = { ...input, job_id: input.job_id || ('job-' + (jobs.length + 1)) };
      jobs.push(job);
      return job;
    },
    updateJob(id, input) {
      const i = jobs.findIndex((j) => j.job_id === id);
      if (i < 0) fail('update missing ' + id);
      jobs[i] = { ...jobs[i], ...input, job_id: id };
      return jobs[i];
    },
  };
}

function crew(date, team, over = {}) {
  return {
    job_id: crewNoteId(date, team),
    date,
    team_lead: team,
    source: CREW_SOURCE,
    client_name: '',
    day_full: false,
    ...over,
  };
}

const today = '2026-10-05';
const date = '2026-12-15';
const past = '2026-09-22';
const team = 'Josh';

function weekHtml(jobs, day, when) {
  return rosterCellHtml(jobs, jobs, day, team, 'week', jobs, when || today);
}

function dayHtml(jobs, day, when) {
  return rosterCellHtml(jobs, jobs, day, team, 'day', jobs, when || today);
}

function toggleLock(jobs, day, on) {
  const id = crewNoteId(day, team);
  const i = jobs.findIndex((j) => j.job_id === id);
  const flags = on
    ? { day_full: true, day_locked: true, day_unlocked: false }
    : { day_full: false, day_locked: false, day_unlocked: false };
  if (i >= 0) jobs[i] = { ...jobs[i], ...flags };
  else jobs.push(crew(day, team, flags));
}

const jobs = [];

assert(/^\d{4}-\d{2}-\d{2}$/.test(hongKongToday()), 'today shape ' + hongKongToday());

// 1. Open week cell → lock → title Locked, beige, no +, no empty slots.
let html = weekHtml(jobs, date);
assert(weekCellTitle(date, true, false, 0).indexOf('Open') !== -1, '1 title Open fn');
assert(html.indexOf('Open') !== -1, '1 Open in html');
assert(html.indexOf('cell-add') !== -1, '1 + present before lock');
assert(html.indexOf('empty-slot') === -1, '1 week rest has empty slots');
assert(html.indexOf('is-full') === -1, '1 not full yet');
toggleLock(jobs, date, true);
html = weekHtml(jobs, date);
assert(isTeamDayFull(jobs, date, team, today), '1 flag');
assert(html.indexOf('Locked') !== -1, '1 Locked in html');
assert(html.indexOf('is-full') !== -1, '1 beige is-full');
assert(html.indexOf('cell-add') === -1, '1 no +');
assert(html.indexOf('empty-slot') === -1, '1 no empty slots');
print('ok 1 week lock Locked no + no slots');

// 2. Toggle again → Open or count, + comes back.
toggleLock(jobs, date, false);
html = weekHtml(jobs, date);
assert(!isTeamDayFull(jobs, date, team, today), '2 flag off');
assert(html.indexOf('Open') !== -1, '2 Open');
assert(html.indexOf('cell-add') !== -1, '2 + back');
assert(html.indexOf('empty-slot') === -1, '2 week rest has empty slots');
assert(html.indexOf('is-full') === -1, '2 not full class');
print('ok 2 toggle open + back');

// 3. Locked day: header + and drop-on-empty do nothing. New booking → toast, no write.
toggleLock(jobs, date, true);
html = weekHtml(jobs, date);
assert(html.indexOf('cell-add') === -1, '3 no header +');
assert(!canPlaceJobOnTeamDay(jobs, date, team, null, today), '3 drop-on-empty blocked');
const io = memoryIo(jobs);
const before = jobs.length;
const r3 = commitBooking(blankForm({ date, team_lead: team, client_name: 'New' }), 'confirmed', io);
assert(r3.error === 'That day is locked', '3 toast ' + r3.error);
assert(!r3.job, '3 wrote');
assert(jobs.length === before, '3 count');
print('ok 3 locked blocks + drop and new save');

// 4. Job already on a locked day: card save is blocked.
const live = {
  job_id: 'job-keep',
  date,
  team_lead: team,
  client_name: 'Priya',
  source: 'local',
};
jobs.push(live);
const r4 = commitBooking(blankForm({
  job_id: 'job-keep',
  date,
  team_lead: team,
  client_name: 'Priya Chen',
}), 'confirmed', io);
assert(r4.error === 'That day is locked', '4 error ' + r4.error);
assert(!r4.job, '4 wrote');
assert(jobs.filter((j) => j.job_id === 'job-keep' && j.client_name === 'Priya').length === 1, '4 still Priya');
print('ok 4 save on locked day blocked');

// 5. Week cells do not render the day Locked button, +slot, −slot, or Mark.
html = weekHtml(jobs, date);
assert(html.indexOf('Day full') === -1, '5 Day full');
assert(html.indexOf('>Locked</button>') !== -1, '5 week title Locked');
assert(html.indexOf('day-full-btn') === -1, '5 week day-full-btn');
assert(html.indexOf('+ slot') === -1, '5 + slot');
assert(html.indexOf('− slot') === -1, '5 minus slot');
assert(html.indexOf('>Mark<') === -1, '5 Mark');
const day = dayHtml(jobs, date);
assert(day.indexOf('day-full-btn') !== -1, '5 day view keeps lock button');
assert(day.indexOf('>Locked</button>') !== -1, '5 day view label Locked');
assert(day.indexOf('+ slot') !== -1, '5 day view keeps + slot');
print('ok 5 week chrome gone, day tools stay');

// 6. Past team-day with no crew note is locked. Drop and save blocked.
const pastJobs = [];
assert(isTeamDayFull(pastJobs, past, team, today), '6 past locked with no note');
assert(!canPlaceJobOnTeamDay(pastJobs, past, team, null, today), '6 past drop blocked');
const pastHtml = weekHtml(pastJobs, past);
assert(pastHtml.indexOf('Locked') !== -1, '6 past paints Locked');
assert(pastHtml.indexOf('is-full') !== -1, '6 past beige');
assert(pastHtml.indexOf('cell-add') === -1, '6 past no +');
assert(pastJobs.length === 0, '6 no crew note created');
const ioPast = memoryIo(pastJobs);
const r6 = commitBooking(blankForm({ date: past, team_lead: team, client_name: 'Ada' }), 'confirmed', ioPast);
assert(r6.error === 'That day is locked', '6 past save ' + r6.error);
assert(pastJobs.length === 0, '6 past no write');
print('ok 6 past day locked with no crew note');

// 7. day_unlocked beats the past-day rule and day_locked.
const unlocked = [crew(past, team, { day_unlocked: true, day_locked: true, day_full: true })];
assert(!isTeamDayFull(unlocked, past, team, today), '7 unlock beats past');
assert(canPlaceJobOnTeamDay(unlocked, past, team, null, today), '7 unlock allows place');
const unlockedHtml = weekHtml(unlocked, past);
assert(unlockedHtml.indexOf('Open') !== -1, '7 unlocked Open');
assert(unlockedHtml.indexOf('is-full') === -1, '7 unlocked not beige');
print('ok 7 unlock beats past and day_locked');

// 8. A day that was Full stays locked. day_locked also locks a future day.
const wasFull = [crew(date, team, { day_full: true })];
assert(isTeamDayFull(wasFull, date, team, today), '8 day_full still locks');
assert(!canPlaceJobOnTeamDay(wasFull, date, team, { date, team_lead: team }, today), '8 no save on Full');
const lockedOnly = [crew(date, team, { day_locked: true })];
assert(isTeamDayFull(lockedOnly, date, team, today), '8 day_locked locks future');
const openFuture = [];
assert(!isTeamDayFull(openFuture, date, team, today), '8 future open');
print('ok 8 Full stays locked; future open unless locked');

// 9. Drag off a locked day is blocked even when the dest is open.
const onLocked = { job_id: 'job-move', date, team_lead: team };
assert(!canPlaceJobOnTeamDay(wasFull, '2026-12-16', 'Matthew', onLocked, today), '9 drag off Full');
const fromPast = { job_id: 'job-old', date: past, team_lead: team };
assert(!canPlaceJobOnTeamDay([], date, team, fromPast, today), '9 drag off past');
assert(canPlaceJobOnTeamDay([], date, team, { job_id: 'job-open', date, team_lead: team }, today), '9 open to open');
print('ok 9 drag off locked source blocked');

// 10. Unlock is office only.
assert(isOfficeEmail('jefflamb1992@gmail.com'), '10 jeff office');
assert(!isOfficeEmail('joshua@breathe-easyhk.com'), '10 josh not office');
assert(!isOfficeEmail('matthewgross2001@gmail.com'), '10 tech not office');
print('ok 10 unlock office only');

print('ok 10 week-lock cases');
