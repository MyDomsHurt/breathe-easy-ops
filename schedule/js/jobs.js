import { DISTRICTS, TEAM_META } from './config.js';
import { esc, formatDay, formatMoney, jobTypeOf, shortAddress, shortNotes, shortTime } from './utils.js';

function displayMobile(mobile) {
  const d = String(mobile || '').replace(/\s+/g, '');
  if (d.length === 8) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return d;
}

export function searchJobs(jobs, query, limit = 8) {
  const s = String(query || '').trim().toLowerCase();
  if (s.length < 2) return [];
  const hits = [];
  for (const j of jobs) {
    const hay = [j.client_name, j.mobile, j.address, j.district, j.notes, j.invoice, j.job_id, j.acs, j.team_lead]
      .join(' ')
      .toLowerCase();
    if (hay.includes(s)) hits.push(j);
    if (hits.length >= limit) break;
  }
  return hits;
}

export function renderSearchHits(el, jobs, query) {
  if (!el) return [];
  const s = String(query || '').trim();
  if (s.length < 2) {
    el.hidden = true;
    el.innerHTML = '';
    return [];
  }
  const hits = searchJobs(jobs, s, 8);
  if (!hits.length) {
    el.hidden = false;
    el.innerHTML = `<div class="search-empty">No matches</div>`;
    return [];
  }
  el.hidden = false;
  el.innerHTML = hits.map((j) => {
    const type = jobTypeOf(j);
    const mark = type === 'return' ? 'RET' : type === 'influencer' ? 'INF' : (j.acs || '');
    const when = [formatDay(j.date), shortTime(j), j.team_lead, j.district].filter(Boolean).join(' · ');
    const place = [shortAddress(j), mark].filter(Boolean).join(' · ');
    const notes = shortNotes(j, 72);
    return `<button type="button" class="search-hit" data-jump-job="${esc(j.job_id)}">
      <div class="search-hit-id">
        <strong>${esc(j.client_name || 'Job')}</strong>
        ${j.mobile ? `<span class="search-hit-mobile">${esc(displayMobile(j.mobile))}</span>` : ''}
      </div>
      <div class="search-hit-when">${esc(when)}</div>
      <div class="search-hit-place">${esc(place)}</div>
      ${notes ? `<div class="search-hit-notes">${esc(notes)}</div>` : ''}
    </button>`;
  }).join('');
  return hits;
}

export function renderJobsList(el, jobs, query) {
  const q = String(query || '').trim().toLowerCase();
  const rows = jobs.filter((j) => {
    if (!q) return true;
    return [j.client_name, j.mobile, j.address, j.notes, j.acs, j.invoice, j.team_lead, j.district]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  if (!rows.length) {
    el.innerHTML = `<div class="board-wrap" style="padding:40px;text-align:center;color:#64748b">No jobs match.</div>`;
    return;
  }

  el.innerHTML = `<table class="jobs-table">
    <thead>
      <tr>
        <th>When</th>
        <th>Client</th>
        <th>Team</th>
        <th>Type</th>
        <th>ACs</th>
        <th>Area</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((j) => {
        const type = jobTypeOf(j);
        return `<tr data-job="${j.job_id}">
          <td>
            <strong>${formatDay(j.date)}</strong>
            <div style="color:#64748b;font-size:12px">${j.time || ''}</div>
          </td>
          <td>
            <strong>${j.client_name}</strong>
            <div style="color:#64748b;font-size:12px">${j.mobile || ''}</div>
          </td>
          <td><span style="display:inline-block;padding:2px 7px;border-radius:999px;background:${TEAM_META[j.team_lead]?.soft || '#eee'};color:${TEAM_META[j.team_lead]?.ink || '#333'};font-weight:700;font-size:12px">${j.team_lead}</span></td>
          <td>${typeBadge(type)}</td>
          <td>${j.acs || '—'}</td>
          <td>${j.district || '—'}</td>
          <td>${type === 'cleaning' ? formatMoney(j.amount) : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function typeBadge(type) {
  if (type === 'return') return '<span class="tag return">RETURN</span>';
  if (type === 'influencer') return '<span class="tag influencer">INFLUENCER</span>';
  return '<span style="font-size:12px;font-weight:700;color:#0f766e">Cleaning</span>';
}

export function renderJobModal(el, job) {
  if (!job) {
    el.classList.remove('open');
    el.innerHTML = '';
    return;
  }
  const type = jobTypeOf(job);
  const dist = DISTRICTS[job.district];
  const maps = job.address
    ? `<a href="https://maps.google.com/?q=${encodeURIComponent(job.address)}" target="_blank" rel="noopener" class="ghost-btn" style="display:inline-block;margin-top:8px;text-decoration:none">Open in Maps</a>`
    : '';
  el.classList.add('open');
  el.innerHTML = `
    <div class="modal-bg" data-close-modal="1"></div>
    <div class="modal">
      <div class="modal-head">
        <div>
          <div style="font-size:12px;opacity:.8">${formatDay(job.date, { weekday: 'long' })} · ${job.time || ''}</div>
          <h2 style="margin:4px 0 0;font-size:20px">${job.client_name}</h2>
        </div>
        <button class="icon-btn" data-close-modal="1" style="background:transparent;color:white;border-color:rgba(255,255,255,.3)">✕</button>
      </div>
      <div class="modal-body">
        ${kv('Type', typeBadge(type))}
        ${kv('Team', `${job.team_lead}${job.team_members ? ' · ' + job.team_members : ''}`)}
        ${kv('ACs', job.acs || (type === 'return' ? '— (empty → return)' : '—'))}
        ${kv('Amount', type === 'cleaning' ? formatMoney(job.amount) : '—')}
        ${kv('Payment', job.payment || '—')}
        ${kv('Mobile', job.mobile || '—')}
        ${kv('Address', `${job.address || '—'}${maps}`)}
        ${kv('District', dist ? `${dist.short} · ${dist.label}` : (job.district || '—'))}
        ${kv('Invoice', job.invoice || '—')}
        ${kv('Notes', job.notes || '—')}
        ${kv('Job ID', job.job_id)}
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="primary-btn" data-edit-job="${job.job_id}" type="button">Edit / move</button>
          <button class="ghost-btn" data-cancel-job="${job.job_id}" type="button" style="color:#b91c1c;border-color:#fecaca">Cancel job</button>
        </div>
      </div>
    </div>
  `;
}

function kv(k, v) {
  return `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`;
}
