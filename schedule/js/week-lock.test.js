import { renderWeekBoard, rosterCellHtml, weekCellTitle } from './board.js';
import { commitBooking } from './booking.js';
import { isOfficeEmail } from '../../shared/firebase-config.js';
import { COMPANY_SOURCE, CREW_SOURCE, canPlaceJobOnTeamDay, crewNoteId, holidayId, hongKongToday, isCompanyDay, isTeamDayFull } from './team-day.js';
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

// 1. Open week cell → close → title Closed, grey, no +, no empty slots.
let html = weekHtml(jobs, date);
assert(weekCellTitle(date, true, false, 0).indexOf('Open') !== -1, '1 title Open fn');
assert(html.indexOf('Open') !== -1, '1 Open in html');
assert(html.indexOf('cell-add') !== -1, '1 + present before lock');
assert(html.indexOf('empty-slot') === -1, '1 week rest has empty slots');
assert(html.indexOf('is-full') === -1, '1 not full yet');
toggleLock(jobs, date, true);
html = weekHtml(jobs, date);
assert(isTeamDayFull(jobs, date, team, today), '1 flag');
assert(html.indexOf('Closed') !== -1, '1 Closed in html');
assert(html.indexOf('Locked') === -1, '1 Locked gone');
assert(html.indexOf('is-full') !== -1, '1 grey is-full');
assert(html.indexOf('cell-add') === -1, '1 no +');
assert(html.indexOf('empty-slot') === -1, '1 no empty slots');
print('ok 1 week close Closed no + no slots');

// 2. Toggle again → Open or count, + comes back.
toggleLock(jobs, date, false);
html = weekHtml(jobs, date);
assert(!isTeamDayFull(jobs, date, team, today), '2 flag off');
assert(html.indexOf('Open') !== -1, '2 Open');
assert(html.indexOf('>Open</button>') !== -1, '2 week Open is the button');
assert(html.indexOf('class="cell-lock"') !== -1, '2 week Open has cell-lock');
assert(html.indexOf('cell-add') !== -1, '2 + back');
assert(html.indexOf('empty-slot') === -1, '2 week rest has empty slots');
assert(html.indexOf('is-full') === -1, '2 not full class');
assert(weekCellTitle(date, false, false, 4).indexOf('Open') !== -1, '2 Open with jobs');
assert(dayHtml(jobs, date).indexOf('>Open</button>') !== -1, '2 day Open');
print('ok 2 toggle open + back');

// 3. Locked day: header + and drop-on-empty do nothing. New booking → toast, no write.
toggleLock(jobs, date, true);
html = weekHtml(jobs, date);
assert(html.indexOf('cell-add') === -1, '3 no header +');
assert(!canPlaceJobOnTeamDay(jobs, date, team, null, today), '3 drop-on-empty blocked');
const io = memoryIo(jobs);
const before = jobs.length;
const r3 = commitBooking(blankForm({ date, team_lead: team, client_name: 'New' }), 'confirmed', io);
assert(r3.error === 'That day is closed', '3 toast ' + r3.error);
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
assert(r4.error === 'That day is closed', '4 error ' + r4.error);
assert(!r4.job, '4 wrote');
assert(jobs.filter((j) => j.job_id === 'job-keep' && j.client_name === 'Priya').length === 1, '4 still Priya');
print('ok 4 save on locked day blocked');

// 5. Week Closed/Open word is the close control. Day-full-btn, +slot, −slot, Mark stay off week.
html = weekHtml(jobs, date);
assert(html.indexOf('Day full') === -1, '5 Day full');
assert(html.indexOf('class="cell-lock"') !== -1, '5 week Closed/Open is a button');
assert(html.indexOf('data-day-full="') !== -1, '5 week data-day-full');
assert(html.indexOf('data-day-full-team="') !== -1, '5 week data-day-full-team');
assert(html.indexOf('>Closed</button>') !== -1, '5 week word Closed is the button');
assert(html.indexOf('Locked') === -1, '5 week Locked gone');
assert(html.indexOf('day-full-btn') === -1, '5 week day-full-btn');
assert(html.indexOf('+ slot') === -1, '5 + slot');
assert(html.indexOf('− slot') === -1, '5 minus slot');
assert(html.indexOf('>Mark<') === -1, '5 Mark');
const day = dayHtml(jobs, date);
assert(day.indexOf('day-full-btn') !== -1, '5 day view keeps close button');
assert(day.indexOf('>Closed</button>') !== -1, '5 day view label Closed');
assert(day.indexOf('Locked') === -1, '5 day Locked gone');
assert(day.indexOf('+ slot') !== -1, '5 day view keeps + slot');
print('ok 5 week Closed/Open button, day tools stay');

