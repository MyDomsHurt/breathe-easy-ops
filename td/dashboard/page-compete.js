/* Standings (#/standings)
 * This-week race first, then crew line charts, then a YTD table.
 * Josh stays out via TECH_ORDER / techNames().
 */
function competeRowsHtml(sorted, extraDays){
  const lead = sorted[0];
  return sorted.map((t, i) => {
    const gap = i === 0 ? null : (lead ? lead.pointsDay - t.pointsDay : 0);
    const gapHtml = gap == null
      ? '<span class="gap-lead">Lead</span>'
      : `<span class="gap-behind">-${fmt(gap, 2)}</span>`;
    const daysCell = extraDays
      ? `<td class="num hide-sm">${fmt(t.days)}</td>`
      : '';
    return `<tr class="${i===0?'lead-row':''}">
      <td><span class="rank-num ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span></td>
      <td class="name"><span class="tech-dot" style="background:${TECH_COLORS[t.name]}"></span>${t.name}</td>
      <td class="num"><strong>${fmt(t.pointsDay, 2)}</strong></td>
      <td class="num">${fmt(t.points, 1)}</td>
      ${daysCell}
      <td class="num hide-sm">${gapHtml}</td>
    </tr>`;
  }).join('');
}

window.renderCompetePage = function renderCompetePage(){
  destroyCharts();
  setNav('#/standings');
  const names = techNames();
  const thisWeekKey = latestMondayWeek();
  const race = rankedTechs(thisWeekKey ? [thisWeekKey] : [], 'day');
  const ytd = rankedTechs(ytdWeekKeys(), 'day');
  const hideTrend = TIMEFRAME === 'this_week' && thisWeekEarnedDayCount() < 2;
  const eight = lastEightWeekKeys();
  const trendHtml = hideTrend ? '' : `
    <div class="section">
      <div class="section-title">Last 8 weeks</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Points / day</h3>
          <p class="chart-explain">One labeled line per technician · weekly pace.</p>
          <div class="chart-wrap"><canvas id="s-points"></canvas></div>
        </div>
        <div class="chart-card full">
          <h3>Units / day</h3>
          <p class="chart-explain">One labeled line per technician · weekly pace.</p>
          <div class="chart-wrap"><canvas id="s-units"></canvas></div>
        </div>
      </div>
    </div>`;

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Standings</h1>
      <p>This week’s race, then last-8-week pace, then year to date · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week race">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday through today · ${weekSpanLabel(thisWeekKey)} · ranked by pts/day</p>
      <div class="table-wrap race-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Technician</th>
            <th class="num">Pts/Day</th>
            <th class="num">Points</th>
            <th class="num hide-sm">Gap</th>
          </tr></thead>
          <tbody>${competeRowsHtml(race, false)}</tbody>
        </table>
      </div>
    </section>
    ${controlsHtml('standings')}
    ${trendHtml}
    <div class="section">
      <div class="section-title">Year to date</div>
      <p class="explain">1 Jan through ${DATA.generated}. Pts/Day = points ÷ workdays. Gap is pts/day behind #1.</p>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Technician</th>
          <th class="num">Pts/Day</th>
          <th class="num">Points</th>
          <th class="num hide-sm">Days</th>
          <th class="num hide-sm">Gap</th>
        </tr></thead>
        <tbody>${competeRowsHtml(ytd, true)}</tbody>
      </table></div>
    </div>`;

  bindControls('standings');

  if(hideTrend) return;
  const series = names.map(n => ({ name: n, pace: paceSeries(n, eight) }));
  const labels = series[0] ? series[0].pace.labels : [];
  charts.push(new Chart(document.getElementById('s-points'), {
    type: 'line',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.name,
        data: s.pace.pointsDay,
        borderColor: TECH_COLORS[s.name],
        backgroundColor: TECH_COLORS[s.name] + '22',
        tension: 0.3, pointRadius: 3, borderWidth: 2, spanGaps: true, fill: false
      }))
    },
    options: lineChartOptions()
  }));
  charts.push(new Chart(document.getElementById('s-units'), {
    type: 'line',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.name,
        data: s.pace.unitsDay,
        borderColor: TECH_COLORS[s.name],
        backgroundColor: TECH_COLORS[s.name] + '22',
        tension: 0.3, pointRadius: 3, borderWidth: 2, spanGaps: true, fill: false
      }))
    },
    options: lineChartOptions()
  }));
};
