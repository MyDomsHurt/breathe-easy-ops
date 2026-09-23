/* Breathe-Easy Scheduler — 2026 Full Year */

let allJobs = [];
let filtered = [];
let currentFilters = {
  month: 'all',
  team: 'Matthew',
  type: 'all',
  date: 'all',
  range: 'this_week',
  day: '',
  search: ''
};

const EMAIL_TO_TEAM = {
  'matthewgross2001@gmail.com': 'Matthew',
  'tiagogiri334@gmail.com': 'Tiago',
  'iggi.king@gmail.com': 'Iggi',
  'joshua@breathe-easyhk.com': 'Josh',
  'sudor23@gmail.com': 'Alun',
  'neltrestium@gmail.com': 'Nick'
};

function teamFromEmail(email) {
  const key = String(email || '').toLowerCase().trim();
  return EMAIL_TO_TEAM[key] || '';
}

function lockedTeam() {
  return window.BE_LOCKED_TEAM || '';
}
let viewMode = 'date';

const TEAMS = ['Matthew', 'Tiago', 'Nick', 'Alun', 'Iggi', 'Josh'];
const TEAM_COLORS = {
  Josh: 'bg-violet-100 text-violet-800',
  Matthew: 'bg-sky-100 text-sky-800',
  Tiago: 'bg-emerald-100 text-emerald-800',
  Nick: 'bg-amber-100 text-amber-800',
  Alun: 'bg-rose-100 text-rose-800',
  Iggi: 'bg-indigo-100 text-indigo-800'
};

const DISTRICT_COLORS = {
  'HKN':  { bg: '#CFE2F3', border: '#9FC5E8', text: '#1e3a5f' },
  'HKS':  { bg: '#9FC5E8', border: '#6FA8DC', text: '#1e3a5f' },
  'KLN':  { bg: '#F4CCCC', border: '#EA9999', text: '#5c1a1a' },
  'N-T':  { bg: '#FFF2CC', border: '#FFE599', text: '#5c4a00' },
  'N-TW': { bg: '#FCE4D6', border: '#F9CB9C', text: '#5c3a1a' },
  'TKO':  { bg: '#B6D7A8', border: '#93C47D', text: '#1e3d14' },
  'S-K':  { bg: '#D9EAD3', border: '#B6D7A8', text: '#1e3d14' },
  'L-T':  { bg: '#D9D2E9', border: '#B4A7D6', text: '#2e1a4a' },
  'L-M':  { bg: '#A2C4C9', border: '#76A5AF', text: '#1a3338' }
};
const DISTRICT_FALLBACK = { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };

/* Area tags already live on job.district — never show or search them. */
const DISTRICT_TAG = 'HKN|HKS|HKIS|KLN|TKO|TSW|N\\s*-?\\s*TW?|NTW?|S\\s*-?\\s*K|L\\s*-?\\s*[TM]|LT|LM';

function tidyAddress(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ')
    .replace(/[,\s;，、]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractMapsPin(raw) {
  const m = String(raw || '').match(/https?:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[^\s/]+\/)[^\s]+/i);
  if (!m) return '';
  return m[0].replace(/[),.;]+$/g, '');
}

function stripDistrictTag(raw) {
  if (!raw) return '';
  let a = String(raw);
  a = a.replace(/\/\/\s*pin:?\s*/gi, ' ');
  a = a.replace(/https?:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.)[^\s]+/gi, ' ');
  a = a.replace(new RegExp('[\\(（]{1,2}\\s*(?:' + DISTRICT_TAG + ')\\s*[\\)）(]*', 'gi'), ' ');
  a = a.replace(new RegExp('[,，\\s]+(?:' + DISTRICT_TAG + ')\\s*$', 'i'), '');
  a = a.replace(/[,，\s]+(?:HK|N\.?\s*T\.?)\s*$/i, '');
  a = a.replace(/\(\s*[A-Z]{2,5}\s*-\s*[A-Z]{1,5}\s*\)\s*$/g, '');
  a = a.replace(/\(\s*\d+\s*[SWBCU](?:\s*[+\/&]\s*\d+\s*[SWBCU])*\s*\)/gi, ' ');
  a = a.replace(/,+\s*[a-z]?\s*$/g, '');
  return tidyAddress(a);
}

function displayAddress(raw) {
  const out = tidyAddress(stripDistrictTag(raw).replace(/\s*need a pin\s*$/i, ''));
  return out || String(raw || '').trim();
}

function mapsHref(raw) {
  if (!raw) return null;
  const pin = extractMapsPin(raw);
  if (pin) return pin;
  const q = cleanAddressForMaps(raw);
  if (!q) return null;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function mapsDirQuery(raw) {
  return cleanAddressForMaps(raw) || '';
}

function mapsDirHref(destRaw, originRaw) {
  const dest = mapsDirQuery(destRaw);
  if (!dest) return null;
  let url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest);
  if (originRaw) {
    const origin = mapsDirQuery(originRaw);
    if (!origin) return null;
    url += '&origin=' + encodeURIComponent(origin);
  }
  return url;
}

