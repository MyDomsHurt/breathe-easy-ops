/* Breathe-Easy Dashboard
 * Standings | Full Team | Personal
 * Timeframe + metric controls · full-year weeks.json
 * Returns (R) tracked as count only — 0 points
 */
const TECH_ORDER = ['Matthew','Tiago','Nick','Alun','Iggi'];
const TECH_COLORS = {
  Matthew: '#2563eb',
  Tiago: '#0ea5e9',
  Nick: '#22c55e',
  Alun: '#a855f7',
  Iggi: '#f97316'
};

(function initChartDefaults(){
  const OrigChart = window.Chart;
  if (!OrigChart) return;
  const GRID = 'rgba(14,77,145,0.08)';
  const TICK = '#8aa0b8';
  try {
    OrigChart.defaults.font.family = "'Libre Franklin', Arial, system-ui, sans-serif";
    OrigChart.defaults.font.size = 11;
    OrigChart.defaults.font.weight = '600';
    OrigChart.defaults.color = TICK;
    OrigChart.defaults.plugins.legend.labels.boxWidth = 10;
    OrigChart.defaults.plugins.legend.labels.padding = 12;
    OrigChart.defaults.plugins.legend.labels.usePointStyle = true;
    OrigChart.defaults.plugins.legend.labels.pointStyle = 'circle';
    OrigChart.defaults.plugins.legend.labels.color = '#1a3558';
    OrigChart.defaults.plugins.tooltip.backgroundColor = 'rgba(14,77,145,0.94)';
    OrigChart.defaults.plugins.tooltip.cornerRadius = 10;
    OrigChart.defaults.plugins.tooltip.padding = 10;
    OrigChart.defaults.elements.bar.borderRadius = 6;
    OrigChart.defaults.elements.bar.borderSkipped = false;
    OrigChart.defaults.elements.line.borderWidth = 2.5;
    OrigChart.defaults.elements.point.radius = 3.5;
    OrigChart.defaults.elements.point.hoverRadius = 5;
    OrigChart.defaults.scale.grid.color = GRID;
    OrigChart.defaults.scale.grid.drawBorder = false;
    OrigChart.defaults.scale.ticks.color = TICK;
  } catch (e) {}
  function Chart(ctx, config) {
    try {
      const scales = config && config.options && config.options.scales;
      if (scales) {
        Object.keys(scales).forEach(function (k) {
          const axis = scales[k] || (scales[k] = {});
          axis.grid = axis.grid || {};
          axis.grid.color = GRID;
          axis.grid.drawBorder = false;
          if (axis.ticks) axis.ticks.color = TICK;
        });
      }
    } catch (e) {}
    return new OrigChart(ctx, config);
  }
  Chart.prototype = OrigChart.prototype;
  Object.keys(OrigChart).forEach(function (k) { try { Chart[k] = OrigChart[k]; } catch (e) {} });
  window.Chart = Chart;
})();

let DATA = null, charts = [];
let TIMEFRAME = 'this_week';
let METRIC = 'day'; // day | points | unitsDay

function techNames(){
  const keys = DATA && DATA.technicians ? Object.keys(DATA.technicians) : TECH_ORDER;
  return TECH_ORDER.filter(n => keys.includes(n));
}
function $(id){ return document.getElementById(id); }
function fmt(n, d=0){
  if(n==null || isNaN(n)) return '\u2014';
  return Number(n).toLocaleString('en-HK', {maximumFractionDigits:d, minimumFractionDigits:d});
}
function destroyCharts(){ charts.forEach(c => c.destroy()); charts = []; }
function badge(t){
  const x = (t || 'Stable').toLowerCase();
  return `<span class="badge ${x}">${t}</span>`;
}

async function loadData(){
  const [res, wres] = await Promise.all([fetch('data.json'), fetch('weeks.json')]);
  DATA = await res.json();
  const weeks = await wres.json();
  const cols = weeks._cols;
  for(const name of Object.keys(DATA.technicians || {})){
    if(!weeks[name]) continue;
    if(cols){
      DATA.technicians[name].weeks = weeks[name].map(arr => {
        const o = {};
        cols.forEach((c, i) => { o[c] = arr[i]; });
        return o;
      });
    } else {
      DATA.technicians[name].weeks = weeks[name];
    }
  }
  const keys = allWeekKeys();
  if(keys.length){
    DATA.weeks = keys;
    DATA.weekLabels = keys.map(weekLabelFor);
  }
  if(DATA.ranking){
    DATA.ranking = DATA.ranking.map(t => {
      const live = DATA.technicians[t.name];
      return live ? Object.assign({}, t, live) : t;
    });
  }
}

function setNav(active){
  const names = techNames();
  const standingsOn = active === '#/standings' || active === '#/compete';
  const teamActive = active === '#/team' ? ' active' : '';
  $('nav-links').innerHTML =
    names.map(n => `<a href="#/tech/${n}" class="${active === ('#/tech/'+n) ? 'active' : ''}">${n}</a>`).join('') +
    `<span class="nav-sep"></span>` +
    `<a href="#/team" class="${teamActive}">Full Team</a>` +
    `<a href="#/standings" class="nav-compete${standingsOn ? ' active' : ''}">Standings</a>`;
  renderPeriodBar();
}

