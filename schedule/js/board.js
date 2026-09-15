import { TEAM_META } from './config.js';
import { conflictingJobIds, districtsForTeamOnDay, jobsForTeamDay } from './capacity.js';
import { cellTeamMembers, findCrewNote } from './team-day.js';
import { isHeld } from '../../shared/job.js';
import { districtChipsHtml, esc, formatDay, formatMoney, isToday, isWeekend, jobStatus, jobTypeOf, notes1Text, shortAddress, shortTime } from './utils.js';

function teamColor(name) {
  return TEAM_META[name]?.color || '#64748b';
}

function typeMark(type, compact, job) {
  const hi = isHeld(job, 'type') ? ' hi' : '';
  if (type === 'return') return `<span class="tag return${hi}">${compact ? 'RET' : 'RETURN'}</span>`;
  if (type === 'influencer') return `<span class="tag influencer${hi}">${compact ? 'COL' : 'COLLAB'}</span>`;
  return '';
}

function markedType(type) {
  return type === 'return' || type === 'influencer';
}

function rightMark(job, type, compact) {
  const mark = typeMark(type, compact, job);
  if (mark) return mark;
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

function chipHtml(job, conflict) {
  const type = jobTypeOf(job);
  const extra = markedType(type) ? type : '';
  const tentative = jobStatus(job) === 'tentative' ? ' tentative' : '';
  const notes = notes1Text(job);
  const notesRow = notes ? `<div class="chip-notes${hi(job, 'notes')}">${esc(notes)}</div>` : '';
  const tent = tentative ? '<span class="tag tentative">TENT</span>' : '';
  return `<button class="job-chip ${extra}${tentative}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    <div class="chip-top">
      <span class="when${conflict ? ' time-conflict' : ''}${hi(job, 'time')}">${esc(shortTime(job))}</span>
      ${tent}${rightMark(job, type, true)}
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
  return `<button class="job-card ${extra}${tentative}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    <div class="card-top">
      <strong class="when${conflict ? ' time-conflict' : ''}${hi(job, 'time')}">${esc(shortTime(job))}</strong>
      ${tent}${rightMark(job, type, false)}
    </div>
    <div class="card-addr${hi(job, 'address')}">${esc(shortAddress(job, 56))}</div>
    ${who}
    ${notesRow}
    ${money}
    ${unpaidTip(job)}
  </button>`;
}

function cellHtml(allJobs, displayJobs, date, team, mode, lookupJobs) {
  const list = jobsForTeamDay(allJobs, date, team);
  const shown = jobsForTeamDay(displayJobs, date, team);
  const empty = list.length === 0;
  const districts = empty ? [] : districtsForTeamOnDay(allJobs, date, team);
  const conflicts = conflictingJobIds(list);
  const body = mode === 'day'
    ? shown.map((j) => cardHtml(j, conflicts.has(j.job_id))).join('')
    : shown.map((j) => chipHtml(j, conflicts.has(j.job_id))).join('');
  const lookup = lookupJobs || allJobs;
  const van = cellTeamMembers(lookup, date, team);
  const vanHi = isHi(findCrewNote(lookup, date, team)?.highlight_members);
  const vanLabel = van || "Who's on";
  return `<div class="roster-cell ${empty ? 'empty' : 'has-jobs'} ${mode === 'day' ? 'day-cell' : ''}" data-date="${date}" data-team="${team}">
    <div class="cell-top">
      <div class="cell-head-left">
        <span class="cell-status">${empty ? 'Open' : list.length + ' job' + (list.length === 1 ? '' : 's')}</span>
        <button class="cell-add" data-book-date="${date}" data-book-team="${team}" type="button" aria-label="Add booking">+</button>
      </div>
      ${districtChipsHtml(districts)}
    </div>
    <div class="cell-van-row">
      <button type="button" class="cell-van${van ? '' : ' is-empty'}${vanHi ? ' hi' : ''}" data-edit-van="${esc(date)}" data-edit-van-team="${esc(team)}" data-van-value="${esc(van)}" title="${esc(van ? van : 'Set who is on the van')}">${esc(vanLabel)}</button>
      <button type="button" class="hold-chip${vanHi ? ' on' : ''}" data-mark-van="${esc(date)}" data-mark-van-team="${esc(team)}" aria-pressed="${vanHi ? 'true' : 'false'}" title="Mark who's on">Mark</button>
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

