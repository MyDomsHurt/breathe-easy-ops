/* Personal page (#/tech/{Name})
 * Units, units/day on worked days, returns, days worked.
 * Chart + day/week list for the selected period. Josh is not on the board.
 */
function techDailyMap(name){
  const map = {};
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => { map[r.date] = r; });
  return map;
}
function techWorkedDayCount(name, start, end){
  return ((DATA.daily && DATA.daily[name]) || []).filter(r =>
    r.date >= start && r.date <= end && ((r.units || 0) || (r.returns || 0))
  ).length;
}
function techDayList(name, tf){
  const today = earnedCutoff();
  const map = techDailyMap(name);
  const weekLike = tf.id === 'this_week' || tf.id === 'last_week';
  const monthLike = (tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end;
  function dayRow(d){
    const r = map[d];
    const future = today && d > today;
    const booked = r && ((r.units || 0) || (r.returns || 0) || (r.points || 0));
    return {
      label: dayLabel(d),
      units: r ? (r.units || 0) : 0,
      returns: r ? (r.returns || 0) : 0,
      blank: !!(future && !booked)
    };
  }
  if(weekLike && tf.weeks && tf.weeks.length){
    return periodDayKeys(tf).map(dayRow);
  }
  if(monthLike){
    return daysInclusive(tf.start, tf.end).map(dayRow);
  }
  return (tf.weeks || []).map(w => {
    const row = (DATA.technicians[name].weeks || []).find(x => x.week === w);
    const future = today && addDaysIso(w, 6) > today && w > today;
    const units = row ? (row.totalUnits || 0) : 0;
    const returns = row ? (row.returns || 0) : 0;
    return {
      label: weekLabelFor(w),
      units: units,
      returns: returns,
      blank: !!(future && !units && !returns)
    };
  });
}

const MIX_TYPES = ['S','W','B','C','UC','TV','OU','SwG','EF','PAU'];
function techMixDates(tf){
  const weekLike = tf.id === 'this_week' || tf.id === 'last_week';
  const monthLike = (tf.id === 'this_month' || tf.id === 'last_month') && tf.start && tf.end;
  if(weekLike && tf.weeks && tf.weeks.length) return periodDayKeys(tf);
  if(monthLike) return daysInclusive(tf.start, tf.end);
  const dates = [];
  (tf.weeks || []).forEach(w => {
    for(let d = w; d <= addDaysIso(w, 6); d = addDaysIso(d, 1)) dates.push(d);
  });
  return dates;
}
function techMix(name, tf){
  const dates = {};
  techMixDates(tf).forEach(d => { dates[d] = true; });
  const mix = {};
  MIX_TYPES.forEach(k => { mix[k] = 0; });
  ((DATA.daily && DATA.daily[name]) || []).forEach(r => {
    if(!dates[r.date]) return;
    MIX_TYPES.forEach(k => { mix[k] += Number(r[k] || 0); });
  });
  return mix;
}

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
  const dayList = techDayList(name, tf);
  let winStart = null;
  let winEnd = null;
  if(tf.start && tf.end){
    winStart = tf.start;
    winEnd = tf.end;
  } else if(tf.weeks && tf.weeks.length){
    winStart = tf.weeks[0];
    winEnd = addDaysIso(tf.weeks[tf.weeks.length - 1], 6);
  }
  const daysWorked = (winStart && winEnd)
    ? techWorkedDayCount(name, winStart, winEnd)
    : (period.days || 0);
  const unitsDay = daysWorked ? Math.round((period.units / daysWorked) * 100) / 100 : 0;
  const mix = techMix(name, tf);
  const mixChips = MIX_TYPES.filter(k => mix[k] > 0).map(k =>
    `<div class="unit-chip"><div class="ut">${k}</div><div class="uv">${fmtUnits(mix[k])}</div></div>`
  ).join('');
  const mixHtml = mixChips
    ? `<div class="unit-chips" style="margin:0 0 20px">${mixChips}</div>`
    : '';
  const tableRows = dayList.map(r =>
    `<tr>
      <td>${r.label}</td>
      <td class="num">${r.blank ? '' : fmtUnits(r.units)}</td>
      <td class="num">${r.blank ? '' : fmt(r.returns)}</td>
    </tr>`
  ).join('');

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
          <div class="value">${fmt(unitsDay, 2)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Returns</div>
          <div class="value">${fmt(period.returns)}</div>
        </div>
        <div class="this-week-stat">
          <div class="label">Days worked</div>
          <div class="value">${fmt(daysWorked)}</div>
        </div>
      </div>
    </section>
    ${mixHtml}
    <div class="section">
      <div class="section-title">Units</div>
      <div class="chart-grid">
        <div class="chart-card full">
          <h3>Units</h3>
          <p class="chart-explain">${name} only · ${chart.explain}.</p>
          <div class="chart-wrap"><canvas id="p-pace"></canvas></div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Days</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th class="num">Units</th><th class="num">Returns</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
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