// 6. Past team-day with no crew note is locked. Drop and save blocked.
const pastJobs = [];
assert(isTeamDayFull(pastJobs, past, team, today), '6 past locked with no note');
assert(!canPlaceJobOnTeamDay(pastJobs, past, team, null, today), '6 past drop blocked');
const pastHtml = weekHtml(pastJobs, past);
assert(pastHtml.indexOf('Closed') !== -1, '6 past paints Closed');
assert(pastHtml.indexOf('Locked') === -1, '6 past Locked gone');
assert(pastHtml.indexOf('is-full') !== -1, '6 past grey');
assert(pastHtml.indexOf('cell-add') === -1, '6 past no +');
assert(pastJobs.length === 0, '6 no crew note created');
const ioPast = memoryIo(pastJobs);
const r6 = commitBooking(blankForm({ date: past, team_lead: team, client_name: 'Ada' }), 'confirmed', ioPast);
assert(r6.error === 'That day is closed', '6 past save ' + r6.error);
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

// 11. Open Saturday is Open and not closed. Past Saturday is Closed because it is past.
const sat = '2026-12-19';
const satHtml = weekHtml([], sat);
assert(satHtml.indexOf('Open') !== -1, '11 sat Open');
assert(satHtml.indexOf('is-full') === -1, '11 sat not closed');
assert(satHtml.indexOf('weekend') === -1, '11 sat cell no weekend grey');
const pastSat = '2026-10-03';
const pastSatHtml = weekHtml([], pastSat);
assert(isTeamDayFull([], pastSat, team, today), '11 past sat closed by date');
assert(pastSatHtml.indexOf('Closed') !== -1, '11 past sat Closed');
assert(pastSatHtml.indexOf('is-full') !== -1, '11 past sat grey from Closed');
print('ok 11 Saturday colour follows Closed/Open');

function holiday(day, name) {
  return {
    job_id: holidayId(day),
    date: day,
    source: COMPANY_SOURCE,
    team_lead: '',
    client_name: '',
    mobile: '',
    phone_cc: '',
    phone_national: '',
    amount: '',
    notes: name || 'Public holiday',
  };
}

const hDate = '2026-12-25';
const hRec = holiday(hDate, 'Christmas');
const hJobs = [hRec];

