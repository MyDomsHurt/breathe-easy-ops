/* Competition (#/compete)
 * This-week race first, then one year-to-date table.
 * Josh stays out via TECH_ORDER / techNames().
 */
function competeRowsHtml(sorted){
  const lead = sorted[0];
  return sorted.map((t, i) => {
    const gap = i === 0 ? null : (lead ? lead.pointsDay - t.pointsDay : 0);
    const gapHtml = gap == null
      ? '<span class="gap-lead">Lead</span>'
      : `<span class="gap-behind">-${fmt(gap, 2)}</span>`;
    return `<tr class="${i===0?'lead-row':''}">
      <td><span class="rank-num ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span></td>
      <td class="name"><span class="tech-dot" style="background:${TECH_COLORS[t.name]}"></span>${t.name}</td>
      <td class="num"><strong>${fmt(t.pointsDay, 2)}</strong></td>
      <td class="num">${fmt(t.points, 1)}</td>
      <td class="num hide-sm">${gapHtml}</td>
    </tr>`;
  }).join('');
}

window.renderCompetePage = function renderCompetePage(){
  destroyCharts();
  setNav('#/compete');
  const thisWeekKey = latestMondayWeek();
  const race = rankedTechs(thisWeekKey ? [thisWeekKey] : [], 'day');
  const ytd = rankedTechs(ytdWeekKeys(), 'day');

  document.getElementById('app').innerHTML = `
    <div class="page-header">
      <h1>Competition</h1>
      <p>This week’s race, then year-to-date · Updated ${DATA.generated}</p>
    </div>
    <section class="this-week" aria-label="This week race">
      <div class="this-week-kicker">This week</div>
      <p class="this-week-range">Monday week ${weekLabelFor(thisWeekKey)} · ${weekSpanLabel(thisWeekKey)} · ranked by pts/day</p>
      <div class="table-wrap race-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Technician</th>
            <th class="num">Pts/Day</th>
            <th class="num">Points</th>
            <th class="num hide-sm">Gap</th>
          </tr></thead>
          <tbody>${competeRowsHtml(race)}</tbody>
        </table>
      </div>
    </section>
    <div class="section">
      <div class="section-title">Year to date</div>
      <p class="explain">One ranking for 05 Jan through ${weekLabelFor(thisWeekKey)}. Pts/Day = points ÷ workdays. Gap is pts/day behind #1.</p>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Technician</th>
          <th class="num">Pts/Day</th>
          <th class="num">Points</th>
          <th class="num hide-sm">Days</th>
          <th class="num hide-sm">Gap</th>
        </tr></thead>
        <tbody>${ytd.map((t, i) => {
          const gap = i === 0 ? null : ytd[0].pointsDay - t.pointsDay;
          const gapHtml = gap == null
            ? '<span class="gap-lead">Lead</span>'
            : `<span class="gap-behind">-${fmt(gap, 2)}</span>`;
          return `<tr class="${i===0?'lead-row':''}">
            <td><span class="rank-num ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span></td>
            <td class="name"><span class="tech-dot" style="background:${TECH_COLORS[t.name]}"></span>${t.name}</td>
            <td class="num"><strong>${fmt(t.pointsDay, 2)}</strong></td>
            <td class="num">${fmt(t.points, 1)}</td>
            <td class="num hide-sm">${fmt(t.days)}</td>
            <td class="num hide-sm">${gapHtml}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <div class="section">
      <div class="section-title">Points system</div>
      <p class="explain">Each completed unit type has a fixed weight. <strong>R</strong> = team return visit — tracked as a count, currently <strong>0 points</strong>.</p>
      <div class="points-ref"><table>
        <thead><tr><th>Unit type</th><th class="num">Points each</th><th>Note</th></tr></thead>
        <tbody>${(DATA.pointsTable||[]).map(p =>
          `<tr><td class="name">${p.type}</td><td class="num"><strong>${fmt(p.points,2)}</strong></td><td style="color:var(--mute)">${p.note||''}</td></tr>`
        ).join('')}</tbody>
      </table></div>
    </div>`;
};
