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
  return { points: 0, pointsDay: 0, units: 0, unitsDay: 0, returns: 0, days: 0, weeks: [], byTech: {} };
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
  const chartSeries = names.map(n => ({ name: n, chart: unitsChartFor(n, tf) }));
  const chartLabels = chartSeries[0] ? chartSeries[0].chart.labels : [];
  const grain = chartSeries[0] ? chartSeries[0].chart.explain : 'Units';
  const cardHtml = cards.map(s => `
    <div class="kpi-card">
      <div class="label">${s.name}</div>
      <div class="value">${fmtUnits(s.units)}</div>
      <div class="kpi-explain">Units</div>
      <div class="kpi-explain">Units / day ${fmt(s.unitsDay, 2)}</div>
      <div class="kpi-explain">Returns ${fmt(s.returns)}</div>
    </div>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>${tf.label} · Updated ${DATA.generated}</p>
    </div>
    <p class="this-week-range">${copy.kicker} · ${copy.range}</p>
    <div class="kpi-row">${cardHtml}</div>
    <div class="section">
      <div class="section-title">Units</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Units</h3>
          <p class="chart-explain">One line per lead · ${grain}.</p>
          <div class="chart-wrap"><canvas id="t-pace"></canvas></div>
        </div>
      </div>
    </div>`;

  if(!chartLabels.length) return;
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
};