assert(isCompanyDay(hRec), '12 is company-day');
assert(hRec.job_id === 'holiday-2026-12-25', '12 id');
assert(hRec.source === 'company-day', '12 source');
assert(hRec.client_name === '', '12 no client');
assert(!hRec.mobile, '12 no phone');
assert(hRec.amount === '', '12 no amount');
assert(isTeamDayFull(hJobs, hDate, 'Josh', today), '12 josh closed by holiday');
assert(isTeamDayFull(hJobs, hDate, 'Matthew', today), '12 matthew closed by holiday');
assert(isTeamDayFull(hJobs, hDate, 'Iggi', today), '12 iggi closed by holiday');
assert(!isTeamDayFull(hJobs, '2026-12-24', 'Josh', today), '12 other date stays open');
assert(!canPlaceJobOnTeamDay(hJobs, hDate, 'Josh', null, today), '12 no new booking');
const hJosh = rosterCellHtml(hJobs, hJobs, hDate, 'Josh', 'week', hJobs, today);
const hMatt = rosterCellHtml(hJobs, hJobs, hDate, 'Matthew', 'week', hJobs, today);
assert(hJosh.indexOf('Closed') !== -1, '12 josh Closed');
assert(hJosh.indexOf('is-full') !== -1, '12 josh grey because Closed');
assert(hMatt.indexOf('Closed') !== -1, '12 matt Closed');
assert(hMatt.indexOf('is-full') !== -1, '12 matt grey because Closed');
assert(hJosh.indexOf('Christmas') === -1, '12 name not on team cell');
assert(hMatt.indexOf('Christmas') === -1, '12 name not on other cell');
const hBoard = { innerHTML: '' };
renderWeekBoard(hBoard, {
  jobs: hJobs,
  days: [hDate, '2026-12-26'],
  teams: ['Josh', 'Matthew'],
  today,
});
const hHead = hBoard.innerHTML;
assert(hHead.indexOf('>Christmas</button>') !== -1, '12 name on header');
assert(hHead.split('>Christmas</button>').length === 2, '12 name once on header');
assert(hHead.indexOf('data-holiday-date="' + hDate + '"') !== -1, '12 holiday control');
assert(hHead.indexOf('class="day-col-head') !== -1, '12 head is not a nested button');
const ioH = memoryIo(hJobs);
const beforeH = hJobs.length;
const rH = commitBooking(blankForm({ date: hDate, team_lead: 'Josh', client_name: 'Ada' }), 'confirmed', ioH);
assert(rH.error === 'That day is closed', '12 save ' + rH.error);
assert(!rH.job, '12 wrote a booking');
assert(hJobs.length === beforeH, '12 no client job');
assert(!hJobs.some((j) => j.client_name === 'Ada' || (j.client_name === 'Public holiday' && !isCompanyDay(j))), '12 no Public holiday booking');
print('ok 12 one holiday closes every team that date');

const opened = [hRec, crew(hDate, 'Josh', { day_unlocked: true })];
assert(!isTeamDayFull(opened, hDate, 'Josh', today), '13 unlocked team Open');
assert(isTeamDayFull(opened, hDate, 'Matthew', today), '13 other team Closed');
const openCell = rosterCellHtml(opened, opened, hDate, 'Josh', 'week', opened, today);
const closedCell = rosterCellHtml(opened, opened, hDate, 'Matthew', 'week', opened, today);
assert(openCell.indexOf('Open') !== -1, '13 josh Open');
assert(openCell.indexOf('is-full') === -1, '13 josh white');
assert(closedCell.indexOf('Closed') !== -1, '13 matt Closed');
assert(closedCell.indexOf('is-full') !== -1, '13 matt grey');
assert(opened.some((j) => j.job_id === 'holiday-2026-12-25'), '13 holiday stays');
print('ok 13 one team Open stays white; holiday stays; others Closed');

const purpose = [crew(hDate, 'Nick', { day_full: true, day_locked: true })];
assert(isTeamDayFull(purpose, hDate, 'Nick', today), '14 purpose-closed stays Closed after holiday gone');
assert(!isTeamDayFull(purpose, hDate, 'Josh', today), '14 other team Open after holiday gone');
assert(isTeamDayFull([], past, 'Josh', today), '14 past stays Closed');
print('ok 14 clear holiday leaves purpose-closed Closed');

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
const storeSrc = readSrc('store.js');
assert(storeSrc.indexOf('function setCompanyDay') !== -1, '15 setCompanyDay');
assert(storeSrc.indexOf('function clearCompanyDay') !== -1, '15 clearCompanyDay');
assert(storeSrc.indexOf("source: COMPANY_SOURCE") !== -1, '15 writes company-day');
assert(storeSrc.indexOf('removeJob(found.job_id)') !== -1, '15 clear removes holiday only');
assert(storeSrc.indexOf('day_unlocked: !lockOn && (past || !!findCompanyDay(allJobs(), date))') !== -1, '15 open writes day_unlocked on holiday');
assert(storeSrc.indexOf('Saturday') === -1, '15 no Saturday rule in store');
print('ok 15 store holiday record and unlock');

print('ok 15 week-lock cases');
