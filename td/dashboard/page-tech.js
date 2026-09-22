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
  const period = periodTechStats(name, tf);
  const chart = unitsChartFor(name, tf);

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
          <div class="label">Units</div>
          <div class="value">${fmtUnits(period.units)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Units / day</div>
          <div class="value">${fmt(period.unitsDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(period.returns)}</div>
        </div>
      </div>
    </section>
    <div class="section">
      <div class="section-title">Units</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Units</h3>
          <p class="chart-explain">${name} only · ${chart.explain}.</p>
          <div class="chart-wrap"><canvas id="p-pace"></canvas></div>
        </div>
      </div>
    </div>`;

  if(!chart.labels.length) return;
  charts.push(new Chart(document.getElementById('p-pace'), {
    type: 'line',
    data: {
      labels: chart.labels,
      datasets: [{
        label: name,
        data: chart.data,
        borderColor: color, backgroundColor: color + '22',
        fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5, spanGaps: true
      }]
    },
    options: lineChartOptions()
  }));
};
