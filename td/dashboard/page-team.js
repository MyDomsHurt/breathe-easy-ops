/* Full Team (#/team)
 * This-week strip first, then year-to-date, then period controls.
 * Josh stays out via TECH_ORDER / techNames().
 */
function dashboardCutoff(){
  if(DATA && DATA.generated) return DATA.generated;
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function latestMondayWeek(){
  const keys = (DATA.weeks || allWeekKeys()).slice().sort();
  if(!keys.length) return null;
  const cutoff = dashboardCutoff();
  const onOrBefore = keys.filter(k => k <= cutoff);
  const pool = onOrBefore.length ? onOrBefore : keys;
  return pool[pool.length - 1];
}

function ytdWeekKeys(){
  const keys = (DATA.weeks || allWeekKeys()).slice().sort();
  const cutoff = dashboardCutoff();
  return keys.filter(k => k <= cutoff);
}

function weekSpanLabel(monday){
  if(!monday) return '';
  const start = new Date(monday + 'T12:00:00');
  if(isNaN(start)) return weekLabelFor(monday);
  const cutoff = dashboardCutoff();
  const sunday = addDaysIso(monday, 6);
  const endIso = cutoff && cutoff < sunday ? cutoff : sunday;
  const end = new Date(endIso + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const left = start.getDate() + ' ' + months[start.getMonth()];
  const right = end.getDate() + ' ' + months[end.getMonth()];
  return left + ' – ' + right;
}

function emptyWindowStats(){
  return { points: 0, pointsDay: 0, units: 0, unitsDay: 0, returns: 0, days: 0, jobs: 0, jobsDay: 0, weeks: [], byTech: {} };
}

function periodStripCopy(tf){
  if(!tf) return { kicker: 'Period', range: 'No data in this period' };
  if(tf.start && tf.end){
    return { kicker: tf.label, range: calendarSpanLabel(tf.start, tf.end) };
  }
  if(!tf.weeks || !tf.weeks.length){
    return { kicker: tf.label || 'Period', range: 'No data in this period' };
  }
  return {
    kicker: tf.id === 'this_week' ? 'This week' : tf.label,
    range: periodRangeLabel(tf.weeks, tf.id, tf)
  };
}

window.renderTeamPage = function renderTeamPage(){
  destroyCharts();
  setNav('#/team');
  const tf = resolveTimeframe(TIMEFRAME);
  const copy = periodStripCopy(tf);
  const empty = emptyWindowStats();
  const names = TECH_ORDER.filter(n => techNames().indexOf(n) !== -1);
  const cards = names.map(n => periodTechStats(n, tf));
  const chartSeries = names.map(n => ({ name: n, chart: outputChartFor(n, tf) }));
  const chartLabels = chartSeries[0] ? chartSeries[0].chart.labels : [];
  const grain = chartSeries[0] ? chartSeries[0].chart.explain : metricLabel();
  const cardHtml = cards.map(s => `
    <div class="kpi-card">
      <div class="label">${s.name}</div>
      <div class="value">${isUnitsView() ? fmtUnits(metricTotal(s)) : fmt(metricTotal(s), 1)}</div>
      <div class="kpi-explain">${metricLabel()}</div>
      <div class="kpi-explain">${metricDayLabel()} ${fmt(metricDay(s), 2)}</div>
      <div class="kpi-explain">Returns ${fmt(s.returns)}</div>
      <div class="kpi-explain">Jobs ${fmt(s.jobs || 0)}</div>
      <div class="kpi-explain">Jobs / day ${fmt(s.jobsDay || 0, 2)}</div>
    </div>`).join('');
  const TYPE_KEYS = ['S','W','B','C','UC','TV','OU','SwG','EF','PAU'];
  const TYPE_W = { S:1, W:0.85, B:1.3, C:1.8, UC:1.5, TV:1.4, OU:1.4, SwG:1.3, EF:1, PAU:1 };
  const mixDates = {};
  periodMixDates(tf).forEach(d => { mixDates[d] = true; });
  function leadTypeCount(lead, type){
    let n = 0;
    ((DATA.daily && DATA.daily[lead]) || []).forEach(r => {
      if(mixDates[r.date]) n += Number(r[type] || 0);
    });
    return n;
  }
  const typePies = TYPE_KEYS.map(type => {
    const counts = names.map(n => ({ name: n, count: leadTypeCount(n, type) }));
    const crew = counts.reduce((s, c) => s + c.count, 0);
    return { type, crew, counts };
  }).filter(p => p.crew > 0);
  const pieGrid = typePies.length ? `
    <div class="section">
      <div class="section-title">Type mix</div>
      <div class="chart-grid">${typePies.map(p => `
        <div class="chart-card">
          <h3>${p.type} · ${fmtUnits(p.crew)}</h3>
          <div class="chart-wrap team-type-pie-wrap"><canvas id="t-mix-${p.type}"></canvas></div>
        </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>${tf.label} · Updated ${DATA.generated}</p>
    </div>
    <p class="this-week-range">${copy.kicker} · ${copy.range}</p>
    <div class="kpi-row">${cardHtml}</div>
    <div class="section">
      <div class="section-title">${metricLabel()}</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>${metricLabel()}</h3>
          <p class="chart-explain">One line per lead · ${grain}.</p>
          <div class="chart-wrap"><canvas id="t-pace"></canvas></div>
        </div>
      </div>
    </div>
    ${pieGrid}`;

  if(chartLabels.length){
  charts.push(new Chart(document.getElementById('t-pace'), {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: chartSeries.map(s => ({
        label: s.name,
        data: s.chart.data,
        borderColor: TECH_COLORS[s.name],
        backgroundColor: TECH_COLORS[s.name] + '22',
        tension: 0.3, pointRadius: 3, borderWidth: 2, spanGaps: true, fill: false
      }))
    },
    options: lineChartOptions()
  }));
  }
  typePies.forEach(p => {
    const el = document.getElementById('t-mix-' + p.type);
    if(!el) return;
    const values = p.counts.map(c => isUnitsView() ? c.count : c.count * TYPE_W[p.type]);
    charts.push(new Chart(el, {
      type: 'pie',
      data: {
        labels: p.counts.map(c => c.name + ' · ' + fmtUnits(c.count)),
        datasets: [{
          data: values,
          backgroundColor: p.counts.map(c => TECH_COLORS[c.name] || '#8aa0b8')
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } } }
      }
    }));
  });
};
