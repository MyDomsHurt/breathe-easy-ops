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

function sizeSelectToName(sel) {
  if (!sel || !sel.options || !sel.options.length) return;
  const opt = sel.options[sel.selectedIndex] || sel.options[0];
  const text = String(opt.textContent || '');
  const probe = document.createElement('span');
  const cs = window.getComputedStyle(sel);
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;left:0;top:0';
  probe.style.fontFamily = cs.fontFamily;
  probe.style.fontSize = cs.fontSize;
  probe.style.fontWeight = cs.fontWeight;
  probe.style.letterSpacing = cs.letterSpacing;
  probe.textContent = text || 'M';
  document.body.appendChild(probe);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  sel.style.width = Math.ceil(probe.getBoundingClientRect().width + pad) + 'px';
  probe.remove();
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

function shortDistrictCode(district) {
  const raw = String(district || '').trim();
  if (!raw) return '';
  if (DISTRICT_COLORS[raw]) return raw;
  const key = raw.replace(/\s+/g, '').toUpperCase();
  if (DISTRICT_COLORS[key]) return key;
  if (key === 'NT' || /^NEW\s*TERRITORIES$/i.test(raw)) return 'N-T';
  if (key === 'NTW') return 'N-TW';
  if (key === 'SK') return 'S-K';
  if (key === 'LT') return 'L-T';
  if (key === 'LM') return 'L-M';
  return '';
}

function addressHasDistrictTag(line) {
  return new RegExp('[\\(（]\\s*(?:' + DISTRICT_TAG + ')\\s*[\\)）]', 'i').test(String(line || ''));
}

function displayAddress(raw, district) {
  let a = String(raw || '');
  a = a.replace(/\/\/\s*pin:?\s*/gi, ' ');
  a = a.replace(/https?:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.)[^\s]+/gi, ' ');
  a = a.replace(/\s*need a pin\s*$/i, '');
  a = a.replace(/\(\s*\d+\s*[SWBCU](?:\s*[+\/&]\s*\d+\s*[SWBCU])*\s*\)/gi, ' ');
  a = tidyAddress(a);
  const code = shortDistrictCode(district);
  if (code && !addressHasDistrictTag(a)) {
    a = a ? (a + ' (' + code + ')') : ('(' + code + ')');
  }
  return a;
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

function isPaintedDayJob(j) {
  if (!j || j.deleted) return false;
  if (isCrewNote(j)) return false;
  const td = typeof window !== 'undefined' ? window.BETeamDay : null;
  if (td && typeof td.isCompanyDay === 'function' && td.isCompanyDay(j)) return false;
  if (j.source === 'company-day' || String(j.job_id || '').indexOf('holiday-') === 0) return false;
  return true;
}

function sameDayTeamJobs(job) {
  const pool = (typeof filtered !== 'undefined' && filtered && filtered.length)
    ? filtered
    : ((typeof allJobs !== 'undefined' && allJobs.length) ? allJobs : []);
  const list = pool.filter(function (x) {
    return isPaintedDayJob(x) && x.date === job.date && x.team_lead === job.team_lead;
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

function vanDiscordChannel() {
  return 'https://discord.com/channels/1547059756642861066/1547070087343898674';
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

const DAY_HEAD_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_HEAD_MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayHeading(iso) {
  if (!iso) return '';
  const d = new Date(String(iso) + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return DAY_HEAD_WD[d.getDay()] + ', ' + d.getDate() + ' ' + DAY_HEAD_MO[d.getMonth()];
}

function dayWhenBadge(iso) {
  if (iso === todayISO()) return '<span class="day-flag day-flag-today">Today</span>';
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
    sizeSelectToName(sel);
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
      sizeSelectToName(techSelect);
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
  sizeSelectToName(sel);
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
  const showTeam = currentFilters.team === 'all';
  const out = [];
  let li = 0;
  sorted.forEach(function (j) {
    const mins = jobSortMinutes(j);
    while (li < lunches.length && lunches[li].mins <= mins) {
      out.push(lunchRowHtml(lunches[li], showTeam));
      li++;
    }
    out.push(jobCard(j));
  });
  while (li < lunches.length) {
    out.push(lunchRowHtml(lunches[li], showTeam));
    li++;
  }
  return out.join('');
}

function dayLunchHtml(date) {
  const rows = lunchesOnDate(date);
  if (!rows.length) return '';
  const showTeam = currentFilters.team === 'all';
  return '<div class="day-lunch">' + rows.map(function (row) {
    return lunchRowHtml(row, showTeam);
  }).join('') + '</div>';
}

function dayIsClosed(date) {
  const today = todayISO();
  const td = window.BETeamDay;
  if (td && typeof td.isTeamDayFull === 'function') {
    if (currentFilters.team !== 'all') {
      return td.isTeamDayFull(allJobs, date, currentFilters.team, today);
    }
    return TEAMS.every(function (team) {
      return td.isTeamDayFull(allJobs, date, team, today);
    });
  }
  return String(date || '') < String(today);
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
    if (window.BETeamDay && typeof window.BETeamDay.isCompanyDay === 'function' && window.BETeamDay.isCompanyDay(j)) return false;
    if (j.source === 'company-day' || String(j.job_id || '').indexOf('holiday-') === 0) return false;
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
    renderByDate(container);
  } else {
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
  container.innerHTML = dates.map(function (date) {
    const jobs = (groups[date] || []).slice().sort((a, b) => jobSortMinutes(a) - jobSortMinutes(b));
    const returns = jobs.filter(j => j.is_return).length;
    const closed = dayIsClosed(date);
    const when = dayWhenBadge(date);
    const panel = closed ? 'is-closed' : 'is-open';
    const todayCls = date === today ? ' day-today' : '';
    return '<section class="day-section ' + panel + todayCls + '" data-date="' + date + '">' +
      '<header class="day-header-sticky">' +
        '<div class="flex items-center justify-between">' +
          '<h3 class="font-semibold text-brand-800">' +
            '<span class="day-heading-date">' + formatDayHeading(date) + '</span>' +
            (when ? ' ' + when : '') +
            '<span class="text-slate-400 font-normal text-sm ml-2">' + jobs.length + ' job' + (jobs.length !== 1 ? 's' : '') + '</span>' +
            (returns ? '<span class="ml-1 text-amber-600 text-sm">\u00b7 ' + returns + ' return' + (returns > 1 ? 's' : '') + '</span>' : '') +
          '</h3>' +
        '</div>' +
        dayWhosOnHtml(jobs, date) +
      '</header>' +
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

function jobCard(j) {
  const hold = isTentative(j);
  const dist = DISTRICT_COLORS[j.district] || DISTRICT_FALLBACK;
  const shownAddr = displayAddress(j.address, j.district);
  const unitsBit = liveAcsBadges(j.acs) || (j.acs
    ? '<span class="compact-units">' + esc(j.acs) + '</span>'
    : '');
  const shownMobile = formatMobile(j.mobile);
  const phoneBit = shownMobile
    ? '<p class="detailed-phone">' + esc(shownMobile) + '</p>'
    : '';
  const addrBit = shownAddr
    ? '<p class="compact-addr">' + esc(shownAddr) + '</p>'
    : '';
  const notes1 = j.notes
    ? '<p class="compact-notes">' + esc(j.notes) + '</p>'
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
        addrBit +
        notes1 +
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

function modalDayLabel(iso) {
  if (!iso) return '';
  const d = new Date(String(iso) + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return wd[d.getDay()] + ' ' + d.getDate() + ' ' + mo[d.getMonth()];
}

function modalSubText(j) {
  return modalDayLabel(j && j.date) + ' \u00b7 ' + displayTime(j) + ' \u00b7 ' + (j && j.team_lead || '');
}

function modalChipsHtml(j) {
  const units = liveAcsBadges(j && j.acs) || (j && j.acs
    ? '<span class="modal-chip">' + esc(j.acs) + '</span>'
    : '');
  const paid = jobIsPaid(j);
  const pay = '<span class="modal-chip ' + (paid ? 'modal-chip-paid' : 'modal-chip-unpaid') + '">'
    + (paid ? 'Paid' : 'Unpaid') + '</span>';
  return units + pay;
}

function modalPhoneHtml(j) {
  const tel = j && j.mobile ? String(j.mobile).replace(/[^\d+]/g, '') : '';
  if (!tel) return '';
  const shown = formatMobile(j.mobile) || String(j.mobile).trim();
  return '<a class="modal-phone" href="tel:' + esc(tel) + '">' + esc(shown) + '</a>';
}

function modalNotesHtml(j) {
  const notes = j && j.notes ? String(j.notes).trim() : '';
  if (!notes) return '';
  return '<div class="modal-notes">' + esc(notes) + '</div>';
}

function techNotesBoxHtml() {
  return '<div id="techNotesBox" class="tech-notes-box">' +
    '<div class="tech-notes-box-bar">' +
      '<div class="tech-notes-heading">' +
        '<p class="tech-notes-box-label">Technician notes</p>' +
        '<button type="button" id="techNotesHistoryBtn" class="tech-notes-history-btn" aria-label="Notes history" aria-pressed="false">' +
          '<svg class="tech-notes-history-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
            '<path fill="currentColor" d="M7 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12V5H7zm2.5 2.5h8v1.75h-8V7.5zm0 3.5h8V12.75h-8V11zm0 3.5h5.5V16.75H9.5V14.5z"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<textarea id="techNotesText" class="tech-notes-text" rows="3"></textarea>' +
    '<input type="file" id="techNotesFile" class="tech-notes-file" multiple>' +
    '<div id="techNotesProgress" class="tech-notes-progress">' +
      '<div id="techNotesProgressBar" class="tech-notes-progress-bar"></div>' +
    '</div>' +
    '<div class="tech-notes-save-row">' +
      '<button type="button" id="techNotesSave" class="tech-notes-save">Save</button>' +
    '</div>' +
    '<div id="techNotesLog" class="tech-notes-log" style="display:none"></div>' +
  '</div>';
}

function techNoteBy() {
  if (typeof window !== 'undefined' && window.BE_AUTH_EMAIL) return String(window.BE_AUTH_EMAIL).toLowerCase();
  try {
    const u = firebase.auth().currentUser;
    return u && u.email ? String(u.email).toLowerCase() : '';
  } catch (err) {
    return '';
  }
}

function techNotePayload(job, text, author, at) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return null;
  const jobId = job && job.job_id ? String(job.job_id) : '';
  if (!jobId) return null;
  return {
    author: String(author || '').trim().toLowerCase(),
    job_id: jobId,
    text: t,
    at: at || new Date().toISOString()
  };
}

function techNotesCol() {
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return null;
  if (!firebase.apps || !firebase.apps.length) return null;
  return firebase.firestore().collection('technician_notes');
}

function techNotesStorage() {
  if (typeof firebase === 'undefined' || typeof firebase.storage !== 'function') return null;
  if (!firebase.apps || !firebase.apps.length) return null;
  return firebase.storage();
}

function techNoteFileId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (err) {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function techNoteFileRef(file, fileId) {
  if (!file || !fileId) return null;
  return {
    id: String(fileId),
    name: String(file.name || ''),
    size: Number(file.size) || 0,
    type: String(file.type || '')
  };
}

function uploadTechNoteFile(jobId, file, fileId, onProgress) {
  const storage = techNotesStorage();
  if (!storage || !jobId || !file || !fileId) return Promise.reject(new Error('no storage'));
  const path = 'technician_notes/' + String(jobId) + '/' + String(fileId);
  const task = storage.ref(path).put(file);
  if (typeof onProgress === 'function') {
    task.on('state_changed', function (snap) {
      const total = snap && snap.totalBytes ? snap.totalBytes : 0;
      const done = snap && snap.bytesTransferred ? snap.bytesTransferred : 0;
      onProgress(total ? Math.round((done / total) * 100) : 0, done, total);
    });
  }
  return task;
}

function techNoteFilesProgress(dones, totals) {
  let total = 0;
  let done = 0;
  const n = totals && totals.length ? totals.length : 0;
  for (let i = 0; i < n; i++) {
    total += Number(totals[i]) || 0;
    done += Number(dones[i]) || 0;
  }
  if (total) return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  if (!n) return 0;
  let finished = 0;
  for (let i = 0; i < n; i++) {
    if (Number(dones[i]) > 0) finished++;
  }
  return Math.round((finished / n) * 100);
}

function uploadTechNoteFiles(jobId, files, onProgress) {
  const list = [];
  if (files && files.length) {
    for (let i = 0; i < files.length; i++) {
      if (files[i]) list.push(files[i]);
    }
  }
  if (!list.length) return Promise.resolve([]);
  const totals = [];
  const dones = [];
  for (let i = 0; i < list.length; i++) {
    totals[i] = Number(list[i].size) || 0;
    dones[i] = 0;
  }
  function report() {
    if (typeof onProgress === 'function') onProgress(techNoteFilesProgress(dones, totals));
  }
  const pending = list.map(function (file, i) {
    const fileId = techNoteFileId();
    return uploadTechNoteFile(jobId, file, fileId, function (pct, transferred, totalBytes) {
      if (totalBytes) totals[i] = totalBytes;
      dones[i] = transferred != null ? transferred : Math.round(((Number(pct) || 0) / 100) * (totals[i] || 0));
      report();
    }).then(function () {
      dones[i] = totals[i] || 1;
      report();
      return techNoteFileRef(file, fileId);
    });
  });
  return Promise.all(pending);
}

function showTechNoteProgress(pct) {
  const wrap = document.getElementById('techNotesProgress');
  const bar = document.getElementById('techNotesProgressBar');
  if (wrap) wrap.style.display = 'block';
  if (bar) {
    const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    bar.style.width = n + '%';
  }
}

function hideTechNoteProgress() {
  const wrap = document.getElementById('techNotesProgress');
  const bar = document.getElementById('techNotesProgressBar');
  if (wrap) wrap.style.display = 'none';
  if (bar) bar.style.width = '0%';
}

function addTechNoteFileRef(noteId, fileRef) {
  const col = techNotesCol();
  if (!col || !noteId || !fileRef) return Promise.resolve(null);
  return col.doc(String(noteId)).update({ file: fileRef });
}

function addTechNoteFiles(noteId, fileRefs) {
  const col = techNotesCol();
  if (!col || !noteId || !fileRefs || !fileRefs.length) return Promise.resolve(null);
  return col.doc(String(noteId)).update({ files: fileRefs });
}

function techNotesNewestFirst(notes) {
  return (notes || []).slice().sort(function (a, b) {
    return String(b && b.at || '').localeCompare(String(a && a.at || ''));
  });
}

function techNoteAtLabel(at) {
  if (at == null || at === '') return '';
  const d = new Date(at);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(d);
  const map = {};
  for (let i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
  if (!map.day || !map.month || map.hour == null || map.minute == null) return '';
  const hh = map.hour.length === 1 ? '0' + map.hour : map.hour;
  const mm = map.minute.length === 1 ? '0' + map.minute : map.minute;
  return map.day + ' ' + map.month + ', ' + hh + ':' + mm;
}

function techNoteStoragePath(jobId, fileId) {
  return 'technician_notes/' + String(jobId) + '/' + String(fileId);
}

function techNoteFilesOnNote(note) {
  const out = [];
  if (note && note.file && note.file.id) out.push(note.file);
  if (note && note.files && note.files.length) {
    for (let i = 0; i < note.files.length; i++) {
      if (note.files[i] && note.files[i].id) out.push(note.files[i]);
    }
  }
  return out;
}

function techNoteFileIsImage(file) {
  const type = String(file && file.type || '').toLowerCase();
  if (type.indexOf('image/') === 0) return true;
  const name = String(file && file.name || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name);
}

function techNoteFileUrl(jobId, fileId) {
  const storage = techNotesStorage();
  if (!storage || !jobId || !fileId) return Promise.resolve('');
  return storage.ref(techNoteStoragePath(jobId, fileId)).getDownloadURL().catch(function () {
    return '';
  });
}

function attachTechNoteFileUrls(jobId, notes) {
  const pending = [];
  (notes || []).forEach(function (note) {
    const id = (note && note.job_id) || jobId;
    techNoteFilesOnNote(note).forEach(function (file) {
      pending.push(techNoteFileUrl(id, file.id).then(function (url) {
        file.url = url;
      }));
    });
  });
  return Promise.all(pending).then(function () { return notes; });
}

function techNoteFilesHtml(note) {
  const files = techNoteFilesOnNote(note);
  if (!files.length) return '';
  let html = '<div class="tech-note-files">';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = String(file && file.name || 'File');
    const url = file && file.url ? String(file.url) : '';
    const inner = (techNoteFileIsImage(file) && url)
      ? '<img class="tech-note-thumb" src="' + esc(url) + '" alt="' + esc(name) + '">'
      : '<span class="tech-note-file-name">' + esc(name) + '</span>';
    if (url) {
      html += '<a class="tech-note-file" href="' + esc(url) + '" download="' + esc(name) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    } else {
      html += '<span class="tech-note-file">' + inner + '</span>';
    }
  }
  html += '</div>';
  return html;
}

function techNotePhoneKey(job) {
  const raw = String((job && (job.mobile || job.phone_national || job.phone)) || '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return '';
  return digits.slice(-8);
}

function techNoteAddressKey(job) {
  return String(job && job.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function techNoteSameClient(a, b) {
  const pa = techNotePhoneKey(a);
  const pb = techNotePhoneKey(b);
  if (pa && pb && pa === pb) return true;
  const aa = techNoteAddressKey(a);
  const ab = techNoteAddressKey(b);
  if (aa && ab && aa === ab) return true;
  return false;
}

function techNoteIsVisitJob(j) {
  if (!j) return false;
  if (typeof isCrewNote === 'function' && isCrewNote(j)) return false;
  if (j.source === 'team-day-crew' || j.source === 'company-day') return false;
  const id = String(j.job_id || '');
  if (id.indexOf('crew-') === 0 || id.indexOf('holiday-') === 0) return false;
  return true;
}

function techNoteClientJobIds(job, jobs) {
  const ids = [];
  const seen = {};
  function add(id) {
    const s = String(id || '');
    if (!s || seen[s]) return;
    seen[s] = 1;
    ids.push(s);
  }
  add(job && job.job_id);
  const pool = Array.isArray(jobs)
    ? jobs
    : ((typeof allJobs !== 'undefined' && allJobs) ? allJobs : []);
  for (let i = 0; i < pool.length; i++) {
    const x = pool[i];
    if (!techNoteIsVisitJob(x)) continue;
    if (techNoteSameClient(job, x)) add(x.job_id);
  }
  return ids;
}

function techNoteAuthorName(author) {
  const raw = String(author || '').trim().toLowerCase();
  if (!raw) return '';
  const local = raw.indexOf('@') >= 0 ? raw.slice(0, raw.indexOf('@')) : raw;
  const names = {
    'jefflamb1992': 'Admin',
    'info': 'Customer Service',
    'ruby': 'Ruby',
    'joshua': 'Josh',
    'perry': 'Perry',
    'iggi.king': 'Iggi',
    'matthewgross2001': 'Matthew',
    'n.marie.lamb': 'Naiyie',
    'neltrestium': 'Nick',
    'sudor23': 'Alun',
    'tiagogiri334': 'Tiago'
  };
  if (names[local]) return names[local];
  return local;
}

function techNoteJobById(jobId, jobs) {
  const id = String(jobId || '');
  if (!id) return null;
  const pool = Array.isArray(jobs)
    ? jobs
    : ((typeof allJobs !== 'undefined' && allJobs) ? allJobs : []);
  for (let i = 0; i < pool.length; i++) {
    if (pool[i] && String(pool[i].job_id) === id) return pool[i];
  }
  return null;
}

function techNoteJobAddress(job) {
  if (!job) return '';
  if (typeof displayAddress === 'function') {
    const shown = displayAddress(job.address, job.district);
    if (shown) return shown;
  }
  return String(job.address || '');
}

function techNoteJobIsReturn(job) {
  if (!job) return false;
  if (job.is_return) return true;
  return String(job.job_type || '').toLowerCase() === 'return';
}

function techNoteLogItemHtml(note, jobs) {
  const text = note && note.text != null ? String(note.text) : '';
  if (!text) return '';
  const who = techNoteAuthorName(note && note.author);
  const when = techNoteAtLabel(note && note.at);
  const jobId = String(note && note.job_id || '');
  const job = techNoteJobById(jobId, jobs);
  const addr = techNoteJobAddress(job);
  const units = (job && typeof liveAcsBadges === 'function') ? (liveAcsBadges(job.acs) || '') : '';
  const ret = techNoteJobIsReturn(job) ? '<span class="tech-note-return">Return</span>' : '';
  const bits = [];
  if (who) bits.push('<span class="tech-note-author">' + esc(who) + '</span>');
  if (when) bits.push('<span class="tech-note-at">' + esc(when) + '</span>');
  if (jobId) bits.push('<span class="tech-note-job">' + esc(jobId) + '</span>');
  const metaHtml = bits.length
    ? '<p class="tech-note-meta">' + bits.join(' · ') + '</p>'
    : '';
  const placeHtml = addr
    ? '<p class="tech-note-addr">' + esc(addr) + '</p>'
    : '';
  const badgeHtml = (units || ret)
    ? '<div class="tech-note-badges">' + units + ret + '</div>'
    : '';
  return '<div class="tech-note-item">' +
    metaHtml +
    placeHtml +
    badgeHtml +
    '<div class="tech-note-text">' + esc(text) + '</div>' +
    techNoteFilesHtml(note) +
  '</div>';
}

function techNoteLogHtml(notes, jobs) {
  const pool = arguments.length > 1
    ? jobs
    : ((typeof allJobs !== 'undefined' && allJobs) ? allJobs : []);
  return techNotesNewestFirst(notes).map(function (note) {
    return techNoteLogItemHtml(note, pool);
  }).join('');
}

function closeTechNotesLog(logEl, historyBtn) {
  if (logEl) {
    logEl.dataset.open = '';
    logEl.style.display = 'none';
    logEl.innerHTML = '';
  }
  if (historyBtn) historyBtn.setAttribute('aria-pressed', 'false');
}

function fetchTechNotes(job) {
  const col = techNotesCol();
  if (!col || !job) return Promise.resolve([]);
  const ids = techNoteClientJobIds(job);
  if (!ids.length) return Promise.resolve([]);
  return Promise.all(ids.map(function (id) {
    return col.where('job_id', '==', String(id)).get();
  })).then(function (snaps) {
    const notes = [];
    snaps.forEach(function (snap) {
      snap.forEach(function (doc) {
        notes.push(doc.data() || {});
      });
    });
    return notes;
  });
}

function paintTechNoteHistoryMark(job, historyBtn) {
  if (!historyBtn) return;
  fetchTechNotes(job).then(function (notes) {
    let has = false;
    for (let i = 0; i < (notes && notes.length || 0); i++) {
      if (notes[i] && String(notes[i].text || '').trim()) {
        has = true;
        break;
      }
    }
    if (has) historyBtn.classList.add('has-notes');
    else historyBtn.classList.remove('has-notes');
  }).catch(function () {
    historyBtn.classList.remove('has-notes');
  });
}

function loadTechNotes(job, listEl) {
  if (!job || !listEl) return;
  fetchTechNotes(job).then(function (notes) {
    return attachTechNoteFileUrls(job && job.job_id, notes);
  }).then(function (withUrls) {
    if (!listEl || listEl.dataset.open !== '1') return;
    listEl.innerHTML = techNoteLogHtml(withUrls);
  }).catch(function () {
    listEl.innerHTML = '';
  });
}

function writeTechNote(job, text, author) {
  const payload = techNotePayload(job, text, author);
  if (!payload) return Promise.resolve(null);
  const col = techNotesCol();
  if (!col) return Promise.resolve(null);
  return col.add(payload).then(function (ref) {
    return { id: ref && ref.id, payload: payload };
  });
}

function bindTechNotes(job) {
  const ta = document.getElementById('techNotesText');
  const fileEl = document.getElementById('techNotesFile');
  const btn = document.getElementById('techNotesSave');
  const historyBtn = document.getElementById('techNotesHistoryBtn');
  const logEl = document.getElementById('techNotesLog');
  closeTechNotesLog(logEl, historyBtn);
  paintTechNoteHistoryMark(job, historyBtn);
  if (historyBtn) {
    historyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!logEl) return;
      if (logEl.dataset.open === '1') {
        closeTechNotesLog(logEl, historyBtn);
        return;
      }
      logEl.dataset.open = '1';
      logEl.style.display = 'block';
      historyBtn.setAttribute('aria-pressed', 'true');
      loadTechNotes(job, logEl);
    });
  }
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const text = ta ? ta.value : '';
    if (!String(text || '').trim()) return;
    const saveBtn = btn;
    if (saveBtn.dataset.busy) return;
    saveBtn.dataset.busy = '1';
    const files = [];
    if (fileEl && fileEl.files && fileEl.files.length) {
      for (let i = 0; i < fileEl.files.length; i++) files.push(fileEl.files[i]);
    }
    writeTechNote(job, text, techNoteBy()).then(function (written) {
      if (!written || !written.payload) return null;
      if (!files.length) return written;
      showTechNoteProgress(0);
      const jobId = written.payload.job_id;
      return uploadTechNoteFiles(jobId, files, showTechNoteProgress).then(function (fileRefs) {
        return addTechNoteFiles(written.id, fileRefs).then(function () {
          return written;
        });
      });
    }).then(function (written) {
      hideTechNoteProgress();
      if (written && written.payload) {
        if (ta) ta.value = '';
        if (fileEl) fileEl.value = '';
        saveBtn.textContent = 'Saved';
        paintTechNoteHistoryMark(job, historyBtn);
        if (logEl && logEl.dataset.open === '1') loadTechNotes(job, logEl);
      } else {
        saveBtn.textContent = 'Save';
      }
    }).catch(function () {
      hideTechNoteProgress();
      saveBtn.textContent = 'Save failed';
    }).then(function () {
      delete saveBtn.dataset.busy;
      setTimeout(function () { saveBtn.textContent = 'Save'; }, 900);
    });
  });
}

function modalBodyHtml(j, mapsRow) {
  const shownAddr = displayAddress(j && j.address, j && j.district);
  const addr = shownAddr
    ? '<div class="modal-address"><div class="modal-address-text">' + esc(shownAddr) + '</div></div>'
    : '';
  return '<div class="sheet-block sheet-identity">' +
      '<p class="sheet-identity-time">' + esc(displayTime(j)) + '</p>' +
    '</div>' +
    '<div class="sheet-block sheet-place">' +
      modalPhoneHtml(j) + addr + (mapsRow || '') +
    '</div>' +
    '<div class="sheet-block sheet-notes">' +
      modalNotesHtml(j) + techNotesBoxHtml() +
    '</div>' +
    '<div class="sheet-block sheet-action">' +
      '<button type="button" id="copyVanBtn" class="van-copy-btn">Copy van request</button>' +
      '<button type="button" id="copyVanPinBtn" class="van-copy-btn van-copy-btn-quiet">Copy van request + pin</button>' +
    '</div>';
}

function openModal(j) {
  document.getElementById('modalTitle').textContent = j.client_name;
  document.getElementById('modalSub').textContent = modalSubText(j);
  const chipsEl = document.getElementById('modalChips');
  if (chipsEl) chipsEl.innerHTML = modalChipsHtml(j);
  const placeUrl = mapsHref(j.address);
  const nextJob = nextJobSameDayLead(j);
  const nextUrl = (nextJob && mapsDirQuery(j.address) && mapsDirQuery(nextJob.address))
    ? mapsDirHref(nextJob.address, j.address)
    : null;
  const officeUrl = mapsDirQuery(j.address)
    ? mapsDirHref('Gravity, 29 Hing Yip Street', j.address)
    : mapsDirHref('Gravity, 29 Hing Yip Street');
  const mapBtns = [];
  if (placeUrl) {
    mapBtns.push('<a href="' + esc(placeUrl) + '" target="_blank" rel="noopener noreferrer">Open Location</a>');
  }
  if (nextJob) {
    if (nextUrl) {
      const nextName = nextJob.client_name ? ' title="To ' + esc(nextJob.client_name) + '"' : '';
      mapBtns.push('<a href="' + esc(nextUrl) + '" target="_blank" rel="noopener noreferrer"' + nextName + '>To next</a>');
    }
  } else if (officeUrl) {
    mapBtns.push('<a href="' + esc(officeUrl) + '" target="_blank" rel="noopener noreferrer">To Office</a>');
  }
  const mapsRow = mapBtns.length
    ? '<div class="job-map-actions">' + mapBtns.join('') + '</div>'
    : '';
  document.getElementById('modalBody').innerHTML = modalBodyHtml(j, mapsRow);
  bindTechNotes(j);
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
      }).then(function () {
        window.location.href = vanDiscordChannel();
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
  if (user && user.email) window.BE_AUTH_EMAIL = String(user.email).toLowerCase().trim();
  const lock = teamFromEmail(user && user.email);
  window.BE_LOCKED_TEAM = lock;
  currentFilters.team = lock || 'Matthew';
  currentFilters.range = 'this_week';
  currentFilters.day = todayISO();
  init();
};
