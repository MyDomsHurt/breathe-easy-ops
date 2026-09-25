import { UNIT_TYPES, TEAMS } from './config.js';
import { emptyUnits } from './utils.js';
import { CREW_SOURCE, crewNoteId } from './team-day.js';
import {
  applyUnitDelta,
  applyAddrClean,
  applyPhoneClean,
  bindForm,
  commitBooking,
  getBookingForm,
  mintJobId,
  renderForm,
  runAddrClean,
  runPhoneClean,
} from './booking.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function node(extra) {
  const n = {
    listeners: {},
    dataset: {},
    value: '',
    hidden: false,
    scrollTop: 0,
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    disabled: false,
    addEventListener(type, fn) {
      (n.listeners[type] = n.listeners[type] || []).push(fn);
    },
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return n; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    preventDefault() {},
    stopPropagation() {},
  };
  if (extra) Object.keys(extra).forEach((k) => { n[k] = extra[k]; });
  return n;
}

function heard(el) {
  const ls = el && el.listeners;
  if (!ls) return false;
  return Object.keys(ls).some((k) => (ls[k] || []).length > 0);
}

const byId = {};
const unitBtns = [];
const teamBtns = [];
const holdBtns = [];
const closeBtns = [node()];
const sCount = { textContent: '0' };
const sTile = node({
  querySelector(sel) { return sel === 'b' ? sCount : null; },
});
sTile.closest = (sel) => (sel === '.unit' ? sTile : null);

UNIT_TYPES.forEach((u) => {
  const tile = u.id === 'S' ? sTile : node();
  if (u.id === 'S') {
    tile.querySelector = (sel) => (sel === 'b' ? sCount : null);
    tile.closest = (sel) => (sel === '.unit' ? tile : null);
  }
  ['-1', '1'].forEach((delta) => {
    const btn = node({ dataset: { unit: u.id, delta } });
    btn.closest = (sel) => (sel === '.unit' ? tile : null);
    unitBtns.push(btn);
  });
});

TEAMS.forEach((team) => {
  teamBtns.push(node({ dataset: { team } }));
});

const acsPreview = node({ textContent: '—' });
let drawerBody = node({ scrollTop: 80 });
let rebuilt = 0;
const bookingRoot = node();
Object.defineProperty(bookingRoot, 'innerHTML', {
  set() {
    rebuilt += 1;
    drawerBody = node({ scrollTop: 0 });
  },
  get() { return ''; },
});
bookingRoot.querySelector = (sel) => document.querySelector(sel);
bookingRoot.querySelectorAll = (sel) => document.querySelectorAll(sel);

const ids = [
  'clientSearch', 'clientHits',
  'mobileInput', 'formPhoneCc', 'formPhoneNational', 'phoneCleanOpen', 'phoneApplyBtn',
  'addressInput', 'formAddrLine1', 'formAddrStreet', 'formAddrPlace', 'districtInput',
  'addrCleanOpen', 'addrApplyBtn',
  'dateInput', 'timeInput', 'typeInput', 'payInput', 'amountInput',
  'notesInput', 'notesLongInput', 'invoiceInput',
  'saveTentative', 'saveBooking', 'deleteBooking',
  'notes1Count', 'toggleLog', 'changeLog',
];
ids.forEach((id) => { byId[id] = node({ id }); });

function qs(sel) {
  if (!sel) return null;
  if (sel === '#bookingRoot') return bookingRoot;
  if (sel[0] === '#') return byId[sel.slice(1)] || null;
  if (sel === '.drawer-body') return drawerBody;
  if (sel === '.acs-preview') return acsPreview;
  if (sel.indexOf('[data-unit="') === 0) {
    const id = sel.slice(12, -2);
    return unitBtns.find((b) => b.dataset.unit === id) || null;
  }
  return null;
}

function qsa(sel) {
  if (sel === '[data-unit]') return unitBtns;
  if (sel === '[data-team]') return teamBtns;
  if (sel === '[data-hold]') return holdBtns;
  if (sel === '[data-close]') return closeBtns;
  return [];
}

globalThis.document = {
  querySelector: qs,
  querySelectorAll: qsa,
  getElementById: (id) => byId[id] || null,
};

function blankForm(over) {
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
    ...(over || {}),
  };
}

function memoryIo(jobs) {
  const list = jobs || [];
  return {
    jobs: list,
    allJobs: () => list.slice(),
    allContacts: () => [],
    addJob(input) {
      const job = { ...input, job_id: input.job_id || ('job-' + (list.length + 1)) };
      list.push(job);
      return job;
    },
    updateJob(id, input) {
      const i = list.findIndex((j) => j.job_id === id);
      if (i < 0) fail('missing ' + id);
      list[i] = { ...list[i], ...input, job_id: id };
      return list[i];
    },
  };
}

// 1. Unit + then − on S: counts and preview change; scrollTop stays; renderForm not used.
drawerBody.scrollTop = 80;
rebuilt = 0;
const form = getBookingForm();
form.units = emptyUnits();
applyUnitDelta('S', 1);
assert(form.units.S === 1, '1 S count after + ' + form.units.S);
assert(sCount.textContent === '1', '1 tile b ' + sCount.textContent);
assert(acsPreview.textContent === '1S', '1 preview ' + acsPreview.textContent);
assert(rebuilt === 0, '1 renderForm used');
assert(drawerBody.scrollTop === 80, '1 scroll after + ' + drawerBody.scrollTop);
applyUnitDelta('S', -1);
assert(form.units.S === 0, '1 S after −');
assert(sCount.textContent === '0', '1 tile b after −');
assert(acsPreview.textContent === '—', '1 preview after − ' + acsPreview.textContent);
assert(rebuilt === 0, '1 renderForm on −');
assert(drawerBody.scrollTop === 80, '1 scroll after −');
print('ok 1 ACS in place, scroll stays');

