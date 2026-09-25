import { DISTRICTS, JOB_TYPES, PAYMENTS, TEAMS, TEAM_META, UNIT_TYPES } from './config.js?v=3';
import { overlapWarning, stackOrderOnSave, suggestTeams, teamMembersOnDay } from './capacity.js';
import { canPlaceJobOnTeamDay } from './team-day.js?v=1';
import { addJob, allJobs, isStoreReady, removeJob, updateJob } from './store.js?v=4';
import { allContacts } from './contacts-store.js?v=1';
import { uniqueClientsFrom } from './seed.js';
import { displayNameForEmail } from '../../shared/firebase-config.js';
import { highlightOf } from '../../shared/job.js';
import { acsLabel, emptyUnits, formatDay, formatTime24, jobStatus, jobTypeOf, NOTES1_MAX, parseAcs, shortTime, storedUnits } from './utils.js?v=3';
import { TERRITORIES, composeFullAddress, parseAddress } from './address-parse.js?v=5';
import { composePhone, matchHubspotIdByPhone, parsePhone } from '../../shared/phone-parse.js';

let form = {
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
  team_lead: 'Josh',
  job_type: 'cleaning',
  amount: '',
  payment: 'Unpaid',
  notes: '',
  notes_long: '',
  status: 'confirmed',
  created_by: '',
  created_at: '',
  updated_by: '',
  updated_at: '',
  highlight: {},
  changes: [],
  stack_order: '',
};

let phoneSnap = null;
let addrSnap = null;
let lastTeamLead = '';

export function storedClientName(name) {
  return String(name == null ? '' : name).trim();
}

export function newBookingPrefill({ date, boardTeams } = {}) {
  const teams = Array.isArray(boardTeams) && boardTeams.length ? boardTeams : TEAMS;
  return {
    date: date || '',
    team_lead: lastTeamLead || teams[0] || '',
  };
}

function $(sel) {
  return document.querySelector(sel);
}

function captureDrawerScroll() {
  const el = document.querySelector('.drawer-body');
  return el ? Number(el.scrollTop) || 0 : 0;
}

function restoreDrawerScroll(y) {
  const el = document.querySelector('.drawer-body');
  if (el) el.scrollTop = y;
}

export function getBookingForm() {
  return form;
}

export function mintJobId(formState) {
  const date = String((formState && formState.date) || 'undated');
  const team = String((formState && formState.team_lead) || 'team').toLowerCase().replace(/\s+/g, '-');
  const rand = Math.random().toString(36).slice(2, 7);
  return `${date}-${team}-${Date.now().toString(36)}-${rand}`;
}

export function paintAcsPad() {
  UNIT_TYPES.forEach((u) => {
    const n = form.units[u.id] || 0;
    const btn = document.querySelector('[data-unit="' + u.id + '"]');
    const tile = btn && typeof btn.closest === 'function' ? btn.closest('.unit') : null;
    if (tile) {
      const b = tile.querySelector('b');
      if (b) b.textContent = String(n);
      if (tile.classList && typeof tile.classList.toggle === 'function') tile.classList.toggle('on', n > 0);
    }
  });
  const preview = document.querySelector('.acs-preview');
  if (preview) preview.textContent = acsLabel(form.units) || '—';
}

export function applyUnitDelta(id, delta) {
  form.units[id] = Math.max(0, (form.units[id] || 0) + Number(delta || 0));
  paintAcsPad();
  return form.units[id] || 0;
}

const PAYMENT_ALIASES = {
  unpaid: 'Unpaid',
  free: 'Free',
  deposit: 'Deposit',
  'bank transfer/fps': 'Bank Transfer/FPS',
  'bank transfer': 'Bank Transfer/FPS',
  fps: 'Bank Transfer/FPS',
  'payme / fps': 'Bank Transfer/FPS',
  bt: 'Bank Transfer/FPS',
  payme: 'PayMe',
  cash: 'Cash',
  cheque: 'Cheque',
  check: 'Cheque',
};

function normalizePaymentLabel(raw, status) {
  const s = String(raw || '').trim();
  if (PAYMENTS.includes(s)) return s;
  const lower = s.toLowerCase();
  const mapped = PAYMENT_ALIASES[lower];
  if (mapped) return mapped;
  if (String(status || '').trim().toUpperCase() === 'UNPAID') return 'Unpaid';
  if (String(status || '').trim().toUpperCase() === 'PAID' || lower === 'paid' || lower === 'visa') {
    return 'Bank Transfer/FPS';
  }
  return 'Unpaid';
}

function paymentStatusFromLabel(label) {
  return String(label || '').trim().toLowerCase() === 'unpaid' ? 'UNPAID' : 'PAID';
}

function held(key) {
  return !!(form.highlight && form.highlight[key]);
}

function holdChip(key, label) {
  const on = held(key);
  return `<button type="button" class="hold-chip${on ? ' on' : ''}" data-hold="${key}" aria-pressed="${on ? 'true' : 'false'}" title="Mark ${label}">Mark</button>`;
}

function fieldClass(key) {
  return held(key) ? ' is-hold' : '';
}

function formatLogAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString('en-HK', {
    timeZone: 'Asia/Hong_Kong',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function diffSentenceHtml(diff) {
  return `<p class="log-sentence"><span class="log-field">${escapeAttr(diff.field)}</span> changed from <span class="log-old">${escapeAttr(diff.from)}</span> to <span class="log-new">${escapeAttr(diff.to)}</span></p>`;
}

function logFallback(action) {
  if (action === 'created') return 'Job created';
  if (action === 'tentative') return 'Marked tentative';
  if (action === 'moved') return 'Moved';
  return 'Saved';
}

function changeRailHtml() {
  const rows = Array.isArray(form.changes) ? form.changes.slice().reverse() : [];
  let body;
  if (!rows.length) {
    body = '<p class="log-empty">No history yet</p>';
  } else {
    body = rows.map((row) => {
      const diffs = Array.isArray(row.diffs) ? row.diffs : [];
      const sentences = diffs.length
        ? diffs.map((d) => diffSentenceHtml(d)).join('')
        : `<p class="log-sentence log-fallback">${escapeAttr(logFallback(row.action))}</p>`;
      return `<article class="log-entry">
        <p class="log-meta">${escapeAttr(formatLogAt(row.at))} · ${escapeAttr(displayNameForEmail(row.by))}</p>
        ${sentences}
      </article>`;
    }).join('');
  }
  return `
    <aside class="log-rail" id="changeLog" hidden>
      <div class="log-rail-head">
        <h3>History</h3>
      </div>
      <div class="log-rail-body">${body}</div>
    </aside>`;
}

function sizeFullBox(el, minRows, maxRows) {
  if (!el) return;
  const min = minRows || 1;
  const max = maxRows || min;
  el.rows = min;
  el.style.overflow = 'hidden';
  try {
    el.style.height = 'auto';
    const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    let lh = cs ? parseFloat(cs.lineHeight) : NaN;
    if (!Number.isFinite(lh) || lh <= 0) {
      const fs = cs ? parseFloat(cs.fontSize) : 14;
      lh = (Number.isFinite(fs) && fs > 0 ? fs : 14) * 1.35;
    }
    const pad = cs ? ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)) : 16;
    const border = cs ? ((parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)) : 0;
    const minH = lh * min + pad + border;
    const maxH = lh * max + pad + border;
    const sh = el.scrollHeight || (lh * min + pad);
    el.style.height = Math.min(Math.max(sh + border, minH), maxH) + 'px';
  } catch (err) {
    el.rows = min;
  }
}

function logButtonHtml() {
  return `
    <button type="button" class="icon-btn log-btn" id="toggleLog" aria-expanded="false" title="History" aria-label="History">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <path d="M8 7h8M8 11h8M8 15h5"/>
      </svg>
    </button>`;
}

export function openBooking(prefill = {}) {
  const jobs = allJobs();
  const editing = Boolean(prefill.job_id);
  const units = (prefill.acs != null || editing)
    ? parseAcs(prefill.acs)
    : parseAcs(acsLabel(prefill.units || {}));
  form = {
    job_id: prefill.job_id || '',
    client_name: prefill.client_name || '',
    mobile: prefill.mobile || '',
    phone_cc: prefill.phone_cc || '',
    phone_national: prefill.phone_national || '',
    hubspot_id: prefill.hubspot_id || '',
    address: prefill.address || '',
    address_line1: prefill.address_line1 || '',
    address_street: prefill.address_street || '',
    address_place: prefill.address_place || '',
    address_extra: prefill.address_extra || '',
    district: prefill.district || '',
    units,
    date: prefill.date || '',
    time: formatTime24(prefill.time) || prefill.time || '',
    team_lead: prefill.team_lead || '',
    job_type: jobTypeOf(prefill),
    amount: prefill.amount != null && prefill.amount !== '' ? prefill.amount : '',
    payment: normalizePaymentLabel(prefill.payment, prefill.payment_status),
    notes: prefill.notes || '',
    notes_long: prefill.notes_long || '',
    status: jobStatus(prefill),
    created_by: prefill.created_by || '',
    created_at: prefill.created_at || '',
    updated_by: prefill.updated_by || '',
    updated_at: prefill.updated_at || '',
    highlight: highlightOf(prefill),
    changes: Array.isArray(prefill.changes) ? prefill.changes : [],
    invoice: prefill.invoice || '',
    stack_order: prefill.stack_order != null && prefill.stack_order !== '' ? prefill.stack_order : '',
    receipt: prefill.receipt,
    source: prefill.source,
  };
  if (!form.date) form.date = new Date().toISOString().slice(0, 10);
  if (form.job_type !== 'cleaning') form.units = emptyUnits();
  if (!form.team_lead) {
    const ranked = suggestTeams(jobs, { date: form.date, district: form.district });
    form.team_lead = ranked[0]?.team || 'Josh';
  }
  if (form.mobile && !form.phone_cc && !form.phone_national) {
    const p = parsePhone(form.mobile);
    if (p.full) {
      form.phone_cc = p.country;
      form.phone_national = p.national;
      form.mobile = p.full;
    }
  }
  if (form.address && !form.address_line1 && !form.address_street && !form.address_place) {
    const parsed = parseAddress(form.address);
    form.address_line1 = parsed.line1 || '';
    form.address_street = parsed.street || '';
    form.address_place = parsed.district || '';
    if (parsed.code) form.district = parsed.code;
    form.address_extra = form.address_extra || parsed.extra || '';
    if (parsed.composed) form.address = parsed.composed;
  }
  phoneSnap = snapPhoneNow();
  addrSnap = snapAddrNow();
  renderForm();
  const root = $('#bookingRoot');
  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  if (!editing) setTimeout(() => $('#clientSearch')?.focus(), 30);
}