function nextJobSameDayLead(j) {
  if (!j || !j.date || !j.team_lead) return null;
  const rows = (allJobs || []).filter(function (x) {
    return x && !x.deleted && !isCrewNote(x)
      && x.date === j.date
      && x.team_lead === j.team_lead;
  }).slice().sort(function (a, b) {
    const d = jobSortMinutes(a) - jobSortMinutes(b);
    if (d) return d;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  const idx = rows.findIndex(function (x) { return x.job_id === j.job_id; });
  if (idx < 0) return null;
  return rows[idx + 1] || null;
}

function formatMobile(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.indexOf('852') === 0 && d.length >= 11) d = d.slice(-8);
  if (d.length > 8) d = d.slice(-8);
  if (d.length === 8) return d.slice(0, 4) + ' ' + d.slice(4);
  return d;
}

function timeToMinutes(t) {
  if (!t) return 9999;
  const s = String(t).toLowerCase().replace(/\s+/g, '');
  const m = s.match(/(\d{1,2})(?:[.:](\d{2}))?(am|pm)?/);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : 0;
  const ap = m[3] || '';
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}

function jobSortMinutes(j) {
  const fromTime = timeToMinutes(j.time);
  if (fromTime !== 9999) return fromTime;
  return timeToMinutes(j.client_name || '');
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  const last = n % 10;
  if (last === 1) return n + 'st';
  if (last === 2) return n + 'nd';
  if (last === 3) return n + 'rd';
  return n + 'th';
}

function sameDayTeamJobs(job) {
  const list = (typeof allJobs !== 'undefined' && allJobs.length ? allJobs : []).filter(function (x) {
    return x.date === job.date && x.team_lead === job.team_lead;
  });
  list.sort(function (a, b) {
    const dt = jobSortMinutes(a) - jobSortMinutes(b);
    if (dt !== 0) return dt;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  return list;
}

function vanRequestText(job) {
  const dayJobs = sameDayTeamJobs(job);
  let idx = dayJobs.findIndex(function (x) { return x.job_id === job.job_id; });
  if (idx < 0) idx = 0;
  const n = idx + 1;
  const team = job.team_lead || '';
  const name = job.client_name || '';
  const next = dayJobs[idx + 1];
  const dest = next
    ? ordinal(n + 1) + ' job: ' + (next.client_name || '')
    : 'Office';
  return '*Team ' + team + '*\nVan request\n\n' +
    ordinal(n) + ' job: ' + name + '\n\u2192 ' + dest + '\n\nPickup:\n';
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    }
    document.body.removeChild(ta);
  });
}

function flashVanBtn(btn, label, restore) {
  if (!btn) return;
  btn.textContent = label;
  btn.classList.add('is-copied');
  setTimeout(function () {
    btn.textContent = restore;
    btn.classList.remove('is-copied');
  }, 1600);
}

function getGpsPin(opts) {
  const o = opts || {};
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error('no geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      function (err) { reject(err); },
      {
        enableHighAccuracy: true,
        timeout: o.timeout != null ? o.timeout : 10000,
        maximumAge: o.maximumAge != null ? o.maximumAge : 20000
      }
    );
  });
}

function displayTime(j) {
  const raw = j && j.time ? String(j.time).trim() : '';
  let token = raw;
  if (!token) {
    const s = String(j && j.client_name || '');
    const m = s.match(/(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm)?)/i);
    token = m ? m[1] : '';
  } else {
    token = token.split(/\s*>\s*/)[0].trim();
  }
  if (!token) return '\u2014';
  return formatLunch24(token) || token.replace(/\s+/g, '');
}

function liveAcsBadges(acs) {
  if (!acs) return '';
  const re = /(?<!\d)(\d{1,2})\s*(BEP|UC|S|W|B|C)\b/gi;
  const bits = [];
  let m;
  while ((m = re.exec(String(acs))) !== null) {
    const type = m[2].toUpperCase();
    const kind = type === 'S' ? 's' : type === 'W' ? 'w' : type === 'B' ? 'b' : 'x';
    bits.push('<span class="live-u live-u-' + kind + '">' + esc(m[1] + type) + '</span>');
  }
  if (!bits.length) return '';
  return '<span class="live-units">' + bits.join('') + '</span>';
}

function jobIsPaid(j) {
  const s = j.payment_status != null ? String(j.payment_status).trim().toUpperCase() : '';
  if (s === 'PAID') return true;
  if (s === 'UNPAID') return false;
  return !!(j.receipt && String(j.receipt).trim());
}

function jobMonth(j) {
  if (j.month != null && j.month !== '') return Number(j.month);
  if (j.date) return Number(String(j.date).slice(5, 7));
  return null;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function tomorrowISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

function addDaysISO(iso, n) {
  const d = new Date((iso || todayISO()) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function selectedDayISO() {
  return currentFilters.day || todayISO();
}

function formatDayHeading(iso) {
  return formatDate(iso);
}

function dayWhenBadge(iso) {
  if (iso === todayISO()) return '<span class="day-flag day-flag-today">Today</span>';
  if (iso === tomorrowISO()) return '<span class="day-flag day-flag-tomorrow">Tomorrow</span>';
  return '';
}

function sortJobs(rows) {
  return (rows || []).filter((j) => !j.deleted).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return jobSortMinutes(a) - jobSortMinutes(b);
  });
}

async function loadStaticJobs() {
  let files = [];
  try {
    const man = await fetch('data/manifest.json');
    if (man.ok) files = await man.json();
  } catch (_) {}
  if (files.length) {
    const results = await Promise.all(
      files.map(f => fetch('data/' + f).then(r => (r.ok ? r.json() : [])).catch(() => []))
    );
    const flat = results.flat();
    if (flat.length) return flat;
  }
  const res = await fetch('data/jobs.json');
  if (res.ok) return res.json();
  return [];
}

async function init() {
  try {
    let live = null;
    if (typeof window.BELoadLiveJobs === 'function') {
      live = await window.BELoadLiveJobs();
    }
    if (live && live.length) {
      allJobs = sortJobs(live);
    } else {
      allJobs = sortJobs(await loadStaticJobs());
    }
    if (allJobs.length === 0) throw new Error('No job data found');
    buildTeamButtons();
    buildDateSelect();
    bindEvents();
    applyFilters();
  } catch (err) {
    document.getElementById('jobsContainer').innerHTML =
      '<div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">Failed to load job data.<br><span class="text-sm">' + err.message + '</span></div>';
  }
}

window.BEOnJobsChanged = function (jobs) {
  allJobs = sortJobs(jobs);
  applyFilters();
};

function buildTeamButtons() {
  const sidebar = document.getElementById('teamFilters');
  function fill(container, includeAll) {
    if (!container) return;
    container.innerHTML = '';
    const lock = lockedTeam();
    const names = lock ? [lock] : (includeAll ? ['all'].concat(TEAMS) : TEAMS.slice());
    names.forEach(t => {
      const btn = document.createElement('button');
      btn.dataset.team = t;
      const isActive = currentFilters.team === t;
      btn.className = 'team-btn shrink-0 px-2.5 py-1 rounded-lg text-[13px] font-medium ' +
        (isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200');
      btn.textContent = t === 'all' ? 'All' : t;
      container.appendChild(btn);
    });
  }
  fill(sidebar, true);
  const sel = document.getElementById('techTeamSelect');
  if (sel) {
    const lock = lockedTeam();
    const current = lock || ((!currentFilters.team || currentFilters.team === 'all') ? 'Matthew' : currentFilters.team);
    sel.innerHTML = '';
    (lock ? [lock] : TEAMS).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === current) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.value = current;
    sel.disabled = !!lock;
  }
}

function buildDateSelect() {
  const select = document.getElementById('dateSelect');
  if (!select) return;
  const dates = [...new Set(allJobs.map(j => j.date))].sort();
  dates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = formatDate(d);
    select.appendChild(opt);
  });
}

