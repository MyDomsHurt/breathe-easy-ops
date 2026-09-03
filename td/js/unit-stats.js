/* Unit counting rules:
 * - Attribute units ONLY to team_lead (never helpers)
 * - Never count BEP (free add-on)
 * - Built-ins = B, Cassette = C, Split = S, Window = W
 */
(function () {
  const UNIT_TYPES = ['S', 'W', 'B', 'C', 'UC', 'FS', 'SwG', 'OU'];

  function parseCountableUnits(acs) {
    if (!acs) return {};
    const counts = {};
    const re = /(\d+)\s*([A-Za-z]+)/g;
    let m;
    while ((m = re.exec(String(acs))) !== null) {
      let t = m[2].toUpperCase();
      if (t === 'BEP') continue;
      if (t === 'SWG' || t === 'SW') t = 'SwG';
      if (UNIT_TYPES.indexOf(t) === -1 && t !== 'SwG') continue;
      counts[t] = (counts[t] || 0) + parseInt(m[1], 10);
    }
    return counts;
  }

  function jobUnits(j) {
    if (j.units && typeof j.units === 'object') {
      const out = {};
      Object.keys(j.units).forEach(function (k) {
        if (k === 'BEP') return;
        if (UNIT_TYPES.indexOf(k) !== -1 || k === 'SwG') out[k] = j.units[k];
      });
      return out;
    }
    return parseCountableUnits(j.acs);
  }

  function formatUnitsShort(units) {
    return UNIT_TYPES.map(function (t) {
      return units[t] ? units[t] + t : null;
    }).filter(Boolean).join(' ') || '—';
  }

  window.__beUpdateStatsPanelOverride = function () {
    if (typeof TEAMS === 'undefined' || typeof filtered === 'undefined') return;
    const byTeam = {};
    TEAMS.forEach(function (t) {
      byTeam[t] = { jobs: 0, returns: 0, amount: 0, units: {} };
    });
    filtered.forEach(function (j) {
      const lead = j.team_lead;
      if (!byTeam[lead]) return;
      byTeam[lead].jobs++;
      if (j.is_return) byTeam[lead].returns++;
      byTeam[lead].amount += j.amount || 0;
      const u = jobUnits(j);
      Object.keys(u).forEach(function (t) {
        byTeam[lead].units[t] = (byTeam[lead].units[t] || 0) + u[t];
      });
    });
    const panel = document.getElementById('statsPanel');
    if (!panel) return;
    panel.innerHTML = TEAMS.map(function (t) {
      const s = byTeam[t];
      if (s.jobs === 0) return '';
      const right = s.jobs + ' job' + (s.jobs !== 1 ? 's' : '');
      return (
        '<div class="py-1 border-b border-slate-100 last:border-0">' +
        '<div class="flex justify-between items-center"><span class="font-medium">' + t + '</span>' +
        '<span class="text-slate-500">' + right + '</span></div>' +
        '<div class="text-[11px] text-slate-400 mt-0.5">' + formatUnitsShort(s.units) + '</div>' +
        '</div>'
      );
    }).filter(Boolean).join('') || '<p class="text-slate-400">No data</p>';
  };

  function install() {
    if (typeof updateStatsPanel === 'function') {
      window.updateStatsPanel = function () {
        window.__beUpdateStatsPanelOverride();
      };
      try { window.updateStatsPanel(); } catch (e) {}
    } else {
      setTimeout(install, 50);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
