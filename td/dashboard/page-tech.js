/* Personal page (#/tech/{Name})
 * This-week strip first, then units/day and points/day for that person.
 * Daily on this week, weekly on longer periods. Josh is not on the board.
 */
function fmtUnits(n){
  if(n == null || isNaN(n)) return '\u2014';
  const x = Number(n);
  const d = Math.round(Math.abs(x) * 10) % 10 === 0 ? 0 : 1;
  return fmt(x, d);
}

window.renderTechPage = function renderTechPage(name){
  destroyCharts();
  if(!DATA.technicians[name] || techNames().indexOf(name) === -1){
    location.hash = '#/team';
    return;
  }
  setNav('#/tech/' + name);
  const tf = resolveTimeframe(TIMEFRAME);
  const color = TECH_COLORS[name] || '#1481c3';
  const thisWeekKey = latestMondayWeek();
  const thisWeek = thisWeekKey ? techWindowStats(name, [thisWeekKey]) : {
    points: 0, pointsDay: 0, units: 0, returns: 0, days: 0
  };
  const series = paceSeries(name, tf.weeks);
  const grain = series.grain === 'day' ? 'each day this week' : 'each week in ' + tf.label;

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1><span class="tech-dot" style="background:${color};width:12px;height:12px;display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle"></span>${name}</h1>
      <p>This week through today · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday through today · ${weekSpanLabel(thisWeekKey)}</p>
      <div class="this-week-stats">
        <div class="this-week-stat">
          <div class="label">Points</div>
          <div class="value">${fmt(thisWeek.points, 1)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Pts / Day</div>
          <div class="value">${fmt(thisWeek.pointsDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Units</div>
          <div class="value">${fmtUnits(thisWeek.units)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(thisWeek.returns)}</div>
        </div>
      </div>
    </section>
    ${controlsHtml('tech')}
    <div class="section">
      <div class="section-title">Pace · ${tf.label}</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Units / day</h3>
          <p class="chart-explain">${name} only · ${grain}.</p>
          <div class="chart-wrap"><canvas id="p-units"></canvas></div>
        </div>
        <div class="chart-card full">
          <h3>Points / day</h3>
          <p class="chart-explain">${name} only · ${grain}.</p>
          <div class="chart-wrap"><canvas id="p-points"></canvas></div>
        </div>
      </div>
    </div>`;

  bindControls('tech');

  charts.push(new Chart(document.getElementById('p-units'), {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'Units / day',
        data: series.unitsDay,
        borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5, spanGaps: true
      }]
    },
    options: Object.assign({}, lineChartOptions(), {
      plugins: { legend: { display: false } }
    })
  }));
  charts.push(new Chart(document.getElementById('p-points'), {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'Points / day',
        data: series.pointsDay,
        borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5, spanGaps: true
      }]
    },
    options: Object.assign({}, lineChartOptions(), {
      plugins: { legend: { display: false } }
    })
  }));
};