function bindEvents() {
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActive('.month-btn', btn);
      currentFilters.month = btn.dataset.month;
      applyFilters();
    });
  });
  function onTeamClick(e) {
    const btn = e.target.closest('.team-btn');
    if (!btn) return;
    if (lockedTeam()) {
      currentFilters.team = lockedTeam();
      applyFilters();
      return;
    }
    currentFilters.team = btn.dataset.team;
    document.querySelectorAll('.team-btn').forEach(b => {
      const on = b.dataset.team === currentFilters.team;
      b.classList.toggle('bg-brand-600', on);
      b.classList.toggle('text-white', on);
      b.classList.toggle('bg-slate-100', !on);
      b.classList.toggle('text-slate-700', !on);
      b.classList.toggle('hover:bg-slate-200', !on);
    });
    applyFilters();
  }
  const teamFiltersEl = document.getElementById('teamFilters');
  if (teamFiltersEl) teamFiltersEl.addEventListener('click', onTeamClick);
  const techSelect = document.getElementById('techTeamSelect');
  if (techSelect) {
    techSelect.addEventListener('change', e => {
      currentFilters.team = lockedTeam() || e.target.value || 'Matthew';
      applyFilters();
    });
  }
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActive('.type-btn', btn);
      currentFilters.type = btn.dataset.type;
      applyFilters();
    });
  });
  const dateSelect = document.getElementById('dateSelect');
  if (dateSelect) {
    dateSelect.addEventListener('change', e => {
      currentFilters.date = e.target.value;
      applyFilters();
    });
  }
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentFilters.search = e.target.value.trim().toLowerCase();
        applyFilters();
      }, 200);
    });
  }
  const viewByDate = document.getElementById('viewByDate');
  if (viewByDate) {
    viewByDate.addEventListener('click', () => {
      viewMode = 'date';
      setActive('.view-btn', viewByDate);
      render();
    });
  }
  const viewByTeam = document.getElementById('viewByTeam');
  if (viewByTeam) {
    viewByTeam.addEventListener('click', () => {
      viewMode = 'team';
      setActive('.view-btn', viewByTeam);
      render();
    });
  }
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  applyRoleUI();
  const rangeSelect = document.getElementById('rangeSelect');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', function () {
      selectRange(rangeSelect.value);
    });
  }
  const prevDay = document.getElementById('prevDay');
  const nextDay = document.getElementById('nextDay');
  if (prevDay) prevDay.addEventListener('click', () => shiftDay(-1));
  if (nextDay) nextDay.addEventListener('click', () => shiftDay(1));
  const emptyActions = document.getElementById('emptyActions');
  if (emptyActions) {
    emptyActions.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump-range]');
      if (jump) selectRange(jump.dataset.jumpRange);
    });
  }
  window.addEventListener('resize', syncHeaderHeight);
  syncHeaderHeight();
}

function syncHeaderHeight() {
  const header = document.querySelector('header');
  if (!header) return;
  const h = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--app-header-h', h + 'px');
  const rangeBar = document.getElementById('techRangeBar');
  let barH = 0;
  if (rangeBar && !rangeBar.classList.contains('hidden')) {
    barH = Math.ceil(rangeBar.getBoundingClientRect().height);
  }
  document.documentElement.style.setProperty('--tech-bar-h', barH + 'px');
  document.documentElement.style.setProperty('--day-sticky-top', (h + barH) + 'px');
  const container = document.getElementById('jobsContainer');
  if (container && container.classList.contains('jobs-week-strip')) {
    const top = container.getBoundingClientRect().top;
    const colH = Math.max(160, Math.floor(window.innerHeight - top - 8));
    document.documentElement.style.setProperty('--week-col-h', colH + 'px');
  }
}

function syncWeekStrip(container, dayCount) {
  const on = (currentFilters.range === 'this_week' || currentFilters.range === 'next_week') && dayCount > 0;
  if (container) container.classList.toggle('jobs-week-strip', on);
  document.body.classList.toggle('jobs-week-view', on);
  if (on) requestAnimationFrame(syncHeaderHeight);
}

function scrollDayIntoView(iso) {
  const container = document.getElementById('jobsContainer');
  if (!container || !container.classList.contains('jobs-week-strip')) return;
  const target = container.querySelector('.day-section[data-date="' + iso + '"]');
  if (!target) return;
  target.scrollIntoView({ inline: 'start', block: 'nearest' });
}

