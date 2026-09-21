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

function emptyWindowStats(){
  return { points: 0, pointsDay: 0, units: 0, unitsDay: 0, returns: 0, days: 0, weeks: [], byTech: {} };
}

function periodStripCopy(tf){
  if(!tf || !tf.weeks || !tf.weeks.length){
    return { kicker: (tf && tf.label) || 'Period', range: 'No data in this period' };
  }
  if(tf.id === 'this_week'){
    return {
      kicker: 'This week',
      range: 'Monday through today · ' + weekSpanLabel(tf.weeks[0])
    };
  }
  const firstSpan = weekSpanLabel(tf.weeks[0]);
  const lastSpan = weekSpanLabel(tf.weeks[tf.weeks.length - 1]);
  const start = firstSpan.split(' – ')[0];
  const end = lastSpan.split(' – ').pop();
  return { kicker: tf.label, range: start + ' – ' + end };
}

window.renderTeamPage = function renderTeamPage(){
  destroyCharts();
  setNav('#/team');
  const retW = DATA.returnPointsWeight != null ? DATA.returnPointsWeight : 0;
  const tf = resolveTimeframe(TIMEFRAME);
  const copy = periodStripCopy(tf);
  const period = tf.weeks.length ? teamWindowStats(tf.weeks) : emptyWindowStats();
  const ytd = teamWindowStats(ytdWeekKeys());
  const unitsOn = isUnitsView();
  const stripTotal = unitsOn ? fmt(period.units) : fmt(period.points, 1);
  const stripDay = unitsOn ? fmt(period.unitsDay, 2) : fmt(period.pointsDay, 2);
  const ytdTotal = unitsOn ? fmt(ytd.units) : fmt(ytd.points, 1);
  const ytdDay = unitsOn ? fmt(ytd.unitsDay, 2) : fmt(ytd.pointsDay, 2);
  const showYtd = TIMEFRAME !== 'ytd';
  const ytdHtml = showYtd ? `
    <div class="section">
      <div class="section-title">Year to date</div>
      <div class="kpi-row">
        <div class="kpi-card"><div class="label">${viewTotalLabel()}</div><div class="value">${ytdTotal}</div><div class="kpi-explain">1 Jan through ${DATA.generated}.</div></div>
        <div class="kpi-card"><div class="label">${viewDayLabel()}</div><div class="value">${ytdDay}</div><div class="kpi-explain">YTD total ÷ YTD workdays (${fmt(ytd.days)} days).</div></div>
        <div class="kpi-card"><div class="label">Returns</div><div class="value">${fmt(ytd.returns)}</div><div class="kpi-explain">Return visits tracked · ${fmt(retW,1)} each.</div></div>
      </div>
    </div>` : '';

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Full Team</h1>
      <p>${copy.kicker} · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="${copy.kicker}">
      <div class="this-week-kicker">${copy.kicker}</div>
      <p class="this-week-range">${copy.range}</p>
      <div class="this-week-stats">
        <div class="this-week-stat">
          <div class="label">Crew ${viewTotalLabel()}</div>
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
    ${ytdHtml}`;
};
