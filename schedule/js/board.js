import { TEAM_META } from './config.js';
import { conflictingJobIds, districtsForTeamOnDay, jobsForTeamDay } from './capacity.js';
import { cellTeamMembers, findCrewNote } from './team-day.js';
import { isHeld } from '../../shared/job.js';
import { districtChipsHtml, esc, formatDay, formatMoney, isToday, isWeekend, jobStatus, jobTypeOf, normalizeLunch, notes1Text, shortAddress, shortTime, startMinutes } from './utils.js';

function teamColor(name) {
  return TEAM_META[name]?.color || '#64748b';
}

function markedType(type) {
  return type === 'return' || type === 'influencer';
}

function rightMark(job) {
  return job.acs ? `<span class="acs${isHeld(job, 'acs') ? ' hi' : ''}">${esc(job.acs)}</span>` : '';
}

function hoverTitle(job) {
  return [job.client_name, job.time, job.acs, job.address, job.notes]
    .filter((x) => x != null && String(x).trim())
    .join(' · ');
}

function isUnpaid(job) {
  return String(job && job.payment_status || '').trim().toUpperCase() === 'UNPAID';
}

function unpaidTip(job) {
  return isUnpaid(job) ? '<span class="unpaid-tip" aria-hidden="true"></span>' : '';
}

function isHi(value) {
  return value === true || value === 'true';
}

function hi(job, key) {
  return isHeld(job, key) ? ' hi' : '';
}

const PULSE_MS = 20000;

export function pulseRemaining(job, now = Date.now()) {
  const rows = job && Array.isArray(job.changes) ? job.changes : [];
  const last = rows[rows.length - 1];
  if (!last) return 0;
  if (last.action !== 'created' && last.action !== 'saved' && last.action !== 'tentative' && last.action !== 'moved') return 0;
  const t = Date.parse(last.at);
  if (!Number.isFinite(t)) return 0;
  const remain = t + PULSE_MS - now;
  if (remain <= 0 || remain > PULSE_MS) return 0;
  return remain;
}

function chipHtml(job, conflict) {
  const type = jobTypeOf(job);
  const extra = markedType(type) ? type : '';
  const tentative = jobStatus(job) === 'tentative' ? ' tentative' : '';
  const notes = notes1Text(job);
  const notesRow = notes ? `<div class="chip-notes${hi(job, 'notes')}">${esc(notes)}</div>` : '';
  const who = job.client_name
    ? `<div class="who${hi(job, 'client')}">${esc(job.client_name)}</div>` : '';
  const tent = tentative ? '<span class="tag tentative">TENT</span>' : '';
  const pulse = pulseRemaining(job) ? ' is-pulse' : '';
  return `<button class="job-chip ${extra}${tentative}${pulse}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    ${who}
    <div class="chip-top">
      <span class="when${conflict ? ' time-conflict' : ''}${hi(job, 'time')}">${esc(shortTime(job))}</span>
      ${tent}${rightMark(job)}
    </div>
    <div class="chip-addr${hi(job, 'address')}">${esc(shortAddress(job))}</div>
    ${notesRow}
    ${unpaidTip(job)}
  </button>`;
}

function cardHtml(job, conflict) {
  const type = jobTypeOf(job);
  const extra = markedType(type) ? type : '';
  const tentative = jobStatus(job) === 'tentative' ? ' tentative' : '';
  const notes = notes1Text(job);
  const notesRow = notes ? `<p class="card-notes${hi(job, 'notes')}">${esc(notes)}</p>` : '';
  const money = type === 'cleaning' && job.amount != null
    ? `<span class="card-money${hi(job, 'amount')}">${formatMoney(job.amount)}</span>` : '';
  const who = job.client_name
    ? `<div class="who${hi(job, 'client')}">${esc(job.client_name)}</div>` : '';
  const tent = tentative ? '<span class="tag tentative">TENT</span>' : '';
  const pulse = pulseRemaining(job) ? ' is-pulse' : '';
  return `<button class="job-card ${extra}${tentative}${pulse}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    ${who}
    <div class="card-top">
      <strong class="when${conflict ? ' time-conflict' : ''}${hi(job, 'time')}">${esc(shortTime(job))}</strong>
      ${tent}${rightMark(job)}
    </div>
    <div class="card-addr${hi(job, 'address')}">${esc(shortAddress(job, 56))}</div>
    ${notesRow}
    ${money}
    ${unpaidTip(job)}
  </button>`;
}

function lunchCardHtml(time) {
  return `<div class="lunch-card" data-lunch-card="1">
    <span class="lunch-label">Lunch</span>
    <span class="lunch-time">${esc(time)}</span>
  </div>`;
}

function daySlotsOf(note) {
  const n = Number(note && note.day_slots);
  if (Number.isFinite(n) && n >= 6) return Math.min(24, Math.floor(n));
  return 6;
}

function stackWithLunch(jobs, lunchTime, conflicts, mode) {
  const time = normalizeLunch(lunchTime);
  const renderJob = (j) => (mode === 'day' ? cardHtml(j, conflicts.has(j.job_id)) : chipHtml(j, conflicts.has(j.job_id)));
  if (!time) return jobs.map(renderJob).join('');
  const mins = startMinutes({ time });
  const out = [];
  let placed = false;
  for (const j of jobs) {
    const t = startMinutes(j);
    if (!placed && (t == null || t >= mins)) {
      out.push(lunchCardHtml(time));
      placed = true;
    }
    out.push(renderJob(j));
  }
  if (!placed) out.push(lunchCardHtml(time));
  return out.join('');
}