function focusedDayISO() {
  const container = document.getElementById('jobsContainer');
  if (container && container.classList.contains('jobs-week-strip')) {
    const cols = container.querySelectorAll('.day-section[data-date]');
    const left = container.getBoundingClientRect().left;
    let best = '';
    let bestDist = Infinity;
    cols.forEach(function (el) {
      const dist = Math.abs(el.getBoundingClientRect().left - left);
      if (dist < bestDist) {
        bestDist = dist;
        best = el.getAttribute('data-date') || '';
      }
    });
    if (best) return best;
  }
  return currentFilters.day || todayISO();
}

function weekForISO(iso) {
  const thisB = getRangeBounds('this_week');
  const nextB = getRangeBounds('next_week');
  if (iso >= thisB.start && iso <= thisB.end) return 'this_week';
  if (iso >= nextB.start && iso <= nextB.end) return 'next_week';
  return '';
}

function datesInBounds(bounds) {
  const out = [];
  if (!bounds || !bounds.start || !bounds.end) return out;
  for (let d = bounds.start; d <= bounds.end; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

function paintRangeButtons(range) {
  const sel = document.getElementById('rangeSelect');
  if (!sel) return;
  const week = range === 'next_week' ? 'next_week' : 'this_week';
  sel.value = week;
}

function selectRange(range) {
  if (range !== 'this_week' && range !== 'next_week') range = 'this_week';
  currentFilters.range = range;
  currentFilters.date = 'all';
  const bounds = getRangeBounds(range);
  const day = currentFilters.day || todayISO();
  if (!bounds || day < bounds.start || day > bounds.end) {
    currentFilters.day = range === 'this_week' ? todayISO() : bounds.start;
  }
  const dateSelect = document.getElementById('dateSelect');
  if (dateSelect) dateSelect.value = 'all';
  paintRangeButtons(range);
  applyFilters();
}

function shiftDay(delta) {
  const next = addDaysISO(focusedDayISO(), delta);
  const range = weekForISO(next);
  if (!range) return;
  currentFilters.day = next;
  if (range !== currentFilters.range) {
    currentFilters.range = range;
    currentFilters.date = 'all';
    const dateSelect = document.getElementById('dateSelect');
    if (dateSelect) dateSelect.value = 'all';
    paintRangeButtons(range);
    applyFilters();
  } else {
    scrollDayIntoView(next);
  }
}

function applyRoleUI() {
  viewMode = 'date';
  const rangeBar = document.getElementById('techRangeBar');
  if (rangeBar) rangeBar.classList.remove('hidden');
  const revenueEl = document.getElementById('revenueTotal');
  if (revenueEl) revenueEl.classList.add('hidden');
  currentFilters.month = 'all';
  currentFilters.date = 'all';
  currentFilters.search = '';
  currentFilters.type = 'all';
  currentFilters.range = 'this_week';
  currentFilters.day = todayISO();
  if (lockedTeam()) currentFilters.team = lockedTeam();
  else if (!currentFilters.team || currentFilters.team === 'all') currentFilters.team = 'Matthew';
  buildTeamButtons();
  paintRangeButtons(currentFilters.range);
  syncHeaderHeight();
}

function setActive(selector, activeBtn) {
  document.querySelectorAll(selector).forEach(b => {
    b.classList.remove('active', 'bg-brand-600', 'text-white');
    b.classList.add('bg-slate-100', 'hover:bg-slate-200');
  });
  activeBtn.classList.add('active', 'bg-brand-600', 'text-white');
  activeBtn.classList.remove('bg-slate-100', 'hover:bg-slate-200');
}

function getRangeBounds(range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today' || range === 'day') {
    const iso = selectedDayISO();
    return { start: iso, end: iso };
  }
  if (range === 'this_week') {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toISODate(monday), end: toISODate(sunday) };
  }
  if (range === 'next_week') {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + mondayOffset);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    return { start: toISODate(nextMonday), end: toISODate(nextSunday) };
  }
  return null;
}

function isCrewNote(job) {
  if (window.BETeamDay && typeof window.BETeamDay.isCrewNote === 'function') {
    return window.BETeamDay.isCrewNote(job);
  }
  return !!(job && (job.source === 'team-day-crew' || String(job.job_id || '').indexOf('crew-') === 0));
}

function cellTeamMembersFor(date, team) {
  if (window.BETeamDay && typeof window.BETeamDay.cellTeamMembers === 'function') {
    return window.BETeamDay.cellTeamMembers(allJobs, date, team);
  }
  return consensusTeamMembers(allJobs, date, team);
}

function findCrewNoteFor(date, team) {
  if (window.BETeamDay && typeof window.BETeamDay.findCrewNote === 'function') {
    return window.BETeamDay.findCrewNote(allJobs, date, team);
  }
  const id = 'crew-' + String(date || '') + '-' + String(team || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  let found = null;
  (allJobs || []).forEach(function (job) {
    if (job.deleted || !isCrewNote(job)) return;
    if (job.job_id === id) found = job;
    else if (!found && job.date === date && job.team_lead === team) found = job;
  });
  return found;
}

function parseLunchMinutes(raw) {
  const s = String(raw || '').trim().replace(/;/g, ':').replace(/\s+/g, '').toLowerCase();
  if (!s) return null;
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h <= 23 && min <= 59) return h * 60 + min;
  }
  const mins = timeToMinutes(s);
  return mins === 9999 ? null : mins;
}

