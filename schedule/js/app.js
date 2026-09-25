import { DISTRICTS, JOB_TYPES, TEAMS } from './config.js?v=3';
import { canPlaceJobOnTeamDay, findCrewNote, isCrewNote, isTeamDayFull } from './team-day.js?v=1';
import { addDays, formatDay, formatTime24, formatWeekLabel, jobTypeOf, mondayOf, mondayOfMonth, monthKey, normalizeLunch, pad, parseISO, shortTime, weekDays, workWeekDays } from './utils.js';
import { allJobs, getJob, placeJobInSlot, redo, removeJob, setTeamDayFull, setTeamDayHighlight, setTeamDayLunch, setTeamDayMembers, setTeamDaySlots, subscribe, initStore, undo, updateJob, usingFirestore } from './store.js?v=4';
import { startScheduleAuth } from './auth.js';
import { daySlotsOf, firstEmptySlotIndex, hasTimeConflict, jobsForTeamDay, layoutSlots, slotIndex } from './capacity.js?v=4';
import { clientCardName, pulseRemaining, renderDayBoard, renderWeekBoard, weekDragSlotsHtml } from './board.js?v=11';
import { applyJobDrop, armClickSuppress, beginDrag, capturedDragId, clearCapturedDrag, consumeClickSuppress, resolveDropId } from './board-drag.js?v=1';
import { closeBooking, newBookingPrefill, openBooking } from './booking.js?v=22';
import { renderJobModal, renderJobsList, renderSearchHits } from './jobs.js?v=2';
import { exportMasterRoster } from './export-roster.js?v=22';
import { allContacts, initContactsStore, subscribeContacts } from './contacts-store.js?v=1';
import { fillContactFilterSelect, importHubspotFile, renderContacts } from './contacts.js?v=2';
import { uniqueContactValues } from './contacts-query.js?v=1';

function calendarToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = calendarToday();
const OWNER_EMAIL = 'jefflamb1992@gmail.com';
let signedInEmail = '';

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
};

function $(id) {
  return document.getElementById(id);
}

function sundayOfWeek(mondayIso) {
  return addDays(mondayIso, 6);
}

function isSunday(iso) {
  return parseISO(iso).getDay() === 0;
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

function paintBoard() {
  const mount = $('boardMount');
  if (!mount) return;
  const jobs = filteredJobs();
  const rosterJobs = teamJobs();
  if (state.mode === 'week') {
    renderWeekBoard(mount, { jobs: rosterJobs, chipJobs: jobs, days: boardDays(), teams: state.teams, lookupJobs: allJobs(), today: TODAY });
  } else {
    renderDayBoard(mount, { jobs: rosterJobs, chipJobs: jobs, date: state.day, teams: state.teams, lookupJobs: allJobs(), today: TODAY });
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
  const base = parseISO(TODAY);
  const opts = [];
  for (let i = -8; i <= 8; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const label = d.toLocaleDateString('en-HK', { month: 'short', year: 'numeric' });
    opts.push(`<option value="${value}">${label}</option>`);
  }
  sel.innerHTML = opts.join('');
  sel.value = monthKey(state.monday);
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
    const chip = e.target.closest('[data-job]');
    if (!chip) {
      e.preventDefault();
      return;
    }
    dragKind = 'job';
    dragJobId = beginDrag(chip.dataset.job);
    dragLunchFrom = null;
    chip.classList.add('is-dragging');
    e.dataTransfer.setData('text/plain', dragJobId);
    e.dataTransfer.effectAllowed = 'move';
    showWeekDropSlots();
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

function filterButtonLabel(singular, plural, selected, total, emptyMeansAll) {
  const n = selected.length;
  const allOn = emptyMeansAll ? n === 0 : n === total;
  return allOn ? `All ${plural}` : `${singular} · ${n}`;
}

function syncFilterUi() {
  const teamBtn = $('teamFilterBtn');
  if (teamBtn) {
    teamBtn.textContent = filterButtonLabel('Team', 'teams', state.teams, TEAMS.length, false);
    teamBtn.classList.toggle('is-subset', state.teams.length !== TEAMS.length);
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
    TEAMS.map((t) => `<label><input type="checkbox" value="${t}" checked> ${t}</label>`).join(''),
  );
  if (teamMenu) {
    teamMenu.addEventListener('change', (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const t = input.value;
      if (input.checked) {
        if (!state.teams.includes(t)) state.teams = [...state.teams, t];
      } else {
        if (state.teams.length === 1) {
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
    if (e.target.closest('.filter-dd')) return;
    closeFilterMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFilterMenus();
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
    state.monday = mondayOfMonth(value);
    state.day = state.monday;
    state.focusJobId = '';
    paint();
  });
  $('newBooking').addEventListener('click', () => {
    const date = state.mode === 'day' ? state.day : TODAY;
    const boardTeams = state.teams.length ? state.teams : TEAMS;
    openBooking(newBookingPrefill({ date, boardTeams }));
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
    contactsMount.addEventListener('click', (e) => {
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

function bindOwnerTools() {
  const box = $('ownerTools');
  const exportBtn = $('exportRoster');
  if (!isOwnerUser(signedInEmail)) {
    if (box) {
      box.hidden = true;
      box.replaceChildren();
    }
    return;
  }
  if (box) box.hidden = false;
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
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
  bindContactsImport();
}

function bindContactsImport() {
  const btn = $('importHubspotCsv');
  const file = $('importHubspotFile');
  if (!btn || !file) return;
  const jeff = isOwnerUser(signedInEmail);
  btn.hidden = !jeff;
  if (!jeff) return;
  btn.addEventListener('click', () => {
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
    btn.disabled = true;
    try {
      const result = await importHubspotFile(picked);
      toast('Imported ' + result.count + ' contacts');
      paint();
    } catch (err) {
      console.error(err);
      toast((err && err.message) || 'Import failed');
    } finally {
      btn.disabled = false;
    }
  });
}

fillMonthSelect();
bindFilters();
bindChrome();
bindBoardClicks();
bindBoardDrag();
subscribe(paint);
subscribeContacts(paintContacts);

startScheduleAuth()
  .then(async (user) => {
    signedInEmail = (user && user.email) || '';
    bindOwnerTools();
    await initStore(user);
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
