import { DISTRICTS, JOB_TYPES, TEAMS } from './config.js?v=3';
import { canPlaceJobOnTeamDay, findCrewNote, isCrewNote, isTeamDayFull } from './team-day.js?v=1';
import { addDays, formatDay, formatTime24, formatWeekLabel, jobTypeOf, mondayOf, mondayOfMonth, monthKey, normalizeLunch, pad, parseISO, shortTime, weekDays, workWeekDays } from './utils.js';
import { allJobs, applyCleanPhones, applyCleanTimes, applySeptemberFixes, applySeptemberLoad, getJob, listContactsForPhoneClean, listJobsForTimeClean, placeJobInSlot, redo, removeJob, setTeamDayFull, setTeamDayHighlight, setTeamDayLunch, setTeamDayMembers, setTeamDaySlots, subscribe, initStore, undo, updateJob, usingFirestore } from './store.js?v=8';
import { startScheduleAuth } from './auth.js';
import { daySlotsOf, firstEmptySlotIndex, hasTimeConflict, jobsForTeamDay, layoutSlots, slotIndex } from './capacity.js?v=4';
import { clientCardName, pulseRemaining, renderDayBoard, renderWeekBoard, weekDragSlotsHtml } from './board.js?v=22';
import { applyJobDrop, armClickSuppress, beginDrag, capturedDragId, clearCapturedDrag, consumeClickSuppress, jobDropKind, pointerJobUp, pointerMoved, resolveDropId } from './board-drag.js?v=2';
import { closeBooking, newBookingPrefill, openBooking } from './booking.js?v=35';
import { renderJobModal, renderJobsList, renderSearchHits } from './jobs.js?v=2';
import { exportMasterRoster } from './export-roster.js?v=28';
import { allContacts, initContactsStore, subscribeContacts } from './contacts-store.js?v=1';
import { fillContactFilterSelect, importHubspotFile, renderContacts } from './contacts.js?v=3';
import { uniqueContactValues } from './contacts-query.js?v=1';
import { isSundayDate, readJobLink } from './contact-jobs.js?v=1';
import { moveTeam, visibleTeamOrder } from './team-order.js?v=1';
import { initSettingsStore, subscribeSettings, teamOrder, writeTeamOrder } from './settings-store.js?v=2';
import {
  markSeptemberLoadDone,
  planSeptemberLines,
  planSeptemberLoad,
  readSeptemberLoadDone,
  septemberLoadDone,
  validateSeptemberGlance,
} from './september-load.js?v=1';
import {
  markTimesCleanedDone,
  planCleanTimes,
  planCleanTimesLines,
  readTimesCleanedDone,
  timesCleanedDone,
} from './clean-times.js?v=1';
import {
  planCheckSeptember,
  planCheckSeptemberLines,
} from './september-check.js?v=1';
import {
  markPhonesCleanedDone,
  planCleanPhones,
  planCleanPhonesLines,
  phonesCleanedDone,
  readPhonesCleanedDone,
} from './clean-phones.js?v=1';

function calendarToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = calendarToday();
const OWNER_EMAIL = 'jefflamb1992@gmail.com';
let signedInEmail = '';
let septemberPending = null;
let checkSeptemberPending = null;
let cleanTimesPending = null;
let cleanPhonesPending = null;

function isOwnerUser(email) {
  return String(email || '').toLowerCase().trim() === OWNER_EMAIL;
}

const state = {
  view: 'board',
  mode: 'week',
  monday: mondayOf(TODAY),
  day: TODAY,
  teams: [...TEAMS],
  districts: [],
  types: [],
  query: '',
  focusJobId: '',
  showSunday: false,
  contactQuery: '',
  contactId: '',
  contactAll: false,
  contactStream: '',
  contactTag: '',
  contactLanguage: '',
  contactHasAddress: false,
  contactSort: 'name',
  contactJobsOpen: false,
};

let pendingJobLink = null;
let applyingJobLink = false;

function $(id) {
  return document.getElementById(id);
}

function sundayOfWeek(mondayIso) {
  return addDays(mondayIso, 6);
}

function isSunday(iso) {
  return isSundayDate(iso);
}

function boardDays() {
  return state.showSunday ? weekDays(state.monday) : workWeekDays(state.monday);
}

function visibleDates() {
  return state.mode === 'day' ? [state.day] : boardDays();
}

function sundayJobCount() {
  const sun = sundayOfWeek(state.monday);
  return allJobs().filter((j) => {
    if (isCrewNote(j)) return false;
    if (j.date !== sun) return false;
    if (state.teams.length && !state.teams.includes(j.team_lead)) return false;
    if (state.districts.length && !state.districts.includes(j.district)) return false;
    if (state.types.length && !state.types.includes(jobTypeOf(j))) return false;
    return true;
  }).length;
}

function syncSundayUi() {
  const btn = $('sundayToggle');
  if (btn) {
    btn.classList.toggle('on', state.showSunday);
    btn.setAttribute('aria-pressed', state.showSunday ? 'true' : 'false');
  }
  const cue = $('sundayCue');
  if (!cue) return;
  const n = state.showSunday ? 0 : sundayJobCount();
  if (n > 0) {
    cue.hidden = false;
    cue.textContent = `${n} on Sunday`;
  } else {
    cue.hidden = true;
  }
}

function teamJobs() {
  const dates = new Set(visibleDates());
  return allJobs().filter((j) => (
    !isCrewNote(j)
    && dates.has(j.date)
    && (!state.teams.length || state.teams.includes(j.team_lead))
  ));
}

function filteredJobs() {
  return teamJobs().filter((j) => {
    if (state.districts.length && !state.districts.includes(j.district)) return false;
    if (state.types.length && !state.types.includes(jobTypeOf(j))) return false;
    return true;
  });
}

function visibleBoardTeams() {
  return visibleTeamOrder(teamOrder(), state.teams);
}

function paintBoard() {
  const mount = $('boardMount');
  if (!mount) return;
  const jobs = filteredJobs();
  const rosterJobs = teamJobs();
  const teams = visibleBoardTeams();
  if (state.mode === 'week') {
    renderWeekBoard(mount, { jobs: rosterJobs, chipJobs: jobs, days: boardDays(), teams, lookupJobs: allJobs(), today: TODAY });
  } else {
    renderDayBoard(mount, { jobs: rosterJobs, chipJobs: jobs, date: state.day, teams, lookupJobs: allJobs(), today: TODAY });
  }
}

function paintContacts() {
  if (state.view !== 'contacts') return;
  syncContactFilters();
  const picked = renderContacts($('contactsMount'), {
    query: state.contactQuery,
    selectedId: state.contactId,
    all: state.contactAll,
    stream: state.contactStream,
    tag: state.contactTag,
    language: state.contactLanguage,
    hasAddress: state.contactHasAddress,
    sort: state.contactSort,
    jobs: allJobs(),
    jobsOpen: state.contactJobsOpen,
  });
  if (picked && picked.hubspot_id) state.contactId = picked.hubspot_id;
}