function formatLunch24(raw) {
  const mins = parseLunchMinutes(raw);
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function lunchesOnDate(date) {
  const teams = currentFilters.team !== 'all' ? [currentFilters.team] : TEAMS.slice();
  const out = [];
  teams.forEach(function (team) {
    const note = findCrewNoteFor(date, team);
    const raw = note && String(note.lunch || '').trim();
    const mins = parseLunchMinutes(raw);
    if (mins == null) return;
    out.push({ team: team, time: formatLunch24(raw), mins: mins });
  });
  out.sort(function (a, b) {
    if (a.mins !== b.mins) return a.mins - b.mins;
    return a.team.localeCompare(b.team);
  });
  return out;
}

function lunchRowHtml(row, showTeam) {
  const who = showTeam ? esc(row.team) + ' \u00b7 ' : '';
  return '<div class="lunch-row" data-lunch="1">' +
    '<span class="lunch-label">' + who + 'Lunch</span>' +
    '<span class="lunch-time">' + esc(row.time) + '</span>' +
  '</div>';
}

function cardsWithLunch(jobs, date, teamFilter) {
  const sorted = (jobs || []).slice().sort(function (a, b) {
    return jobSortMinutes(a) - jobSortMinutes(b);
  });
  const lunches = lunchesOnDate(date);
  const bits = [];
  let li = 0;
  sorted.forEach(function (j) {
    const jm = jobSortMinutes(j);
    while (li < lunches.length && lunches[li].mins <= jm) {
      bits.push(lunchRowHtml(lunches[li], teamFilter === 'all'));
      li += 1;
    }
    bits.push(jobCard(j));
  });
  while (li < lunches.length) {
    bits.push(lunchRowHtml(lunches[li], teamFilter === 'all'));
    li += 1;
  }
  return bits.join('');
}

function visibleCrewNotes() {
  const bounds = getRangeBounds(currentFilters.range);
  return allJobs.filter(function (j) {
    if (!isCrewNote(j) || j.deleted) return false;
    if (currentFilters.team !== 'all' && j.team_lead !== currentFilters.team) return false;
    if (currentFilters.date !== 'all' && j.date !== currentFilters.date) return false;
    if (bounds && (j.date < bounds.start || j.date > bounds.end)) return false;
    const who = String(j.team_members || '').trim();
    const lunch = String(j.lunch || '').trim();
    return !!(who || lunch);
  });
}

function applyFilters() {
  if (lockedTeam()) currentFilters.team = lockedTeam();
  const bounds = getRangeBounds(currentFilters.range);
  filtered = allJobs.filter(j => {
    if (isCrewNote(j)) return false;
    if (j.deleted) return false;
    if (currentFilters.month !== 'all' && jobMonth(j) !== Number(currentFilters.month)) return false;
    if (currentFilters.team !== 'all' && j.team_lead !== currentFilters.team) return false;
    if (currentFilters.type === 'clean' && j.is_return) return false;
    if (currentFilters.type === 'return' && !j.is_return) return false;
    if (currentFilters.date !== 'all' && j.date !== currentFilters.date) return false;
    if (bounds && (j.date < bounds.start || j.date > bounds.end)) return false;
    if (currentFilters.search) {
      const hay = [j.client_name, j.mobile, j.address, j.notes, j.notes_long, j.acs, j.invoice].join(' ').toLowerCase();
      if (!hay.includes(currentFilters.search)) return false;
    }
    return true;
  });
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return jobSortMinutes(a) - jobSortMinutes(b);
  });
  updateHeaderStats();
  updateStatsPanel();
  render();
}

function updateHeaderStats() {
  const count = filtered.length;
  const returns = filtered.filter(j => j.is_return).length;
  const revenue = filtered.reduce((s, j) => s + (j.amount || 0), 0);
  const jobCount = document.getElementById('jobCount');
  if (jobCount) jobCount.textContent = count + ' job' + (count !== 1 ? 's' : '');
  const rc = document.getElementById('returnCount');
  if (rc) {
    if (returns > 0) {
      rc.textContent = returns + ' return' + (returns !== 1 ? 's' : '');
      rc.classList.remove('hidden');
    } else {
      rc.classList.add('hidden');
    }
  }
  const revenueTotal = document.getElementById('revenueTotal');
  if (revenueTotal) revenueTotal.textContent = formatMoney(revenue);
}

function updateStatsPanel() {
  const panel = document.getElementById('statsPanel');
  if (!panel) return;
  const byTeam = {};
  TEAMS.forEach(t => byTeam[t] = { jobs: 0, returns: 0, amount: 0 });
  filtered.forEach(j => {
    if (!byTeam[j.team_lead]) return;
    byTeam[j.team_lead].jobs++;
    if (j.is_return) byTeam[j.team_lead].returns++;
    byTeam[j.team_lead].amount += j.amount || 0;
  });
  panel.innerHTML = TEAMS.map(t => {
    const s = byTeam[t];
    if (s.jobs === 0) return '';
    const right = s.jobs + ' job' + (s.jobs !== 1 ? 's' : '');
    return '<div class="flex justify-between items-center"><span class="font-medium">' + t + '</span><span class="text-slate-500">' + right + '</span></div>';
  }).filter(Boolean).join('') || '<p class="text-slate-400">No data</p>';
}

function render() {
  const container = document.getElementById('jobsContainer');
  const empty = document.getElementById('emptyState');
  const crewOnly = visibleCrewNotes();
  const weekView = currentFilters.range === 'this_week' || currentFilters.range === 'next_week';
  if (!weekView && filtered.length === 0 && crewOnly.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    const title = document.getElementById('viewTitle');
    if (title) title.textContent = 'No matching jobs';
    const msg = document.getElementById('emptyMessage');
    const actions = document.getElementById('emptyActions');
    const team = currentFilters.team && currentFilters.team !== 'all' ? currentFilters.team : 'this team';
    let jumps = [];
    if (currentFilters.range === 'next_week') {
      if (msg) msg.textContent = 'No jobs next week for ' + team + '.';
      jumps = [['this_week', 'See this week']];
    } else {
      if (msg) msg.textContent = 'No jobs this week for ' + team + '.';
      jumps = [['next_week', 'See next week']];
    }
    if (actions) {
      actions.innerHTML = jumps.map(function (pair) {
        return '<button type="button" data-jump-range="' + pair[0] + '" class="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-brand-600 text-white active:scale-95">' + pair[1] + '</button>';
      }).join('');
    }
    syncWeekStrip(container, 0);
    return;
  }
  empty.classList.add('hidden');
  if (viewMode === 'date') {
    document.getElementById('viewTitle').textContent = 'Jobs by Date';
    renderByDate(container);
  } else {
    document.getElementById('viewTitle').textContent = 'Jobs by Team';
    syncWeekStrip(container, 0);
    renderByTeam(container);
  }
  syncHeaderHeight();
}

