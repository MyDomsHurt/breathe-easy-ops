import { contactDisplayName } from '../../shared/contact.js';
import { allContacts, importContacts, usingContactsFirestore } from './contacts-store.js?v=1';
import { contactsFromCsv } from './contacts-import.js?v=2';
import { queryContacts, uniqueContactValues } from './contacts-query.js?v=2';
import {
  contactJobFields,
  contactJobHref,
  contactJobsSummary,
  formatContactJobDate,
  splitJobsForContact,
} from './contact-jobs.js?v=4';
import { esc, formatMoney } from './utils.js';

export { queryContacts, uniqueContactValues };

function text(value) {
  return value == null ? '' : String(value).trim();
}

function kv(label, value) {
  const v = text(value);
  if (!v) return '';
  return `<div class="contact-kv"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
}

function billingSplit(c) {
  return [
    c && c.address_line1,
    c && c.address_street,
    c && c.address_place,
    c && c.address_territory,
  ].map(text).filter(Boolean).join(', ');
}

function hubspotRow(c) {
  const bits = [];
  if (c && c.deals != null && c.deals !== '') bits.push(String(c.deals));
  if (c && c.revenue != null && c.revenue !== '') {
    const n = Number(c.revenue);
    if (Number.isFinite(n)) bits.push(formatMoney(n));
  }
  if (!bits.length) return '';
  return kv('HubSpot', bits.join(' · '));
}

function payClass(pay) {
  if (pay === 'Unpaid') return 'is-unpaid';
  if (pay === 'Paid') return 'is-paid';
  return '';
}

function jobRow(j) {
  const href = contactJobHref(j);
  if (!href) return '';
  const f = contactJobFields(j);
  const payBit = f.pay
    ? `<span class="compact-pay ${payClass(f.pay)}">${esc(f.pay)}</span>`
    : '';
  return `<li><a class="contact-job job-card job-card-detailed" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
      <div class="compact-row">
        <div class="compact-col compact-col-time">
          ${f.day ? `<span class="compact-time">${esc(f.day)}</span>` : ''}
          ${text(f.time) ? `<span class="detailed-phone">${esc(f.time)}</span>` : ''}
        </div>
        <div class="compact-col compact-col-main">
          ${text(f.team) ? `<span class="compact-name">${esc(f.team)}</span>` : ''}
          ${f.units ? `<span class="compact-units">${esc(f.units)}</span>` : ''}
          ${f.amount ? `<p class="detailed-phone">${esc(f.amount)}</p>` : ''}
          ${f.notes ? `<p class="compact-notes">${esc(f.notes)}</p>` : ''}
        </div>
        <div class="compact-col compact-col-meta">${payBit}</div>
      </div>
    </a></li>`;
}

function jobsSection(title, jobs) {
  if (!jobs || !jobs.length) return '';
  return `<details class="contact-jobs" open>
      <summary>${esc(title)}</summary>
      <ul class="contact-jobs-list">${jobs.map(jobRow).join('')}</ul>
    </details>`;
}

function jobsHtml(c, opts) {
  const jobs = opts && opts.jobs;
  const id = c && c.hubspot_id;
  const grouped = splitJobsForContact(jobs, id, opts && opts.today);
  const sum = contactJobsSummary(jobs, id);
  if (!sum.count) {
    return `<p class="contacts-empty-sub">no job has this contact id</p>`;
  }
  const count = sum.count === 1 ? '1 job' : sum.count + ' jobs';
  const last = sum.last ? 'last ' + formatContactJobDate(sum.last) : '';
  const total = 'total ' + Math.round(sum.total);
  const head = [count, last, total].filter(Boolean).join(' · ');
  return `<p class="contact-jobs-sum">${esc(head)}</p>`
    + jobsSection('Next', grouped.next)
    + jobsSection('Past', grouped.past);
}

export function paneHtml(c, opts) {
  if (!c) {
    return `<div class="contact-pane-empty">Select a contact</div>`;
  }
  const phone = text(c.phone);
  const phoneDd = phone
    ? `${esc(phone)} <button type="button" class="ghost-btn contact-copy" data-copy-phone="${esc(phone)}">Copy</button>`
    : '';
  return `
    <div class="contact-pane-body">
      <h2>${esc(contactDisplayName(c))}</h2>
      ${phoneDd ? `<div class="contact-kv"><dt>Phone</dt><dd>${phoneDd}</dd></div>` : ''}
      ${kv('HubSpot id', c.hubspot_id)}
      ${kv('Owner', c.owner)}
      ${kv('Full address', c.address)}
      ${kv('Line 1', c.address_line1)}
      ${kv('Street', c.address_street)}
      ${kv('Place', c.address_place)}
      ${kv('Territory', c.address_territory)}
      ${kv('Billing split', billingSplit(c))}
      ${kv('Stream', c.stream)}
      ${kv('Tag', c.tag)}
      ${kv('Language', c.language)}
      ${kv('Groups', c.groups)}
      ${hubspotRow(c)}
      ${jobsHtml(c, opts)}
    </div>`;
}

export function fillContactFilterSelect(el, values, current, allLabel) {
  if (!el) return;
  const opts = [`<option value="">${esc(allLabel || 'All')}</option>`].concat(
    (values || []).map((v) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`),
  );
  el.innerHTML = opts.join('');
}

export function renderContacts(el, opts = {}) {
  if (!el) return;
  const all = allContacts();
  const countEl = document.getElementById('contactsCount');
  if (!all.length) {
    if (countEl) countEl.textContent = '';
    el.innerHTML = `<div class="contacts-empty">
      <p>No contacts yet.</p>
      <p class="contacts-empty-sub">Import a HubSpot all-contacts CSV to fill this page.</p>
    </div>`;
    return;
  }
  const rows = queryContacts(all, opts);
  if (countEl) countEl.textContent = `${rows.length} of ${all.length}`;
  const selected = rows.find((c) => c.hubspot_id === opts.selectedId) || rows[0] || null;
  el.innerHTML = `<div class="contacts-layout">
      <div class="contacts-table-wrap">
        <table class="contacts-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c) => {
              const on = selected && c.hubspot_id === selected.hubspot_id ? ' on' : '';
              return `<tr class="contacts-row${on}" data-contact="${esc(c.hubspot_id)}">
                <td>${esc(contactDisplayName(c))}</td>
                <td>${esc(c.phone || '')}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="2" class="contacts-empty-sub">No matches</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="contact-pane">${paneHtml(selected, opts)}</div>
    </div>`;
  return selected;
}

export async function importHubspotFile(file) {
  if (!file) throw new Error('Choose a CSV file');
  if (!usingContactsFirestore()) throw new Error('Sign in to import contacts into the live store');
  const text = await file.text();
  const rows = contactsFromCsv(text);
  if (!rows.length) throw new Error('No contacts with a Record ID in that CSV');
  return importContacts(rows);
}