function paint() {
  const label = $('weekLabel');
  const mount = $('boardMount');
  if (!label || !mount) return;
  const jobs = filteredJobs();
  label.textContent = state.mode === 'day'
    ? formatDay(state.day, { weekday: 'short', year: 'numeric' })
    : formatWeekLabel(state.monday, state.showSunday);
  $('prevWeek').setAttribute('aria-label', state.mode === 'day' ? 'Previous day' : 'Previous week');
  $('nextWeek').setAttribute('aria-label', state.mode === 'day' ? 'Next day' : 'Next week');
  const monthSel = $('monthSelect');
  if (monthSel) monthSel.value = monthKey(state.mode === 'day' ? state.day : state.monday);
  $('viewBoard').hidden = state.view !== 'board';
  $('viewJobs').hidden = state.view !== 'jobs';
  if ($('viewContacts')) $('viewContacts').hidden = state.view !== 'contacts';
  const root = $('appRoot');
  if (root) root.dataset.view = state.view;
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('on', el.dataset.nav === state.view);
  });
  document.querySelectorAll('[data-mode]').forEach((el) => {
    el.classList.toggle('on', el.dataset.mode === state.mode);
  });

  if (state.view === 'board') {
    paintBoard();
  } else if (state.view === 'jobs') {
    renderJobsList($('jobsMount'), jobs, state.query);
  } else if (state.view === 'contacts') {
    paintContacts();
  }
  syncFilterUi();
  syncSundayUi();
  focusJobOnBoard();
  schedulePulseClear();
  consumePendingJobLink();
}

function stripJobLink() {
  if (typeof history === 'undefined' || typeof history.replaceState !== 'function') return;
  if (typeof window === 'undefined' || !window.location) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('date') && !url.searchParams.has('job')) return;
    url.searchParams.delete('date');
    url.searchParams.delete('job');
    const next = url.pathname + url.search + url.hash;
    history.replaceState({}, '', next);
  } catch (err) {}
}

function consumePendingJobLink() {
  if (!pendingJobLink || applyingJobLink) return;
  const job = getJob(pendingJobLink.jobId);
  if (!job || isCrewNote(job)) return;
  applyingJobLink = true;
  pendingJobLink = null;
  stripJobLink();
  state.view = 'board';
  state.mode = 'week';
  state.monday = mondayOf(job.date);
  state.day = job.date;
  if (isSunday(job.date)) state.showSunday = true;
  state.focusJobId = job.job_id;
  paint();
  openBooking(job);
  focusJobOnBoard();
  applyingJobLink = false;
}

function schedulePulseClear() {
  clearTimeout(schedulePulseClear._t);
  let next = Infinity;
  for (const job of allJobs()) {
    const remain = pulseRemaining(job);
    if (remain > 0 && remain < next) next = remain;
  }
  if (next < Infinity) {
    schedulePulseClear._t = setTimeout(() => paint(), next + 40);
  }
}

