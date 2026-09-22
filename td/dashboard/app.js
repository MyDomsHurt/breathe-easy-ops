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
let VIEW = 'units'; // 'units' | 'points'

function techNames(){
  const keys = DATA && DATA.technicians ? Object.keys(DATA.technicians) : TECH_ORDER;
  return TECH_ORDER.filter(n => keys.includes(n));
}
function $(id){ return document.getElementById(id); }
function fmt(n, d=0){
  if(n==null || isNaN(n)) return '\u2014';
  return Number(n).toLocaleString('en-HK', {maximumFractionDigits:d, minimumFractionDigits:d});
}
function fmtUnits(n){
  if(n == null || isNaN(n)) return '\u2014';
  const x = Number(n);
  const d = Math.round(Math.abs(x) * 10) % 10 === 0 ? 0 : 1;
  return fmt(x, d);
}
function destroyCharts(){ charts.forEach(c => c.destroy()); charts = []; }
function badge(t){
  const x = (t || 'Stable').toLowerCase();
  return `<span class="badge ${x}">${t}</span>`;
}

function finishLoadedData(){
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

async function loadJsonFallback(){
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
  finishLoadedData();
}

function waitForBELoadPerfJobs(){
  return new Promise(function (resolve) {
    let n = 0;
    function tick(){
      if (typeof window.BELoadPerfJobs === 'function') {
        resolve(window.BELoadPerfJobs);
        return;
      }
      n += 1;
      if (n > 20) {
        resolve(null);
        return;
      }
      if (n < 4) queueMicrotask(tick);
      else setTimeout(tick, 25);
    }
    queueMicrotask(tick);
  });
}

async function loadData(){
  try {
    const loader = await waitForBELoadPerfJobs();
    if (loader) {
      const jobs = await loader();
      if (jobs && jobs.length && typeof window.BEApplyScoredData === 'function') {
        const scored = window.BEApplyScoredData(jobs);
        if (scored && scored.technicians) {
          DATA = scored;
          finishLoadedData();
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Live Performance score unavailable, using data.json', err);
  }
  await loadJsonFallback();
}

window.BEOnPerfJobsChanged = function BEOnPerfJobsChanged(jobs){
  if (typeof window.BEApplyScoredData !== 'function') return;
  const scored = window.BEApplyScoredData(jobs);
  if (!scored || !scored.technicians) return;
  DATA = scored;
  finishLoadedData();
  if (typeof route === 'function') route();
};

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
function monthBounds(ym){
  const [y, m] = (ym || '').split('-').map(Number);
  if(!y || !m) return null;
  const last = new Date(y, m, 0).getDate();
  return {
    start: ym + '-01',
    end: ym + '-' + String(last).padStart(2, '0')
  };
}
function daysInclusive(start, end){
  if(!start || !end || start > end) return [];
  const out = [];
  for(let d = start; d <= end; d = addDaysIso(d, 1)) out.push(d);
  return out;
}
function calendarSpanLabel(start, end){
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function bit(iso){
    const p = (iso || '').split('-').map(Number);
    if(p.length < 3) return iso || '';
    return p[2] + ' ' + months[p[1] - 1];
  }
  return bit(start) + ' – ' + bit(end);
}
function periodRangeLabel(weeks, id, tf){
  if(tf && tf.start && tf.end) return calendarSpanLabel(tf.start, tf.end);
  if(!weeks || !weeks.length) return 'No data in this period';
  if(id === 'this_week' || id === 'last_week'){
    const mon = weeks[0];
    return 'Monday through Sunday · ' + calendarSpanLabel(mon, addDaysIso(mon, 6));
  }
  const firstSpan = weekSpanLabel(weeks[0]);
  const lastSpan = weekSpanLabel(weeks[weeks.length - 1]);
  const start = firstSpan.split(' – ')[0];
  const end = lastSpan.split(' – ').pop();
  return start + ' – ' + end;
}
function thisWeekEarnedDayCount(){
  return thisWeekDayKeys().length;
}
function periodDayKeys(tf){
  if(!tf || !tf.weeks || !tf.weeks.length) return [];
  const mon = tf.weeks[0];
  const sunday = addDaysIso(mon, 6);
  const out = [];
  for(let d = mon; d <= sunday; d = addDaysIso(d, 1)) out.push(d);
  return out;
}
function periodMixDates(tf){
  if(!tf) return [];
  if(tf.id === 'this_week' || tf.id === 'last_week') return periodDayKeys(tf);
  if((tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end){
    return daysInclusive(tf.start, tf.end);
  }
  const dates = [];
  (tf.weeks || []).forEach(w => {
    for(let d = w; d <= addDaysIso(w, 6); d = addDaysIso(d, 1)) dates.push(d);
  });
  return dates;
}
function monthShortLabel(ym){
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = parseInt((ym || '').slice(5, 7), 10);
  return names[m - 1] || ym;
}
function monthsInTimeframe(tf){
  const cap = (earnedCutoff() || '').slice(0, 7);
  const out = [];
  function add(ym){
    if(!ym || (cap && ym > cap)) return;
    if(out.indexOf(ym) === -1) out.push(ym);
  }
  if(tf.id === 'ytd' || tf.id === 'full'){
    const y = (cap || '2026-01').slice(0, 4);
    for(let m = 1; m <= 12; m++) add(y + '-' + String(m).padStart(2, '0'));
    return out.sort();
  }
  if(tf.id === 'this_quarter' || tf.id === 'last_quarter'){
    const keys = tf.weeks || [];
    if(!keys.length) return [];
    const q = weekQuarter(keys[0]);
    if(!q) return [];
    const parts = q.split('-Q');
    const y = parts[0];
    const startM = (parseInt(parts[1], 10) - 1) * 3 + 1;
    for(let i = 0; i < 3; i++) add(y + '-' + String(startM + i).padStart(2, '0'));
    return out.sort();
  }
  return [];
}
function monthlyChartFor(name, field, tf, title){
  const months = monthsInTimeframe(tf);
  const totals = {};
  months.forEach(ym => { totals[ym] = 0; });
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => {
    const ym = (r.date || '').slice(0, 7);
    if(totals[ym] == null) return;
    totals[ym] += Number(r[field] || 0);
  });
  return {
    grain: 'month',
    labels: months.map(monthShortLabel),
    data: months.map(ym => totals[ym] || 0),
    title: title,
    explain: 'Monthly ' + title.toLowerCase()
  };
}
function chartTodayHkt(){
  if(typeof window.BEScoreHktToday === 'function') return window.BEScoreHktToday();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
function dailyChartPoint(map, d, today){
  const n = Number(map[d] || 0);
  if(today && d > today) return n ? n : null;
  return n;
}
function pointsChartFor(name, tf){
  if(tf.id === 'this_quarter' || tf.id === 'last_quarter' || tf.id === 'ytd' || tf.id === 'full'){
    return monthlyChartFor(name, 'points', tf, 'Points');
  }
  const daily = tf.id === 'this_week' || tf.id === 'last_week';
  const month = tf.id === 'this_month' || tf.id === 'last_month';
  const today = chartTodayHkt();
  const map = {};
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => { map[r.date] = r.points || 0; });
  if(daily){
    const dates = periodDayKeys(tf);
    return {
      grain: 'day',
      labels: dates.map(dayLabel),
      data: dates.map(d => dailyChartPoint(map, d, today)),
      title: 'Points',
      explain: 'Daily points'
    };
  }
  if(month && tf.start && tf.end){
    const dates = daysInclusive(tf.start, tf.end);
    return {
      grain: 'day',
      labels: dates.map(dayLabel),
      data: dates.map(d => dailyChartPoint(map, d, today)),
      title: 'Points',
      explain: 'Daily points'
    };
  }
  const keys = tf.weeks || [];
  return {
    grain: 'week',
    labels: keys.map(weekLabelFor),
    data: keys.map(w => {
      const r = (DATA.technicians[name].weeks || []).find(x => x.week === w);
      return r ? (r.points || 0) : null;
    }),
    title: 'Points',
    explain: 'Weekly points'
  };
}
function unitsChartFor(name, tf){
  if(tf.id === 'this_quarter' || tf.id === 'last_quarter' || tf.id === 'ytd' || tf.id === 'full'){
    return monthlyChartFor(name, 'units', tf, 'Units');
  }
  const daily = tf.id === 'this_week' || tf.id === 'last_week';
  const month = tf.id === 'this_month' || tf.id === 'last_month';
  const today = chartTodayHkt();
  const map = {};
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => { map[r.date] = r.units || 0; });
  if(daily){
    const dates = periodDayKeys(tf);
    return {
      grain: 'day',
      labels: dates.map(dayLabel),
      data: dates.map(d => dailyChartPoint(map, d, today)),
      title: 'Units',
      explain: 'Daily units'
    };
  }
  if(month && tf.start && tf.end){
    const dates = daysInclusive(tf.start, tf.end);
    return {
      grain: 'day',
      labels: dates.map(dayLabel),
      data: dates.map(d => dailyChartPoint(map, d, today)),
      title: 'Units',
      explain: 'Daily units'
    };
  }
  const keys = tf.weeks || [];
  return {
    grain: 'week',
    labels: keys.map(weekLabelFor),
    data: keys.map(w => {
      const r = (DATA.technicians[name].weeks || []).find(x => x.week === w);
      return r ? (r.totalUnits || 0) : null;
    }),
    title: 'Units',
    explain: 'Weekly units'
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

function statsFromDaily(name, start, end){
  const rows = ((DATA.daily && DATA.daily[name]) || []).filter(r => r.date >= start && r.date <= end);
  let units = 0, points = 0, returns = 0, days = 0, jobs = 0, jobDays = 0;
  rows.forEach(r => {
    units += r.units || 0;
    points += r.points || 0;
    returns += r.returns || 0;
    jobs += r.jobs || 0;
    if((r.units || 0) || (r.points || 0) || (r.returns || 0) || (r.jobs || 0)) days += 1;
    if((r.jobs || 0) > 0) jobDays += 1;
  });
  return {
    name: name,
    units: units,
    points: Math.round(points * 10) / 10,
    returns: returns,
    days: days,
    jobs: jobs,
    jobsDay: jobDays ? Math.round((jobs / jobDays) * 100) / 100 : 0,
    unitsDay: days ? Math.round((units / days) * 100) / 100 : 0,
    pointsDay: days ? Math.round((points / days) * 100) / 100 : 0,
    weeks: []
  };
}
function periodTechStats(name, tf){
  if((tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end){
    return statsFromDaily(name, tf.start, tf.end);
  }
  if((tf.id === 'this_week' || tf.id === 'last_week') && tf.weeks && tf.weeks.length){
    const mon = tf.weeks[0];
    return statsFromDaily(name, mon, addDaysIso(mon, 6));
  }
  if(!tf.weeks || !tf.weeks.length) return emptyWindowStats();
  const s = techWindowStats(name, tf.weeks);
  const fromDaily = statsFromDaily(name, tf.weeks[0], addDaysIso(tf.weeks[tf.weeks.length - 1], 6));
  s.jobs = fromDaily.jobs;
  s.jobsDay = fromDaily.jobsDay;
  return s;
}

function resolveTimeframe(id){
  const keys = earnedWeekKeys();
  if(!keys.length) return { id, label: 'No data', weeks: [] };
  const latest = keys[keys.length - 1];
  const prev = keys.length > 1 ? keys[keys.length - 2] : null;
  const thisMonth = (earnedCutoff() || latest || '').slice(0, 7);
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
    case 'this_month': {
      const b = monthBounds(thisMonth);
      return { id, label: monthLabel(thisMonth), weeks: filterMonth(thisMonth), start: b && b.start, end: b && b.end };
    }
    case 'last_month': {
      const b = monthBounds(lastMonth);
      return { id, label: monthLabel(lastMonth), weeks: filterMonth(lastMonth), start: b && b.start, end: b && b.end };
    }
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

function metricValue(stats, id){
  if(id === 'unitsDay') return stats.unitsDay;
  if(id === 'pointsDay' || id === 'day') return stats.pointsDay;
  if(id === 'points') return stats.points;
  if(id === 'units') return stats.units;
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
    unitsDay: days ? Math.round((units / days) * 100) / 100 : 0,
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

function isUnitsView(){
  return VIEW !== 'points';
}
function metricLabel(){
  return isUnitsView() ? 'Units' : 'Points';
}
function metricDayLabel(){
  return isUnitsView() ? 'Units / day' : 'Pts / day';
}
function metricTotal(s){
  return isUnitsView() ? s.units : s.points;
}
function metricDay(s){
  return isUnitsView() ? s.unitsDay : s.pointsDay;
}
function outputChartFor(name, tf){
  return isUnitsView() ? unitsChartFor(name, tf) : pointsChartFor(name, tf);
}

function renderPeriodBar(){
  const bar = $('period-bar');
  if(!bar) return;
  const opts = TF_PRESETS.map(p =>
    `<option value="${p.id}"${TIMEFRAME===p.id?' selected':''}>${p.short}</option>`
  ).join('');
  bar.innerHTML =
    `<div class="period-bar-inner">` +
      `<label class="period-label" for="period-select">Period</label>` +
      `<select id="period-select" class="period-select" aria-label="Period">${opts}</select>` +
      `<label class="period-label" for="view-select">Show</label>` +
      `<select id="view-select" class="period-select" aria-label="Show">` +
        `<option value="units"${VIEW==='units'?' selected':''}>Units</option>` +
        `<option value="points"${VIEW==='points'?' selected':''}>Points</option>` +
      `</select>` +
    `</div>`;
}

function bindPeriodBar(){
  const bar = $('period-bar');
  if(!bar || bar.dataset.bound) return;
  bar.dataset.bound = '1';
  bar.addEventListener('change', (e) => {
    const sel = e.target.closest('select');
    if(!sel) return;
    if(sel.id === 'period-select') TIMEFRAME = sel.value;
    if(sel.id === 'view-select') VIEW = sel.value;
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
