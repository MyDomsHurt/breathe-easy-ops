/* Standings (#/standings)
 * This-week race first, then crew line charts, then a YTD table.
 * Josh stays out via TECH_ORDER / techNames().
 */
function competeRowsHtml(sorted, extraDays){
  const lead = sorted[0];
  const dayKey = viewDayKey();
  const unitsOn = isUnitsView();
  return sorted.map((t, i) => {
    const gap = i === 0 ? null : (lead ? (lead[dayKey] || 0) - (t[dayKey] || 0) : 0);
    const gapHtml = gap == null
      ? '<span class="gap-lead">Lead</span>'
      : `<span class="gap-behind">-${fmt(gap, 2)}</span>`;
    const daysCell = extraDays
      ? `<td class="num hide-sm">${fmt(t.days)}</td>`
      : '';
    const total = unitsOn ? fmt(t.units) : fmt(t.points, 1);
    return `<tr class="${i===0?'lead-row':''}">
      <td><span class="rank-num ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span></td>
      <td class="name"><span class="tech-dot" style="background:${TECH_COLORS[t.name]}"></span>${t.name}</td>
      <td class="num"><strong>${fmt(t[dayKey], 2)}</strong></td>
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
  const rankMetric = isUnitsView() ? 'unitsDay' : 'day';
  const race = rankedTechs(tf.weeks, rankMetric);
  const ytd = rankedTechs(ytdWeekKeys(), rankMetric);
  const hideTrend = TIMEFRAME === 'this_week' && thisWeekEarnedDayCount() < 2;
  const eight = lastEightWeekKeys();
  const dayLab = viewDayLabel();
  const totLab = viewTotalLabel();
  const trendHtml = hideTrend ? '' : `
    <div class="section">
      <div class="section-title">Last 8 weeks</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>${dayLab}</h3>
          <p class="chart-explain">One labeled line per technician · weekly pace.</p>
          <div class="chart-wrap"><canvas id="s-pace"></canvas></div>
        </div>
      </div>
    </div>`;
  const ytdExplain = isUnitsView()
    ? `1 Jan through ${DATA.generated}. Gap is units/day behind #1.`
    : `1 Jan through ${DATA.generated}. Gap is pts/day behind #1.`;
  const showYtd = TIMEFRAME !== 'ytd';
  const ytdHtml = showYtd ? `
    <div class="section">
      <div class="section-title">Year to date</div>
      <p class="explain">${ytdExplain}</p>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Technician</th>
          <th class="num">${dayLab}</th>
          <th class="num">${totLab}</th>
          <th class="num hide-sm">Days</th>
          <th class="num hide-sm">Gap</th>
        </tr></thead>
        <tbody>${competeRowsHtml(ytd, true)}</tbody>
      </table></div>
    </div>` : '';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Standings</h1>
      <p>${copy.kicker} · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range} · ranked by ${dayLab.toLowerCase()}</p>
      <div class="table-wrap race-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Technician</th>
            <th class="num">${dayLab}</th>
            <th class="num">${totLab}</th>
            <th class="num hide-sm">Gap</th>
          </tr></thead>
          <tbody>${competeRowsHtml(race, false)}</tbody>
        </table>
      </div>
    </section>
    ${trendHtml}
    ${ytdHtml}`;

  if(hideTrend) return;
  const series = names.map(n => ({ name: n, pace: paceSeries(n, eight) }));
  const labels = series[0] ? series[0].pace.labels : [];
  const dataKey = isUnitsView() ? 'unitsDay' : 'pointsDay';
  charts.push(new Chart(document.getElementById('s-pace'), {
    type: 'line',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.name,
        data: s.pace[dataKey],
        borderColor: TECH_COLORS[s.name],
        backgroundColor: TECH_COLORS[s.name] + '22',
        tension: 0.3, pointRadius: 3, borderWidth: 2, spanGaps: true, fill: false
      }))
    },
    options: lineChartOptions()
  }));
};