function consensusTeamMembers(jobs, date, team) {
  const counts = {};
  (jobs || []).forEach(function (job) {
    if (isCrewNote(job)) return;
    if (job.date !== date || job.team_lead !== team) return;
    const value = String(job.team_members || '').trim();
    if (!value) return;
    counts[value] = (counts[value] || 0) + 1;
  });
  let best = '';
  let bestCount = 0;
  Object.keys(counts).forEach(function (value) {
    const count = counts[value];
    if (count > bestCount || (count === bestCount && value.localeCompare(best) < 0)) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

function dayWhosOnHtml(jobs, date) {
  const leads = currentFilters.team !== 'all'
    ? [currentFilters.team]
    : TEAMS.filter(function (team) {
      return jobs.some(function (j) { return j.team_lead === team; })
        || allJobs.some(function (j) {
          return isCrewNote(j) && !j.deleted && j.date === date && j.team_lead === team;
        });
    });
  if (currentFilters.team === 'all') {
    jobs.forEach(function (j) {
      if (j.team_lead && leads.indexOf(j.team_lead) === -1) leads.push(j.team_lead);
    });
  }
  if (!leads.length) return '';
  const lines = leads.map(function (team) {
    const members = cellTeamMembersFor(date, team);
    const who = members ? esc(members) : '\u2014';
    if (leads.length === 1) return who;
    return esc(team) + ' \u00b7 ' + who;
  });
  return '<div class="day-whos-on">' + lines.map(function (line) {
    return '<div>' + line + '</div>';
  }).join('') + '</div>';
}

function renderByDate(container) {
  const groups = groupBy(filtered, j => j.date);
  const bounds = getRangeBounds(currentFilters.range);
  const dates = datesInBounds(bounds);
  const gridCls = jobsGridClass();
  const today = todayISO();
  container.innerHTML = dates.map(function (date, i) {
    const jobs = (groups[date] || []).slice().sort((a, b) => jobSortMinutes(a) - jobSortMinutes(b));
    const returns = jobs.filter(j => j.is_return).length;
    const kind = date === today ? 'today' : (date === tomorrowISO() ? 'tomorrow' : (date < today ? 'past' : 'upcoming'));
    const stripe = i % 2 === 0 ? 'day-a' : 'day-b';
    const when = dayWhenBadge(date);
    return '<section class="day-section day-' + kind + ' ' + stripe + '" data-date="' + date + '">' +
      '<div class="day-header-sticky' + (when ? ' has-when' : '') + '">' +
        (when ? '<div class="day-when">' + when + '</div>' : '') +
        '<div class="flex items-center justify-between">' +
          '<h3 class="font-semibold text-brand-800">' +
            formatDayHeading(date) + '<span class="text-slate-400 font-normal text-sm ml-2">' + jobs.length + ' job' + (jobs.length !== 1 ? 's' : '') + '</span>' +
            (returns ? '<span class="ml-1 text-amber-600 text-sm">\u00b7 ' + returns + ' return' + (returns > 1 ? 's' : '') + '</span>' : '') +
          '</h3>' +
        '</div>' +
        dayWhosOnHtml(jobs, date) +
      '</div>' +
      '<div class="' + gridCls + '">' + cardsWithLunch(jobs, date, currentFilters.team) + '</div></section>';
  }).join('');
  syncWeekStrip(container, dates.length);
  bindCardClicks();
  requestAnimationFrame(function () {
    syncHeaderHeight();
    scrollDayIntoView(currentFilters.day || todayISO());
  });
}

function renderByTeam(container) {
  const groups = groupBy(filtered, j => j.team_lead);
  const order = TEAMS.filter(t => groups[t]);
  container.innerHTML = order.map(team => {
    const jobs = groups[team].slice().sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return jobSortMinutes(a) - jobSortMinutes(b);
    });
    const returns = jobs.filter(j => j.is_return).length;
    return '<section><div class="flex items-center justify-between mb-2"><h3 class="font-semibold"><span class="inline-block px-2 py-0.5 rounded ' +
      (TEAM_COLORS[team] || 'bg-slate-100') + ' team-chip mr-1">' + team + '</span><span class="text-slate-400 font-normal text-sm">' +
      jobs.length + ' jobs' + (returns ? ' \u00b7 ' + returns + ' returns' : '') + '</span></h3>' +
      '</div><div class="' + jobsGridClass() + '">' + (function () {
        const byDate = groupBy(jobs, function (j) { return j.date; });
        return Object.keys(byDate).sort().map(function (d) {
          return cardsWithLunch(byDate[d], d, team);
        }).join('');
      }()) + '</div></section>';
  }).join('');
  bindCardClicks();
}

function isTentative(j) {
  return String(j && j.status || '').toLowerCase() === 'tentative';
}

function jobsGridClass() {
  return 'grid gap-1.5';
}

function compactTypeMark(j) {
  const t = String(j && j.job_type || '').toLowerCase().trim();
  if ((j && j.is_return) || t === 'return') return 'Return';
  if (t === 'influencer' || t === 'collab') return 'Collab';
  if (t === 'inspection') return 'Inspection';
  if (t === 'other') return 'Other';
  return 'Service';
}

function compactPayMark(j) {
  const pay = String(j && j.payment || '').trim().toLowerCase();
  if (pay === 'free') return 'Free';
  return jobIsPaid(j) ? 'Paid' : 'Unpaid';
}

function jobCard(j) {
  const hold = isTentative(j);
  const dist = DISTRICT_COLORS[j.district] || DISTRICT_FALLBACK;

  const shownAddr = displayAddress(j.address);
  const pinIco = '<svg class="tap-hint" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.4A4.6 4.6 0 0 0 3.4 6c0 3.4 4.6 8.6 4.6 8.6s4.6-5.2 4.6-8.6A4.6 4.6 0 0 0 8 1.4zm0 6.3A1.7 1.7 0 1 1 8 4.3a1.7 1.7 0 0 1 0 3.4z"/></svg>';
  const phoneIco = '<svg class="tap-hint" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3.3 2.2c.3-.4.8-.5 1.2-.3l2.1 1c.4.2.6.6.5 1.1L6.7 6.3c1.3 2.3 3 4 5.3 5.3l2.3-.4c.4-.1.9.1 1.1.5l1 2.1c.2.4.1.9-.3 1.2l-1.2 1.2c-.4.4-1 .6-1.6.4C7.3 15.6.4 8.7.6 2.7c0-.5.2-1.1.6-1.5L3.3 2.2z"/></svg>';
  const shortAddr = shownAddr
    ? '<p class="compact-addr">' + pinIco + esc(shownAddr) + '</p>'
    : '';
  const unitsBit = liveAcsBadges(j.acs) || (j.acs
    ? '<span class="compact-units">' + esc(j.acs) + '</span>'
    : '');
  const payWord = compactPayMark(j);
  const shownMobile = formatMobile(j.mobile);
  const phoneBit = shownMobile
    ? '<p class="detailed-phone">' + phoneIco + esc(shownMobile) + '</p>'
    : '';
  const notes1 = j.notes
    ? '<p class="compact-notes">' + esc(j.notes) + '</p>'
    : '';
  const notes2 = j.notes_long
    ? '<p class="detailed-notes2">' + esc(j.notes_long) + '</p>'
    : '';
  const left = hold ? '#ca8a04' : dist.border;
  return '<article class="job-card job-card-detailed' + (hold ? ' is-tentative' : '') + '" data-id="' + esc(j.job_id) + '" style="border-left:4px solid ' + left + '">' +
    '<div class="compact-row">' +
      '<div class="compact-col compact-col-time">' +
        '<span class="compact-time">' + esc(displayTime(j)) + '</span>' +
        unitsBit +
      '</div>' +
      '<div class="compact-col compact-col-main">' +
        '<span class="compact-name">' + esc(j.client_name) + '</span>' +
        phoneBit +
        shortAddr +
        notes1 +
        notes2 +
      '</div>' +
      '<div class="compact-col compact-col-meta">' +
        '<span class="compact-type">' + compactTypeMark(j) + '</span>' +
        '<span class="compact-pay' + (payWord === 'Unpaid' ? ' is-unpaid' : '') + '">' + payWord + '</span>' +
      '</div>' +
    '</div></article>';
}

function bindCardClicks() {
  document.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const job = filtered.find(j => j.job_id === card.dataset.id) || allJobs.find(j => j.job_id === card.dataset.id);
      if (job) openModal(job);
    });
  });
}

