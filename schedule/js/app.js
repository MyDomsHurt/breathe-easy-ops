import { DISTRICTS, JOB_TYPES, TEAMS, TODAY } from './config.js';
import { addDays, formatDay, formatWeekLabel, jobTypeOf, mondayOf, mondayOfMonth, monthKey, pad, parseISO, shortTime, workWeekDays } from './utils.js';
import { allJobs, getJob, importExistingJobs, redo, removeJob, reorderStack, resetDemo, subscribe, initStore, undo, updateJob, usingFirestore } from './store.js';
import { startScheduleAuth } from './auth.js';
import { hasTimeConflict, jobsForTeamDay, nextStackOrder } from './capacity.js';
import { renderDayBoard, renderWeekBoard } from './board.js';
import { closeBooking, openBooking } from './booking.js';
import { renderJobModal, renderJobsList, renderSearchHits } from './jobs.js';

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
};

function $(id) {
  return document.getElementById(id);
}

function visibleDates() {
  return state.mode === 'day' ? [state.day] : workWeekDays(state.monday);
}

function teamJobs() {
  const dates = new Set(visibleDates());
  return allJobs().filter((j) => (
    dates.has(j.date)
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

function paint() {
  const label = $('weekLabel');
  const mount = $('boardMount');
  if (!label || !mount) return;
  const jobs = filteredJobs();
  const days = workWeekDays(state.monday);
  label.textContent = state.mode === 'day'
    ? formatDay(state.day, { weekday: 'short', year: 'numeric' })
    : formatWeekLabel(state.monday);
  $('prevWeek').setAttribute('aria-label', state.mode === 'day' ? 'Previous day' : 'Previous week');
  $('nextWeek').setAttribute('aria-label', state.mode === 'day' ? 'Next day' : 'Next week');
  const monthSel = $('monthSelect');
  if (monthSel) monthSel.value = monthKey(state.mode === 'day' ? state.day : state.monday);
  $('viewBoard').hidden = state.view !== 'board';
  $('viewJobs').hidden = state.view !== 'jobs';
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('on', el.dataset.nav === state.view);
  });
  document.querySelectorAll('[data-mode]').forEach((el) => {
    el.classList.toggle('on', el.dataset.mode === state.mode);
  });

  if (state.view === 'board') {
    const rosterJobs = teamJobs();
    if (state.mode === 'week') {
      renderWeekBoard($('boardMount'), { jobs: rosterJobs, chipJobs: jobs, days, teams: state.teams });
    } else {
      renderDayBoard($('boardMount'), { jobs: rosterJobs, chipJobs: jobs, date: state.day, teams: state.teams });
    }
  } else {
    renderJobsList($('jobsMount'), jobs, state.query);
  }
  focusJobOnBoard();
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

function bindBoardClicks() {
  $('boardMount').addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
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
    const add = e.target.closest('[data-book-date][data-book-team]');
    const cell = e.target.closest('[data-date][data-team]');
    const date = add?.dataset.bookDate || cell?.dataset.date;
    const team = add?.dataset.bookTeam || cell?.dataset.team;
    if (!date || !team) return;
    openBooking({ date, team_lead: team });
  });
}

let dragJobId = '';
let suppressClick = false;
let dropHint = null;

function clearDropTargets() {
  document.querySelectorAll('#boardMount .drop-ok, #boardMount .is-dragging, #boardMount .drop-before, #boardMount .drop-after').forEach((el) => {
    el.classList.remove('drop-ok', 'is-dragging', 'drop-before', 'drop-after');
  });
  dropHint = null;
}

function setDropHint(id, where) {
  if (dropHint && dropHint.id === id && dropHint.where === where) return;
  dropHint = { id, where };
  document.querySelectorAll('#boardMount .drop-before, #boardMount .drop-after').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after');
  });
  if (!id) return;
  const el = document.querySelector(`#boardMount [data-job="${CSS.escape(id)}"]`);
  if (el) el.classList.add(where === 'before' ? 'drop-before' : 'drop-after');
}

function placeInStack(ids, draggedId, targetId, where) {
  const next = ids.filter((id) => id !== draggedId);
  if (!targetId || !next.includes(targetId) || where === 'end') {
    next.push(draggedId);
    return next;
  }
  let i = next.indexOf(targetId);
  if (where === 'after') i += 1;
  next.splice(i, 0, draggedId);
  return next;
}

