/* Breathe-Easy Scheduler — 2026 Full Year */

let allJobs = [];
let filtered = [];
let currentFilters = {
  month: 'all',
  team: 'Matthew',
  type: 'all',
  date: 'all',
  range: 'today',
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
  return EMAIL_TO_TEAM[key] || 'Matthew';
}
let viewMode = 'date';
let compactMode = localStorage.getItem('be-density') !== 'detailed';

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

function getGpsPin() {
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 }
    );
  });
}

function displayTime(j) {
  if (j.time) return j.time;
  const s = String(j.client_name || '');
  const m = s.match(/(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm)?)/i);
  return m ? m[1].replace(/\s+/g, '') : '\u2014';
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

function formatDayHeading(iso) {
  const label = formatDate(iso);
  if (iso === todayISO()) return '<span class="day-flag day-flag-today">Today</span> ' + label;
  if (iso === tomorrowISO()) return '<span class="day-flag day-flag-tomorrow">Tomorrow</span> ' + label;
  return label;
}

async function init() {
  try {
    let files = [];
    try {
      const man = await fetch('data/manifest.json');
      if (man.ok) files = await man.json();
    } catch (_) {}
    if (files.length) {
      const results = await Promise.all(
        files.map(f => fetch('data/' + f).then(r => (r.ok ? r.json() : [])).catch(() => []))
      );
      allJobs = results.flat();
    }
    if (allJobs.length === 0) {
      const res = await fetch('data/jobs.json');
      if (res.ok) allJobs = await res.json();
    }
    if (allJobs.length === 0) throw new Error('No job data found');
    allJobs.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return jobSortMinutes(a) - jobSortMinutes(b);
    });
    buildTeamButtons();
    buildDateSelect();
    bindEvents();
    applyFilters();
  } catch (err) {
    document.getElementById('jobsContainer').innerHTML =
      '<div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">Failed to load job data.<br><span class="text-sm">' + err.message + '</span></div>';
  }
}

function buildTeamButtons() {
  const sidebar = document.getElementById('teamFilters');
  function fill(container, includeAll) {
    if (!container) return;
    container.innerHTML = '';
    const names = includeAll ? ['all'].concat(TEAMS) : TEAMS.slice();
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
    const current = (!currentFilters.team || currentFilters.team === 'all') ? 'Matthew' : currentFilters.team;
    sel.innerHTML = '';
    TEAMS.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === current) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.value = current;
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
      currentFilters.team = e.target.value || 'Matthew';
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
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => selectRange(btn.dataset.range));
  });
  const emptyActions = document.getElementById('emptyActions');
  if (emptyActions) {
    emptyActions.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump-range]');
      if (jump) selectRange(jump.dataset.jumpRange);
    });
  }
  function setDensity(isCompact) {
    compactMode = isCompact;
    localStorage.setItem('be-density', compactMode ? 'compact' : 'detailed');
    applyCompactUI();
    render();
  }
  const densityCompact = document.getElementById('densityCompact');
  const densityDetailed = document.getElementById('densityDetailed');
  if (densityCompact) densityCompact.addEventListener('click', () => setDensity(true));
  if (densityDetailed) densityDetailed.addEventListener('click', () => setDensity(false));
  applyCompactUI();
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
}

function paintRangeButtons(range) {
  document.querySelectorAll('.range-btn').forEach(b => {
    const on = b.dataset.range === range;
    b.classList.toggle('bg-brand-600', on);
    b.classList.toggle('text-white', on);
    b.classList.toggle('bg-slate-100', !on);
    b.classList.toggle('text-slate-700', !on);
  });
}

function selectRange(range) {
  currentFilters.range = range;
  currentFilters.date = 'all';
  const dateSelect = document.getElementById('dateSelect');
  if (dateSelect) dateSelect.value = 'all';
  paintRangeButtons(range);
  applyFilters();
}