// 2. Rebuild path (change team): scrollTop restored after render.
drawerBody.scrollTop = 80;
rebuilt = 0;
renderForm();
assert(rebuilt >= 1, '2 did rebuild');
assert(document.querySelector('.drawer-body').scrollTop === 80, '2 scroll restored ' + document.querySelector('.drawer-body').scrollTop);
print('ok 2 team rebuild restores scroll');

// 3. Throw inside addJob → { error }, no throw out of commitBooking.
let threw = false;
let r3;
try {
  r3 = commitBooking(blankForm({ date: '2026-09-25', team_lead: 'Josh' }), 'confirmed', {
    allJobs: () => [],
    allContacts: () => [],
    addJob() { throw new Error('Firestore boom'); },
    updateJob() { fail('3 update'); },
  });
} catch (err) {
  threw = true;
}
assert(!threw, '3 threw out');
assert(r3 && r3.error === 'Firestore boom', '3 error ' + (r3 && r3.error));
assert(!r3.job, '3 job');
print('ok 3 addJob throw becomes { error }');

// 4. Blank name + date + team on Open day → job with job_id, client_name "".
const io4 = memoryIo([]);
const r4 = commitBooking(blankForm({ date: '2026-09-25', team_lead: 'Josh' }), 'confirmed', io4);
assert(!r4.error, '4 error ' + (r4 && r4.error));
assert(r4.job.client_name === '', '4 name');
assert(typeof r4.job.job_id === 'string' && r4.job.job_id.indexOf('2026-09-25-josh-') === 0, '4 job_id ' + r4.job.job_id);
assert(mintJobId({ date: '2026-09-25', team_lead: 'Josh' }).indexOf('2026-09-25-josh-') === 0, '4 mint shape');
print('ok 4 minted id ' + r4.job.job_id);

// 5. New job onto a Full day → { error: "That day is full" }.
const fullJobs = [{
  job_id: crewNoteId('2026-09-22', 'Josh'),
  date: '2026-09-22',
  team_lead: 'Josh',
  source: CREW_SOURCE,
  client_name: '',
  day_full: true,
}];
const io5 = memoryIo(fullJobs);
const before = fullJobs.length;
const r5 = commitBooking(blankForm({ date: '2026-09-22', team_lead: 'Josh', client_name: 'Ada' }), 'confirmed', io5);
assert(r5.error === 'That day is full', '5 error ' + (r5 && r5.error));
assert(!r5.job, '5 wrote');
assert(fullJobs.length === before, '5 count');
print('ok 5 full day no write');

// 6. Walk drawer controls: each has a listener after bindForm().
bindForm();
const missing = [];
function need(label, el) {
  if (!heard(el)) missing.push(label);
}
need('name', byId.clientSearch);
need('phone full', byId.mobileInput);
need('phone cc', byId.formPhoneCc);
need('phone national', byId.formPhoneNational);
need('phone Clean', byId.phoneCleanOpen);
need('phone Apply', byId.phoneApplyBtn);
need('address full', byId.addressInput);
need('address line1', byId.formAddrLine1);
need('address street', byId.formAddrStreet);
need('address place', byId.formAddrPlace);
need('address territory', byId.districtInput);
need('address Clean', byId.addrCleanOpen);
need('address Apply', byId.addrApplyBtn);
need('ACS tiles', unitBtns[0]);
need('date', byId.dateInput);
need('team', teamBtns[0]);
need('time', byId.timeInput);
need('type', byId.typeInput);
need('notes 1', byId.notesInput);
need('notes 2', byId.notesLongInput);
need('payment', byId.payInput);
need('amount', byId.amountInput);
need('invoice', byId.invoiceInput);
need('Tentative', byId.saveTentative);
need('Save', byId.saveBooking);
need('Cancel job', byId.deleteBooking);
assert(!missing.length, '6 missing listeners: ' + missing.join(', '));
print('ok 6 bindForm listeners');

// 7. Phone and address Clean / Apply still write Full into form and do not reset scroll.
drawerBody.scrollTop = 50;
rebuilt = 0;
form.mobile = '9123 4567';
form.phone_cc = '';
form.phone_national = '';
runPhoneClean();
assert(form.mobile === '+85291234567', '7 phone full ' + form.mobile);
assert(form.phone_cc === '852', '7 phone cc');
assert(form.phone_national === '91234567', '7 phone national');
applyPhoneClean();
assert(drawerBody.scrollTop === 50, '7 phone scroll ' + drawerBody.scrollTop);
assert(rebuilt === 0, '7 phone rebuilt');
form.address = '12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)';
form.address_line1 = '';
form.address_street = '';
form.address_place = '';
form.district = '';
runAddrClean();
assert(!!form.address, '7 addr full');
assert(form.address_street.indexOf('Conduit') !== -1, '7 addr street ' + form.address_street);
applyAddrClean();
assert(drawerBody.scrollTop === 50, '7 addr scroll');
assert(rebuilt === 0, '7 addr rebuilt');
print('ok 7 clean/apply write Full, scroll stays');

print('ok 7 drawer-harden cases');
