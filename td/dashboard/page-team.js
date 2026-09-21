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

window.renderTeamPage = function renderTeamPage(){
  destroyCharts();
  setNav('#/team');
  const retW = DATA.returnPointsWeight != null ? DATA.returnPointsWeight : 0;
  const thisWeekKey = latestMondayWeek();
  const thisWeek = thisWeekKey ? teamWindowStats([thisWeekKey]) : {
    points: 0, pointsDay: 0, units: 0, returns: 0, days: 0
  };
  const ytd = teamWindowStats(ytdWeekKeys());
  const thisWeekRange = thisWeekKey ? weekSpanLabel(thisWeekKey) : '—';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>This week through today, then year to date · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday through today · ${thisWeekRange}</p>
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
        <div class="kpi-card"><div class="label">Team points</div><div class="value">${fmt(ytd.points,1)}</div><div class="kpi-explain">1 Jan through ${DATA.generated}.</div></div>
        <div class="kpi-card"><div class="label">Pts / Day</div><div class="value">${fmt(ytd.pointsDay,2)}</div><div class="kpi-explain">YTD points ÷ YTD workdays (${fmt(ytd.days)} days).</div></div>
        <div class="kpi-card"><div class="label">Units</div><div class="value">${fmt(ytd.units)}</div><div class="kpi-explain">Unweighted units year to date.</div></div>
        <div class="kpi-card"><div class="label">Team returns</div><div class="value">${fmt(ytd.returns)}</div><div class="kpi-explain">Return visits tracked · ${fmt(retW,1)} pts each.</div></div>
      </div>
    </div>`;
};