function focusJobOnBoard() {
  if (!state.focusJobId || state.view !== 'board') return;
  const el = document.querySelector(`#boardMount [data-job="${CSS.escape(state.focusJobId)}"]`);
  if (!el) return;
  el.classList.add('is-focus');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function goToJob(job) {
  if (!job) return;
  state.view = 'board';
  state.mode = 'week';
  state.monday = mondayOf(job.date);
  state.day = job.date;
  if (isSunday(job.date)) state.showSunday = true;
  state.focusJobId = job.job_id;
  hideSearchHits();
  paint();
  renderJobModal($('modalRoot'), null);
  openBooking(job);
}

function hideSearchHits() {
  const box = $('searchHits');
  if (!box) return;
  box.hidden = true;
}

function fillMonthSelect() {
  const sel = $('monthSelect');
  if (!sel) return;
  sel.value = monthKey(state.mode === 'day' ? state.day : state.monday);
}

function startVanEdit(btn) {
  const date = btn.dataset.editVan;
  const team = btn.dataset.editVanTeam;
  const current = btn.dataset.vanValue || '';
  if (!date || !team) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-van-input';
  input.value = current;
  input.setAttribute('aria-label', 'Who is on the van');
  btn.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      const next = input.value.trim();
      if (next !== current) {
        setTeamDayMembers(date, team, next);
        toast(next ? `Van: ${next}` : 'Van cleared');
        return;
      }
    }
    paint();
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('mousedown', (e) => e.stopPropagation());
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

function startLunchEdit(btn) {
  const date = btn.dataset.editLunch;
  const team = btn.dataset.editLunchTeam;
  const current = btn.dataset.lunchValue || '';
  if (!date || !team) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-lunch-input';
  input.value = current;
  input.placeholder = '14:00';
  input.setAttribute('aria-label', 'Lunch start');
  btn.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      const next = normalizeLunch(input.value);
      if (next !== current) {
        setTeamDayLunch(date, team, next);
        toast(next ? `Lunch ${next}` : 'Lunch cleared');
        return;
      }
    }
    paint();
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('mousedown', (e) => e.stopPropagation());
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

function bindBoardClicks() {
  $('boardMount').addEventListener('click', (e) => {
    if (consumeClickSuppress()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const markVan = e.target.closest('[data-mark-van]');
    if (markVan) {
      e.preventDefault();
      e.stopPropagation();
      const on = markVan.getAttribute('aria-pressed') !== 'true';
      setTeamDayHighlight(markVan.dataset.markVan, markVan.dataset.markVanTeam, on);
      paint();
      return;
    }
    const dayFull = e.target.closest('[data-day-full]');
    if (dayFull) {
      e.preventDefault();
      e.stopPropagation();
      const on = dayFull.getAttribute('aria-pressed') !== 'true';
      setTeamDayFull(dayFull.dataset.dayFull, dayFull.dataset.dayFullTeam, on);
      paint();
      return;
    }
    const addSlot = e.target.closest('[data-add-slot]');
    if (addSlot) {
      e.preventDefault();
      e.stopPropagation();
      const n = Number(addSlot.dataset.addSlotCount) || 6;
      setTeamDaySlots(addSlot.dataset.addSlot, addSlot.dataset.addSlotTeam, n + 1);
      paint();
      return;
    }
    const removeSlot = e.target.closest('[data-remove-slot]');
    if (removeSlot) {
      e.preventDefault();
      e.stopPropagation();
      if (removeSlot.disabled) return;
      const n = Number(removeSlot.dataset.removeSlotCount) || 6;
      const floor = Number(removeSlot.dataset.removeSlotFloor) || 6;
      setTeamDaySlots(removeSlot.dataset.removeSlot, removeSlot.dataset.removeSlotTeam, Math.max(floor, n - 1));
      paint();
      return;
    }
    const emptySlot = e.target.closest('[data-empty-slot]');
    if (emptySlot) {
      e.preventDefault();
      e.stopPropagation();
      if (emptySlot.classList.contains('is-locked')) return;
      const date = emptySlot.dataset.bookDate;
      const team = emptySlot.dataset.bookTeam;
      if (date && team && isTeamDayFull(allJobs(), date, team)) return;
      const slot = Number(emptySlot.dataset.slot);
      if (date && team) openBooking({ date, team_lead: team, stack_order: Number.isFinite(slot) ? slot : undefined });
      return;
    }
    if (e.target.closest('[data-lunch-bar]')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const lunchEdit = e.target.closest('[data-edit-lunch]');
    if (lunchEdit) {
      e.preventDefault();
      e.stopPropagation();
      startLunchEdit(lunchEdit);
      return;
    }
    const van = e.target.closest('[data-edit-van]');
    if (van) {
      e.preventDefault();
      e.stopPropagation();
      startVanEdit(van);
      return;
    }
    const chip = e.target.closest('[data-job]');
    if (chip) {
      const job = getJob(chip.dataset.job);
      if (job) openBooking(job);
      return;
    }
    const dayHead = e.target.closest('[data-open-day]');
    if (dayHead) {
      state.mode = 'day';
      state.day = dayHead.dataset.openDay;
      state.monday = mondayOf(state.day);
      paint();
      return;
    }
    if (e.target.closest('.cell-status') && !e.target.closest('[data-day-full]')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const add = e.target.closest('[data-book-date][data-book-team]');
    const cell = e.target.closest('[data-date][data-team]');
    const date = add?.dataset.bookDate || cell?.dataset.date;
    const team = add?.dataset.bookTeam || cell?.dataset.team;
    if (!date || !team) return;
    if (isTeamDayFull(allJobs(), date, team)) return;
    const slotRaw = add && add.dataset.slot;
    const slot = Number(slotRaw);
    openBooking({
      date,
      team_lead: team,
      stack_order: Number.isFinite(slot) ? slot : firstEmptySlotIndex(allJobs(), date, team),
    });
  });
}

let dragJobId = '';
let dragKind = '';
let dragLunchFrom = null;
let dropHint = null;
let clearCaptureTimer = 0;

function hideWeekDropSlots() {
  document.querySelectorAll('#boardMount [data-week-drop-stack]').forEach((el) => el.remove());
}

function showWeekDropSlots() {
  hideWeekDropSlots();
  document.querySelectorAll('#boardMount .week-cell:not(.is-full)').forEach((cell) => {
    const chips = cell.querySelector('.job-chips');
    if (!chips) return;
    const html = weekDragSlotsHtml(allJobs(), cell.dataset.date, cell.dataset.team);
    if (!html) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('data-week-drop-stack', '1');
    wrap.innerHTML = html;
    chips.appendChild(wrap);
  });
}

function clearDropTargets() {
  hideWeekDropSlots();
  document.querySelectorAll('#boardMount .drop-ok, #boardMount .is-dragging, #boardMount .drop-before, #boardMount .drop-after').forEach((el) => {
    el.classList.remove('drop-ok', 'is-dragging', 'drop-before', 'drop-after');
  });
  dropHint = null;
}

function highlightDropTarget(el) {
  document.querySelectorAll('#boardMount .drop-ok').forEach((node) => {
    if (node !== el) node.classList.remove('drop-ok');
  });
  if (el) el.classList.add('drop-ok');
}

function pointerDropEl(e) {
  const empty = e.target.closest('[data-empty-slot]');
  if (empty) return empty;
  return e.target.closest('[data-job]');
}

function slotFromPoint(e, date, team, exceptId) {
  const emptyOver = e.target.closest('[data-empty-slot]');
  if (emptyOver) {
    const n = Number(emptyOver.dataset.slot);
    if (Number.isFinite(n)) return n;
  }
  const overJob = e.target.closest('[data-job]');
  if (overJob && overJob.dataset.job !== exceptId) {
    const i = slotIndex(getJob(overJob.dataset.job));
    if (i != null) return i;
  }
  return firstEmptySlotIndex(allJobs(), date, team, exceptId);
}

function laidSlotsFor(date, team) {
  const jobs = jobsForTeamDay(allJobs(), date, team);
  return layoutSlots(jobs, daySlotsOf(findCrewNote(allJobs(), date, team)));
}

function lunchTimeFromJob(job) {
  return normalizeLunch(job && job.time) || formatTime24(job && job.time) || '13:00';
}

function lunchTimeForEmptySlot(date, team, slot) {
  const laid = laidSlotsFor(date, team);
  let prev = null;
  const max = Number.isFinite(slot) ? slot : laid.length;
  for (let i = 0; i < max; i += 1) {
    if (laid[i]) prev = laid[i];
  }
  if (!prev) return '13:00';
  return lunchTimeFromJob(prev);
}

function placeLunch(date, team, time, slot) {
  const source = dragLunchFrom;
  setTeamDayLunch(date, team, time, slot);
  if (source && (source.date !== date || source.team !== team)) {
    setTeamDayLunch(source.date, source.team, '');
  }
  toast(`Lunch ${time}`);
}

function bindBoardDrag() {
  const mount = $('boardMount');
  const blank = $('blankAppt');
  if (blank) {
    blank.addEventListener('dragstart', (e) => {
      dragKind = 'job';
      dragJobId = beginDrag('new-appointment');
      dragLunchFrom = null;
      blank.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', 'new-appointment');
      e.dataTransfer.effectAllowed = 'copy';
      showWeekDropSlots();
    });
    blank.addEventListener('dragend', () => {
      armClickSuppress(300);
      blank.classList.remove('is-dragging');
      clearDropTargets();
      scheduleClearCapture();
    });
  }
  mount.addEventListener('dragstart', (e) => {
    const lunch = e.target.closest('[data-lunch-card]');
    if (lunch) {
      const cell = lunch.closest('[data-date][data-team]');
      dragKind = 'lunch';
      dragJobId = beginDrag('lunch');
      dragLunchFrom = cell ? { date: cell.dataset.date, team: cell.dataset.team } : null;
      lunch.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', 'lunch');
      e.dataTransfer.effectAllowed = 'move';
      showWeekDropSlots();
      return;
    }
    if (e.target.closest('[data-job]')) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
  });
  mount.addEventListener('dragend', () => {
    armClickSuppress(300);
    clearDropTargets();
    scheduleClearCapture();
  });
  mount.addEventListener('dragover', (e) => {
    const cell = e.target.closest('[data-date][data-team]');
    if (!cell || !dragJobId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragJobId === 'new-appointment' ? 'copy' : 'move';
    const over = pointerDropEl(e);
    highlightDropTarget(over);
    if (dragKind === 'lunch') {
      const emptyOver = e.target.closest('[data-empty-slot]');
      const jobOver = e.target.closest('[data-job]');
      const emptySlot = emptyOver ? Number(emptyOver.dataset.slot) : NaN;
      dropHint = {
        kind: 'lunch',
        jobId: jobOver ? jobOver.dataset.job : '',
        slot: Number.isFinite(emptySlot) ? emptySlot : null,
      };
      return;
    }
    const job = dragJobId === 'new-appointment' ? null : getJob(dragJobId);
    const sameStack = job && job.date === cell.dataset.date && job.team_lead === cell.dataset.team;
    dropHint = { slot: slotFromPoint(e, cell.dataset.date, cell.dataset.team, sameStack ? dragJobId : null) };
  });
  mount.addEventListener('drop', (e) => {
    const cell = e.target.closest('[data-date][data-team]');
    const id = resolveDropId(e.dataTransfer && e.dataTransfer.getData('text/plain'), capturedDragId() || dragJobId);
    const kind = dragKind || (id === 'lunch' ? 'lunch' : 'job');
    const hint = dropHint;
    armClickSuppress(300);
    clearDropTargets();
    $('blankAppt')?.classList.remove('is-dragging');
    e.preventDefault();
    e.stopPropagation();
    if (!cell || !id) {
      dragLunchFrom = null;
      finishDropCapture();
      return;
    }
    const date = cell.dataset.date;
    const team = cell.dataset.team;
    if (!date || !team) {
      dragLunchFrom = null;
      finishDropCapture();
      return;
    }
    if (kind === 'lunch' || id === 'lunch') {
      const overJob = hint && hint.jobId ? getJob(hint.jobId) : getJob(e.target.closest('[data-job]')?.dataset.job);
      if (overJob) {
        placeLunch(date, team, lunchTimeFromJob(overJob), null);
      } else {
        const slot = hint && Number.isFinite(hint.slot)
          ? hint.slot
          : Number(e.target.closest('[data-empty-slot]')?.dataset.slot);
        const time = lunchTimeForEmptySlot(date, team, slot);
        placeLunch(date, team, time, Number.isFinite(slot) ? slot : null);
      }
      dragLunchFrom = null;
      finishDropCapture();
      return;
    }
    dragLunchFrom = null;
    const existing = id === 'new-appointment' ? null : getJob(id);
    if (!canPlaceJobOnTeamDay(allJobs(), date, team, existing)) {
      finishDropCapture();
      return;
    }
    const slot = hint && Number.isFinite(hint.slot)
      ? hint.slot
      : firstEmptySlotIndex(allJobs(), date, team, id === 'new-appointment' ? null : id);
    const result = applyJobDrop(id, {
      date,
      team,
      slot,
      placeJobInSlot,
      openBooking,
      getJob,
      toast(msg) { toast(msg); },
    });
    if (result === 'move') {
      state.monday = mondayOf(date);
      state.day = date;
      state.focusJobId = id;
      const moved = getJob(id);
      if (moved && hasTimeConflict(moved, allJobs())) {
        toast(`Moved — time conflict at ${shortTime(moved)}`);
      } else if (moved) {
        toast(`Moved to ${moved.team_lead} · ${formatDay(moved.date)}`);
      } else {
        toast('Moved');
      }
    }
    finishDropCapture();
  });
}

function bindBoardPointer() {
  const mount = $('boardMount');
  if (!mount) return;
  let ptrEl = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;

  function underPoint(e) {
    if (typeof document.elementFromPoint !== 'function') return e.target;
    return document.elementFromPoint(e.clientX, e.clientY) || e.target;
  }

  function resetPtr() {
    ptrEl = null;
    dragging = false;
    startX = 0;
    startY = 0;
  }

  mount.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('[data-lunch-card], [data-lunch-bar]')) return;
    const chip = e.target.closest('[data-job]');
    if (!chip || !chip.dataset.job) return;
    beginDrag(chip.dataset.job);
    dragKind = 'job';
    dragJobId = chip.dataset.job;
    dragLunchFrom = null;
    ptrEl = chip;
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;
    if (typeof chip.setPointerCapture === 'function') chip.setPointerCapture(e.pointerId);
  });

  mount.addEventListener('pointermove', (e) => {
    const id = capturedDragId();
    if (!id || jobDropKind(id) !== 'job') return;
    if (!dragging) {
      if (!pointerMoved(e.clientX - startX, e.clientY - startY)) return;
      dragging = true;
      if (ptrEl) ptrEl.classList.add('is-dragging');
      showWeekDropSlots();
    }
    e.preventDefault();
    const under = underPoint(e);
    const cell = under && under.closest && under.closest('[data-date][data-team]');
    if (!cell) {
      highlightDropTarget(null);
      return;
    }
    const fake = { target: under };
    highlightDropTarget(pointerDropEl(fake));
    const job = getJob(id);
    const sameStack = job && job.date === cell.dataset.date && job.team_lead === cell.dataset.team;
    dropHint = { slot: slotFromPoint(fake, cell.dataset.date, cell.dataset.team, sameStack ? id : null) };
  });

  function finishPointer(e) {
    const id = capturedDragId();
    if (!id || jobDropKind(id) !== 'job') {
      resetPtr();
      return;
    }
    const moved = dragging;
    const under = underPoint(e);
    const cell = under && under.closest && under.closest('[data-date][data-team]');
    const overJob = under && under.closest && under.closest('[data-job]');
    const date = cell && cell.dataset.date;
    const team = cell && cell.dataset.team;
    const fake = { target: under || e.target };
    const job = getJob(id);
    const sameStack = job && date && team && job.date === date && job.team_lead === team;
    const slot = date && team
      ? (dropHint && Number.isFinite(dropHint.slot)
        ? dropHint.slot
        : slotFromPoint(fake, date, team, sameStack ? id : null))
      : undefined;
    if (ptrEl) ptrEl.classList.remove('is-dragging');
    clearDropTargets();
    if (moved && date && team) {
      const existing = getJob(id);
      if (!canPlaceJobOnTeamDay(allJobs(), date, team, existing)) {
        armClickSuppress(300);
        finishDropCapture();
        resetPtr();
        return;
      }
    }
    const result = pointerJobUp({
      moved,
      capturedId: id,
      overJobId: overJob && overJob.dataset.job,
      overDate: date,
      overTeam: team,
      slot,
      placeJobInSlot,
      openBooking,
      getJob,
    });
    if (result === 'move') {
      state.monday = mondayOf(date);
      state.day = date;
      state.focusJobId = id;
      const movedJob = getJob(id);
      if (movedJob && hasTimeConflict(movedJob, allJobs())) {
        toast(`Moved — time conflict at ${shortTime(movedJob)}`);
      } else if (movedJob) {
        toast(`Moved to ${movedJob.team_lead} · ${formatDay(movedJob.date)}`);
      } else {
        toast('Moved');
      }
    }
    if (result === 'move' || result === 'open-job') armClickSuppress(300);
    finishDropCapture();
    resetPtr();
  }

  mount.addEventListener('pointerup', finishPointer);
  mount.addEventListener('pointercancel', () => {
    if (ptrEl) ptrEl.classList.remove('is-dragging');
    clearDropTargets();
    finishDropCapture();
    resetPtr();
  });
}

function scheduleClearCapture() {
  if (clearCaptureTimer) clearTimeout(clearCaptureTimer);
  clearCaptureTimer = setTimeout(() => {
    dragJobId = '';
    dragKind = '';
    dragLunchFrom = null;
    clearCapturedDrag();
    clearCaptureTimer = 0;
  }, 400);
}

function finishDropCapture() {
  if (clearCaptureTimer) {
    clearTimeout(clearCaptureTimer);
    clearCaptureTimer = 0;
  }
  dragJobId = '';
  dragKind = '';
  clearCapturedDrag();
}

function closeFilterMenus(except) {
  document.querySelectorAll('.filter-dd').forEach((dd) => {
    if (dd === except) return;
    const btn = dd.querySelector('.filter-dd-btn');
    const menu = dd.querySelector('.filter-dd-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  });
}

function closeDatePanel() {
  const panel = $('datePanel');
  const btn = $('weekLabel');
  if (panel) panel.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function closeUserMenu() {
  const menu = $('userMenu');
  const btn = $('userMenuBtn');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function closeSettingsPanel() {
  const root = $('settingsRoot');
  if (root) {
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
  }
}

function paintSeptemberLoad() {
  const block = $('septemberLoadBlock');
  if (!block) return;
  const show = isOwnerUser(signedInEmail) && !septemberLoadDone();
  block.hidden = !show;
  const applyBtn = $('applySeptemberBtn');
  const planEl = $('septemberLoadPlan');
  if (!show || !septemberPending) {
    if (applyBtn) applyBtn.hidden = true;
    if (planEl) {
      planEl.hidden = true;
      planEl.textContent = '';
    }
    if (!show) septemberPending = null;
    return;
  }
  if (planEl) {
    planEl.hidden = false;
    planEl.textContent = planSeptemberLines(septemberPending.plan).join('\n');
  }
  if (applyBtn) applyBtn.hidden = false;
}

function paintCheckSeptember() {
  const block = $('checkSeptemberBlock');
  if (!block) return;
  const show = isOwnerUser(signedInEmail);
  block.hidden = !show;
  const applyBtn = $('fixSeptemberBtn');
  const planEl = $('checkSeptemberPlan');
  if (!show || !checkSeptemberPending) {
    if (applyBtn) applyBtn.hidden = true;
    if (planEl) {
      planEl.hidden = true;
      planEl.textContent = '';
    }
    if (!show) checkSeptemberPending = null;
    return;
  }
  if (planEl) {
    planEl.hidden = false;
    planEl.textContent = planCheckSeptemberLines(checkSeptemberPending).join('\n');
  }
  if (applyBtn) applyBtn.hidden = !(checkSeptemberPending.mismatchCount > 0);
}

function paintCleanTimes() {
  const block = $('cleanTimesBlock');
  if (!block) return;
  const show = isOwnerUser(signedInEmail) && !timesCleanedDone();
  block.hidden = !show;
  const applyBtn = $('applyCleanTimesBtn');
  const planEl = $('cleanTimesPlan');
  if (!show || !cleanTimesPending) {
    if (applyBtn) applyBtn.hidden = true;
    if (planEl) {
      planEl.hidden = true;
      planEl.textContent = '';
    }
    if (!show) cleanTimesPending = null;
    return;
  }
  if (planEl) {
    planEl.hidden = false;
    planEl.textContent = planCleanTimesLines(cleanTimesPending).join('\n');
  }
  if (applyBtn) applyBtn.hidden = false;
}

function paintCleanPhones() {
  const block = $('cleanPhonesBlock');
  if (!block) return;
  const show = isOwnerUser(signedInEmail) && !phonesCleanedDone();
  block.hidden = !show;
  const applyBtn = $('applyCleanPhonesBtn');
  const planEl = $('cleanPhonesPlan');
  if (!show || !cleanPhonesPending) {
    if (applyBtn) applyBtn.hidden = true;
    if (planEl) {
      planEl.hidden = true;
      planEl.textContent = '';
    }
    if (!show) cleanPhonesPending = null;
    return;
  }
  if (planEl) {
    planEl.hidden = false;
    planEl.textContent = planCleanPhonesLines(cleanPhonesPending).join('\n');
  }
  if (applyBtn) applyBtn.hidden = false;
}

function paintSettingsPanel() {
  const list = $('teamOrderList');
  if (!list) return;
  const order = teamOrder();
  list.innerHTML = order.map((name, i) => (
    `<div class="team-order-row">`
    + `<span class="team-order-name">${name}</span>`
    + `<button type="button" class="ghost-btn" data-move="-1" data-team="${name}"${i === 0 ? ' disabled' : ''} aria-label="Move ${name} up">Up</button>`
    + `<button type="button" class="ghost-btn" data-move="1" data-team="${name}"${i === order.length - 1 ? ' disabled' : ''} aria-label="Move ${name} down">Down</button>`
    + `</div>`
  )).join('');
  paintSeptemberLoad();
  paintCheckSeptember();
  paintCleanTimes();
  paintCleanPhones();
}

function openSettingsPanel() {
  closeFilterMenus();
  closeDatePanel();
  closeUserMenu();
  paintSettingsPanel();
  const root = $('settingsRoot');
  if (root) {
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
  }
}

function toggleDatePanel() {
  const panel = $('datePanel');
  const btn = $('weekLabel');
  if (!panel || !btn) return;
  const open = panel.hidden;
  closeFilterMenus();
  closeUserMenu();
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleUserMenu() {
  const menu = $('userMenu');
  const btn = $('userMenuBtn');
  if (!menu || !btn) return;
  const open = menu.hidden;
  closeFilterMenus();
  closeDatePanel();
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function filterButtonLabel(singular, plural, selected, total, emptyMeansAll) {
  const n = selected.length;
  const allOn = emptyMeansAll ? n === 0 : n === total;
  return allOn ? `All ${plural}` : `${singular} · ${n}`;
}

function paintTeamFilterMenu() {
  const menu = $('teamFilterMenu');
  if (!menu) return;
  const order = teamOrder();
  const key = order.join('|');
  if (menu.dataset.order === key) return;
  menu.dataset.order = key;
  menu.innerHTML = order.map((t) => `<label><input type="checkbox" value="${t}"> ${t}</label>`).join('');
}

function syncFilterUi() {
  paintTeamFilterMenu();
  const teamBtn = $('teamFilterBtn');
  if (teamBtn) {
    const vis = visibleBoardTeams();
    const total = teamOrder().length;
    teamBtn.textContent = filterButtonLabel('Team', 'teams', vis, total, false);
    teamBtn.classList.toggle('is-subset', vis.length !== total);
  }
  const distBtn = $('districtFilterBtn');
  if (distBtn) {
    distBtn.textContent = filterButtonLabel('Area', 'areas', state.districts, Object.keys(DISTRICTS).length, true);
    distBtn.classList.toggle('is-subset', state.districts.length > 0);
  }
  const typeBtn = $('typeFilterBtn');
  if (typeBtn) {
    typeBtn.textContent = filterButtonLabel('Type', 'types', state.types, JOB_TYPES.length, true);
    typeBtn.classList.toggle('is-subset', state.types.length > 0);
  }
  document.querySelectorAll('#teamFilterMenu input[type="checkbox"]').forEach((el) => {
    el.checked = state.teams.includes(el.value);
  });
  document.querySelectorAll('#districtFilterMenu input[type="checkbox"]').forEach((el) => {
    el.checked = state.districts.includes(el.value);
  });
  document.querySelectorAll('#typeFilterMenu input[type="checkbox"]').forEach((el) => {
    el.checked = state.types.includes(el.value);
  });
}

function bindFilterDropdown(btnId, menuId, html) {
  const btn = $(btnId);
  const menu = $(menuId);
  if (!btn || !menu) return null;
  menu.innerHTML = html;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = btn.getAttribute('aria-expanded') === 'true';
    closeFilterMenus();
    if (!open) {
      btn.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
    }
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
  return menu;
}

function bindFilters() {
  const teamMenu = bindFilterDropdown(
    'teamFilterBtn',
    'teamFilterMenu',
    teamOrder().map((t) => `<label><input type="checkbox" value="${t}" checked> ${t}</label>`).join(''),
  );
  if (teamMenu) {
    teamMenu.dataset.order = teamOrder().join('|');
    teamMenu.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const t = input.value;
      if (input.checked) {
        if (!state.teams.includes(t)) state.teams = [...state.teams, t];
      } else {
        if (visibleBoardTeams().length <= 1) {
          input.checked = true;
          return;
        }
        state.teams = state.teams.filter((x) => x !== t);
      }
      paint();
    });
  }

  const distMenu = bindFilterDropdown(
    'districtFilterBtn',
    'districtFilterMenu',
    Object.keys(DISTRICTS).map((d) => `<label><input type="checkbox" value="${d}"> ${d}</label>`).join(''),
  );
  if (distMenu) {
    distMenu.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const d = input.value;
      state.districts = input.checked
        ? (state.districts.includes(d) ? state.districts : [...state.districts, d])
        : state.districts.filter((x) => x !== d);
      paint();
    });
  }

  const typeMenu = bindFilterDropdown(
    'typeFilterBtn',
    'typeFilterMenu',
    JOB_TYPES.map((t) => `<label><input type="checkbox" value="${t.id}"> ${t.label}</label>`).join(''),
  );
  if (typeMenu) {
    typeMenu.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const t = input.value;
      state.types = input.checked
        ? (state.types.includes(t) ? state.types : [...state.types, t])
        : state.types.filter((x) => x !== t);
      paint();
    });
  }

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.filter-dd')) closeFilterMenus();
    if (!e.target.closest('.date-cluster')) closeDatePanel();
    if (!e.target.closest('.auth-slot')) closeUserMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeFilterMenus();
    closeDatePanel();
    closeUserMenu();
    closeSettingsPanel();
  });
  syncFilterUi();
}

function syncContactFilters() {
  const list = allContacts();
  fillContactFilterSelect($('contactsStream'), uniqueContactValues(list, 'stream'), state.contactStream, 'Stream');
  fillContactFilterSelect($('contactsTag'), uniqueContactValues(list, 'tag'), state.contactTag, 'Tag');
  fillContactFilterSelect($('contactsLanguage'), uniqueContactValues(list, 'language'), state.contactLanguage, 'Language');
  const allBtn = $('contactsAllBtn');
  if (allBtn) {
    allBtn.classList.toggle('on', state.contactAll);
    allBtn.setAttribute('aria-pressed', state.contactAll ? 'true' : 'false');
  }
  const hasAddr = $('contactsHasAddress');
  if (hasAddr) hasAddr.checked = state.contactHasAddress;
  const sortSel = $('contactsSort');
  if (sortSel && sortSel.value !== state.contactSort) sortSel.value = state.contactSort;
}

function bindChrome() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      state.view = el.dataset.nav;
      if (state.view === 'jobs') $('globalSearch')?.focus();
      if (state.view === 'contacts') $('contactsSearch')?.focus();
      paint();
    });
  });
  document.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      state.mode = el.dataset.mode;
      if (state.mode === 'day') {
        const days = boardDays();
        state.day = days.includes(TODAY) ? TODAY : state.monday;
      }
      paint();
    });
  });
  const weekLabel = $('weekLabel');
  if (weekLabel) {
    weekLabel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDatePanel();
    });
  }
  const userMenuBtn = $('userMenuBtn');
  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserMenu();
    });
  }
  $('prevWeek').addEventListener('click', () => {
    if (state.mode === 'day') {
      state.day = addDays(state.day, -1);
      state.monday = mondayOf(state.day);
    } else {
      state.monday = addDays(state.monday, -7);
      state.day = state.monday;
    }
    paint();
  });
  $('nextWeek').addEventListener('click', () => {
    if (state.mode === 'day') {
      state.day = addDays(state.day, 1);
      state.monday = mondayOf(state.day);
    } else {
      state.monday = addDays(state.monday, 7);
      state.day = state.monday;
    }
    paint();
  });
  $('thisWeek').addEventListener('click', () => {
    state.monday = mondayOf(TODAY);
    state.day = TODAY;
    paint();
  });
  $('monthSelect').addEventListener('change', (e) => {
    const value = e.target.value;
    if (!value) return;
    if (state.mode === 'day') {
      state.day = value + '-01';
      state.monday = mondayOf(state.day);
    } else {
      state.monday = mondayOfMonth(value);
      state.day = state.monday;
    }
    state.focusJobId = '';
    paint();
  });
  $('newBooking').addEventListener('click', () => {
    const date = state.mode === 'day' ? state.day : TODAY;
    const boardTeams = visibleBoardTeams();
    openBooking(newBookingPrefill({ date, boardTeams: boardTeams.length ? boardTeams : teamOrder() }));
  });
  const sundayBtn = $('sundayToggle');
  if (sundayBtn) {
    sundayBtn.addEventListener('click', () => {
      state.showSunday = !state.showSunday;
      paint();
    });
  }
  const sundayCue = $('sundayCue');
  if (sundayCue) {
    sundayCue.addEventListener('click', () => {
      state.showSunday = true;
      paint();
    });
  }
  bindSearch();
  $('modalRoot').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit-job]');
    if (edit) {
      const job = getJob(edit.dataset.editJob);
      renderJobModal($('modalRoot'), null);
      if (job) openBooking(job);
      return;
    }
    const cancel = e.target.closest('[data-cancel-job]');
    if (cancel) {
      const job = getJob(cancel.dataset.cancelJob);
      if (job && confirm('Remove this job from the roster?')) {
        removeJob(job.job_id);
        renderJobModal($('modalRoot'), null);
        paint();
        toast(`Cancelled ${job.client_name}`);
      }
      return;
    }
    if (e.target.closest('[data-close-modal]')) renderJobModal($('modalRoot'), null);
  });
  $('jobsMount').addEventListener('click', (e) => {
    const row = e.target.closest('[data-job]');
    if (row) {
      const job = getJob(row.dataset.job);
      if (job) openBooking(job);
    }
  });
  const contactsMount = $('contactsMount');
  if (contactsMount) {
    contactsMount.addEventListener('toggle', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('contact-jobs')) {
        state.contactJobsOpen = !!e.target.open;
      }
    }, true);
    contactsMount.addEventListener('click', (e) => {
      if (e.target.closest('a.contact-job')) {
        e.stopPropagation();
        return;
      }
      if (e.target.closest('details.contact-jobs')) {
        e.stopPropagation();
        return;
      }
      const copy = e.target.closest('[data-copy-phone]');
      if (copy) {
        e.preventDefault();
        e.stopPropagation();
        const num = copy.dataset.copyPhone || '';
        if (!num) return;
        const done = () => toast('Copied ' + num);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(done).catch(() => window.prompt('Copy phone', num));
        } else {
          window.prompt('Copy phone', num);
        }
        return;
      }
      const row = e.target.closest('[data-contact]');
      if (!row) return;
      state.contactId = row.dataset.contact;
      state.contactJobsOpen = false;
      paint();
    });
  }
  const contactsSearch = $('contactsSearch');
  if (contactsSearch) {
    contactsSearch.addEventListener('input', (e) => {
      state.contactQuery = e.target.value;
      paint();
    });
  }
  const allBtn = $('contactsAllBtn');
  if (allBtn) {
    allBtn.addEventListener('click', () => {
      state.contactAll = !state.contactAll;
      paint();
    });
  }
  const streamSel = $('contactsStream');
  if (streamSel) {
    streamSel.addEventListener('change', (e) => {
      state.contactStream = e.target.value;
      paint();
    });
  }
  const tagSel = $('contactsTag');
  if (tagSel) {
    tagSel.addEventListener('change', (e) => {
      state.contactTag = e.target.value;
      paint();
    });
  }
  const langSel = $('contactsLanguage');
  if (langSel) {
    langSel.addEventListener('change', (e) => {
      state.contactLanguage = e.target.value;
      paint();
    });
  }
  const hasAddr = $('contactsHasAddress');
  if (hasAddr) {
    hasAddr.addEventListener('change', (e) => {
      state.contactHasAddress = !!e.target.checked;
      paint();
    });
  }
  const sortSel = $('contactsSort');
  if (sortSel) {
    sortSel.addEventListener('change', (e) => {
      state.contactSort = e.target.value || 'name';
      paint();
    });
  }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'z') {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const result = e.shiftKey ? redo() : undo();
      if (result) toast(historyToast(result));
      return;
    }
    if (e.key === 'Escape') {
      const hits = $('searchHits');
      if (hits && !hits.hidden) {
        hideSearchHits();
        return;
      }
      closeBooking();
      renderJobModal($('modalRoot'), null);
    }
  });
  window.addEventListener('be:booked', (e) => {
    const job = e.detail;
    state.monday = mondayOf(job.date);
    state.day = job.date;
    state.view = 'board';
    state.focusJobId = job.job_id;
    paint();
    toast(`${job.status === 'tentative' ? 'Tentative' : 'Saved'} ${clientCardName(job.client_name)} · ${job.team_lead} · ${job.date}`);
  });
  window.addEventListener('be:changed', () => paint());
  window.addEventListener('be:toast', (e) => toast(e.detail));
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function isTypingTarget(el) {
  const tag = el && el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el && el.isContentEditable);
}

