import { DISTRICTS, JOB_TYPES, PAYMENTS, TEAMS, TEAM_META, UNIT_TYPES } from './config.js';
import { overlapWarning, stackOrderOnSave, suggestTeams, teamMembersOnDay } from './capacity.js';
import { addJob, allJobs, removeJob, updateJob } from './store.js';
import { uniqueClientsFrom } from './seed.js';
import { highlightOf } from '../../shared/job.js';
import { acsLabel, emptyUnits, formatDay, jobStatus, jobTypeOf, NOTES1_MAX, parseAcs, shortTime } from './utils.js';

let form = {
  job_id: '',
  client_name: '',
  mobile: '',
  address: '',
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
};

function $(sel) {
  return document.querySelector(sel);
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

function logPanelHtml() {
  const rows = Array.isArray(form.changes) ? form.changes.slice().reverse() : [];
  const body = rows.length
    ? `<ul class="log-list">${rows.map((row) => `<li>${escapeAttr(formatLogAt(row.at))} · ${escapeAttr(row.by || '—')} · ${escapeAttr(row.action)}</li>`).join('')}</ul>`
    : '<p class="log-empty">No changes yet</p>';
  return `
    <div class="log-wrap">
      <button type="button" class="icon-btn log-btn" id="toggleLog" aria-expanded="false" title="Change log" aria-label="Change log">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <path d="M8 7h8M8 11h8M8 15h5"/>
        </svg>
      </button>
      <div id="changeLog" class="log-panel" hidden>${body}</div>
    </div>`;
}

export function openBooking(prefill = {}) {
  const jobs = allJobs();
  const editing = Boolean(prefill.job_id);
  const units = {
    ...emptyUnits(),
    ...(prefill.units || (prefill.acs != null || editing ? parseAcs(prefill.acs) : {})),
  };
  form = {
    job_id: prefill.job_id || '',
    client_name: prefill.client_name || '',
    mobile: prefill.mobile || '',
    address: prefill.address || '',
    district: prefill.district || '',
    units,
    date: prefill.date || '',
    time: prefill.time || '',
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
    receipt: prefill.receipt,
    source: prefill.source,
  };
  if (!form.date) form.date = new Date().toISOString().slice(0, 10);
  if (form.job_type !== 'cleaning') form.units = emptyUnits();
  if (!form.team_lead) {
    const ranked = suggestTeams(jobs, { date: form.date, district: form.district });
    form.team_lead = ranked[0]?.team || 'Josh';
  }
  renderForm();
  const root = $('#bookingRoot');
  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');
  if (!editing) setTimeout(() => $('#clientSearch')?.focus(), 30);
}

export function closeBooking() {
  const root = $('#bookingRoot');
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
}

function others() {
  return allJobs().filter((j) => j.job_id !== form.job_id);
}

function renderForm() {
  const jobs = others();
  const ranked = suggestTeams(jobs, { date: form.date, district: form.district });
  if (form.team_lead && !ranked.find((r) => r.team === form.team_lead)) {
    form.team_lead = ranked[0]?.team || form.team_lead;
  }
  const best = ranked[0];
  const warn = overlapWarning(jobs, { date: form.date, team: form.team_lead, time: form.time });
  const selected = ranked.find((r) => r.team === form.team_lead);
  const selectedJobs = selected?.jobCount || 0;
  const selectedAreas = selected?.dayDistricts?.length ? selected.dayDistricts.join(', ') : '';
  const editing = Boolean(form.job_id);
  const headWhen = [form.date ? formatDay(form.date, { weekday: 'short' }) : 'Pick a date', form.team_lead || 'choose team', form.time ? shortTime(form) : '']
    .filter(Boolean)
    .join(' · ');

  $('#bookingRoot').innerHTML = `
    <div class="drawer-bg" data-close="1"></div>
    <aside class="drawer" role="dialog" aria-label="${editing ? 'Edit booking' : 'New booking'}">
      <div class="drawer-head">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <h2>${editing ? 'Edit booking' : 'New booking'}</h2>
            <p>${headWhen}${form.status === 'tentative' ? ' · Tentative' : ''}</p>
          </div>
          <div class="head-btns">
            ${editing ? logPanelHtml() : ''}
            <button class="icon-btn" data-close="1" aria-label="Close">✕</button>
          </div>
        </div>
      </div>
      <div class="drawer-body">
        <section class="form-block form-block-lead">
          <div class="field${fieldClass('team')}">
            <label>Team ${holdChip('team', 'team')}</label>
            ${warn ? `<div class="team-warn">${warn}. You can still book.</div>` : ''}
            <div class="team-picker">
              ${TEAMS.map((team) => `
                <button type="button" class="team-pick ${form.team_lead === team ? 'on' : ''}" data-team="${team}" style="--team:${TEAM_META[team].color};--team-soft:${TEAM_META[team].soft}">
                  <i class="team-pip"></i><span>${team}</span>
                </button>
              `).join('')}
            </div>
            <div class="team-context">${selectedJobs} job${selectedJobs === 1 ? '' : 's'}${selectedAreas ? ' · ' + selectedAreas : ''}${best && best.team !== form.team_lead ? ' · Suggested ' + best.team : ''}</div>
          </div>
        </section>

        <section class="form-block">
          <div class="field field-primary${fieldClass('client')}">
            <label>Client ${holdChip('client', 'client')}</label>
            <div class="typeahead">
              <input id="clientSearch" type="search" placeholder="Name or mobile" value="${escapeAttr(form.client_name)}" autocomplete="off" />
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
              <input id="timeInput" value="${escapeAttr(form.time)}" />
            </div>
          </div>
        </section>

        <section class="form-block form-block-quiet">
          <div class="grid-2">
            <div class="field${fieldClass('mobile')}">
              <label>Mobile ${holdChip('mobile', 'mobile')}</label>
              <input id="mobileInput" value="${escapeAttr(form.mobile)}" />
            </div>
            <div class="field${fieldClass('district')}">
              <label>District ${holdChip('district', 'district')}</label>
              <select id="districtInput">
                <option value="">Select</option>
                ${Object.entries(DISTRICTS).map(([k, v]) => `<option value="${k}" ${form.district === k ? 'selected' : ''}>${v.short} · ${v.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field${fieldClass('address')}">
            <label>Address ${holdChip('address', 'address')}</label>
            <input id="addressInput" value="${escapeAttr(form.address)}" />
          </div>
        </section>

        <section class="form-block">
          <div class="field${fieldClass('acs')}">
            <label>ACs ${holdChip('acs', 'ACs')}</label>
            <div class="unit-strip">
              ${UNIT_TYPES.map((u) => `
                <div class="unit ${(form.units[u.id] || 0) ? 'on' : ''}">
                  <span class="unit-code">${u.id}</span>
                  <b>${form.units[u.id] || 0}</b>
                  <div class="unit-ctrl">
                    <button type="button" data-unit="${u.id}" data-delta="-1" aria-label="Fewer ${u.id}">−</button>
                    <button type="button" data-unit="${u.id}" data-delta="1" aria-label="More ${u.id}">+</button>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="field${fieldClass('notes')}">
            <label>Notes 1 ${holdChip('notes', 'notes')} <span id="notes1Count" class="notes-count">${String(form.notes || '').length}/${NOTES1_MAX}</span></label>
            <textarea id="notesInput" rows="3" maxlength="${NOTES1_MAX}" placeholder="Shown on the board">${escapeAttr(form.notes)}</textarea>
          </div>
          <div class="field${fieldClass('notes_long')}">
            <label>Notes 2 ${holdChip('notes_long', 'notes 2')}</label>
            <textarea id="notesLongInput" class="notes-long" rows="5" placeholder="Extra detail — drawer only">${escapeAttr(form.notes_long)}</textarea>
          </div>
        </section>

        <section class="form-block form-block-meta">
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
          <div class="field${fieldClass('invoice')}" style="margin-top:10px">
            <label>Invoice ${holdChip('invoice', 'invoice')}</label>
            <input id="invoiceInput" value="${escapeAttr(form.invoice || '')}" placeholder="Inv" />
          </div>
        </section>
      </div>
      <div class="drawer-foot">
        ${editing ? `<p class="foot-audit">Created by ${escapeAttr(String(form.created_by || '').trim() || '—')} · Last edit ${escapeAttr(String(form.updated_by || '').trim() || '—')}</p>` : ''}
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
}

function bindForm() {
  const root = $('#bookingRoot');
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
      if (open) logPanel.removeAttribute('hidden');
      else logPanel.setAttribute('hidden', '');
      logBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  $('#clientSearch').addEventListener('input', (e) => {
    form.client_name = e.target.value;
    renderHits(e.target.value);
  });
  $('#mobileInput').addEventListener('input', (e) => { form.mobile = e.target.value; });
  $('#addressInput').addEventListener('input', (e) => { form.address = e.target.value; });
  $('#districtInput').addEventListener('change', (e) => { form.district = e.target.value; renderForm(); });
  $('#dateInput').addEventListener('change', (e) => { form.date = e.target.value; renderForm(); });
  $('#timeInput').addEventListener('input', (e) => { form.time = e.target.value; });
  $('#timeInput').addEventListener('change', (e) => { form.time = e.target.value; renderForm(); });
  $('#typeInput').addEventListener('change', (e) => { form.job_type = e.target.value; renderForm(); });
  $('#payInput').addEventListener('change', (e) => { form.payment = e.target.value; });
  $('#amountInput').addEventListener('input', (e) => {
    form.amount = e.target.value === '' ? '' : Number(e.target.value);
  });
  $('#notesInput').addEventListener('input', (e) => {
    form.notes = String(e.target.value || '').slice(0, NOTES1_MAX);
    if (e.target.value !== form.notes) e.target.value = form.notes;
    const count = $('#notes1Count');
    if (count) count.textContent = `${form.notes.length}/${NOTES1_MAX}`;
  });
  $('#notesLongInput').addEventListener('input', (e) => { form.notes_long = e.target.value; });
  $('#invoiceInput').addEventListener('input', (e) => { form.invoice = e.target.value; });
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
      const id = btn.dataset.unit;
      const delta = Number(btn.dataset.delta);
      form.units[id] = Math.max(0, (form.units[id] || 0) + delta);
      renderForm();
    });
  });
  root.querySelectorAll('[data-team]').forEach((btn) => {
    btn.addEventListener('click', () => { form.team_lead = btn.dataset.team; renderForm(); });
  });
  $('#saveBooking').addEventListener('click', () => save('confirmed'));
  $('#saveTentative').addEventListener('click', () => save('tentative'));
  const del = $('#deleteBooking');
  if (del) del.addEventListener('click', cancelJob);
}

function renderHits(q) {
  const box = $('#clientHits');
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
      form.address = client.address;
      form.district = client.district;
      renderForm();
    });
  });
}

function save(status = 'confirmed') {
  if (!form.client_name.trim()) {
    toast('Add a client name first');
    $('#clientSearch')?.focus();
    return;
  }
  if (!form.date || !form.team_lead) {
    toast('Date and team are required');
    return;
  }
  const notesRaw = form.job_type === 'influencer' && !/influencer/i.test(form.notes || '')
    ? `Influencer (Free)${form.notes ? ' — ' + form.notes : ''}`
    : form.notes;
  const notes = String(notesRaw || '').slice(0, NOTES1_MAX);
  const jobs = allJobs();
  const prev = form.job_id ? jobs.find((j) => j.job_id === form.job_id) : null;
  const payload = {
    ...form,
    status: status === 'tentative' ? 'tentative' : 'confirmed',
    acs: form.job_type === 'cleaning' ? acsLabel(form.units) : '',
    units: form.units,
    notes,
    notes_long: form.notes_long,
    invoice: form.invoice || '',
    highlight: highlightOf({ highlight: form.highlight }),
    time: String(form.time || '').trim(),
    payment: form.payment,
    payment_status: paymentStatusFromLabel(form.payment),
    team_members: teamMembersOnDay(jobs, form.date, form.team_lead),
    amount: form.job_type === 'cleaning'
      ? (form.amount === '' || form.amount == null ? null : Number(form.amount))
      : null,
    stack_order: stackOrderOnSave(jobs, form.date, form.team_lead, prev),
  };
  delete payload.created_by;
  delete payload.created_at;
  delete payload.updated_by;
  delete payload.updated_at;
  delete payload.changes;
  delete payload.highlight_time;
  delete payload.highlight_notes;
  const job = form.job_id ? updateJob(form.job_id, payload) : addJob(payload);
  closeBooking();
  window.dispatchEvent(new CustomEvent('be:booked', { detail: job }));
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

function toast(msg) {
  window.dispatchEvent(new CustomEvent('be:toast', { detail: msg }));
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}


