/* Personal page (#/tech/{Name})
 * This-week strip first, then year-to-date, then the existing table and charts.
 * Josh is not in TECH_ORDER / DATA.technicians — unknown names go back to Full Team.
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
  const weekKeys = tf.weeks;
  const s = techWindowStats(name, weekKeys);
  const color = TECH_COLORS[name] || '#1481c3';
  const retW = DATA.returnPointsWeight != null ? DATA.returnPointsWeight : 0;
  const labels = weekKeys.map(weekLabelFor);
  const rows = s.weeks.slice().sort((a, b) => a.week.localeCompare(b.week));

  const thisWeekKey = latestMondayWeek();
  const thisWeek = thisWeekKey ? techWindowStats(name, [thisWeekKey]) : {
    points: 0, pointsDay: 0, units: 0, returns: 0, days: 0
  };
  const ytd = techWindowStats(name, ytdWeekKeys());

  const ut = {};
  for(const r of rows){
    for(const u of ['S','W','B','C','UC','TV','OU','SwG','EF','PAU']){
      ut[u] = (ut[u] || 0) + (r[u] || 0);
    }
    ut['R'] = (ut['R'] || 0) + (r.returns || 0);
  }
  const unitOrder = ['S','W','B','C','UC','SwG','TV','OU','EF','PAU','R'];
  const weightMap = {};
  (DATA.pointsTable || []).forEach(p => { weightMap[p.type] = p.points; });

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1><span class="tech-dot" style="background:${color};width:12px;height:12px;display:inline-block;border-radius:50%;margin-right:8px;vertical-align:middle"></span>${name}</h1>
      <p>Personal performance · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday week ${weekLabelFor(thisWeekKey)} · ${weekSpanLabel(thisWeekKey)}</p>
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
    <div class="section">
      <div class="section-title">Year to date</div>
      <div class="kpi-row">
        <div class="kpi-card"><div class="label">Points</div><div class="value">${fmt(ytd.points,1)}</div><div class="kpi-explain">Weighted units from 05 Jan through ${weekLabelFor(thisWeekKey)}.</div></div>
        <div class="kpi-card"><div class="label">Pts / Day</div><div class="value">${fmt(ytd.pointsDay,2)}</div><div class="kpi-explain">YTD points ÷ workdays (${fmt(ytd.days)} days).</div></div>
        <div class="kpi-card"><div class="label">Units</div><div class="value">${fmtUnits(ytd.units)}</div><div class="kpi-explain">Unweighted units year to date.</div></div>
        <div class="kpi-card"><div class="label">Team returns</div><div class="value">${fmt(ytd.returns)}</div><div class="kpi-explain">Tracked · ${fmt(retW,1)} pts each.</div></div>
      </div>
    </div>
    ${controlsHtml('tech')}
    <div class="kpi-row">
      <div class="kpi-card"><div class="label">Points</div><div class="value">${fmt(s.points,1)}</div><div class="kpi-explain">Weighted units in ${tf.label}.</div></div>
      <div class="kpi-card"><div class="label">Pts / Day</div><div class="value">${fmt(s.pointsDay,2)}</div><div class="kpi-explain">Points ÷ workdays (${fmt(s.days)} days).</div></div>
      <div class="kpi-card"><div class="label">Units</div><div class="value">${fmtUnits(s.units)}</div><div class="kpi-explain">Units in the period.</div></div>
      <div class="kpi-card"><div class="label">Team returns</div><div class="value">${fmt(s.returns)}</div><div class="kpi-explain">Tracked · ${fmt(retW,1)} pts each.</div></div>
    </div>
    <div class="section">
      <div class="section-title">Unit mix · ${tf.label}</div>
      <div class="unit-chips">${unitOrder.filter(u => (ut[u]||0) > 0).map(u =>
        `<div class="unit-chip"><div class="ut">${u} · ${fmt(weightMap[u]!=null?weightMap[u]:0,2)} pts</div><div class="uv">${fmtUnits(ut[u])}</div></div>`
      ).join('')}</div>
    </div>
    <div class="section">
      <div class="section-title">Week by week · ${tf.label}</div>
      <div class="table-wrap"><table class="wide">
        <thead><tr><th>Week</th><th class="num">Points</th><th class="num">Pts/Day</th><th class="num">Units</th><th class="num hide-sm">Days</th><th class="num">Returns</th></tr></thead>
        <tbody>
        ${rows.map(w => `<tr>
          <td>${w.weekLabel || weekLabelFor(w.week)}</td>
          <td class="num"><strong>${fmt(w.points,1)}</strong></td>
          <td class="num">${fmt(w.pointsDay,2)}</td>
          <td class="num">${fmtUnits(w.totalUnits)}</td>
          <td class="num hide-sm">${fmt(w.workday)}</td>
          <td class="num">${fmt(w.returns||0)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td>Period total</td>
          <td class="num">${fmt(s.points,1)}</td>
          <td class="num">${fmt(s.pointsDay,2)}</td>
          <td class="num">${fmtUnits(s.units)}</td>
          <td class="num hide-sm">${fmt(s.days)}</td>
          <td class="num">${fmt(s.returns)}</td>
        </tr>
        </tbody>
      </table></div>
    </div>
    <div class="section">
      <div class="section-title">Charts · ${tf.label}</div>
      <div class="chart-grid">
        <div class="chart-card">
          <h3>Your Pts/Day</h3>
          <p class="chart-explain">Weekly pace vs your period average (${fmt(s.pointsDay,2)}).</p>
          <div class="chart-wrap"><canvas id="p1"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Your points each week</h3>
          <p class="chart-explain">Weighted points in the selected period.</p>
          <div class="chart-wrap"><canvas id="p2"></canvas></div>
        </div>
        <div class="chart-card full">
          <h3>Your team returns</h3>
          <p class="chart-explain">Return visit count per week (0 points).</p>
          <div class="chart-wrap"><canvas id="p3"></canvas></div>
        </div>
      </div>
    </div>`;

  bindControls('tech');

  const avg = s.pointsDay;
  charts.push(new Chart(document.getElementById('p1'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Your Pts/Day',
          data: rows.map(w => w.pointsDay),
          borderColor: color, backgroundColor: color + '22',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5
        },
        {
          label: 'Period avg ' + fmt(avg, 2),
          data: labels.map(() => avg),
          borderColor: '#8aa0b8', borderDash: [6, 4],
          pointRadius: 0, borderWidth: 1.5, fill: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(14,77,145,0.08)' }, beginAtZero: true }
      }
    }
  }));
  charts.push(new Chart(document.getElementById('p2'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: rows.map(w => w.points), backgroundColor: color, borderRadius: 6, barThickness: 28 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(14,77,145,0.08)' }, beginAtZero: true }
      }
    }
  }));
  charts.push(new Chart(document.getElementById('p3'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: rows.map(w => w.returns || 0), backgroundColor: '#69C7EE', borderRadius: 6, barThickness: 28 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(14,77,145,0.08)' }, beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  }));
};