function historyToast(result) {
  const noun = result.kind === 'move' ? 'move'
    : result.kind === 'edit' ? 'edit'
    : result.type === 'remove' ? 'cancel'
    : 'booking';
  return result.action === 'redo' ? `Redid ${noun}` : `Undid ${noun}`;
}

function bindSearch() {
  const input = $('globalSearch');
  const box = $('searchHits');
  if (!input || !box) return;
  input.addEventListener('input', () => {
    state.query = input.value;
    renderSearchHits(box, allJobs().filter((j) => !isCrewNote(j)), state.query);
    if (state.view === 'jobs') paint();
  });
  input.addEventListener('focus', () => {
    renderSearchHits(box, allJobs().filter((j) => !isCrewNote(j)), input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = box.querySelector('[data-jump-job]');
    if (!first) return;
    e.preventDefault();
    goToJob(getJob(first.dataset.jumpJob));
  });
  box.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('[data-jump-job]');
    if (!btn) return;
    e.preventDefault();
    goToJob(getJob(btn.dataset.jumpJob));
  });
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.header-search')) return;
    hideSearchHits();
  });
}

function bindSettingsPanel() {
  const root = $('settingsRoot');
  if (root && !root.dataset.bound) {
    root.dataset.bound = '1';
    root.addEventListener('click', (e) => {
      if (e.target === root) closeSettingsPanel();
    });
    const card = root.querySelector('.settings-card');
    if (card) card.addEventListener('click', (e) => e.stopPropagation());
  }
  const closeBtn = $('settingsClose');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', () => closeSettingsPanel());
  }
  bindSeptemberLoad();
  bindCheckSeptember();
  bindCleanTimes();
  bindCleanPhones();
  const list = $('teamOrderList');
  if (list && !list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-move]');
      if (!btn || btn.disabled) return;
      if (!signedInEmail) {
        toast('Sign in to save team order');
        return;
      }
      const name = btn.dataset.team;
      const delta = Number(btn.dataset.move);
      const current = teamOrder();
      const next = moveTeam(current, name, delta);
      if (next.join('\0') === current.join('\0')) return;
      const buttons = list.querySelectorAll('[data-move]');
      buttons.forEach((el) => { el.disabled = true; });
      try {
        await writeTeamOrder(next);
        paint();
        paintSettingsPanel();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Could not save team order');
        paintSettingsPanel();
      }
    });
  }
}