function bindBoardDrag() {
  const mount = $('boardMount');
  const blank = $('blankAppt');
  if (blank) {
    blank.addEventListener('dragstart', (e) => {
      dragJobId = 'new-appointment';
      blank.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', 'new-appointment');
      e.dataTransfer.effectAllowed = 'copy';
    });
    blank.addEventListener('dragend', () => {
      dragJobId = '';
      blank.classList.remove('is-dragging');
      clearDropTargets();
    });
  }
  mount.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('[data-job]');
    if (!chip) {
      e.preventDefault();
      return;
    }
    dragJobId = chip.dataset.job;
    chip.classList.add('is-dragging');
    e.dataTransfer.setData('text/plain', dragJobId);
    e.dataTransfer.effectAllowed = 'move';
  });
  mount.addEventListener('dragend', () => {
    dragJobId = '';
    clearDropTargets();
  });
  mount.addEventListener('dragover', (e) => {
    const cell = e.target.closest('[data-date][data-team]');
    if (!cell || !dragJobId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragJobId === 'new-appointment' ? 'copy' : 'move';
    const job = dragJobId === 'new-appointment' ? null : getJob(dragJobId);
    const sameStack = job && job.date === cell.dataset.date && job.team_lead === cell.dataset.team;
    document.querySelectorAll('#boardMount .drop-ok').forEach((el) => {
      if (el !== cell) el.classList.remove('drop-ok');
    });
    if (sameStack) {
      cell.classList.remove('drop-ok');
      const overJob = e.target.closest('[data-job]');
      if (overJob && overJob.dataset.job !== dragJobId) {
        const rect = overJob.getBoundingClientRect();
        const where = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
        setDropHint(overJob.dataset.job, where);
      } else {
        setDropHint(null, 'end');
      }
    } else {
      setDropHint(null, null);
      cell.classList.add('drop-ok');
    }
  });
  mount.addEventListener('drop', (e) => {
    const cell = e.target.closest('[data-date][data-team]');
    const id = e.dataTransfer.getData('text/plain') || dragJobId;
    const hint = dropHint;
    clearDropTargets();
    dragJobId = '';
    $('blankAppt')?.classList.remove('is-dragging');
    if (!cell || !id) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = true;
    const date = cell.dataset.date;
    const team = cell.dataset.team;
    if (!date || !team) return;
    if (id === 'new-appointment') {
      openBooking({ date, team_lead: team, time: '' });
      return;
    }
    const job = getJob(id);
    if (!job) return;
    if (job.date === date && job.team_lead === team) {
      const ids = jobsForTeamDay(allJobs(), date, team).map((j) => j.job_id);
      const nextIds = placeInStack(ids, id, hint && hint.id, hint && hint.where);
      if (nextIds.join() === ids.join()) return;
      if (reorderStack(nextIds)) toast('Reordered');
      return;
    }
    state.monday = mondayOf(date);
    state.day = date;
    state.focusJobId = id;
    const moved = updateJob(id, {
      ...job,
      date,
      team_lead: team,
      stack_order: nextStackOrder(allJobs(), date, team, id),
    });
    if (!moved) return;
    if (hasTimeConflict(moved, allJobs())) {
      toast(`Moved — time conflict at ${shortTime(moved)}`);
    } else {
      toast(`Moved to ${moved.team_lead} · ${formatDay(moved.date)}`);
    }
  });
}

function bindFilters() {
  const teamBox = $('teamFilters');
  teamBox.innerHTML = TEAMS.map((t) => `<button class="chip team on" data-team="${t}" style="--team:var(--team-${t.toLowerCase()})">${t}</button>`).join('');
  teamBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-team]');
    if (!btn) return;
    const t = btn.dataset.team;
    if (state.teams.includes(t)) {
      if (state.teams.length === 1) return;
      state.teams = state.teams.filter((x) => x !== t);
    } else {
      state.teams = [...state.teams, t];
    }
    [...teamBox.children].forEach((el) => el.classList.toggle('on', state.teams.includes(el.dataset.team)));
    paint();
  });

  const distBox = $('districtFilters');
  distBox.innerHTML = Object.keys(DISTRICTS).map((d) => `<button class="chip district" data-district="${d}">${d}</button>`).join('');
  distBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-district]');
    if (!btn) return;
    const d = btn.dataset.district;
    state.districts = state.districts.includes(d) ? state.districts.filter((x) => x !== d) : [...state.districts, d];
    [...distBox.children].forEach((el) => el.classList.toggle('on', state.districts.includes(el.dataset.district)));
    paint();
  });

  const typeBox = $('typeFilters');
  typeBox.innerHTML = JOB_TYPES.map((t) => `<button class="chip type-${t.id}" data-type="${t.id}">${t.label}</button>`).join('');
  typeBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    const t = btn.dataset.type;
    state.types = state.types.includes(t) ? state.types.filter((x) => x !== t) : [...state.types, t];
    [...typeBox.children].forEach((el) => el.classList.toggle('on', state.types.includes(el.dataset.type)));
    paint();
  });
}

function bindChrome() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      state.view = el.dataset.nav;
      if (state.view === 'jobs') $('globalSearch')?.focus();
      paint();
    });
  });
  document.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      state.mode = el.dataset.mode;
      if (state.mode === 'day') {
        const days = workWeekDays(state.monday);
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
    openBooking({ date: state.mode === 'day' ? state.day : TODAY });
  });
  bindSearch();
  $('importJobs').addEventListener('click', async () => {
    if (!usingFirestore()) {
      toast('Sign in to import into the live store');
      return;
    }
    if (!confirm('One-time import of seed + technician archive into Firestore?\n\nThis can upload thousands of jobs. Do not run it on every computer or on every page load.')) {
      return;
    }
    const btn = $('importJobs');
    btn.disabled = true;
    try {
      const result = await importExistingJobs();
      paint();
      toast(`Imported ${result.count} jobs`);
    } catch (err) {
      console.error(err);
      toast((err && err.message) || 'Import failed');
    } finally {
      btn.disabled = false;
    }
  });
  $('resetDemo').addEventListener('click', () => {
    if (usingFirestore()) {
      toast('Local demo reset is only for the offline fallback');
      return;
    }
    if (confirm('Reset prototype bookings back to the seed schedule?')) {
      resetDemo();
      paint();
      toast('Demo data reset');
    }
  });
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
    paint();
    toast(`${job.status === 'tentative' ? 'Tentative' : 'Saved'} ${job.client_name} · ${job.team_lead} · ${job.date}`);
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
    renderSearchHits(box, allJobs(), state.query);
    if (state.view === 'jobs') paint();
  });
  input.addEventListener('focus', () => {
    renderSearchHits(box, allJobs(), input.value);
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

fillMonthSelect();
bindFilters();
bindChrome();
bindBoardClicks();
bindBoardDrag();
subscribe(paint);

startScheduleAuth()
  .then((user) => initStore(user))
  .then(() => paint())
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('boardMount');
    if (el) {
      el.innerHTML = '<p style="padding:24px;color:#b91c1c">Could not start the scheduler. Sign in with an authorised Google account, then hard-refresh.</p>';
    }
  });
