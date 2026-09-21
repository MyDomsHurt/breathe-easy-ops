/* Personal page (#/tech/{Name})
 * This-week strip first, then units/day and points/day for that person.
 * Last 8 earned weeks, weekly pace. Josh is not on the board.
 */
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
  const period = tf.weeks.length ? techWindowStats(name, tf.weeks) : emptyWindowStats();
  const series = paceSeries(name, lastEightWeekKeys());
  const unitsOn = isUnitsView();
  const stripTotal = unitsOn ? fmtUnits(period.units) : fmt(period.points, 1);
  const stripDay = unitsOn ? fmt(period.unitsDay, 2) : fmt(period.pointsDay, 2);
  const chartLabel = viewDayLabel();
  const chartData = unitsOn ? series.unitsDay : series.pointsDay;

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1><span class="tech-dot" style="background:${color};width:12px;height:12px;display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle"></span>${name}</h1>
      <p>${tf.label} · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range}</p>
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
          <div class="value">${fmt(period.returns)}</div>
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