function bindSeptemberLoad() {
  const loadBtn = $('loadSeptemberBtn');
  const applyBtn = $('applySeptemberBtn');
  const file = $('septemberGlanceFile');
  if (loadBtn && file && !loadBtn.dataset.bound) {
    loadBtn.dataset.bound = '1';
    loadBtn.addEventListener('click', () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can load September');
        return;
      }
      if (septemberLoadDone()) return;
      file.value = '';
      file.click();
    });
    file.addEventListener('change', async () => {
      const picked = file.files && file.files[0];
      file.value = '';
      if (!picked) return;
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can load September');
        return;
      }
      if (!usingFirestore()) {
        toast('Sign in to load September');
        return;
      }
      loadBtn.disabled = true;
      try {
        const text = await picked.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          septemberPending = null;
          toast('That file is not JSON');
          paintSeptemberLoad();
          return;
        }
        const checked = validateSeptemberGlance(data);
        if (!checked.ok) {
          septemberPending = null;
          toast(checked.error);
          paintSeptemberLoad();
          return;
        }
        const plan = planSeptemberLoad(allJobs(), checked.jobs, checked.crew);
        septemberPending = { jobs: checked.jobs, crew: checked.crew, plan };
        paintSeptemberLoad();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Could not read that file');
      } finally {
        loadBtn.disabled = false;
      }
    });
  }
  if (applyBtn && !applyBtn.dataset.bound) {
    applyBtn.dataset.bound = '1';
    applyBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can load September');
        return;
      }
      if (!septemberPending) return;
      applyBtn.disabled = true;
      if (loadBtn) loadBtn.disabled = true;
      try {
        const result = await applySeptemberLoad({
          jobs: septemberPending.jobs,
          crew: septemberPending.crew,
          deleteIds: septemberPending.plan.softDeletes,
        });
        markSeptemberLoadDone();
        septemberPending = null;
        toast(
          'Applied: ' + result.jobUpserts + ' job upserts, '
          + result.crewUpserts + ' crew upserts, '
          + result.softDeleted + ' live September jobs soft-deleted',
        );
        paint();
        paintSettingsPanel();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'September load failed');
      } finally {
        applyBtn.disabled = false;
        if (loadBtn) loadBtn.disabled = false;
      }
    });
  }
}