function cleanAddressForMaps(raw) {
  if (!raw) return '';
  const street = displayAddress(raw);
  let a = street;
  a = a.replace(/\s*\/\/\s*[\s\S]*$/, '');
  a = a.replace(/\s*need a pin\s*/gi, ' ');
  a = a.replace(/^\(\s*\d+\s*[A-Za-z][^)]*\)\s*/, '');
  a = a.replace(/\(\s*\d+\s*[SWBCU][A-Za-z0-9+\/ ]*\)\s*$/i, '');
  a = a.replace(/\b(G\/F|GF|G\.F\.|Ground\s*Floor)\b[,\s]*/gi, '');
  a = a.replace(/^(Flat|Unit|Room|Apt|Apartment|Suite|Hse|House|Rm)\s*[A-Z0-9\-\/]+[,\s]*/i, '')
    .replace(/\b\d{1,2}\s*(\/F|F|th\s*Floor|st\s*Floor|nd\s*Floor|rd\s*Floor|Floor)\b[,\s]*/gi, '')
    .replace(/\b(Floor|Level)\s*\d{1,2}\b[,\s]*/gi, '')
    .replace(/^(Tower|Block|Blk)\s*[A-Z0-9\-]+[,\s]*/i, '')
    .replace(/^\d{1,3}[A-Z]?\s*[,\-]\s*/i, '');
  a = tidyAddress(a);
  if (a.length < 8) a = street;
  if (a && !/hong\s*kong/i.test(a)) a += ', Hong Kong';
  return a;
}

