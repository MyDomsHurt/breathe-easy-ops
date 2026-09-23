import { contactDisplayName } from '../../shared/contact.js';
import { allContacts, importContacts, usingContactsFirestore } from './contacts-store.js?v=1';
import { contactsFromCsv } from './contacts-import.js?v=2';
import { queryContacts, uniqueContactValues } from './contacts-query.js?v=1';
import { esc, formatMoney } from './utils.js';

export { queryContacts, uniqueContactValues };

function kv(label, value) {
  const v = value == null || value === '' ? '—' : String(value);
  return `<div class="contact-kv"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
}

function paneHtml(c) {
  if (!c) {
    return `<div class="contact-pane-empty">Select a contact</div>`;
  }
  const split = [
    c.address_line1,
    c.address_street,
    c.address_place,
    c.address_territory,
  ].filter((x) => x && String(x).trim());
  const phone = c.phone || '';
  return `
    <div class="contact-pane-body">
      <h2>${esc(contactDisplayName(c))}</h2>
      <div class="contact-kv">
        <dt>Phone</dt>
        <dd>${phone ? `${esc(phone)} <button type="button" class="ghost-btn contact-copy" data-copy-phone="${esc(phone)}">Copy</button>` : '—'}</dd>
      </div>
      ${kv('Full address', c.address)}
      ${kv('Billing split', split.length ? split.join(', ') : '')}
      ${kv('Line 1', c.address_line1)}
      ${kv('Street', c.address_street)}
      ${kv('Place', c.address_place)}
      ${kv('Territory', c.address_territory)}
      ${kv('Stream', c.stream)}
      ${kv('Tag', c.tag)}
      ${kv('Language', c.language)}
      ${kv('Groups', c.groups)}
      ${kv('Instagram', c.instagram)}
      ${kv('Owner', c.owner)}
      ${kv('Deals', c.deals == null ? '' : c.deals)}
      ${kv('Revenue', c.revenue == null ? '' : formatMoney(c.revenue))}
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
              <th>Place</th>
              <th>Stream</th>
              <th>Tag</th>
              <th>Deals</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c) => {
              const on = selected && c.hubspot_id === selected.hubspot_id ? ' on' : '';
              return `<tr class="contacts-row${on}" data-contact="${esc(c.hubspot_id)}">
                <td>${esc(contactDisplayName(c))}</td>
                <td>${esc(c.phone || '')}</td>
                <td>${esc(c.address_place || '')}</td>
                <td>${esc(c.stream || '')}</td>
                <td>${esc(c.tag || '')}</td>
                <td>${c.deals == null ? '' : esc(c.deals)}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="6" class="contacts-empty-sub">No matches</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="contact-pane">${paneHtml(selected)}</div>
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
