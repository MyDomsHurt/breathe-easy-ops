import { DISTRICTS, TEAM_META } from './config.js?v=3';
import { conflictingJobIds, daySlotsOf, districtsForTeamOnDay, firstEmptySlotIndex, jobsForTeamDay, layoutSlots, slotFloor } from './capacity.js';
import { cellTeamMembers, findCrewNote } from './team-day.js';
import { acsLabel, districtChipsHtml, esc, formatDay, isToday, isWeekend, jobStatus, jobTypeOf, normalizeLunch, parseAcs, parseISO, shortTime, startMinutes } from './utils.js';

function teamColor(name) {
  return TEAM_META[name]?.color || '#64748b';
}

function hoverTitle(job) {
  return [job.client_name, job.time, job.acs, job.address, job.notes]
    .filter((x) => x != null && String(x).trim())
    .join(' · ');
}

function isHi(value) {
  return value === true || value === 'true';
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

const DISTRICT_FALLBACK = { border: '#D1D5DB' };

function formatMobile(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.indexOf('852') === 0 && d.length >= 11) d = d.slice(-8);
  if (d.length > 8) d = d.slice(-8);
  if (d.length === 8) return d.slice(0, 4) + ' ' + d.slice(4);
  return d;
}

function badgeKind(token) {
  if (/WP/i.test(token)) return 'w';
  if (/^\d+(?:\.\d+)?S$/i.test(token)) return 's';
  if (/^\d+(?:\.\d+)?W$/i.test(token)) return 'w';
  if (/B/i.test(token)) return 'b';
  return 'x';
}

function liveAcsBadges(acs) {
  const raw = String(acs || '').trim();
  const label = acsLabel(parseAcs(raw));
  if (!label) return raw ? `<span class="compact-units">${esc(raw)}</span>` : '';
  const bits = label.split(/\s+/).filter(Boolean).map((tok) => (
    `<span class="live-u live-u-${badgeKind(tok)}">${esc(tok)}</span>`
  ));
  return `<span class="live-units">${bits.join('')}</span>`;
}

function compactTypeMark(job) {
  const t = jobTypeOf(job);
  if (t === 'return') return 'Return';
  if (t === 'influencer') return 'Collab';
  if (t === 'inspection') return 'Inspection';
  if (t === 'other') return 'Other';
  return 'Service';
}

function jobIsPaid(j) {
  const s = j && j.payment_status != null ? String(j.payment_status).trim().toUpperCase() : '';
  if (s === 'PAID') return true;
  if (s === 'UNPAID') return false;
  return !!(j && j.receipt && String(j.receipt).trim());
}

function compactPayMark(j) {
  const pay = String(j && j.payment || '').trim().toLowerCase();
  if (pay === 'free') return 'Free';
  return jobIsPaid(j) ? 'Paid' : 'Unpaid';
}

function weekAddressLine(job) {
  const street = String(job && job.address_street || '').trim();
  const place = String(job && job.address_place || '').trim();
  if (street || place) return [street, place].filter(Boolean).join(', ');
  return String(job && job.address || '').trim();
}

function boardCardHtml(job, conflict, week) {
  const hold = jobStatus(job) === 'tentative';
  const dist = DISTRICTS[job.district] || DISTRICT_FALLBACK;
  const left = hold ? '#ca8a04' : dist.border;
  const unitsBit = liveAcsBadges(job.acs) || (job.acs
    ? `<span class="compact-units">${esc(job.acs)}</span>`
    : '');
  const mobile = week ? '' : formatMobile(job.mobile);
  const addr = week ? weekAddressLine(job) : String(job.address || '').trim();
  const notes1 = String(job.notes || '').trim();
  const notes2 = week ? '' : String(job.notes_long || '').trim();
  const payWord = compactPayMark(job);
  const pulse = pulseRemaining(job) ? ' is-pulse' : '';
  const timeCls = conflict ? ' time-conflict' : '';
  const name = String(job.client_name || '').trim();
  return `<button type="button" class="job-card job-card-detailed${hold ? ' is-tentative' : ''}${pulse}" draggable="true" data-job="${esc(job.job_id)}" style="border-left:4px solid ${left}" title="${esc(hoverTitle(job))}">
    <div class="compact-row">
      <div class="compact-col compact-col-time">
        <span class="compact-time${timeCls}">${esc(shortTime(job))}</span>
        ${unitsBit}
      </div>
      <div class="compact-col compact-col-main">
        ${name ? `<span class="compact-name">${esc(name)}</span>` : ''}
        ${mobile ? `<p class="detailed-phone">${esc(mobile)}</p>` : ''}
        ${addr ? `<p class="compact-addr">${esc(addr)}</p>` : ''}
        ${notes1 ? `<p class="compact-notes">${esc(notes1)}</p>` : ''}
        ${notes2 ? `<p class="detailed-notes2">${esc(notes2)}</p>` : ''}
      </div>
      <div class="compact-col compact-col-meta">
        <span class="compact-type">${compactTypeMark(job)}</span>
        <span class="compact-pay${payWord === 'Unpaid' ? ' is-unpaid' : ''}">${payWord}</span>
      </div>
    </div>
  </button>`;
}