export function closeBooking() {
  restorePhoneIfPending();
  restoreAddrIfPending();
  const root = $('#bookingRoot');
  root.classList.remove('open', 'log-open');
  root.setAttribute('aria-hidden', 'true');
  const logPanel = $('#changeLog');
  if (logPanel) logPanel.setAttribute('hidden', '');
}

function others() {
  return allJobs().filter((j) => j.job_id !== form.job_id);
}

export function renderForm() {
  const scrollY = captureDrawerScroll();
  const jobs = others();
  const ranked = suggestTeams(jobs, { date: form.date, district: form.district });
  if (form.team_lead && !ranked.find((r) => r.team === form.team_lead)) {
    form.team_lead = ranked[0]?.team || form.team_lead;
  }
  const warn = overlapWarning(jobs, { date: form.date, team: form.team_lead, time: form.time });
  const editing = Boolean(form.job_id);
  const teamColor = (TEAM_META[form.team_lead] && TEAM_META[form.team_lead].color) || '#64748b';
  const headWhen = [form.date ? formatDay(form.date, { weekday: 'short' }) : 'Pick a date', form.team_lead || 'choose team', form.time ? shortTime(form) : '']
    .filter(Boolean)
    .join(' · ');

  $('#bookingRoot').innerHTML = `
    <div class="drawer-bg" data-close="1"></div>
    ${editing ? changeRailHtml() : ''}
    <aside class="drawer" role="dialog" aria-label="${editing ? 'Edit booking' : 'New booking'}">
      <div class="drawer-head">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <h2>${editing ? 'Edit booking' : 'New booking'}</h2>
            <p>${headWhen}${form.status === 'tentative' ? ' · Tentative' : ''}</p>
          </div>
          <div class="head-btns">
            ${editing ? logButtonHtml() : ''}
            <button class="icon-btn" data-close="1" aria-label="Close">✕</button>
          </div>
        </div>
      </div>
      <div class="drawer-body">
        <section class="form-block">
          <div class="field${fieldClass('team')}">
            <label>Team ${holdChip('team', 'team')}</label>
            ${warn ? `<div class="team-warn">${warn}. You can still book.</div>` : ''}
            <div class="team-picker" style="--team:${teamColor}">
              <i class="team-pip" aria-hidden="true"></i>
              <select id="teamInput" aria-label="Team">
                ${TEAMS.map((team) => `<option value="${escapeAttr(team)}" ${form.team_lead === team ? 'selected' : ''}>${escapeAttr(team)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field field-primary${fieldClass('client')}">
            <label>Client ${holdChip('client', 'client')}</label>
            <div class="typeahead">
              <input id="clientSearch" type="search" placeholder="Name or phone" value="${escapeAttr(form.client_name)}" autocomplete="off" />
              <div id="clientHits" class="typeahead-list" hidden></div>
            </div>
          </div>
          <div class="grid-2">
            <div class="field${fieldClass('date')}">
              <label>Date ${holdChip('date', 'date')}</label>
              <input id="dateInput" type="date" value="${form.date}" />
            </div>
            <div class="field${fieldClass('time')}">
              <label>Time ${holdChip('time', 'time')}</label>
              <input id="timeInput" value="${escapeAttr(form.time)}" placeholder="13:00" autocomplete="off" />
            </div>
          </div>
        </section>

        <section class="form-block" id="phoneBlock">
          <div class="field${fieldClass('mobile')}">
            <div class="split-head">
              <label>Phone ${holdChip('mobile', 'phone')}</label>
            </div>
            <textarea id="mobileInput" class="full-phone" rows="1" placeholder="+852…" aria-label="Full phone">${escapeAttr(form.mobile)}</textarea>
            <p class="clean-was" id="wasMobile" hidden></p>
          </div>
          <div class="rail-row">
            <div class="field rail-cc">
              <label>Country</label>
              <input id="formPhoneCc" class="phone-cc" value="${escapeAttr(form.phone_cc)}" placeholder="852" inputmode="numeric" aria-label="Country code" />
              <p class="clean-was" id="wasPhoneCc" hidden></p>
            </div>
            <div class="field rail-num">
              <label>Number</label>
              <input id="formPhoneNational" class="phone-national" value="${escapeAttr(form.phone_national)}" placeholder="Number" inputmode="numeric" aria-label="National number" />
              <p class="clean-was" id="wasPhoneNational" hidden></p>
            </div>
          </div>
          <button type="button" class="primary-btn split-clean split-apply" id="phoneApplyBtn" hidden>Apply</button>
        </section>

        <section class="form-block" id="addressBlock">
          <div class="field${fieldClass('address')}">
            <div class="split-head">
              <label>Address ${holdChip('address', 'address')}</label>
            </div>
            <textarea id="addressInput" class="full-address" rows="1" placeholder="Full Address 1" aria-label="Full Address 1">${escapeAttr(form.address)}</textarea>
            <p class="clean-was" id="wasAddress" hidden></p>
          </div>
          <div class="field">
            <label>Billing Street</label>
            <input id="formAddrStreet" value="${escapeAttr(billingStreetOf(form))}" />
            <p class="clean-was" id="wasAddrStreet" hidden></p>
          </div>
          <div class="rail-row">
            <div class="field">
              <label>Billing City</label>
              <input id="formAddrPlace" value="${escapeAttr(form.address_place)}" placeholder="Mid-Levels" />
              <p class="clean-was" id="wasAddrPlace" hidden></p>
            </div>
            <div class="field">
              <label>Billing State</label>
              <select id="districtInput" aria-label="Billing State">
                <option value="">Select</option>
                ${TERRITORIES.map((t) => `<option value="${t.code}" ${form.district === t.code ? 'selected' : ''}>${escapeAttr(t.label + ' (' + t.code + ')')}</option>`).join('')}
              </select>
              <p class="clean-was" id="wasAddrDistrict" hidden></p>
            </div>
          </div>
          <button type="button" class="primary-btn split-clean split-apply" id="addrApplyBtn" hidden>Apply</button>
        </section>

        <section class="form-block">
          <div class="field${fieldClass('acs')}">
            <label>ACs ${holdChip('acs', 'ACs')}</label>
            <div class="unit-strip">
              ${UNIT_TYPES.map((u) => `
                <div class="unit ${(form.units[u.id] || 0) ? 'on' : ''}" title="${escapeAttr(u.label || u.id)}">
                  <span class="unit-code">${u.code || u.id}</span>
                  <b>${form.units[u.id] || 0}</b>
                  <div class="unit-ctrl">
                    <button type="button" data-unit="${u.id}" data-delta="-1" aria-label="Fewer ${u.code || u.id}">−</button>
                    <button type="button" data-unit="${u.id}" data-delta="1" aria-label="More ${u.code || u.id}">+</button>
                  </div>
                </div>`).join('')}
            </div>
            <p class="acs-preview">${escapeAttr(acsLabel(form.units)) || '—'}</p>
          </div>
        </section>

        <section class="form-block">
          <div class="field${fieldClass('notes')}">
            <label>Notes 1 ${holdChip('notes', 'notes')} <span id="notes1Count" class="notes-count">${String(form.notes || '').length}/${NOTES1_MAX}</span></label>
            <textarea id="notesInput" rows="3" maxlength="${NOTES1_MAX}" placeholder="Shown on the board">${escapeAttr(form.notes)}</textarea>
          </div>
          <div class="field${fieldClass('notes_long')}">
            <label>Notes 2 ${holdChip('notes_long', 'notes 2')}</label>
            <textarea id="notesLongInput" class="notes-long" rows="5" placeholder="Extra detail — drawer only">${escapeAttr(form.notes_long)}</textarea>
          </div>
          <div class="grid-3">
            <div class="field${fieldClass('type')}">
              <label>Type ${holdChip('type', 'type')}</label>
              <select id="typeInput">
                ${JOB_TYPES.map((t) => `<option value="${t.id}" ${form.job_type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
            <div class="field${fieldClass('payment')}">
              <label>Payment ${holdChip('payment', 'payment')}</label>
              <select id="payInput">
                ${PAYMENTS.map((p) => `<option ${form.payment === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="field${fieldClass('amount')}">
              <label>Amount ${holdChip('amount', 'amount')}</label>
              <input id="amountInput" type="number" min="0" step="10" value="${form.amount === '' || form.amount == null ? '' : form.amount}" placeholder="HKD" />
            </div>
          </div>
          <div class="field${fieldClass('invoice')}">
            <label>Invoice ${holdChip('invoice', 'invoice')}</label>
            <input id="invoiceInput" value="${escapeAttr(form.invoice || '')}" placeholder="Inv" />
          </div>
        </section>
      </div>
      <div class="drawer-foot">
        ${(() => {
          const bits = [];
          if (editing) bits.push(`Created by ${escapeAttr(displayNameForEmail(form.created_by))}`);
          if (editing) bits.push(`Last edit ${escapeAttr(displayNameForEmail(form.updated_by))}`);
          if (form.hubspot_id) bits.push(`HubSpot ${escapeAttr(form.hubspot_id)}`);
          return bits.length ? `<p class="foot-audit">${bits.join(' · ')}</p>` : '';
        })()}
        <div class="foot-row">
          ${editing ? '<button class="ghost-btn danger-btn" id="deleteBooking" type="button">Cancel job</button>' : '<span class="foot-spacer"></span>'}
          <div class="foot-actions">
            <button class="ghost-btn tent-btn ${form.status === 'tentative' ? 'on' : ''}" id="saveTentative" type="button">Tentative</button>
            <button class="primary-btn" id="saveBooking" type="button">Save</button>
          </div>
        </div>
      </div>
    </aside>
  `;
  bindForm();
  paintPhoneCleanColors();
  paintAddrCleanColors();
  sizeFullBox($('#mobileInput'), 1, 2);
  sizeFullBox($('#addressInput'), 1, 4);
  restoreDrawerScroll(scrollY);
}

export function bindForm() {
  const root = $('#bookingRoot');
  if (!root) return;
  root.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', closeBooking);
  });
  const logBtn = $('#toggleLog');
  const logPanel = $('#changeLog');
  if (logBtn && logPanel) {
    logBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = logPanel.hasAttribute('hidden');
      if (open) {
        logPanel.removeAttribute('hidden');
        root.classList.add('log-open');
      } else {
        logPanel.setAttribute('hidden', '');
        root.classList.remove('log-open');
      }
      logBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!phoneDirty() && !addrDirty()) return;
    e.preventDefault();
    e.stopPropagation();
    restorePhoneIfPending();
    restoreAddrIfPending();
  });
  $('#clientSearch')?.addEventListener('input', (e) => {
    form.client_name = e.target.value;
    renderHits(e.target.value);
  });
  bindFormPhone();
  bindFormAddress();
  $('#phoneApplyBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    applyPhoneClean();
  });
  $('#addrApplyBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    applyAddrClean();
  });
  $('#dateInput')?.addEventListener('change', (e) => { form.date = e.target.value; renderForm(); });
  $('#timeInput')?.addEventListener('input', (e) => { form.time = e.target.value; });
  $('#timeInput')?.addEventListener('change', (e) => {
    const converted = formatTime24(e.target.value);
    form.time = converted || e.target.value;
    if (converted) e.target.value = converted;
    renderForm();
  });
  $('#typeInput')?.addEventListener('change', (e) => { form.job_type = e.target.value; renderForm(); });
  $('#payInput')?.addEventListener('change', (e) => { form.payment = e.target.value; });
  $('#amountInput')?.addEventListener('input', (e) => {
    form.amount = e.target.value === '' ? '' : Number(e.target.value);
  });
  $('#notesInput')?.addEventListener('input', (e) => {
    form.notes = String(e.target.value || '').slice(0, NOTES1_MAX);
    if (e.target.value !== form.notes) e.target.value = form.notes;
    const count = $('#notes1Count');
    if (count) count.textContent = `${form.notes.length}/${NOTES1_MAX}`;
  });
  $('#notesLongInput')?.addEventListener('input', (e) => { form.notes_long = e.target.value; });
  $('#invoiceInput')?.addEventListener('input', (e) => { form.invoice = e.target.value; });
  root.querySelectorAll('[data-hold]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.hold;
      const next = { ...(form.highlight || {}) };
      if (next[key]) delete next[key];
      else next[key] = true;
      form.highlight = next;
      const on = !!next[key];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const field = btn.closest('.field');
      if (field) field.classList.toggle('is-hold', on);
    });
  });
  root.querySelectorAll('[data-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyUnitDelta(btn.dataset.unit, btn.dataset.delta);
    });
  });
  $('#teamInput')?.addEventListener('change', (e) => {
    form.team_lead = e.target.value;
    renderForm();
  });
  $('#saveBooking')?.addEventListener('click', () => save('confirmed'));
  $('#saveTentative')?.addEventListener('click', () => save('tentative'));
  const del = $('#deleteBooking');
  if (del) del.addEventListener('click', cancelJob);
}

function renderHits(q) {
  const box = $('#clientHits');
  if (!box) return;
  const s = String(q || '').trim().toLowerCase();
  if (s.length < 2) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const clients = uniqueClientsFrom(allJobs());
  const hits = clients.filter((c) => (
    `${c.name} ${c.mobile} ${c.address}`.toLowerCase().includes(s)
  )).slice(0, 7);
  if (!hits.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = hits.map((c) => `
    <button type="button" data-pick-mobile="${escapeAttr(c.mobile)}">
      <strong>${c.name}</strong>
      <span class="sub">${c.mobile || ''} · ${c.district || ''} · ${c.address || ''}</span>
    </button>
  `).join('');
  box.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const client = clients.find((c) => c.mobile === btn.dataset.pickMobile);
      if (!client) return;
      form.client_name = client.name;
      form.mobile = client.mobile;
      const p = parsePhone(client.mobile);
      form.phone_cc = client.phone_cc || p.country || '';
      form.phone_national = client.phone_national || p.national || '';
      if (p.full) form.mobile = p.full;
      form.address = client.address;
      form.district = client.district;
      form.address_line1 = client.address_line1 || '';
      form.address_street = client.address_street || '';
      form.address_place = client.address_place || '';
      form.address_extra = client.address_extra || '';
      if (form.address && !form.address_line1 && !form.address_street) {
        const parsed = parseAddress(form.address);
        form.address_line1 = parsed.line1 || '';
        form.address_street = parsed.street || '';
        form.address_place = parsed.district || form.address_place;
        if (parsed.code) form.district = parsed.code;
        if (parsed.composed) form.address = parsed.composed;
      }
      renderForm();
    });
  });
}

export function commitBooking(formState, status = 'confirmed', io = {}) {
  try {
    if (!formState.date || !formState.team_lead) {
      return { error: 'Date and team are required' };
    }
    const listFn = io.allJobs || allJobs;
    const addFn = io.addJob || addJob;
    const updateFn = io.updateJob || updateJob;
    const contactsFn = io.allContacts || allContacts;
    if (!io.addJob && !io.updateJob && !isStoreReady()) {
      return { error: 'Store not ready' };
    }
    const jobs = listFn();
    const prev = formState.job_id ? jobs.find((j) => j.job_id === formState.job_id) : null;
    if (!canPlaceJobOnTeamDay(jobs, formState.date, formState.team_lead, prev)) {
      return { error: 'That day is full' };
    }
    const notesRaw = formState.job_type === 'influencer' && !/influencer/i.test(formState.notes || '')
      ? `Influencer (Free)${formState.notes ? ' — ' + formState.notes : ''}`
      : formState.notes;
    const notes = String(notesRaw || '').slice(0, NOTES1_MAX);
    const phone = phonePayload(formState);
    const addr = addressPayload(formState);
    const isNew = !String(formState.job_id || '').trim();
    const payload = {
      ...formState,
      client_name: storedClientName(formState.client_name),
      status: status === 'tentative' ? 'tentative' : 'confirmed',
      acs: formState.job_type === 'cleaning' ? acsLabel(formState.units) : '',
      units: formState.job_type === 'cleaning' ? storedUnits(formState.units) : emptyUnits(),
      notes,
      notes_long: formState.notes_long,
      invoice: formState.invoice || '',
      highlight: highlightOf({ highlight: formState.highlight }),
      mobile: phone.mobile,
      phone_cc: phone.phone_cc,
      phone_national: phone.phone_national,
      hubspot_id: matchHubspotIdByPhone(phone.mobile, contactsFn()).hubspot_id || '',
      address: addr.address,
      address_line1: addr.address_line1,
      address_street: addr.address_street,
      address_place: addr.address_place,
      address_extra: addr.address_extra,
      district: addr.district,
      time: formatTime24(formState.time) || String(formState.time || '').trim(),
      payment: formState.payment,
      payment_status: paymentStatusFromLabel(formState.payment),
      team_members: teamMembersOnDay(jobs, formState.date, formState.team_lead),
      amount: formState.job_type === 'cleaning'
        ? (formState.amount === '' || formState.amount == null ? null : Number(formState.amount))
        : null,
      stack_order: stackOrderOnSave(jobs, formState.date, formState.team_lead, prev, formState.stack_order),
    };
    if (isNew) payload.job_id = mintJobId(formState);
    delete payload.created_by;
    delete payload.created_at;
    delete payload.updated_by;
    delete payload.updated_at;
    delete payload.changes;
    delete payload.highlight_time;
    delete payload.highlight_notes;
    const job = isNew ? addFn(payload) : updateFn(formState.job_id, payload);
    if (!job) return { error: 'Could not save' };
    if (job.team_lead) lastTeamLead = job.team_lead;
    return { job };
  } catch (err) {
    return { error: (err && err.message) || 'Could not save' };
  }
}

export function save(status = 'confirmed') {
  try {
    const result = commitBooking(form, status);
    if (!result || result.error || !result.job) {
      toast((result && result.error) || 'Could not save');
      return result;
    }
    closeBooking();
    window.dispatchEvent(new CustomEvent('be:booked', { detail: result.job }));
    return result;
  } catch (err) {
    toast((err && err.message) || 'Could not save');
    return { error: (err && err.message) || 'Could not save' };
  }
}

function cancelJob() {
  if (!form.job_id) return;
  if (!confirm('Remove this job from the roster?')) return;
  const name = form.client_name;
  removeJob(form.job_id);
  closeBooking();
  window.dispatchEvent(new CustomEvent('be:toast', { detail: `Cancelled ${name || 'job'}` }));
  window.dispatchEvent(new CustomEvent('be:changed'));
}

function sameClean(a, b) {
  return String(a || '') === String(b || '');
}

function setCleanClass(el, same) {
  if (!el) return;
  el.classList.remove('clean-match', 'clean-change');
  if (same === false) el.classList.add('clean-change');
}

function billingStreetOf(src) {
  return [collapseAddr(src && src.address_line1), collapseAddr(src && src.address_street)].filter(Boolean).join(', ');
}

function phoneDirty() {
  if (!phoneSnap) return false;
  return !sameClean(form.mobile, phoneSnap.mobile)
    || !sameClean(form.phone_cc, phoneSnap.phone_cc)
    || !sameClean(form.phone_national, phoneSnap.phone_national);
}

function addrDirty() {
  if (!addrSnap) return false;
  return !sameClean(form.address, addrSnap.address)
    || !sameClean(billingStreetOf(form), billingStreetOf(addrSnap))
    || !sameClean(form.address_place, addrSnap.address_place)
    || !sameClean(form.district, addrSnap.district);
}

function districtWasLabel(code) {
  const c = String(code || '');
  if (!c) return '';
  const t = TERRITORIES.find((x) => x.code === c);
  return t ? `${t.label} (${t.code})` : c;
}

function paintWas(id, matched, prev) {
  const el = document.getElementById(id);
  if (!el) return;
  if (matched !== false) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  const v = String(prev || '');
  el.textContent = v ? 'was: ' + v : 'was:';
  el.hidden = false;
}

function snapPhoneNow() {
  return {
    mobile: form.mobile || '',
    phone_cc: form.phone_cc || '',
    phone_national: form.phone_national || '',
  };
}

function snapAddrNow() {
  return {
    address: form.address || '',
    address_line1: form.address_line1 || '',
    address_street: form.address_street || '',
    address_place: form.address_place || '',
    address_extra: form.address_extra || '',
    district: form.district || '',
  };
}

function writePhoneFields() {
  const full = $('#mobileInput');
  const cc = $('#formPhoneCc');
  const nat = $('#formPhoneNational');
  if (full) full.value = form.mobile || '';
  if (cc) cc.value = form.phone_cc || '';
  if (nat) nat.value = form.phone_national || '';
  sizeFullBox(full, 1, 2);
}

function writeAddrFields() {
  const full = $('#addressInput');
  const street = $('#formAddrStreet');
  const place = $('#formAddrPlace');
  const terr = $('#districtInput');
  if (full) full.value = form.address || '';
  if (street) street.value = billingStreetOf(form);
  if (place) place.value = form.address_place || '';
  if (terr) terr.value = form.district || '';
  sizeFullBox(full, 1, 4);
}

function paintPhoneCleanColors() {
  const apply = $('#phoneApplyBtn');
  const matchFull = phoneSnap ? sameClean(form.mobile, phoneSnap.mobile) : true;
  const matchCc = phoneSnap ? sameClean(form.phone_cc, phoneSnap.phone_cc) : true;
  const matchNat = phoneSnap ? sameClean(form.phone_national, phoneSnap.phone_national) : true;
  setCleanClass($('#mobileInput'), matchFull);
  setCleanClass($('#formPhoneCc'), matchCc);
  setCleanClass($('#formPhoneNational'), matchNat);
  paintWas('wasMobile', matchFull, phoneSnap && phoneSnap.mobile);
  paintWas('wasPhoneCc', matchCc, phoneSnap && phoneSnap.phone_cc);
  paintWas('wasPhoneNational', matchNat, phoneSnap && phoneSnap.phone_national);
  if (apply) apply.hidden = matchFull && matchCc && matchNat;
}

function paintAddrCleanColors() {
  const apply = $('#addrApplyBtn');
  const matchFull = addrSnap ? sameClean(form.address, addrSnap.address) : true;
  const matchStreet = addrSnap ? sameClean(billingStreetOf(form), billingStreetOf(addrSnap)) : true;
  const matchPlace = addrSnap ? sameClean(form.address_place, addrSnap.address_place) : true;
  const matchDist = addrSnap ? sameClean(form.district, addrSnap.district) : true;
  setCleanClass($('#addressInput'), matchFull);
  setCleanClass($('#formAddrStreet'), matchStreet);
  setCleanClass($('#formAddrPlace'), matchPlace);
  setCleanClass($('#districtInput'), matchDist);
  paintWas('wasAddress', matchFull, addrSnap && addrSnap.address);
  paintWas('wasAddrStreet', matchStreet, addrSnap && billingStreetOf(addrSnap));
  paintWas('wasAddrPlace', matchPlace, addrSnap && addrSnap.address_place);
  paintWas('wasAddrDistrict', matchDist, addrSnap && districtWasLabel(addrSnap.district));
  if (apply) apply.hidden = matchFull && matchStreet && matchPlace && matchDist;
}

function restorePhoneIfPending() {
  if (!phoneSnap) return;
  form.mobile = phoneSnap.mobile;
  form.phone_cc = phoneSnap.phone_cc;
  form.phone_national = phoneSnap.phone_national;
  writePhoneFields();
  paintPhoneCleanColors();
}

function restoreAddrIfPending() {
  if (!addrSnap) return;
  form.address = addrSnap.address;
  form.address_line1 = addrSnap.address_line1;
  form.address_street = addrSnap.address_street;
  form.address_place = addrSnap.address_place;
  form.address_extra = addrSnap.address_extra;
  form.district = addrSnap.district;
  writeAddrFields();
  paintAddrCleanColors();
}

export function applyPhoneClean() {
  phoneSnap = snapPhoneNow();
  paintPhoneCleanColors();
}

export function applyAddrClean() {
  addrSnap = snapAddrNow();
  paintAddrCleanColors();
}

export function runPhoneClean(rawOverride) {
  if (!phoneSnap) phoneSnap = snapPhoneNow();
  const raw = rawOverride != null
    ? rawOverride
    : (form.mobile || composePhone(form.phone_cc, form.phone_national));
  const parsed = parsePhone(raw);
  form.phone_cc = parsed.country || '';
  form.phone_national = parsed.national || '';
  form.mobile = parsed.full || composePhone(form.phone_cc, form.phone_national);
  writePhoneFields();
  paintPhoneCleanColors();
}

export function runAddrClean(rawOverride) {
  if (!addrSnap) addrSnap = snapAddrNow();
  const raw = rawOverride != null ? rawOverride : (form.address || '');
  const parsed = parseAddress(raw);
  form.address_line1 = parsed.line1 || '';
  form.address_street = parsed.street || '';
  form.address_place = parsed.district || '';
  form.district = parsed.code || '';
  form.address_extra = parsed.extra || form.address_extra || '';
  form.address = parsed.composed || '';
  writeAddrFields();
  paintAddrCleanColors();
}

function isMessyPhone(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/[A-Za-z]/.test(t)) return true;
  if (/[\s\-()[\]]/.test(t)) return true;
  if (/^00/.test(t)) return true;
  return false;
}

function isMessyAddress(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\n|\t/.test(t)) return true;
  if ((t.match(/,/g) || []).length >= 2) return true;
  return false;
}

function syncFormPhone() {
  const full = composePhone(form.phone_cc, form.phone_national);
  form.mobile = full;
  const el = $('#mobileInput');
  if (el) el.value = full;
  sizeFullBox(el, 1, 2);
}

function syncFormAddress() {
  const composed = composeFullAddress({
    line1: form.address_line1,
    street: form.address_street,
    district: form.address_place,
    code: form.district,
  });
  form.address = composed;
  const el = $('#addressInput');
  if (el) el.value = composed;
  sizeFullBox(el, 1, 4);
}

function bindFormPhone() {
  const cc = $('#formPhoneCc');
  const nat = $('#formPhoneNational');
  const full = $('#mobileInput');
  if (cc) {
    cc.addEventListener('input', (e) => {
      form.phone_cc = String(e.target.value || '').replace(/\D/g, '');
      syncFormPhone();
      paintPhoneCleanColors();
    });
  }
  if (nat) {
    nat.addEventListener('input', (e) => {
      form.phone_national = String(e.target.value || '').replace(/\D/g, '');
      syncFormPhone();
      paintPhoneCleanColors();
    });
    nat.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!isMessyPhone(text)) return;
      e.preventDefault();
      runPhoneClean(text);
    });
  }
  if (full) {
    full.addEventListener('input', (e) => {
      const v = e.target.value;
      form.mobile = v;
      sizeFullBox(full, 1, 2);
      if (!String(v).trim()) {
        form.phone_cc = '';
        form.phone_national = '';
        if (cc) cc.value = '';
        if (nat) nat.value = '';
        paintPhoneCleanColors();
        return;
      }
      const p = parsePhone(v);
      if (p.resolved && p.full) {
        form.phone_cc = p.country;
        form.phone_national = p.national;
        form.mobile = p.full;
        if (cc) cc.value = form.phone_cc;
        if (nat) nat.value = form.phone_national;
        full.value = form.mobile;
      }
      paintPhoneCleanColors();
    });
    full.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!isMessyPhone(text)) return;
      e.preventDefault();
      runPhoneClean(text);
    });
    full.addEventListener('blur', () => {
      const raw = String(form.mobile || '').trim();
      if (!raw) return;
      runPhoneClean(raw);
    });
  }
}

function bindFormAddress() {
  const street = $('#formAddrStreet');
  const place = $('#formAddrPlace');
  const terr = $('#districtInput');
  const full = $('#addressInput');
  if (street) {
    street.addEventListener('input', (e) => {
      form.address_street = e.target.value;
      form.address_line1 = '';
      syncFormAddress();
      paintAddrCleanColors();
    });
  }
  if (place) {
    place.addEventListener('input', (e) => {
      form.address_place = e.target.value;
      syncFormAddress();
      paintAddrCleanColors();
    });
  }
  if (terr) {
    terr.addEventListener('change', (e) => {
      form.district = e.target.value;
      syncFormAddress();
      paintAddrCleanColors();
    });
  }
  if (full) {
    full.addEventListener('input', (e) => {
      form.address = e.target.value;
      sizeFullBox(full, 1, 4);
      paintAddrCleanColors();
    });
    full.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!isMessyAddress(text)) return;
      e.preventDefault();
      runAddrClean(text);
    });
    full.addEventListener('blur', () => {
      const raw = String(form.address || '').trim();
      if (!raw) return;
      runAddrClean(raw);
    });
  }
}

function phonePayload(src = form) {
  const cc = String(src.phone_cc || '').replace(/\D/g, '');
  const nat = String(src.phone_national || '').replace(/\D/g, '');
  const mobile = String(src.mobile || '').trim();
  if (!cc && !nat && !mobile) return { mobile: '', phone_cc: '', phone_national: '' };
  const parsed = parsePhone(composePhone(cc, nat) || mobile);
  if (!parsed.full) return { mobile: '', phone_cc: '', phone_national: '' };
  return { mobile: parsed.full, phone_cc: parsed.country, phone_national: parsed.national };
}

function addressPayload(src = form) {
  const line1 = collapseAddr(src.address_line1);
  const street = collapseAddr(src.address_street);
  const place = collapseAddr(src.address_place);
  const extra = collapseAddr(src.address_extra);
  const code = src.district || '';
  const composed = composeFullAddress({ line1, street, district: place, code }) || collapseAddr(src.address);
  if (!line1 && !street && !place && !composed && !code) {
    return {
      address: '',
      address_line1: '',
      address_street: '',
      address_place: '',
      address_extra: '',
      district: '',
    };
  }
  return {
    address: composed,
    address_line1: line1,
    address_street: street,
    address_place: place,
    address_extra: extra,
    district: code,
  };
}

function collapseAddr(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function toast(msg) {
  window.dispatchEvent(new CustomEvent('be:toast', { detail: msg }));
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}