function openModal(j) {
  document.getElementById('modalTitle').textContent = j.client_name;
  document.getElementById('modalSub').textContent = formatDate(j.date) + ' \u00b7 ' + displayTime(j) + ' \u00b7 ' + j.team_lead;
  const shownAddr = displayAddress(j.address);
  const placeUrl = mapsHref(j.address);
  const dirUrl = mapsDirHref(j.address);
  const nextJob = nextJobSameDayLead(j);
  const nextUrl = (nextJob && mapsDirQuery(j.address) && mapsDirQuery(nextJob.address))
    ? mapsDirHref(nextJob.address, j.address)
    : null;
  const mapBtns = [];
  if (placeUrl) {
    mapBtns.push('<a href="' + esc(placeUrl) + '" target="_blank" rel="noopener noreferrer">Open place</a>');
  }
  if (dirUrl) {
    mapBtns.push('<a href="' + esc(dirUrl) + '" target="_blank" rel="noopener noreferrer" id="jobDirBtn">Directions</a>');
  }
  if (nextUrl) {
    const nextName = nextJob.client_name ? ' title="To ' + esc(nextJob.client_name) + '"' : '';
    mapBtns.push('<a href="' + esc(nextUrl) + '" target="_blank" rel="noopener noreferrer"' + nextName + '>To next</a>');
  }
  const mapsRow = mapBtns.length
    ? '<div class="job-map-actions">' + mapBtns.join('') + '</div>'
    : '';
  const addressHtml = shownAddr
    ? '<div class="text-slate-800 break-words">' + esc(shownAddr) + '</div>' + mapsRow
    : '\u2014';
  const tel = j.mobile ? String(j.mobile).replace(/[^\d+]/g, '') : '';
  const mobileHtml = tel
    ? '<a href="tel:' + esc(tel) + '" class="inline-flex items-center justify-center min-h-[44px] font-semibold text-emerald-800">' + esc(j.mobile) + '</a>'
    : (j.mobile || '\u2014');
  const isPaid = jobIsPaid(j);
  const paidStatus = isPaid
    ? '<span class="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">PAID</span>'
    : '<span class="inline-flex items-center gap-1.5 text-rose-700 font-semibold">UNPAID</span>';
  const rows = [
    ['Type', j.is_return ? '<span class="text-amber-600 font-semibold">Return</span>' : 'Full clean'],
  ];
  if (isTentative(j)) {
    rows.push(['Status', '<span class="tentative-badge text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">Tentative</span>']);
  }
  rows.push(
    ['Team', j.team_lead + (j.team_members ? ' (' + j.team_members + ')' : '')],
    ['ACs / Units', j.acs || '\u2014 (empty \u2192 treated as return)'],
    ['Payment Status', paidStatus],
    ['Mobile', mobileHtml],
    ['Address', addressHtml],
    ['District', j.district || '\u2014'],
    ['Notes 1', j.notes ? esc(j.notes) : '\u2014']
  );
  if (j.notes_long) rows.push(['Notes 2', esc(j.notes_long)]);
  rows.push(['Job ID', j.job_id]);
  document.getElementById('modalBody').innerHTML = rows.map(function(pair) {
    const note2 = pair[0] === 'Notes 2' ? ' modal-notes-2' : '';
    return '<div><dt class="text-xs font-medium text-slate-400 uppercase tracking-wide">' + pair[0] + '</dt><dd class="mt-0.5 text-slate-800 break-words' + note2 + '">' + pair[1] + '</dd></div>';
  }).join('') +
    '<div class="van-copy-row">' +
      '<button type="button" id="copyVanBtn" class="van-copy-btn">Copy van request</button>' +
      '<button type="button" id="copyVanPinBtn" class="van-copy-btn">Copy van request + pin</button>' +
    '</div>';
  const vanText = vanRequestText(j);
  const dirBtn = document.getElementById('jobDirBtn');
  if (dirBtn && dirUrl) {
    dirBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (dirBtn.dataset.busy) return;
      dirBtn.dataset.busy = '1';
      dirBtn.textContent = 'Locating\u2026';
      const dest = mapsDirQuery(j.address);
      const tab = window.open('about:blank', '_blank');
      if (tab) tab.opener = null;
      getGpsPin({ maximumAge: 0, timeout: 10000 }).then(function (loc) {
        const origin = loc.lat.toFixed(6) + ',' + loc.lng.toFixed(6);
        return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest) + '&origin=' + encodeURIComponent(origin);
      }).catch(function () {
        return dirUrl;
      }).then(function (url) {
        if (tab && !tab.closed) tab.location = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
        dirBtn.textContent = 'Directions';
        delete dirBtn.dataset.busy;
      });
    });
  }
  const vanBtn = document.getElementById('copyVanBtn');
  const pinBtn = document.getElementById('copyVanPinBtn');
  if (vanBtn) {
    vanBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyText(vanText).then(function () {
        flashVanBtn(vanBtn, 'Copied', 'Copy van request');
      }).catch(function () {
        flashVanBtn(vanBtn, 'Copy failed', 'Copy van request');
      });
    });
  }
  if (pinBtn) {
    pinBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (pinBtn.dataset.busy) return;
      pinBtn.dataset.busy = '1';
      getGpsPin().then(function (loc) {
        const pin = 'https://maps.google.com/?q=' + loc.lat.toFixed(6) + ',' + loc.lng.toFixed(6);
        return copyText(vanText + pin + '\n').then(function () {
          flashVanBtn(pinBtn, 'Copied', 'Copy van request + pin');
        });
      }).catch(function () {
        return copyText(vanText).then(function () {
          flashVanBtn(pinBtn, 'Copied (no pin)', 'Copy van request + pin');
        }).catch(function () {
          flashVanBtn(pinBtn, 'Copy failed', 'Copy van request + pin');
        });
      }).then(function () {
        delete pinBtn.dataset.busy;
      });
    });
  }
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function groupBy(arr, keyFn) {
  return arr.reduce(function(acc, item) {
    const k = keyFn(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function formatDate(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso + 'T00:00:00');
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.getDate();
  const mo = d.toLocaleDateString('en-GB', { month: 'short' });
  return wd + ', ' + day + ' ' + mo;
}

function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-HK');
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;');
}

window.onAuthReady = function(user) {
  viewMode = 'date';
  const lock = teamFromEmail(user && user.email);
  window.BE_LOCKED_TEAM = lock;
  currentFilters.team = lock || 'Matthew';
  currentFilters.range = 'this_week';
  currentFilters.day = todayISO();
  init();
};