function emptySlotsHtml(date, team, count, locked) {
  if (count <= 0) return '';
  const bits = [];
  for (let i = 0; i < count; i += 1) {
    bits.push(`<button type="button" class="empty-slot${locked ? ' is-locked' : ''}" data-book-date="${esc(date)}" data-book-team="${esc(team)}" data-empty-slot="1"${locked ? ' disabled aria-disabled="true"' : ''} aria-label="${locked ? 'Day full' : 'Add booking'}"></button>`);
  }
  return bits.join('');
}

function cellHtml(allJobs, displayJobs, date, team, mode, lookupJobs) {
  const list = jobsForTeamDay(allJobs, date, team);
  const shown = jobsForTeamDay(displayJobs, date, team);
  const empty = list.length === 0;
  const districts = empty ? [] : districtsForTeamOnDay(allJobs, date, team);
  const conflicts = conflictingJobIds(list);
  const lookup = lookupJobs || allJobs;
  const note = findCrewNote(lookup, date, team);
  const lunch = normalizeLunch(note && note.lunch);
  const slots = daySlotsOf(note);
  const full = !!(note && (note.day_full === true || note.day_full === 'true'));
  const leftover = full ? 0 : Math.max(0, slots - shown.length);
  const body = stackWithLunch(shown, lunch, conflicts, mode) + emptySlotsHtml(date, team, leftover, false);
  const van = cellTeamMembers(lookup, date, team);
  const vanHi = isHi(note && note.highlight_members);
  const vanLabel = van || "Who's on";
  const status = full ? 'Full' : (empty ? 'Open' : list.length + ' job' + (list.length === 1 ? '' : 's'));
  return `<div class="roster-cell ${empty ? 'empty' : 'has-jobs'}${full ? ' is-full' : ''} ${mode === 'day' ? 'day-cell' : ''}" data-date="${date}" data-team="${team}">
    <div class="cell-top">
      <div class="cell-head-left">
        <span class="cell-status">${status}</span>
        <button class="cell-add" data-book-date="${date}" data-book-team="${team}" type="button" aria-label="Add booking">+</button>
      </div>
      ${districtChipsHtml(districts)}
    </div>
    <div class="cell-van-row">
      <button type="button" class="cell-van${van ? '' : ' is-empty'}${vanHi ? ' hi' : ''}" data-edit-van="${esc(date)}" data-edit-van-team="${esc(team)}" data-van-value="${esc(van)}" title="${esc(van ? van : 'Set who is on the van')}">${esc(vanLabel)}</button>
      <button type="button" class="hold-chip${vanHi ? ' on' : ''}" data-mark-van="${esc(date)}" data-mark-van-team="${esc(team)}" aria-pressed="${vanHi ? 'true' : 'false'}" title="Mark who's on">Mark</button>
    </div>
    <div class="cell-lunch-row">
      <button type="button" class="cell-lunch${lunch ? '' : ' is-empty'}" data-edit-lunch="${esc(date)}" data-edit-lunch-team="${esc(team)}" data-lunch-value="${esc(lunch)}" title="Set lunch start">${lunch ? `Lunch ${esc(lunch)}` : 'Lunch'}</button>
    </div>
    <div class="cell-day-tools">
      <button type="button" class="day-full-btn${full ? ' on' : ''}" data-day-full="${esc(date)}" data-day-full-team="${esc(team)}" aria-pressed="${full ? 'true' : 'false'}">Day full</button>
      <button type="button" class="add-slot-btn" data-add-slot="${esc(date)}" data-add-slot-team="${esc(team)}" data-add-slot-count="${slots}" title="Add a slot">+ slot</button>
    </div>
    <div class="job-chips">${body}</div>
  </div>`;
}

export function renderWeekBoard(el, { jobs, chipJobs, days, teams, lookupJobs }) {
  const shown = chipJobs || jobs;
  const lookup = lookupJobs || jobs;
  const heads = days.map((d) => {
    const cls = [isToday(d) ? 'today' : '', isWeekend(d) ? 'weekend' : ''].join(' ');
    return `<button class="day-col-head ${cls}" data-open-day="${d}" type="button">
      <div class="dow">${formatDay(d, { weekday: 'short', month: 'short' }).split(' ')[0]}</div>
      <div class="dom">${Number(d.slice(8))}</div>
    </button>`;
  }).join('');

  const rows = teams.map((team) => {
    const cells = days.map((date) => cellHtml(jobs, shown, date, team, 'week', lookup)).join('');
    return `<div class="team-row-label" style="--team:${teamColor(team)}">
      <span class="team-dot" style="background:${teamColor(team)}"></span>
      <strong>${team}</strong>
      <div class="team-home">${(TEAM_META[team]?.home || []).join(' · ')}</div>
    </div>${cells}`;
  }).join('');

  el.innerHTML = `<div class="board-wrap"><div class="roster" style="--days:${days.length}">
    <div class="board-head">Team</div>${heads}
    ${rows}
  </div></div>`;
}

export function renderDayBoard(el, { jobs, chipJobs, date, teams, lookupJobs }) {
  const shown = chipJobs || jobs;
  const lookup = lookupJobs || jobs;
  const cols = teams.map((team) => {
    return `<div class="day-col">
      <div class="day-col-team" style="--team:${teamColor(team)}">
        <span class="team-dot" style="background:${teamColor(team)}"></span>
        <div>
          <strong>${team}</strong>
        </div>
      </div>
      ${cellHtml(jobs, shown, date, team, 'day', lookup)}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="board-wrap">
    <div class="day-roster-head">${formatDay(date, { weekday: 'long' })}</div>
    <div class="day-roster" style="--cols:${teams.length}">${cols}</div>
  </div>`;
}