function applyCompactUI() {
  document.body.classList.toggle('compact', compactMode);
  function paint(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  paint(document.getElementById('densityCompact'), compactMode);
  paint(document.getElementById('densityDetailed'), !compactMode);
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
  currentFilters.range = 'today';
  if (!currentFilters.team || currentFilters.team === 'all') currentFilters.team = 'Matthew';
  buildTeamButtons();
  paintRangeButtons(currentFilters.range);
  applyCompactUI();
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
  if (range === 'today') {
    const iso = toISODate(today);
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

function applyFilters() {
  const bounds = getRangeBounds(currentFilters.range);
  filtered = allJobs.filter(j => {
    if (currentFilters.month !== 'all' && jobMonth(j) !== Number(currentFilters.month)) return false;
    if (currentFilters.team !== 'all' && j.team_lead !== currentFilters.team) return false;
    if (currentFilters.type === 'clean' && j.is_return) return false;
    if (currentFilters.type === 'return' && !j.is_return) return false;
    if (currentFilters.date !== 'all' && j.date !== currentFilters.date) return false;
    if (bounds && (j.date < bounds.start || j.date > bounds.end)) return false;
    if (currentFilters.search) {
      const hay = [j.client_name, j.mobile, j.address, j.notes, j.acs, j.invoice].join(' ').toLowerCase();
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
  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    const title = document.getElementById('viewTitle');
    if (title) title.textContent = 'No matching jobs';
    const msg = document.getElementById('emptyMessage');
    const actions = document.getElementById('emptyActions');
    const team = currentFilters.team && currentFilters.team !== 'all' ? currentFilters.team : 'this team';
    let jumps = [];
    if (currentFilters.range === 'today') {
      if (msg) msg.textContent = 'No jobs today for ' + team + '.';
      jumps = [['this_week', 'See this week'], ['next_week', 'See next week']];
    } else if (currentFilters.range === 'next_week') {
      if (msg) msg.textContent = 'No jobs next week for ' + team + '.';
      jumps = [['this_week', 'See this week'], ['today', 'See today']];
    } else {
      if (msg) msg.textContent = 'No jobs this week for ' + team + '.';
      jumps = [['next_week', 'See next week'], ['today', 'See today']];
    }
    if (actions) {
      actions.innerHTML = jumps.map(function (pair) {
        return '<button type="button" data-jump-range="' + pair[0] + '" class="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-brand-600 text-white active:scale-95">' + pair[1] + '</button>';
      }).join('');
    }
    return;
  }
  empty.classList.add('hidden');
  if (viewMode === 'date') {
    document.getElementById('viewTitle').textContent = 'Jobs by Date';
    renderByDate(container);
  } else {
    document.getElementById('viewTitle').textContent = 'Jobs by Team';
    renderByTeam(container);
  }
  syncHeaderHeight();
}

function renderByDate(container) {
  const groups = groupBy(filtered, j => j.date);
  const dates = Object.keys(groups).sort();
  const gridCls = compactMode
    ? 'grid grid-cols-2 gap-1.5'
    : 'grid gap-1.5';
  const today = todayISO();
  container.innerHTML = dates.map(date => {
    const jobs = groups[date].slice().sort((a, b) => jobSortMinutes(a) - jobSortMinutes(b));
    const returns = jobs.filter(j => j.is_return).length;
    const kind = date === today ? 'today' : (date === tomorrowISO() ? 'tomorrow' : (date < today ? 'past' : 'upcoming'));
    return '<section class="day-section day-' + kind + '">' +
      '<div class="day-header-sticky flex items-center justify-between">' +
        '<h3 class="font-semibold text-brand-800">' +
          formatDayHeading(date) + '<span class="text-slate-400 font-normal text-sm ml-2">' + jobs.length + ' job' + (jobs.length !== 1 ? 's' : '') + '</span>' +
          (returns ? '<span class="ml-1 text-amber-600 text-sm">\u00b7 ' + returns + ' return' + (returns > 1 ? 's' : '') + '</span>' : '') +
        '</h3>' +
      '</div>' +
      '<div class="' + gridCls + '">' + jobs.map(jobCard).join('') + '</div></section>';
  }).join('');
  bindCardClicks();
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
      '</div><div class="' + (compactMode ? 'grid grid-cols-2 gap-1.5' : 'grid gap-1.5') + '">' + jobs.map(jobCard).join('') + '</div></section>';
  }).join('');
  bindCardClicks();
}

function jobCard(j) {
  const returnBadge = j.is_return ? '<span class="return-badge shrink-0 whitespace-nowrap text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">RETURN</span>' : '';
  const isPaid = jobIsPaid(j);
  const rightBadge = isPaid
    ? '<span class="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">PAID</span>'
    : '';
  const units = j.acs
    ? '<span class="inline-flex items-center text-[11px] font-semibold bg-white/80 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded">' + esc(j.acs) + '</span>'
    : '';
  const dist = DISTRICT_COLORS[j.district] || DISTRICT_FALLBACK;

  if (compactMode) {
    const distBar = 'border-left: 4px solid ' + dist.border + '; background:' + dist.bg + ';';
    const showTeam = currentFilters.team === 'all';
    const teamChip = showTeam
      ? '<span class="text-[10px] font-medium px-1 py-0.5 rounded ' + (TEAM_COLORS[j.team_lead] || 'bg-slate-100') + '">' + esc(j.team_lead) + '</span>'
      : '';
    const shownAddr = displayAddress(j.address);
    const shortAddr = shownAddr
      ? '<p class="text-[10px] leading-tight text-slate-600 mt-1 line-clamp-2">' + esc(shownAddr) + '</p>'
      : '';
    return '<article class="job-card compact-card rounded-xl cursor-pointer active:opacity-90 overflow-hidden" data-id="' + esc(j.job_id) + '" style="' + distBar + '">' +
      '<div class="p-2 min-h-[100px] flex flex-col">' +
        '<div class="flex items-start justify-between gap-1 min-w-0">' +
          '<p class="font-semibold text-[12px] leading-tight line-clamp-1 text-slate-800 min-w-0 flex-1 pr-1">' + esc(j.client_name) + '</p>' +
          returnBadge +
        '</div>' +
        '<p class="text-[12px] font-semibold text-slate-700 mt-0.5">' + esc(displayTime(j)) + '</p>' +
        shortAddr +
        '<div class="flex items-center gap-1.5 flex-wrap shrink-0 mt-auto pt-1.5">' + teamChip + units +
        '</div>' +
      '</div></article>';
  }

  const showTeam = currentFilters.team === 'all';
  const unitsBit = liveAcsBadges(j.acs);
  const shownAddr = displayAddress(j.address);
  const addressBlock = shownAddr
    ? '<p class="live-addr">' + esc(shownAddr) + '</p>'
    : '';
  const notesBlock = j.notes
    ? '<p class="live-notes">' + esc(j.notes) + '</p>'
    : '';
  return '<article class="job-card job-card-detailed" data-id="' + esc(j.job_id) + '" style="border-left:4px solid ' + dist.border + '">' +
    '<div class="live-name-row">' +
      '<p class="live-name">' + esc(j.client_name) + (showTeam ? ' \u00b7 ' + esc(j.team_lead) : '') + '</p>' +
      '<div class="live-badges">' + returnBadge + rightBadge + '</div>' +
    '</div>' +
    '<div class="live-time-row">' +
      '<span class="live-time">' + esc(displayTime(j)) + '</span>' + unitsBit +
    '</div>' +
    addressBlock +
    notesBlock +
  '</article>';
}

function bindCardClicks() {
  document.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-actions') || e.target.closest('a.card-action')) return;
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
  const mapsUrl = mapsHref(j.address);
  const mapsLink = mapsUrl
    ? '<a href="' + mapsUrl + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 mt-2 w-full px-3 py-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 font-bold text-sm active:bg-sky-100">Open in Maps</a>'
    : '';
  const addressHtml = shownAddr ? '<div class="text-slate-800 break-words">' + esc(shownAddr) + '</div>' + mapsLink : '\u2014';
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
    ['Team', j.team_lead + (j.team_members ? ' (' + j.team_members + ')' : '')],
    ['ACs / Units', j.acs || '\u2014 (empty \u2192 treated as return)'],
    ['Payment Status', paidStatus],
    ['Mobile', mobileHtml],
    ['Address', addressHtml],
    ['District', j.district || '\u2014'],
    ['Notes', j.notes || '\u2014'],
    ['Job ID', j.job_id]
  ];
  document.getElementById('modalBody').innerHTML = rows.map(function(pair) {
    return '<div><dt class="text-xs font-medium text-slate-400 uppercase tracking-wide">' + pair[0] + '</dt><dd class="mt-0.5 text-slate-800 break-words">' + pair[1] + '</dd></div>';
  }).join('') +
    '<div class="van-copy-row">' +
      '<button type="button" id="copyVanBtn" class="van-copy-btn">Copy van request</button>' +
      '<button type="button" id="copyVanPinBtn" class="van-copy-btn">Copy van request + pin</button>' +
    '</div>';
  const vanText = vanRequestText(j);
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
  return d.toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric', month: 'short' });
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
  currentFilters.team = teamFromEmail(user && user.email);
  currentFilters.range = 'today';
  init();
};
