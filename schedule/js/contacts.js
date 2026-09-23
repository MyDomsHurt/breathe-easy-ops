import { contactDisplayName } from '../../shared/contact.js';
import { allContacts, importContacts, usingContactsFirestore } from './contacts-store.js?v=1';
import { contactsFromCsv } from './contacts-import.js?v=1';
import { esc, formatMoney } from './utils.js';

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

export function filterContacts(list, query) {
  const q = String(query || '').trim().toLowerCase();
  const rows = Array.isArray(list) ? list.slice() : [];
  rows.sort((a, b) => {
    const an = contactDisplayName(a).toLowerCase();
    const bn = contactDisplayName(b).toLowerCase();
    return an.localeCompare(bn);
  });
  if (!q) return rows;
  const qDigits = digits(q);
  return rows.filter((c) => {
    const name = contactDisplayName(c).toLowerCase();
    if (name.includes(q)) return true;
    if (qDigits && digits(c.phone).includes(qDigits)) return true;
    return false;
  });
}

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
  return `
    <div class="contact-pane-body">
      <h2>${esc(contactDisplayName(c))}</h2>
      ${kv('Phone', c.phone)}
      ${kv('Full address', c.address)}
      ${kv('Billing split', split.length ? split.join(', ') : '')}
      ${kv('Line 1', c.address_line1)}
      ${kv('Street', c.address_street)}
      ${kv('Place', c.address_place)}
      ${kv('Territory', c.address_territory)}
      ${kv('Deals', c.deals == null ? '' : c.deals)}
      ${kv('Revenue', c.revenue == null ? '' : formatMoney(c.revenue))}
    </div>`;
}

export function renderContacts(el, { query, selectedId } = {}) {
  if (!el) return;
  const q = query || '';
  const all = allContacts();
  if (!all.length) {
    el.innerHTML = `<div class="contacts-empty">
      <p>No contacts yet.</p>
      <p class="contacts-empty-sub">Import a HubSpot all-contacts CSV to fill this page.</p>
    </div>`;
    return;
  }
  const rows = filterContacts(all, q);
  const selected = rows.find((c) => c.hubspot_id === selectedId) || rows[0] || null;
  el.innerHTML = `<div class="contacts-layout">
      <div class="contacts-list" role="list">
        ${rows.map((c) => {
          const on = selected && c.hubspot_id === selected.hubspot_id ? ' on' : '';
          return `<button type="button" class="contacts-row${on}" data-contact="${esc(c.hubspot_id)}" role="listitem">
            <strong>${esc(contactDisplayName(c))}</strong>
            <span>${esc(c.phone || '')}</span>
          </button>`;
        }).join('') || `<div class="contacts-empty-sub">No matches</div>`}
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
