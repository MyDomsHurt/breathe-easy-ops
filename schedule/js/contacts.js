import { contactDisplayName } from '../../shared/contact.js';
import { allContacts, importContacts, usingContactsFirestore } from './contacts-store.js?v=1';
import { contactsFromCsv } from './contacts-import.js?v=2';
import { queryContacts, uniqueContactValues } from './contacts-query.js?v=2';
import { contactJobHref, contactJobLine, splitJobsForContact } from './contact-jobs.js?v=3';
import { esc } from './utils.js';

export { queryContacts, uniqueContactValues };

function text(value) {
  return value == null ? '' : String(value).trim();
}

function kv(label, value) {
  const v = text(value);
  if (!v) return '';
  return `<div class="contact-kv"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
}

function addressLine(c) {
  const full = text(c && c.address);
  if (full) return full;
  return [
    c && c.address_line1,
    c && c.address_street,
    c && c.address_place,
    c && c.address_territory,
  ].map(text).filter(Boolean).join(', ');
}

function jobRows(jobs) {
  return (jobs || []).map((j) => {
    const href = contactJobHref(j);
    if (!href) return '';
    return `<li><a class="contact-job" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(contactJobLine(j))}</a></li>`;
  }).join('');
}

function jobsSection(title, jobs) {
  if (!jobs || !jobs.length) return '';
  return `<details class="contact-jobs" open>
      <summary>${esc(title)}</summary>
      <ul class="contact-jobs-list">${jobRows(jobs)}</ul>
    </details>`;
}

function jobsHtml(c, opts) {
  const grouped = splitJobsForContact(opts && opts.jobs, c && c.hubspot_id, opts && opts.today);
  if (!grouped.next.length && !grouped.past.length) {
    return `<p class="contacts-empty-sub">no job has this contact id</p>`;
  }
  return jobsSection('Next', grouped.next) + jobsSection('Past', grouped.past);
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
      ${kv('Address', addressLine(c))}
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
