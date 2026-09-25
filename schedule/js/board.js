import { DISTRICTS, TEAM_META } from './config.js?v=3';
import { conflictingJobIds, daySlotsOf, districtsForTeamOnDay, firstEmptySlotIndex, jobsForTeamDay, layoutSlots, slotFloor } from './capacity.js';
import { cellTeamMembers, findCrewNote } from './team-day.js?v=1';
import { acsLabel, districtChipsHtml, esc, formatDay, isWeekend, jobStatus, jobTypeOf, normalizeLunch, pad, parseAcs, parseISO, shortTime, startMinutes } from './utils.js';
import { jobOnSiteMinutes } from './job-duration.js';

function teamColor(name) {
  return TEAM_META[name]?.color || '#64748b';
}

function calendarDay() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clientCardName(name) {
  const s = String(name == null ? '' : name).trim();
  return s || '—';
}

function hoverTitle(job) {
  return [clientCardName(job && job.client_name), job.time, job.acs, job.address, job.notes]
    .filter((x) => x != null && String(x).trim() && String(x) !== '—')
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

function liveAcsBadges(acs, extraCls) {
  const hold = extraCls ? ` ${extraCls}` : '';
  const raw = String(acs || '').trim();
  const label = acsLabel(parseAcs(raw));
  if (!label) return raw ? `<span class="compact-units${hold}">${esc(raw)}</span>` : '';
  const bits = label.split(/\s+/).filter(Boolean).map((tok) => (
    `<span class="live-u live-u-${badgeKind(tok)}">${esc(tok)}</span>`
  ));
  return `<span class="live-units${hold}">${bits.join('')}</span>`;
}

function compactTypeMark(job) {
  const t = jobTypeOf(job);
  if (t === 'return') return { label: 'Return', kind: 'return' };
  if (t === 'influencer') return { label: 'Collab', kind: 'collab' };
  if (t === 'inspection') return { label: 'Inspection', kind: 'inspection' };
  if (t === 'other') return { label: 'Other', kind: 'other' };
  return null;
}

function jobIsPaid(j) {
  const s = j && j.payment_status != null ? String(j.payment_status).trim().toUpperCase() : '';
  if (s === 'PAID') return true;
  if (s === 'UNPAID') return false;
  return !!(j && j.receipt && String(j.receipt).trim());
}

function compactPayMark(j) {
  const pay = String(j && j.payment || '').trim().toLowerCase();
  if (pay === 'free') return { label: 'Free', kind: 'free' };
  if (jobIsPaid(j)) return { label: 'Paid', kind: 'paid' };
  return { label: 'Unpaid', kind: 'unpaid' };
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
  const hi = job && job.highlight || {};
  const acsHold = isHi(hi.acs) ? 'is-hold' : '';
  const unitsBit = liveAcsBadges(job.acs, acsHold);
  const mobile = week ? '' : formatMobile(job.mobile);
  const addr = week ? weekAddressLine(job) : String(job.address || '').trim();
  const notes1 = String(job.notes || '').trim();
  const notes2 = week ? '' : String(job.notes_long || '').trim();
  const typeMark = compactTypeMark(job);
  const payMark = compactPayMark(job);
  const typeBit = typeMark
    ? `<span class="compact-type is-${typeMark.kind}">${esc(typeMark.label)}</span>`
    : '';
  const payBit = `<span class="compact-pay is-${payMark.kind}">${esc(payMark.label)}</span>`;
  const pulse = pulseRemaining(job) ? ' is-pulse' : '';
  const timeCls = [conflict ? 'time-conflict' : '', isHi(hi.time) ? 'is-hold' : ''].filter(Boolean).join(' ');
  const name = clientCardName(job.client_name);
  return `<button type="button" class="job-card job-card-detailed${hold ? ' is-tentative' : ''}${pulse}" data-job="${esc(job.job_id)}" style="border-left:4px solid ${left}" title="${esc(hoverTitle(job))}">
    <div class="compact-row">
      <div class="compact-col compact-col-time">
        <span class="compact-time${timeCls ? ` ${timeCls}` : ''}">${esc(shortTime(job))}</span>
        ${unitsBit}
      </div>
      <div class="compact-col compact-col-main">
        <span class="compact-name${isHi(hi.client) ? ' is-hold' : ''}">${esc(name)}</span>
        ${mobile ? `<p class="detailed-phone">${esc(mobile)}</p>` : ''}
        ${addr ? `<p class="compact-addr${isHi(hi.address) ? ' is-hold' : ''}">${esc(addr)}</p>` : ''}
        ${notes1 ? `<p class="compact-notes${isHi(hi.notes) ? ' is-hold' : ''}">${esc(notes1)}</p>` : ''}
        ${notes2 ? `<p class="detailed-notes2">${esc(notes2)}</p>` : ''}
      </div>
      <div class="compact-col compact-col-meta">
        ${typeBit}
        ${payBit}
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

export function weekClockJobs(jobs) {
  return (jobs || []).slice().sort((a, b) => {
    const ta = startMinutes(a);
    const tb = startMinutes(b);
    if (ta == null && tb == null) return String(a.job_id || '').localeCompare(String(b.job_id || ''));
    if (ta == null) return -1;
    if (tb == null) return 1;
    if (ta !== tb) return ta - tb;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
}

function weekHoleHtml(date, team, leftover) {
  const h = Math.min(120, Math.max(28, Math.round(leftover * 0.7)));
  return `<button type="button" class="week-hole" style="--hole-min:${h}px" data-book-date="${esc(date)}" data-book-team="${esc(team)}" data-week-hole="1" aria-label="Open time"></button>`;
}

function weekOpenAreaHtml(date, team) {
  return `<button type="button" class="week-open-area" data-book-date="${esc(date)}" data-book-team="${esc(team)}" data-week-open="1" aria-label="Add booking"></button>`;
}

function renderWeekStack(jobs, lunchTime, conflicts, date, team, full) {
  const ordered = weekClockJobs(jobs);
  const lunch = normalizeLunch(lunchTime);
  const lunchMins = lunch ? startMinutes({ time: lunch }) : null;
  const out = [];
  let lunchPlaced = lunchMins == null;
  let prevTimed = null;
  let prevJob = null;

  function placeLunch() {
    if (lunchPlaced || !lunch) return;
    out.push(lunchCardHtml(lunch, date, team));
    lunchPlaced = true;
  }

  for (const j of ordered) {
    const m = startMinutes(j);
    if (!lunchPlaced && lunchMins != null && m != null && lunchMins <= m) placeLunch();
    if (!full && prevTimed != null && m != null && prevJob) {
      const leftover = m - (prevTimed + jobOnSiteMinutes(prevJob));
      if (leftover >= 30) out.push(weekHoleHtml(date, team, leftover));
    }
    out.push(boardCardHtml(j, conflicts.has(j.job_id), true));
    if (m != null) {
      prevTimed = m;
      prevJob = j;
    }
  }
  if (!lunchPlaced && lunch) placeLunch();
  if (!ordered.length && !full) out.push(weekOpenAreaHtml(date, team));
  return out.join('');
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
    } else if (!full && !week) {
      out.push(emptySlotHtml(date, team, i, false));
    }
  }
  if (!placedLunch) out.push(lunchCardHtml(time, date, team));
  return out.join('');
}

export function weekDragSlotsHtml(allJobs, date, team) {
  return '';
}

export function weekLockBit(empty, full, count) {
  return full ? 'Full' : (empty ? 'Open' : String(count));
}

export function weekCellTitle(date, empty, full, count) {
  const dow = parseISO(date).toLocaleDateString('en-HK', { weekday: 'short' });
  const day = Number(date.slice(8));
  return `${dow} ${day} · ${weekLockBit(empty, full, count)}`;
}

export function rosterCellHtml(allJobs, displayJobs, date, team, mode, lookupJobs, today) {
  return cellHtml(allJobs, displayJobs, date, team, mode, lookupJobs, today);
}

function cellHtml(allJobs, displayJobs, date, team, mode, lookupJobs, today) {
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
  const week = mode === 'week';
  const body = week
    ? renderWeekStack(shown, lunch, conflicts, date, team, full)
    : renderSlotStack(laid, lunch, conflicts, mode, full, date, team, lunchSlot);
  const van = cellTeamMembers(lookup, date, team);
  const vanHi = isHi(note && note.highlight_members);
  const vanLabel = van || "Who's on";
  const lockBit = weekLockBit(empty, full, list.length);
  const dow = parseISO(date).toLocaleDateString('en-HK', { weekday: 'short' });
  const dayNum = Number(date.slice(8));
  const status = week
    ? `${esc(dow)} ${dayNum} · <button type="button" class="cell-lock" data-day-full="${esc(date)}" data-day-full-team="${esc(team)}" aria-pressed="${full ? 'true' : 'false'}">${esc(lockBit)}</button>`
    : esc(full ? 'Full' : (empty ? 'Open' : list.length + ' job' + (list.length === 1 ? '' : 's')));
  const addBtn = full
    ? ''
    : `<button class="cell-add" data-book-date="${date}" data-book-team="${team}" data-slot="${firstEmptySlotIndex(list, date, team, null, slots)}" type="button" aria-label="Add booking">+</button>`;
  const vanBtn = week
    ? `<button type="button" class="cell-van${van ? '' : ' is-empty'}${vanHi ? ' hi' : ''}" data-mark-van="${esc(date)}" data-mark-van-team="${esc(team)}" aria-pressed="${vanHi ? 'true' : 'false'}" title="Mark who's on">${esc(vanLabel)}</button>`
    : `<button type="button" class="cell-van${van ? '' : ' is-empty'}${vanHi ? ' hi' : ''}" data-edit-van="${esc(date)}" data-edit-van-team="${esc(team)}" data-van-value="${esc(van)}" title="${esc(van ? van : 'Set who is on the van')}">${esc(vanLabel)}</button>
      <button type="button" class="hold-chip${vanHi ? ' on' : ''}" data-mark-van="${esc(date)}" data-mark-van-team="${esc(team)}" aria-pressed="${vanHi ? 'true' : 'false'}" title="Mark who's on">Mark</button>`;
  const weekLunchAdd = (week && !lunch)
    ? `<button type="button" class="cell-lunch is-empty" data-edit-lunch="${esc(date)}" data-edit-lunch-team="${esc(team)}" data-lunch-value="" title="Set lunch start">Lunch</button>`
    : '';
  const lunchRow = week
    ? ''
    : `<div class="cell-lunch-row">
      <button type="button" class="cell-lunch${lunch ? '' : ' is-empty'}" data-edit-lunch="${esc(date)}" data-edit-lunch-team="${esc(team)}" data-lunch-value="${esc(lunch)}" title="Set lunch start">${lunch ? `Lunch ${esc(lunch)}` : 'Lunch'}</button>
    </div>`;
  const floor = slotFloor(list, date, team);
  const dayTools = week ? '' : `<div class="cell-day-tools">
      <button type="button" class="day-full-btn${full ? ' on' : ''}" data-day-full="${esc(date)}" data-day-full-team="${esc(team)}" aria-pressed="${full ? 'true' : 'false'}">Day full</button>
      <button type="button" class="add-slot-btn" data-add-slot="${esc(date)}" data-add-slot-team="${esc(team)}" data-add-slot-count="${slots}" title="Add a slot">+ slot</button>
      <button type="button" class="add-slot-btn" data-remove-slot="${esc(date)}" data-remove-slot-team="${esc(team)}" data-remove-slot-count="${slots}" data-remove-slot-floor="${floor}" title="Remove an empty slot"${slots <= floor ? ' disabled' : ''}>− slot</button>
    </div>`;
  const todayIso = today || calendarDay();
  const todayCls = date === todayIso ? ' today' : '';
  return `<div class="roster-cell ${empty ? 'empty' : 'has-jobs'}${full ? ' is-full' : ''} ${week ? 'week-cell' : 'day-cell'}${todayCls}" data-date="${date}" data-team="${team}">
    <div class="cell-top">
      <div class="cell-head-left">
        <span class="cell-status">${status}</span>
        ${addBtn}
        ${weekLunchAdd}
      </div>
      ${districtChipsHtml(districts)}
    </div>
    <div class="cell-van-row">
      ${vanBtn}
    </div>
    ${lunchRow}
    ${dayTools}
    <div class="job-chips">${body}</div>
  </div>`;
}

export function renderWeekBoard(el, { jobs, chipJobs, days, teams, lookupJobs, today }) {
  const shown = chipJobs || jobs;
  const lookup = lookupJobs || jobs;
  const todayIso = today || calendarDay();
  const heads = days.map((d) => {
    const cls = [d === todayIso ? 'today' : '', isWeekend(d) ? 'weekend' : ''].join(' ');
    return `<button class="day-col-head ${cls}" data-open-day="${d}" type="button">
      <div class="dow">${formatDay(d, { weekday: 'short', month: 'short' }).split(' ')[0]}</div>
      <div class="dom">${Number(d.slice(8))}</div>
    </button>`;
  }).join('');

  const rows = teams.map((team) => {
    const cells = days.map((date) => cellHtml(jobs, shown, date, team, 'week', lookup, todayIso)).join('');
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

export function renderDayBoard(el, { jobs, chipJobs, date, teams, lookupJobs, today }) {
  const shown = chipJobs || jobs;
  const lookup = lookupJobs || jobs;
  const todayIso = today || calendarDay();
  const cols = teams.map((team) => {
    return `<div class="day-col">
      <div class="day-col-team" style="--team:${teamColor(team)}">
        <span class="team-dot" style="background:${teamColor(team)}"></span>
        <div>
          <strong>${team}</strong>
        </div>
      </div>
      ${cellHtml(jobs, shown, date, team, 'day', lookup, todayIso)}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="board-wrap">
    <div class="day-roster-head">${formatDay(date, { weekday: 'long' })}</div>
    <div class="day-roster" style="--cols:${teams.length}">${cols}</div>
  </div>`;
}

