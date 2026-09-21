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
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const left = start.getDate() + ' ' + months[start.getMonth()];
  const right = end.getDate() + ' ' + months[end.getMonth()];
  return left + ' – ' + right;
}

window.renderTeamPage = function renderTeamPage(){
  destroyCharts();
  setNav('#/team');
  const tf = resolveTimeframe(TIMEFRAME);
  const weekKeys = tf.weeks;
  const team = teamWindowStats(weekKeys);
  const labels = weekKeys.map(weekLabelFor);
  const names = techNames();
  const retW = DATA.returnPointsWeight != null ? DATA.returnPointsWeight : 0;

  const thisWeekKey = latestMondayWeek();
  const thisWeek = thisWeekKey ? teamWindowStats([thisWeekKey]) : {
    points: 0, pointsDay: 0, units: 0, returns: 0, days: 0
  };
  const ytd = teamWindowStats(ytdWeekKeys());

  const unitTotals = {};
  for(const n of names){
    for(const r of (team.byTech[n].weeks || [])){
      for(const u of ['S','W','B','C','UC','TV','OU','SwG','EF','PAU']){
        unitTotals[u] = (unitTotals[u] || 0) + (r[u] || 0);
      }
      unitTotals['R'] = (unitTotals['R'] || 0) + (r.returns || 0);
    }
  }
  const unitOrder = ['S','W','B','C','UC','SwG','TV','OU','EF','PAU','R'];
  const weightMap = {};
  (DATA.pointsTable || []).forEach(p => { weightMap[p.type] = p.points; });

  const teamByWeek = weekKeys.map(w => {
    let points = 0, days = 0;
    names.forEach(n => {
      const r = (DATA.technicians[n].weeks || []).find(x => x.week === w);
      if(r){ points += r.points || 0; days += r.workday || 0; }
    });
    return { points, days, pointsDay: days ? points / days : 0 };
  });

  const thisWeekRange = thisWeekKey
    ? weekSpanLabel(thisWeekKey)
    : '—';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>Crew totals · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday week ${weekLabelFor(thisWeekKey)} · ${thisWeekRange}</p>
      <div class="this-week-stats">
        <div class="this-week-stat">
          <div class="label">Crew points</div>
          <div class="value">${fmt(thisWeek.points, 1)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Pts / Day</div>
          <div class="value">${fmt(thisWeek.pointsDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Units</div>
          <div class="value">${fmt(thisWeek.units)}</div>
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
        <div class="kpi-card"><div class="label">Team points</div><div class="value">${fmt(ytd.points,1)}</div><div class="kpi-explain">Weighted points from 05 Jan through ${weekLabelFor(thisWeekKey)}.</div></div>
        <div class="kpi-card"><div class="label">Pts / Day</div><div class="value">${fmt(ytd.pointsDay,2)}</div><div class="kpi-explain">YTD points ÷ YTD workdays (${fmt(ytd.days)} days).</div></div>
        <div class="kpi-card"><div class="label">Units</div><div class="value">${fmt(ytd.units)}</div><div class="kpi-explain">Unweighted units year to date.</div></div>
        <div class="kpi-card"><div class="label">Team returns</div><div class="value">${fmt(ytd.returns)}</div><div class="kpi-explain">Return visits tracked · ${fmt(retW,1)} pts each.</div></div>
      </div>
    </div>
    ${controlsHtml('team')}
    <div class="kpi-row">
      <div class="kpi-card"><div class="label">Team points</div><div class="value">${fmt(team.points,1)}</div><div class="kpi-explain">Sum of weighted points in ${tf.label}.</div></div>
      <div class="kpi-card"><div class="label">Pts / Day</div><div class="value">${fmt(team.pointsDay,2)}</div><div class="kpi-explain">Team points ÷ team workdays (${fmt(team.days)} days).</div></div>
      <div class="kpi-card"><div class="label">Units</div><div class="value">${fmt(team.units)}</div><div class="kpi-explain">Unweighted job count in the period.</div></div>
      <div class="kpi-card"><div class="label">Team returns</div><div class="value">${fmt(team.returns)}</div><div class="kpi-explain">Return visits tracked · ${fmt(retW,1)} pts each.</div></div>
    </div>
    <div class="section">
      <div class="section-title">Unit mix · ${tf.label}</div>
      <div class="unit-chips">${unitOrder.filter(u => (unitTotals[u]||0) > 0).map(u =>
        `<div class="unit-chip"><div class="ut">${u} · ${fmt(weightMap[u]!=null?weightMap[u]:0,2)} pts</div><div class="uv">${fmt(unitTotals[u])}</div></div>`
      ).join('')}</div>
    </div>
    <div class="section">
      <div class="section-title">Weekly pace · ${tf.label}</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Team points by week</h3>
          <p class="chart-explain">Crew total each week in the selected period.</p>
          <div class="chart-wrap"><canvas id="t1"></canvas></div>
        </div>
        <div class="chart-card full">
          <h3>Team Pts/Day by week</h3>
          <p class="chart-explain">Crew pace (points ÷ workdays) each week.</p>
          <div class="chart-wrap"><canvas id="t2"></canvas></div>
        </div>
      </div>
    </div>`;

  bindControls('team');

  charts.push(new Chart(document.getElementById('t1'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: teamByWeek.map(x => x.points), backgroundColor: '#0d9488', borderRadius: 6, barThickness: 28 }]
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
  charts.push(new Chart(document.getElementById('t2'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Team Pts/Day',
        data: teamByWeek.map(x => Math.round(x.pointsDay * 100) / 100),
        borderColor: '#0d9488', backgroundColor: '#0d948822',
        fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5
      }]
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
};