function bindCheckSeptember() {
  const checkBtn = $('checkSeptemberBtn');
  const applyBtn = $('fixSeptemberBtn');
  const file = $('checkSeptemberFile');
  if (checkBtn && file && !checkBtn.dataset.bound) {
    checkBtn.dataset.bound = '1';
    checkBtn.addEventListener('click', () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can check September');
        return;
      }
      file.value = '';
      file.click();
    });
    file.addEventListener('change', async () => {
      const picked = file.files && file.files[0];
      file.value = '';
      if (!picked) return;
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can check September');
        return;
      }
      if (!usingFirestore()) {
        toast('Sign in to check September');
        return;
      }
      checkBtn.disabled = true;
      try {
        const text = await picked.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          checkSeptemberPending = null;
          toast('That file is not JSON');
          paintCheckSeptember();
          return;
        }
        const checked = validateSeptemberGlance(data);
        if (!checked.ok) {
          checkSeptemberPending = null;
          toast(checked.error);
          paintCheckSeptember();
          return;
        }
        const live = await listJobsForTimeClean();
        checkSeptemberPending = planCheckSeptember(checked.jobs, live);
        paintCheckSeptember();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Could not read that file');
      } finally {
        checkBtn.disabled = false;
      }
    });
  }
  if (applyBtn && !applyBtn.dataset.bound) {
    applyBtn.dataset.bound = '1';
    applyBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can fix September');
        return;
      }
      if (!checkSeptemberPending || !checkSeptemberPending.mismatchCount) return;
      applyBtn.disabled = true;
      if (checkBtn) checkBtn.disabled = true;
      try {
        const result = await applySeptemberFixes(checkSeptemberPending.mismatches);
        checkSeptemberPending = null;
        toast('Fixed ' + result.written + ' September jobs');
        paint();
        paintSettingsPanel();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'September fix failed');
      } finally {
        applyBtn.disabled = false;
        if (checkBtn) checkBtn.disabled = false;
      }
    });
  }
}

