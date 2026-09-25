import { clientCardName } from './board.js';
import { commitBooking, newBookingPrefill, storedClientName } from './booking.js';
import { emptyUnits } from './utils.js';
import { TEAMS } from './config.js';

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

function memoryIo() {
  const jobs = [];
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

const io = memoryIo();
const today = '2026-09-25';
const boardTeams = [...TEAMS];

// 1. New booking → team and date. Type nothing. Save. Job on that team/day. Name is —.
const prefill = newBookingPrefill({ date: today, boardTeams });
assert(prefill.date === today, '1 date ' + prefill.date);
assert(!!prefill.team_lead, '1 team missing');
assert(prefill.team_lead === boardTeams[0], '1 first board team ' + prefill.team_lead);
const r1 = commitBooking(blankForm(prefill), 'confirmed', io);
assert(!r1.error, '1 error ' + r1.error);
assert(r1.job.date === today, '1 job date');
assert(r1.job.team_lead === prefill.team_lead, '1 job team');
assert(r1.job.client_name === '', '1 stored name ' + JSON.stringify(r1.job.client_name));
assert(storedClientName(r1.job.client_name) === '', '1 storedClientName');
assert(clientCardName(r1.job.client_name) === '—', '1 card ' + clientCardName(r1.job.client_name));
assert(io.jobs.length === 1, '1 jobs ' + io.jobs.length);
print('ok 1 blank save on ' + r1.job.team_lead + ' ' + r1.job.date + ' card ' + clientCardName(r1.job.client_name));

// 2. Same drawer: name only, no phone. Save. Job appears with that name.
const r2 = commitBooking(blankForm({
  ...prefill,
  client_name: 'Ada',
  mobile: '',
}), 'confirmed', io);
assert(!r2.error, '2 error ' + r2.error);
assert(r2.job.client_name === 'Ada', '2 name');
assert(!r2.job.mobile, '2 phone empty');
assert(r2.job.date === today && r2.job.team_lead === prefill.team_lead, '2 team/day');
assert(io.jobs.length === 2, '2 jobs');
print('ok 2 name-only Ada');

// 3. Same drawer: phone only, no name. Save. Job appears. Name is —.
const r3 = commitBooking(blankForm({
  ...prefill,
  client_name: '',
  mobile: '+85291234567',
  phone_cc: '852',
  phone_national: '91234567',
}), 'confirmed', io);
assert(!r3.error, '3 error ' + r3.error);
assert(r3.job.client_name === '', '3 stored name');
assert(clientCardName(r3.job.client_name) === '—', '3 card');
assert(r3.job.mobile === '+85291234567', '3 mobile ' + r3.job.mobile);
assert(io.jobs.length === 3, '3 jobs');
print('ok 3 phone-only card —');

// 4. Clear team in the drawer, Save. Toast. No write.
const before = io.jobs.length;
const r4 = commitBooking(blankForm({
  date: today,
  team_lead: '',
  client_name: 'NoTeam',
}), 'confirmed', io);
assert(r4.error === 'Date and team are required', '4 toast ' + r4.error);
assert(!r4.job, '4 wrote');
assert(io.jobs.length === before, '4 count');
print('ok 4 missing team no write');

// 5. Edit an existing named job, clear the name, Save. Name becomes —. Job stays.
const named = commitBooking(blankForm({
  ...prefill,
  client_name: 'Priya',
}), 'confirmed', io);
const id = named.job.job_id;
const r5 = commitBooking(blankForm({
  ...prefill,
  job_id: id,
  client_name: '',
}), 'confirmed', io);
assert(!r5.error, '5 error ' + r5.error);
assert(r5.job.job_id === id, '5 id');
assert(r5.job.client_name === '', '5 stored name');
assert(clientCardName(r5.job.client_name) === '—', '5 card');
assert(io.jobs.filter((j) => j.job_id === id).length === 1, '5 still one');
print('ok 5 cleared name stays as —');

print('ok 5 easy-save cases');
