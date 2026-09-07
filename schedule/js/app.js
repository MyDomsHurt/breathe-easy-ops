import { DISTRICTS, JOB_TYPES, TEAMS } from './config.js';
import { addDays, formatDay, formatWeekLabel, jobTypeOf, mondayOf, mondayOfMonth, monthKey, pad, parseISO, shortTime, weekDays, workWeekDays } from './utils.js';
import { allJobs, getJob, importExistingJobs, redo, removeJob, reorderStack, resetDemo, subscribe, initStore, undo, updateJob, usingFirestore } from './store.js';
import { startScheduleAuth } from './auth.js';
import { hasTimeConflict, jobsForTeamDay, nextStackOrder } from './capacity.js';
import { renderDayBoard, renderWeekBoard } from './board.js';
import { closeBooking, openBooking } from './booking.js';
import { renderJobModal, renderJobsList, renderSearchHits } from './jobs.js';

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
  const days = boardDays();
  label.textContent = state.mode === 'day'
    ? formatDay(state.day, { weekday: 'short', year: 'numeric' })
    : formatWeekLabel(state.monday, state.showSunday);
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
  syncFilterUi();
  syncSundayUi();
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
    openBooking({ date: state.mode === 'day' ? state.day : TODAY });
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

function bindOwnerTools() {
  const box = $('ownerTools');
  const importBtn = $('importJobs');
  const resetBtn = $('resetDemo');
  if (!isOwnerUser(signedInEmail)) {
    if (box) {
      box.hidden = true;
      box.replaceChildren();
    }
    return;
  }
  if (box) box.hidden = false;
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      if (!isOwnerUser(signedInEmail)) return;
      if (!usingFirestore()) {
        toast('Sign in to import into the live store');
        return;
      }
      if (!confirm('One-time import of seed + technician archive into Firestore?\n\nThis can upload thousands of jobs. Do not run it on every computer or on every page load.')) {
        return;
      }
      importBtn.disabled = true;
      try {
        const result = await importExistingJobs();
        paint();
        toast(`Imported ${result.count} jobs`);
      } catch (err) {
        console.error(err);
        toast((err && err.message) || 'Import failed');
      } finally {
        importBtn.disabled = false;
      }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!isOwnerUser(signedInEmail)) return;
      if (usingFirestore()) {
        toast('Local demo reset is only for the offline fallback');
        return;
      }
      if (confirm('Reset local demo bookings back to the seed schedule?')) {
        resetDemo();
        paint();
        toast('Demo data reset');
      }
    });
  }
}

fillMonthSelect();
bindFilters();
bindChrome();
bindBoardClicks();
bindBoardDrag();
subscribe(paint);

startScheduleAuth()
  .then((user) => {
    signedInEmail = (user && user.email) || '';
    bindOwnerTools();
    return initStore(user);
  })
  .then(() => paint())
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('boardMount');
    if (el) {
      el.innerHTML = '<p style="padding:24px;color:#b91c1c">Could not start Booking. Sign in with an authorised Google account, then hard-refresh.</p>';
    }
  });
