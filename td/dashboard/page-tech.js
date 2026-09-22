/* Personal page (#/tech/{Name})
 * Units, units/day on worked days, returns, days worked.
 * Chart + day/week list for the selected period. Josh is not on the board.
 */
function techDailyMap(name){
  const map = {};
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => { map[r.date] = r; });
  return map;
}
function techWorkedDayCount(name, start, end){
  return ((DATA.daily && DATA.daily[name]) || []).filter(r =>
    r.date >= start && r.date <= end && ((r.units || 0) || (r.returns || 0))
  ).length;
}
function techDayList(name, tf){
  const today = earnedCutoff();
  const map = techDailyMap(name);
  const weekLike = tf.id === 'this_week' || tf.id === 'last_week';
  const monthLike = (tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end;
  function dayRow(d){
    const r = map[d];
    const future = today && d > today;
    const booked = r && ((r.units || 0) || (r.returns || 0) || (r.points || 0) || (r.jobs || 0));
    return {
      label: dayLabel(d),
      units: r ? (r.units || 0) : 0,
      points: r ? (r.points || 0) : 0,
      returns: r ? (r.returns || 0) : 0,
      jobs: r ? (r.jobs || 0) : 0,
      blank: !!(future && !booked)
    };
  }
  if(weekLike && tf.weeks && tf.weeks.length){
    return periodDayKeys(tf).map(dayRow);
  }
  if(monthLike){
    return daysInclusive(tf.start, tf.end).map(dayRow);
  }
  return (tf.weeks || []).map(w => {
    const row = (DATA.technicians[name].weeks || []).find(x => x.week === w);
    const future = today && addDaysIso(w, 6) > today && w > today;
    const units = row ? (row.totalUnits || 0) : 0;
    const points = row ? (row.points || 0) : 0;
    const returns = row ? (row.returns || 0) : 0;
    let jobs = 0;
    const map = techDailyMap(name);
    for(let d = w; d <= addDaysIso(w, 6); d = addDaysIso(d, 1)){
      jobs += (map[d] && map[d].jobs) || 0;
    }
    return {
      label: weekLabelFor(w),
      units: units,
      points: points,
      returns: returns,
      jobs: jobs,
      blank: !!(future && !units && !returns && !points && !jobs)
    };
  });
}

const MIX_TYPES = ['S','W','B','C','UC','TV','OU','SwG','EF','PAU'];
const TYPE_WEIGHTS = { S:1, W:0.85, B:1.3, C:1.8, UC:1.5, TV:1.4, OU:1.4, SwG:1.3, EF:1, PAU:1 };
const MIX_COLORS = ['#2563eb','#0d9488','#7c3aed','#d97706','#dc2626','#0891b2','#4f46e5','#65a30d','#db2777','#57534e'];
const DAY_CHART_TF = { this_week: true, last_week: true, this_month: true, last_month: true };

function techDayChartDates(tf){
  if(!tf || !DAY_CHART_TF[tf.id]) return [];
  if(tf.id === 'this_week' || tf.id === 'last_week') return periodDayKeys(tf);
  if((tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end) return daysInclusive(tf.start, tf.end);
  return [];
}
function techDayHeadDate(iso){
  const d = new Date(iso + 'T12:00:00');
  if(isNaN(d)) return iso;
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return wd + ' ' + d.getDate() + ' ' + months[d.getMonth()];
}
function techJobTimeMinutes(j){
  const s = String(j && j.time || '').toLowerCase().replace(/\s+/g, '');
  const m = s.match(/(\d{1,2})(?:[.:](\d{2}))?(am|pm)?/);
  if(!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : 0;
  const ap = m[3] || '';
  if(ap === 'pm' && h < 12) h += 12;
  if(ap === 'am' && h === 12) h = 0;
  if(!ap && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}
function techJobTimeLabel(j){
  const mins = techJobTimeMinutes(j);
  if(mins === 9999){
    const raw = String(j && j.time || '').trim();
    return raw || '\u2014';
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function techHEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function techUnitCodesLine(counts, total){
  const bits = [];
  MIX_TYPES.forEach(k => {
    const n = Number(counts && counts[k] || 0);
    if(!n) return;
    bits.push((Math.round(n * 10) / 10) + k);
  });
  const tot = fmtUnits(total || 0);
  if(!bits.length) return tot;
  return bits.join(' ') + ' and ' + tot;
}
function listLeadDayJobs(name, iso){
  if(!window.BEJobStore || typeof window.BEJobStore.listJobs !== 'function') return null;
  const rows = window.BEJobStore.listJobs() || [];
  const out = [];
  rows.forEach(job => {
    if(!job) return;
    if(job.deleted === true || job.deleted === 'true') return;
    if(typeof window.BEScoreJobIsCrew === 'function' && window.BEScoreJobIsCrew(job)) return;
    const date = typeof window.BEScoreJobDate === 'function' ? window.BEScoreJobDate(job) : String(job.date || '');
    if(date !== iso) return;
    const lead = typeof window.BEScoreJobLead === 'function'
      ? window.BEScoreJobLead(job)
      : String(job.team_lead || '').trim();
    if(lead !== name) return;
    out.push(job);
  });
  out.sort(function (a, b) {
    const d = techJobTimeMinutes(a) - techJobTimeMinutes(b);
    if(d) return d;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
  return out;
}
function paintTechDayPoints(chart, selectedIdx, color){
  if(!chart || !chart.data || !chart.data.datasets || !chart.data.datasets[0]) return;
  const n = (chart.data.labels || []).length;
  const ds = chart.data.datasets[0];
  ds.pointRadius = Array.from({ length: n }, (_, i) => i === selectedIdx ? 7 : 4);
  ds.pointHoverRadius = Array.from({ length: n }, (_, i) => i === selectedIdx ? 8 : 6);
  ds.pointBackgroundColor = Array.from({ length: n }, (_, i) => i === selectedIdx ? '#fff' : color);
  ds.pointBorderColor = color;
  ds.pointBorderWidth = Array.from({ length: n }, (_, i) => i === selectedIdx ? 3 : 1);
  chart.update('none');
}
function clearTechDaySelect(chart, color){
  if(chart) chart.$techDayIdx = null;
  paintTechDayPoints(chart, -1, color);
  const el = document.getElementById('p-day-jobs');
  if(el){
    el.hidden = true;
    el.innerHTML = '';
  }
}
function showTechDayJobs(name, iso, onClose){
  const el = document.getElementById('p-day-jobs');
  if(!el) return;
  const jobs = listLeadDayJobs(name, iso);
  if(jobs == null){
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const head = techDayHeadDate(iso);
  let unitSum = 0;
  const body = jobs.map(j => {
    const scored = typeof window.BEScoreJobUnits === 'function'
      ? window.BEScoreJobUnits(j)
      : { isReturn: false, counts: {}, total: 0 };
    unitSum += Number(scored.total || 0);
    const ret = scored.isReturn ? 'Return' : '';
    return `<tr>
      <td>${techHEsc(techJobTimeLabel(j))}</td>
      <td>${techHEsc(techUnitCodesLine(scored.counts, scored.total))}</td>
      <td class="ret">${ret}</td>
    </tr>`;
  }).join('');
  const jobWord = jobs.length === 1 ? 'job' : 'jobs';
  el.hidden = false;
  el.innerHTML = `
    <div class="tech-day-jobs-head">
      <div class="tech-day-jobs-title">${techHEsc(head)} \u00b7 ${jobs.length} ${jobWord} \u00b7 ${fmtUnits(unitSum)}</div>
      <button type="button" class="tech-day-jobs-close" id="p-day-jobs-close">Close</button>
    </div>
    ${jobs.length
      ? `<div class="table-wrap"><table>
          <tbody>${body}</tbody>
        </table></div>`
      : '<p class="tech-day-jobs-empty">Nothing booked.</p>'}`;
  const btn = document.getElementById('p-day-jobs-close');
  if(btn && onClose) btn.addEventListener('click', onClose);
}
function onTechDayChartClick(chart, evt, name, dates, color){
  if(!window.BEJobStore || typeof window.BEJobStore.listJobs !== 'function') return;
  let idx = null;
  const els = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false, axis: 'x' }, true);
  if(els && els.length) idx = els[0].index;
  else {
    const scale = chart.scales.x;
    if(scale){
      const v = scale.getValueForPixel(evt.x);
      if(typeof v === 'number' && v >= 0 && v < dates.length) idx = Math.round(v);
    }
  }
  if(idx == null || idx < 0 || idx >= dates.length) return;
  if(chart.$techDayIdx === idx){
    clearTechDaySelect(chart, color);
    return;
  }
  chart.$techDayIdx = idx;
  paintTechDayPoints(chart, idx, color);
  showTechDayJobs(name, dates[idx], function () { clearTechDaySelect(chart, color); });
}
function techMixDates(tf){
  const weekLike = tf.id === 'this_week' || tf.id === 'last_week';
  const monthLike = (tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end;
  if(weekLike && tf.weeks && tf.weeks.length) return periodDayKeys(tf);
  if(monthLike) return daysInclusive(tf.start, tf.end);
  const dates = [];
  (tf.weeks || []).forEach(w => {
    for(let d = w; d <= addDaysIso(w, 6); d = addDaysIso(d, 1)) dates.push(d);
  });
  return dates;
}
function techMix(name, tf){
  const dates = {};
  techMixDates(tf).forEach(d => { dates[d] = true; });
  const mix = {};
  MIX_TYPES.forEach(k => { mix[k] = 0; });
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => {
    if(!dates[r.date]) return;
    MIX_TYPES.forEach(k => { mix[k] += Number(r[k] || 0); });
  });
  return mix;
}

window.renderTechPage = function renderTechPage(name){
  destroyCharts();
  if(!DATA.technicians[name] || techNames().indexOf(name) === -1){
    location.hash = '#/team';
    return;
  }
  setNav('#/tech/' + name);
  const color = TECH_COLORS[name] || '#1481c3';
  const tf = resolveTimeframe(TIMEFRAME);
  const copy = periodStripCopy(tf);
  const period = periodTechStats(name, tf);
  const chart = outputChartFor(name, tf);
  const dayList = techDayList(name, tf);
  let winStart = null;
  let winEnd = null;
  if(tf.start && tf.end){
    winStart = tf.start;
    winEnd = tf.end;
  } else if(tf.weeks && tf.weeks.length){
    winStart = tf.weeks[0];
    winEnd = addDaysIso(tf.weeks[tf.weeks.length - 1], 6);
  }
  const daysWorked = (winStart && winEnd)
    ? techWorkedDayCount(name, winStart, winEnd)
    : (period.days || 0);
  const periodTotal = metricTotal(period);
  const periodDay = daysWorked ? Math.round((periodTotal / daysWorked) * 100) / 100 : 0;
  const today = earnedCutoff();
  let doneLeftHtml = '';
  if(tf.id === 'this_week' && tf.weeks && tf.weeks.length && today){
    const mon = tf.weeks[0];
    const sunday = addDaysIso(mon, 6);
    const doneStats = statsFromDaily(name, mon, today);
    const tom = addDaysIso(today, 1);
    const leftStats = tom <= sunday ? statsFromDaily(name, tom, sunday) : emptyWindowStats();
    const doneVal = metricTotal(doneStats);
    const leftVal = metricTotal(leftStats);
    const fmtVal = v => isUnitsView() ? fmtUnits(v) : fmt(v, 1);
    doneLeftHtml =
      `<div class="this-week-stat">
        <div class="label">Done</div>
        <div class="value">${fmtVal(doneVal)}</div>
      </div>
      <div class="this-week-stat">
        <div class="label">Left</div>
        <div class="value">${fmtVal(leftVal)}</div>
      </div>`;
  }
  const mix = techMix(name, tf);
  const pieSlices = MIX_TYPES.filter(k => mix[k] > 0).map(k => ({
    type: k,
    value: isUnitsView() ? mix[k] : mix[k] * TYPE_WEIGHTS[k]
  }));
  const ownWeeks = ((DATA.technicians[name] && DATA.technicians[name].weeks) || [])
    .filter(r => (r.workday || 0) > 0)
    .slice(-8);
  const ownDays = ownWeeks.reduce((s, r) => s + (r.workday || 0), 0);
  const ownAmt = ownWeeks.reduce((s, r) => s + (isUnitsView() ? (r.totalUnits || 0) : (r.points || 0)), 0);
  const ownPace = ownDays ? Math.round((ownAmt / ownDays) * 100) / 100 : null;
  const paceHtml = ownPace == null
    ? ''
    : `<p class="kpi-explain" style="margin:0 0 20px">This period: ${fmt(periodDay, 2)} ${isUnitsView() ? 'units/day' : 'pts/day'}. Your last 8 weeks: ${fmt(ownPace, 2)} ${isUnitsView() ? 'units/day' : 'pts/day'}.</p>`;
  const tableRows = dayList.map(r =>
    `<tr>
      <td>${r.label}</td>
      <td class="num">${r.blank ? '' : (isUnitsView() ? fmtUnits(r.units) : fmt(r.points, 1))}</td>
      <td class="num">${r.blank ? '' : fmt(r.returns)}</td>
      <td class="num">${r.blank ? '' : fmt(r.jobs || 0)}</td>
    </tr>`
  ).join('');

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1><span class="tech-dot" style="background:${color};width:12px;height:12px;display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle"></span>${name}</h1>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range}</p>
      <div class="this-week-stats">
        <div class="this-week-stat">
          <div class="label">${metricLabel()}</div>
          <div class="value">${isUnitsView() ? fmtUnits(periodTotal) : fmt(periodTotal, 1)}</div>
        </div>
        ${doneLeftHtml}
        <div class="this-week-stat">
          <div class="label">${metricDayLabel()}</div>
          <div class="value">${fmt(periodDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(period.returns)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Days worked</div>
          <div class="value">${fmt(daysWorked)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Jobs</div>
          <div class="value">${fmt(period.jobs || 0)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Jobs / day</div>
          <div class="value">${fmt(period.jobsDay || 0, 2)}</div>
        </div>
      </div>
    </section>
    ${paceHtml}
    <div class="tech-desk${pieSlices.length ? ' has-pie' : ''}">
      <div class="tech-line section">
        <div class="section-title">${metricLabel()}</div>
        <div class="chart-card">
          <h3>${metricLabel()}</h3>
          <p class="chart-explain">${name} only · ${chart.explain}.</p>
          <div class="chart-wrap tech-line-wrap"><canvas id="p-pace"></canvas></div>
          <div id="p-day-jobs" class="tech-day-jobs" hidden></div>
        </div>
      </div>
      ${pieSlices.length ? `
      <div class="tech-pie section">
        <div class="section-title">${metricLabel()} mix</div>
        <div class="chart-card tech-pie-card">
          <h3>${metricLabel()} by type</h3>
          <div class="chart-wrap tech-pie-wrap"><canvas id="p-mix"></canvas></div>
        </div>
      </div>` : ''}
      <div class="tech-days section">
        <div class="section-title">Days</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th class="num">${metricLabel()}</th><th class="num">Returns</th><th class="num">Jobs</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>
    </div>`;

  if(pieSlices.length){
    charts.push(new Chart(document.getElementById('p-mix'), {
      type: 'pie',
      data: {
        labels: pieSlices.map(s => s.type),
        datasets: [{
          data: pieSlices.map(s => s.value),
          backgroundColor: pieSlices.map((_, i) => MIX_COLORS[i % MIX_COLORS.length])
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: (window.matchMedia && window.matchMedia('(min-width: 900px)').matches) ? 'right' : 'bottom',
            labels: { boxWidth: 10, padding: 12 }
          }
        }
      }
    }));
  }
  if(!chart.labels.length) return;
  const dayDates = (chart.grain === 'day') ? techDayChartDates(tf) : [];
  const dayTap = dayDates.length === chart.labels.length && dayDates.length > 0;
  const baseOpts = lineChartOptions();
  const lineOpts = Object.assign({}, baseOpts, {
    interaction: dayTap
      ? { mode: 'nearest', intersect: false, axis: 'x' }
      : (baseOpts.interaction || { mode: 'nearest', intersect: true }),
    onClick: dayTap
      ? function (evt, _els, ch) { onTechDayChartClick(ch || this, evt, name, dayDates, color); }
      : undefined
  });
  charts.push(new Chart(document.getElementById('p-pace'), {
    type: 'line',
    data: {
      labels: chart.labels,
      datasets: [{
        label: name,
        data: chart.data,
        borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.3, pointRadius: 4,
        pointHitRadius: dayTap ? 22 : 4,
        pointHoverRadius: 6,
        pointBorderWidth: 1,
        borderWidth: 2.5, spanGaps: true
      }]
    },
    options: lineOpts
  }));
};
