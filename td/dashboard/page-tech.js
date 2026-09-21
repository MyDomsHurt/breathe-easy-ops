/* Personal page (#/tech/{Name})
 * This-week strip first, then units/day and points/day for that person.
 * Last 8 earned weeks, weekly pace. Josh is not on the board.
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
  const color = TECH_COLORS[name] || '#1481c3';
  const thisWeekKey = latestMondayWeek();
  const thisWeek = thisWeekKey ? techWindowStats(name, [thisWeekKey]) : {
    points: 0, pointsDay: 0, units: 0, returns: 0, days: 0
  };
  const series = paceSeries(name, lastEightWeekKeys());
  const unitsOn = isUnitsView();
  const stripTotal = unitsOn ? fmtUnits(thisWeek.units) : fmt(thisWeek.points, 1);
  const stripDay = unitsOn ? fmt(thisWeek.unitsDay, 2) : fmt(thisWeek.pointsDay, 2);
  const chartLabel = viewDayLabel();
  const chartData = unitsOn ? series.unitsDay : series.pointsDay;

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
          <div class="label">${viewTotalLabel()}</div>
          <div class="value">${stripTotal}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">${viewDayLabel()}</div>
          <div class="value">${stripDay}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(thisWeek.returns)}</div>
        </div>
      </div>
    </section>
    <div class="section">
      <div class="section-title">Last 8 weeks</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>${chartLabel}</h3>
          <p class="chart-explain">${name} only · weekly pace, last 8 earned weeks.</p>
          <div class="chart-wrap"><canvas id="p-pace"></canvas></div>
        </div>
      </div>
    </div>`;

  charts.push(new Chart(document.getElementById('p-pace'), {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: chartLabel,
        data: chartData,
        borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5, spanGaps: true
      }]
    },
    options: lineChartOptions()
  }));
};