function bindCleanTimes() {
  const planBtn = $('planCleanTimesBtn');
  const applyBtn = $('applyCleanTimesBtn');
  if (planBtn && !planBtn.dataset.bound) {
    planBtn.dataset.bound = '1';
    planBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can clean job times');
        return;
      }
      if (timesCleanedDone()) return;
      if (!usingFirestore()) {
        toast('Sign in to clean job times');
        return;
      }
      planBtn.disabled = true;
      try {
        const live = await listJobsForTimeClean();
        const plan = planCleanTimes(live);
        cleanTimesPending = plan;
        paintCleanTimes();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Could not read live jobs');
      } finally {
        planBtn.disabled = false;
      }
    });
  }
  if (applyBtn && !applyBtn.dataset.bound) {
    applyBtn.dataset.bound = '1';
    applyBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can clean job times');
        return;
      }
      if (!cleanTimesPending) return;
      applyBtn.disabled = true;
      if (planBtn) planBtn.disabled = true;
      try {
        const arrows = cleanTimesPending.arrowLogs;
        const result = await applyCleanTimes(cleanTimesPending.updates);
        markTimesCleanedDone();
        cleanTimesPending = null;
        toast(
          'Applied: ' + result.written + ' job times cleaned, '
          + arrows + ' arrows became change-log rows',
        );
        paint();
        paintSettingsPanel();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Time clean failed');
      } finally {
        applyBtn.disabled = false;
        if (planBtn) planBtn.disabled = false;
      }
    });
  }
}

