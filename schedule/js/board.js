import { TEAM_META } from './config.js';
import { conflictingJobIds, districtsForTeamOnDay, jobsForTeamDay, teamMembersOnDay } from './capacity.js';
import { districtChipsHtml, esc, formatDay, formatMoney, isToday, isWeekend, jobStatus, jobTypeOf, shortAddress, shortNotes, shortTime } from './utils.js';

function teamColor(name) {
  return TEAM_META[name]?.color || '#64748b';
}

function typeMark(type, compact) {
  if (type === 'return') return `<span class="tag return">${compact ? 'RET' : 'RETURN'}</span>`;
  if (type === 'influencer') return `<span class="tag influencer">${compact ? 'INF' : 'INFLUENCER'}</span>`;
  return '';
}

function rightMark(job, type, compact) {
  if (type !== 'cleaning') return typeMark(type, compact);
  return job.acs ? `<span class="acs">${esc(job.acs)}</span>` : '';
}

function hoverTitle(job) {
  return [job.client_name, job.time, job.acs, job.address, job.notes]
    .filter((x) => x != null && String(x).trim())
    .join(' · ');
}

function chipHtml(job, conflict) {
  const type = jobTypeOf(job);
  const extra = type !== 'cleaning' ? type : '';
  const tentative = jobStatus(job) === 'tentative' ? ' tentative' : '';
  const notes = shortNotes(job);
  const notesRow = notes ? `<div class="chip-notes">${esc(notes)}</div>` : '';
  const tent = tentative ? '<span class="tag tentative">TENT</span>' : '';
  return `<button class="job-chip ${extra}${tentative}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    <div class="chip-top">
      <span class="when${conflict ? ' time-conflict' : ''}">${esc(shortTime(job))}</span>
      ${tent}${rightMark(job, type, true)}
    </div>
    <div class="chip-addr">${esc(shortAddress(job))}</div>
    ${notesRow}
  </button>`;
}

function cardHtml(job, conflict) {
  const type = jobTypeOf(job);
  const extra = type !== 'cleaning' ? type : '';
  const tentative = jobStatus(job) === 'tentative' ? ' tentative' : '';
  const notes = shortNotes(job, 140);
  const notesRow = notes ? `<p class="card-notes">${esc(notes)}</p>` : '';
  const money = type === 'cleaning' && job.amount != null
    ? `<span class="card-money">${formatMoney(job.amount)}</span>` : '';
  const who = job.client_name
    ? `<div class="who">${esc(job.client_name)}</div>` : '';
  const tent = tentative ? '<span class="tag tentative">TENT</span>' : '';
  return `<button class="job-card ${extra}${tentative}" draggable="true" data-job="${job.job_id}" style="--team:${teamColor(job.team_lead)}" title="${esc(hoverTitle(job))}">
    <div class="card-top">
      <strong class="when${conflict ? ' time-conflict' : ''}">${esc(shortTime(job))}</strong>
      ${tent}${rightMark(job, type, false)}
    </div>
    <div class="card-addr">${esc(shortAddress(job, 56))}</div>
    ${who}
    ${notesRow}
    ${money}
  </button>`;
}

function cellHtml(allJobs, displayJobs, date, team, mode) {
  const list = jobsForTeamDay(allJobs, date, team);
  const shown = jobsForTeamDay(displayJobs, date, team);
  const empty = list.length === 0;
  const districts = empty ? [] : districtsForTeamOnDay(allJobs, date, team);
  const conflicts = conflictingJobIds(list);
  const body = mode === 'day'
    ? shown.map((j) => cardHtml(j, conflicts.has(j.job_id))).join('')
    : shown.map((j) => chipHtml(j, conflicts.has(j.job_id))).join('');
  return `<div class="roster-cell ${empty ? 'empty' : 'has-jobs'} ${mode === 'day' ? 'day-cell' : ''}" data-date="${date}" data-team="${team}">
    <div class="cell-top">
      <span class="cell-status">${empty ? 'Open' : list.length + ' job' + (list.length === 1 ? '' : 's')}</span>
      ${districtChipsHtml(districts)}
    </div>
    <div class="job-chips">${body}</div>
    <button class="book-here" data-book-date="${date}" data-book-team="${team}" type="button">+ Add</button>
  </div>`;
}

export function renderWeekBoard(el, { jobs, chipJobs, days, teams }) {
  const shown = chipJobs || jobs;
  const heads = days.map((d) => {
    const cls = [isToday(d) ? 'today' : '', isWeekend(d) ? 'weekend' : ''].join(' ');
    return `<button class="day-col-head ${cls}" data-open-day="${d}" type="button">
      <div class="dow">${formatDay(d, { weekday: 'short', month: 'short' }).split(' ')[0]}</div>
      <div class="dom">${Number(d.slice(8))}</div>
    </button>`;
  }).join('');

  const rows = teams.map((team) => {
    const cells = days.map((date) => cellHtml(jobs, shown, date, team, 'week')).join('');
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

export function renderDayBoard(el, { jobs, chipJobs, date, teams }) {
  const shown = chipJobs || jobs;
  const cols = teams.map((team) => {
    const members = teamMembersOnDay(jobs, date, team);
    return `<div class="day-col">
      <div class="day-col-team" style="--team:${teamColor(team)}">
        <span class="team-dot" style="background:${teamColor(team)}"></span>
        <div>
          <strong>${team}</strong>
          <div class="cell-members">${members}</div>
        </div>
      </div>
      ${cellHtml(jobs, shown, date, team, 'day')}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="board-wrap">
    <div class="day-roster-head">${formatDay(date, { weekday: 'long' })}</div>
    <div class="day-roster" style="--cols:${teams.length}">${cols}</div>
  </div>`;
}

