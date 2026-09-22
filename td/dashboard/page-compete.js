/* Standings (#/standings)
 * This-week race first, then crew line charts, then a YTD table.
 * Josh stays out via TECH_ORDER / techNames().
 */
function competeRowsHtml(sorted, extraDays){
  const lead = sorted[0];
  return sorted.map((t, i) => {
    const gap = i === 0 ? null : (lead ? (metricDay(lead) || 0) - (metricDay(t) || 0) : 0);
    const gapHtml = gap == null
      ? '<span class="gap-lead">Lead</span>'
      : `<span class="gap-behind">-${fmt(gap, 2)}</span>`;
    const daysCell = extraDays
      ? `<td class="num hide-sm">${fmt(t.days)}</td>`
      : '';
    const total = isUnitsView() ? fmtUnits(metricTotal(t)) : fmt(metricTotal(t), 1);
    return `<tr class="${i===0?'lead-row':''}">
      <td><span class="rank-num ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span></td>
      <td class="name"><span class="tech-dot" style="background:${TECH_COLORS[t.name]}"></span>${t.name}</td>
      <td class="num"><strong>${fmt(metricDay(t), 2)}</strong></td>
      <td class="num">${total}</td>
      ${daysCell}
      <td class="num hide-sm">${gapHtml}</td>
    </tr>`;
  }).join('');
}

window.renderCompetePage = function renderCompetePage(){
  destroyCharts();
  setNav('#/standings');
  const names = techNames();
  const tf = resolveTimeframe(TIMEFRAME);
  const copy = periodStripCopy(tf);
  const race = names.map(n => periodTechStats(n, tf)).sort((a, b) =>
    (metricDay(b) - metricDay(a)) || (metricTotal(b) - metricTotal(a)) || (a.name < b.name ? -1 : 1)
  );
  const ytd = rankedTechs(ytdWeekKeys(), isUnitsView() ? 'unitsDay' : 'day');
  const chartSeries = names.map(n => ({ name: n, chart: outputChartFor(n, tf) }));
  const chartLabels = chartSeries[0] ? chartSeries[0].chart.labels : [];
  const grain = chartSeries[0] ? chartSeries[0].chart.explain : metricLabel();
  const showYtd = TIMEFRAME !== 'ytd';
  const ytdHtml = showYtd ? `
    <div class="section">
      <div class="section-title">Year to date</div>
      <p class="explain">1 Jan through ${DATA.generated}. Gap is ${metricDayLabel().toLowerCase()} behind #1.</p>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Technician</th>
          <th class="num">${metricDayLabel()}</th>
          <th class="num">${metricLabel()}</th>
          <th class="num hide-sm">Days</th>
          <th class="num hide-sm">Gap</th>
        </tr></thead>
        <tbody>${competeRowsHtml(ytd, true)}</tbody>
      </table></div>
    </div>` : '';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Standings</h1>
      <p>${tf.label} · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range} · ranked by ${metricDayLabel().toLowerCase()}</p>
      <div class="table-wrap race-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Technician</th>
            <th class="num">${metricDayLabel()}</th>
            <th class="num">${metricLabel()}</th>
            <th class="num hide-sm">Gap</th>
          </tr></thead>
          <tbody>${competeRowsHtml(race, false)}</tbody>
        </table>
      </div>
    </section>
    <div class="section">
      <div class="section-title">${metricLabel()}</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>${metricLabel()}</h3>
          <p class="chart-explain">One line per technician · ${grain}.</p>
          <div class="chart-wrap"><canvas id="s-pace"></canvas></div>
        </div>
      </div>
    </div>
    ${ytdHtml}`;

  if(!chartLabels.length) return;
  charts.push(new Chart(document.getElementById('s-pace'), {
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