function allWeekKeys(){
  const set = new Set();
  for(const n of techNames()){
    for(const r of (DATA.technicians[n].weeks || [])) if(r.week) set.add(r.week);
  }
  (DATA.weeks || []).forEach(w => set.add(w));
  return [...set].sort();
}
function earnedCutoff(){
  if(DATA && DATA.generated) return DATA.generated;
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function earnedWeekKeys(){
  const cutoff = earnedCutoff();
  return allWeekKeys().filter(k => k <= cutoff);
}
function addDaysIso(iso, n){
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function thisWeekDayKeys(){
  const mon = latestMondayWeek();
  const cutoff = earnedCutoff();
  if(!mon) return [];
  const out = [];
  for(let d = mon; d <= cutoff; d = addDaysIso(d, 1)) out.push(d);
  return out;
}
function dayLabel(iso){
  const d = new Date(iso + 'T12:00:00');
  if(isNaN(d)) return iso;
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0');
}
function lastEightWeekKeys(){
  return earnedWeekKeys().slice(-8);
}
function thisWeekEarnedDayCount(){
  return thisWeekDayKeys().length;
}
function paceSeries(name, weekKeys){
  const keys = weekKeys && weekKeys.length ? weekKeys : lastEightWeekKeys();
  return {
    grain: 'week',
    labels: keys.map(weekLabelFor),
    pointsDay: keys.map(w => {
      const r = (DATA.technicians[name].weeks || []).find(x => x.week === w);
      return r ? (r.pointsDay || 0) : null;
    }),
    unitsDay: keys.map(w => {
      const r = (DATA.technicians[name].weeks || []).find(x => x.week === w);
      return r ? (r.unitsDay || 0) : null;
    }),
  };
}
function lineChartOptions(){
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(14,77,145,0.08)' }, beginAtZero: true }
    }
  };
}
function weekLabelFor(weekKey){
  for(const n of techNames()){
    const r = (DATA.technicians[n].weeks || []).find(x => x.week === weekKey);
    if(r && r.weekLabel) return r.weekLabel;
  }
  if(!weekKey) return '';
  const d = new Date(weekKey + 'T12:00:00');
  if(isNaN(d)) return weekKey;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate().toString().padStart(2,'0') + ' ' + months[d.getMonth()];
}
function weekMonth(weekStr){ return (weekStr || '').slice(0, 7); }
function weekQuarter(weekStr){
  if(!weekStr) return null;
  const y = weekStr.slice(0, 4);
  const m = parseInt(weekStr.slice(5, 7), 10);
  return y + '-Q' + Math.ceil(m / 3);
}
function monthLabel(monthKey){
  if(!monthKey) return 'Month';
  const [y, m] = monthKey.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(m, 10) - 1] + ' ' + y;
}
function quarterLabel(quarterKey){
  if(!quarterKey) return 'Quarter';
  const parts = quarterKey.split('-Q');
  return 'Q' + parts[1] + ' ' + parts[0];
}
function shiftMonth(monthKey, delta){
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function shiftQuarter(quarterKey, delta){
  const [yStr, qStr] = quarterKey.split('-Q');
  let y = parseInt(yStr, 10), q = parseInt(qStr, 10) + delta;
  while(q < 1){ q += 4; y -= 1; }
  while(q > 4){ q -= 4; y += 1; }
  return y + '-Q' + q;
}

function resolveTimeframe(id){
  const keys = earnedWeekKeys();
  if(!keys.length) return { id, label: 'No data', weeks: [] };
  const latest = keys[keys.length - 1];
  const prev = keys.length > 1 ? keys[keys.length - 2] : null;
  const thisMonth = weekMonth(latest);
  const lastMonth = shiftMonth(thisMonth, -1);
  const thisQ = weekQuarter(latest);
  const lastQ = shiftQuarter(thisQ, -1);
  const filterMonth = (mk) => keys.filter(k => weekMonth(k) === mk);
  const filterQuarter = (qk) => keys.filter(k => weekQuarter(k) === qk);

  switch(id){
    case 'this_week':
      return { id, label: 'This week · ' + weekLabelFor(latest), weeks: [latest] };
    case 'last_week':
      return { id, label: prev ? 'Last week · ' + weekLabelFor(prev) : 'Last week', weeks: prev ? [prev] : [] };
    case 'last_4':
      return { id, label: 'Last 4 weeks', weeks: keys.slice(-4) };
    case 'this_month':
      return { id, label: monthLabel(thisMonth), weeks: filterMonth(thisMonth) };
    case 'last_month':
      return { id, label: monthLabel(lastMonth), weeks: filterMonth(lastMonth) };
    case 'this_quarter':
      return { id, label: quarterLabel(thisQ), weeks: filterQuarter(thisQ) };
    case 'last_quarter':
      return { id, label: quarterLabel(lastQ), weeks: filterQuarter(lastQ) };
    case 'ytd':
    case 'full':
      return { id, label: 'Year to date', weeks: keys };
    default:
      return { id: 'this_week', label: 'This week · ' + weekLabelFor(latest), weeks: [latest] };
  }
}

const TF_PRESETS = [
  { id: 'this_week', short: 'This week' },
  { id: 'last_week', short: 'Last week' },
  { id: 'last_4', short: 'Last 4 wks' },
  { id: 'this_month', short: 'This month' },
  { id: 'last_month', short: 'Last month' },
  { id: 'this_quarter', short: 'This quarter' },
  { id: 'last_quarter', short: 'Last quarter' },
  { id: 'ytd', short: 'YTD' },
];

const METRIC_PRESETS = [
  { id: 'day', short: 'Pts / Day' },
  { id: 'points', short: 'Total points' },
  { id: 'unitsDay', short: 'Units / Day' },
];

function metricLabel(id){
  return ({ day: 'Pts/Day', points: 'Points', unitsDay: 'Units/Day' })[id] || 'Pts/Day';
}
function metricFmt(id, v){
  if(id === 'points') return fmt(v, 1);
  return fmt(v, 2);
}
function metricValue(stats, id){
  if(id === 'points') return stats.points;
  if(id === 'unitsDay') return stats.unitsDay;
  return stats.pointsDay;
}

function techWindowStats(name, weekKeys){
  const set = new Set(weekKeys);
  const rows = (DATA.technicians[name].weeks || []).filter(r => set.has(r.week));
  let points = 0, days = 0, units = 0, returns = 0;
  for(const r of rows){
    points += r.points || 0;
    days += r.workday || 0;
    units += r.totalUnits || 0;
    returns += r.returns || 0;
  }
  points = Math.round(points * 10) / 10;
  return {
    name,
    points,
    days,
    units,
    returns,
    pointsDay: days ? Math.round((points / days) * 100) / 100 : 0,
    unitsDay: days ? Math.round((units / days) * 100) / 100 : 0,
    weeks: rows,
    weeksActive: rows.filter(r => (r.workday || 0) > 0 || (r.points || 0) > 0).length,
  };
}

function teamWindowStats(weekKeys){
  const names = techNames();
  let points = 0, days = 0, units = 0, returns = 0;
  const byTech = {};
  for(const n of names){
    const s = techWindowStats(n, weekKeys);
    byTech[n] = s;
    points += s.points;
    days += s.days;
    units += s.units;
    returns += s.returns;
  }
  points = Math.round(points * 10) / 10;
  return {
    points, days, units, returns,
    pointsDay: days ? Math.round((points / days) * 100) / 100 : 0,
    byTech,
  };
}

function rankedTechs(weekKeys, metric){
  return techNames()
    .map(n => techWindowStats(n, weekKeys))
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

function trendInWindow(stats){
  const active = (stats.weeks || []).filter(r => (r.workday || 0) > 0);
  if(active.length < 2) return 'Stable';
  const a = active[active.length - 2].pointsDay || 0;
  const b = active[active.length - 1].pointsDay || 0;
  if(b > a + 0.3) return 'Improving';
  if(b < a - 0.3) return 'Declining';
  return 'Stable';
}

function renderPeriodBar(){
  const bar = $('period-bar');
  if(!bar) return;
  const tf = resolveTimeframe(TIMEFRAME);
  const tfBtns = TF_PRESETS.map(p =>
    `<button type="button" class="rank-mode-btn ${TIMEFRAME===p.id?'active':''}" data-tf="${p.id}">${p.short}</button>`
  ).join('');
  bar.innerHTML =
    `<div class="period-bar-inner">` +
      `<span class="period-label">Period</span>` +
      `<div class="rank-modes">${tfBtns}</div>` +
      `<span class="period-active">${tf.label}</span>` +
    `</div>`;
}

function bindPeriodBar(){
  const bar = $('period-bar');
  if(!bar || bar.dataset.bound) return;
  bar.dataset.bound = '1';
  bar.addEventListener('click', (e) => {
    const tfBtn = e.target.closest('[data-tf]');
    if(!tfBtn) return;
    TIMEFRAME = tfBtn.getAttribute('data-tf');
    route();
  });
}

function renderCompetition(){
  if(typeof window.renderCompetePage === 'function'){
    window.renderCompetePage();
    return;
  }
}

function renderTeam(){
  if(typeof window.renderTeamPage === 'function'){
    window.renderTeamPage();
  }
}

function renderTech(name){
  if(typeof window.renderTechPage === 'function'){
    window.renderTechPage(name);
  }
}

function route(){
  const hash = location.hash || '#/team';
  if(hash.startsWith('#/tech/')) renderTech(decodeURIComponent(hash.replace('#/tech/', '')));
  else if(hash === '#/standings' || hash === '#/compete') renderCompetition();
  else renderTeam();
}
window.addEventListener('hashchange', route);
bindPeriodBar();
loadData().then(() => { route(); }).catch(err => {
  console.error(err);
  $('app').innerHTML = '<p>Failed to load data.</p>';
});
window.startDashboard = function(){ route(); };