function bindCleanPhones() {
  const planBtn = $('planCleanPhonesBtn');
  const applyBtn = $('applyCleanPhonesBtn');
  if (planBtn && !planBtn.dataset.bound) {
    planBtn.dataset.bound = '1';
    planBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can clean job phones');
        return;
      }
      if (phonesCleanedDone()) return;
      if (!usingFirestore()) {
        toast('Sign in to clean job phones');
        return;
      }
      planBtn.disabled = true;
      try {
        const live = await listJobsForTimeClean();
        const contacts = await listContactsForPhoneClean();
        cleanPhonesPending = planCleanPhones(live, contacts);
        paintCleanPhones();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Could not read live jobs');
      } finally {
        planBtn.disabled = false;
      }
    });
  }
  if (applyBtn && !applyBtn.dataset.bound) {
    applyBtn.dataset.bound = '1';
    applyBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can clean job phones');
        return;
      }
      if (!cleanPhonesPending) return;
      applyBtn.disabled = true;
      if (planBtn) planBtn.disabled = true;
      try {
        const result = await applyCleanPhones(cleanPhonesPending.updates);
        const one = cleanPhonesPending.oneMatches;
        markPhonesCleanedDone();
        cleanPhonesPending = null;
        toast(
          'Applied: ' + result.written + ' job phones updated, '
          + one + ' one-contact matches',
        );
        paint();
        paintSettingsPanel();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Phone clean failed');
      } finally {
        applyBtn.disabled = false;
        if (planBtn) planBtn.disabled = false;
      }
    });
  }
}

function bindOwnerTools() {
  const settingsBtn = $('openSettings');
  const exportBtn = $('exportRoster');
  const importBtn = $('importHubspotCsv');
  const file = $('importHubspotFile');
  const jeff = isOwnerUser(signedInEmail);
  if (settingsBtn) settingsBtn.hidden = !signedInEmail;
  if (exportBtn) exportBtn.hidden = !jeff;
  if (importBtn) importBtn.hidden = !jeff;

  if (settingsBtn && !settingsBtn.dataset.bound) {
    settingsBtn.dataset.bound = '1';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeUserMenu();
      if (!signedInEmail) {
        toast('Sign in to open Settings');
        return;
      }
      openSettingsPanel();
    });
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', async () => {
      closeUserMenu();
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can export the roster');
        return;
      }
      if (!usingFirestore()) {
        toast('Sign in to export the live roster');
        return;
      }
      exportBtn.disabled = true;
      try {
        const result = await exportMasterRoster();
        toast('Exported ' + result.jobs + ' jobs');
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Export failed');
      } finally {
        exportBtn.disabled = false;
      }
    });
  }

  if (importBtn && file && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', () => {
      closeUserMenu();
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can import HubSpot contacts');
        return;
      }
      file.value = '';
      file.click();
    });
    file.addEventListener('change', async () => {
      const picked = file.files && file.files[0];
      file.value = '';
      if (!picked) return;
      if (!isOwnerUser(signedInEmail)) {
        toast('Only Jeff can import HubSpot contacts');
        return;
      }
      importBtn.disabled = true;
      try {
        const result = await importHubspotFile(picked);
        toast('Imported ' + result.count + ' contacts');
        paint();
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Import failed');
      } finally {
        importBtn.disabled = false;
      }
    });
  }
}

fillMonthSelect();
bindFilters();
bindChrome();
bindSettingsPanel();
bindBoardClicks();
bindBoardDrag();
bindBoardPointer();
subscribe(paint);
subscribeContacts(paintContacts);
subscribeSettings(() => {
  paint();
  const root = $('settingsRoot');
  if (root && !root.hidden) paintSettingsPanel();
});

startScheduleAuth()
  .then(async (user) => {
    signedInEmail = (user && user.email) || '';
    bindOwnerTools();
    await initStore(user);
    await initSettingsStore();
    if (isOwnerUser(signedInEmail)) {
      await readSeptemberLoadDone();
      await readTimesCleanedDone();
      await readPhonesCleanedDone();
    }
    pendingJobLink = readJobLink(window.location.search);
    if (pendingJobLink) {
      state.view = 'board';
      state.mode = 'week';
      state.monday = mondayOf(pendingJobLink.date);
      state.day = pendingJobLink.date;
      if (isSunday(pendingJobLink.date)) state.showSunday = true;
    }
    paint();
    initContactsStore();
  })
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('boardMount');
    if (el) {
      el.innerHTML = '<p style="padding:24px;color:#b91c1c">Could not start Booking. Sign in with an authorised Google account, then hard-refresh.</p>';
    }
  });