function lunchCardHtml(time, date, team) {
  return `<div class="lunch-card" draggable="true" data-lunch-card="1" data-edit-lunch="${esc(date)}" data-edit-lunch-team="${esc(team)}" data-lunch-value="${esc(time)}" title="Drag to move lunch, or click to set time">
    <span class="lunch-label">Lunch</span>
    <span class="lunch-time">${esc(time)}</span>
  </div>`;
}

function emptySlotHtml(date, team, index, slim) {
  const cls = slim ? 'empty-slot empty-slot-slim' : 'empty-slot';
  return `<button type="button" class="${cls}" data-book-date="${esc(date)}" data-book-team="${esc(team)}" data-empty-slot="1" data-slot="${index}" aria-label="Add booking"></button>`;
}

function renderSlotStack(slots, lunchTime, conflicts, mode, full, date, team, lunchSlot) {
  const time = normalizeLunch(lunchTime);
  const lunchMins = time ? startMinutes({ time }) : null;
  const pin = Number.isFinite(Number(lunchSlot)) ? Number(lunchSlot) : null;
  const week = mode === 'week';
  const renderJob = (j) => boardCardHtml(j, conflicts.has(j.job_id), week);
  const out = [];
  let placedLunch = !time;
  for (let i = 0; i < slots.length; i += 1) {
    if (!placedLunch && pin != null && i === pin) {
      out.push(lunchCardHtml(time, date, team));
      placedLunch = true;
    }
    const j = slots[i];
    if (j) {
      if (!placedLunch && pin == null) {
        const t = startMinutes(j);
        if (t == null || t >= lunchMins) {
          out.push(lunchCardHtml(time, date, team));
          placedLunch = true;
        }
      }
      out.push(renderJob(j));
    } else if (!full) {
      out.push(emptySlotHtml(date, team, i, week));
    }
  }
  if (!placedLunch) out.push(lunchCardHtml(time, date, team));
  return out.join('');
}

function weekCellTitle(date, empty, full, count) {
  const dow = parseISO(date).toLocaleDateString('en-HK', { weekday: 'short' });
  const day = Number(date.slice(8));
  const bit = full ? 'Full' : (empty ? 'Open' : String(count));
  return `${dow} ${day} · ${bit}`;
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
  const laid = layoutSlots(shown, slots);
  const lunchSlotRaw = Number(note && note.lunch_slot);
  const lunchSlot = Number.isFinite(lunchSlotRaw) ? lunchSlotRaw : null;
  const body = renderSlotStack(laid, lunch, conflicts, mode, full, date, team, lunchSlot);
  const van = cellTeamMembers(lookup, date, team);
  const vanHi = isHi(note && note.highlight_members);
  const vanLabel = van || "Who's on";
  const status = mode === 'week'
    ? weekCellTitle(date, empty, full, list.length)
    : (full ? 'Full' : (empty ? 'Open' : list.length + ' job' + (list.length === 1 ? '' : 's')));
  const floor = slotFloor(list, date, team);
  return `<div class="roster-cell ${empty ? 'empty' : 'has-jobs'}${full ? ' is-full' : ''} ${mode === 'day' ? 'day-cell' : 'week-cell'}" data-date="${date}" data-team="${team}">
    <div class="cell-top">
      <div class="cell-head-left">
        <span class="cell-status">${status}</span>
        <button class="cell-add" data-book-date="${date}" data-book-team="${team}" data-slot="${firstEmptySlotIndex(list, date, team, null, slots)}" type="button" aria-label="Add booking">+</button>
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
      <button type="button" class="add-slot-btn" data-remove-slot="${esc(date)}" data-remove-slot-team="${esc(team)}" data-remove-slot-count="${slots}" data-remove-slot-floor="${floor}" title="Remove an empty slot"${slots <= floor ? ' disabled' : ''}>− slot</button>
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

