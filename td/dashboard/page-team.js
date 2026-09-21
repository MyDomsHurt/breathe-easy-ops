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
  if(!tf || !tf.weeks || !tf.weeks.length){
    return { kicker: (tf && tf.label) || 'Period', range: 'No data in this period' };
  }
  return {
    kicker: tf.id === 'this_week' ? 'This week' : tf.label,
    range: periodRangeLabel(tf.weeks, tf.id)
  };
}

window.renderTeamPage = function renderTeamPage(){
  destroyCharts();
  setNav('#/team');
  const retW = DATA.returnPointsWeight != null ? DATA.returnPointsWeight : 0;
  const tf = resolveTimeframe(TIMEFRAME);
  const copy = periodStripCopy(tf);
  const period = tf.weeks.length ? teamWindowStats(tf.weeks) : emptyWindowStats();
  const ytd = teamWindowStats(ytdWeekKeys());
  const names = techNames();
  const showYtd = TIMEFRAME !== 'ytd';
  const ytdHtml = showYtd ? `
    <div class="section">
      <div class="section-title">Year to date</div>
      <div class="kpi-row">
        <div class="kpi-card"><div class="label">Pts / day</div><div class="value">${fmt(ytd.pointsDay, 2)}</div><div class="kpi-explain">YTD points ÷ YTD workdays (${fmt(ytd.days)} days).</div></div>
        <div class="kpi-card"><div class="label">Points</div><div class="value">${fmt(ytd.points, 1)}</div><div class="kpi-explain">1 Jan through ${DATA.generated}.</div></div>
        <div class="kpi-card"><div class="label">Returns</div><div class="value">${fmt(ytd.returns)}</div><div class="kpi-explain">Return visits tracked · ${fmt(retW,1)} each.</div></div>
      </div>
    </div>` : '';
  const chartSeries = names.map(n => ({ name: n, chart: pointsChartFor(n, tf) }));
  const chartLabels = chartSeries[0] ? chartSeries[0].chart.labels : [];
  const grain = chartSeries[0] ? chartSeries[0].chart.explain : 'Points';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>${tf.label} · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range}</p>
      <div class="this-week-stats">
        <div class="this-week-stat">
          <div class="label">Pts / day</div>
          <div class="value">${fmt(period.pointsDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Points</div>
          <div class="value">${fmt(period.points, 1)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(period.returns)}</div>
        </div>
      </div>
    </section>
    <div class="section">
      <div class="section-title">Points</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Points</h3>
          <p class="chart-explain">One line per technician · ${grain}.</p>
          <div class="chart-wrap"><canvas id="t-pace"></canvas></div>
        </div>
      </div>
    </div>
    ${ytdHtml}`;

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
