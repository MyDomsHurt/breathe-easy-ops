import { rosterCellHtml, weekCellTitle } from './board.js';
import { commitBooking } from './booking.js';
import { CREW_SOURCE, canPlaceJobOnTeamDay, crewNoteId, isTeamDayFull } from './team-day.js';
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

const date = '2026-09-22';
const team = 'Josh';

function weekHtml(jobs) {
  return rosterCellHtml(jobs, jobs, date, team, 'week', jobs);
}

function dayHtml(jobs) {
  return rosterCellHtml(jobs, jobs, date, team, 'day', jobs);
}

function toggleFull(jobs, on) {
  const id = crewNoteId(date, team);
  const i = jobs.findIndex((j) => j.job_id === id);
  if (i >= 0) jobs[i] = { ...jobs[i], day_full: !!on };
  else jobs.push(crew(date, team, { day_full: !!on }));
}

const jobs = [];

// 1. Open week cell → toggle to Full → title Full, beige/full style, no +, no empty slots.
let html = weekHtml(jobs);
assert(weekCellTitle(date, true, false, 0).indexOf('Open') !== -1, '1 title Open fn');
assert(html.indexOf('Open') !== -1, '1 Open in html');
assert(html.indexOf('cell-add') !== -1, '1 + present before lock');
assert(html.indexOf('empty-slot') !== -1, '1 empty slots before lock');
assert(html.indexOf('is-full') === -1, '1 not full yet');
toggleFull(jobs, true);
html = weekHtml(jobs);
assert(isTeamDayFull(jobs, date, team), '1 flag');
assert(weekCellTitle(date, true, true, 0) === weekCellTitle(date, true, true, 0), '1 title fn');
assert(html.indexOf('Full') !== -1, '1 Full in html');
assert(html.indexOf('is-full') !== -1, '1 beige is-full');
assert(html.indexOf('cell-add') === -1, '1 no +');
assert(html.indexOf('empty-slot') === -1, '1 no empty slots');
print('ok 1 week lock Full no + no slots');

// 2. Toggle again → Open or count, + comes back.
toggleFull(jobs, false);
html = weekHtml(jobs);
assert(!isTeamDayFull(jobs, date, team), '2 flag off');
assert(html.indexOf('Open') !== -1, '2 Open');
assert(html.indexOf('cell-add') !== -1, '2 + back');
assert(html.indexOf('empty-slot') !== -1, '2 empty slots back');
assert(html.indexOf('is-full') === -1, '2 not full class');
print('ok 2 toggle open + back');

// 3. Full day: header + and drop-on-empty do nothing. New booking → toast, no write.
toggleFull(jobs, true);
html = weekHtml(jobs);
assert(html.indexOf('cell-add') === -1, '3 no header +');
assert(!canPlaceJobOnTeamDay(jobs, date, team, null), '3 drop-on-empty blocked');
const io = memoryIo(jobs);
const before = jobs.length;
const r3 = commitBooking(blankForm({ date, team_lead: team, client_name: 'New' }), 'confirmed', io);
assert(r3.error === 'That day is full', '3 toast ' + r3.error);
assert(!r3.job, '3 wrote');
assert(jobs.length === before, '3 count');
print('ok 3 full blocks + drop and new save');

// 4. Job already on a Full day: edit name, Save. Job updates.
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
assert(!r4.error, '4 error ' + r4.error);
assert(r4.job.client_name === 'Priya Chen', '4 name ' + (r4.job && r4.job.client_name));
assert(jobs.filter((j) => j.job_id === 'job-keep').length === 1, '4 still one');
print('ok 4 edit on Full day');

// 5. Week cells do not render Day full, +slot, −slot, or Mark.
html = weekHtml(jobs);
assert(html.indexOf('Day full') === -1, '5 Day full');
assert(html.indexOf('+ slot') === -1, '5 + slot');
assert(html.indexOf('− slot') === -1, '5 minus slot');
assert(html.indexOf('>Mark<') === -1, '5 Mark');
const day = dayHtml(jobs);
assert(day.indexOf('Day full') !== -1, '5 day view keeps Day full');
assert(day.indexOf('+ slot') !== -1, '5 day view keeps + slot');
print('ok 5 week chrome gone, day tools stay');

print('ok 5 week-lock cases');
