/* Port of scripts/score_jobs.py — browser, no network.
 * Unsure ACS is skipped (not scored). No exceptions.json.
 */
(function (global) {
  const TECH_ORDER = ['Matthew', 'Tiago', 'Nick', 'Alun', 'Iggi'];
  const SKIP_LEADS = { josh: true };
  const UNIT_TYPES = ['S', 'W', 'B', 'C', 'UC', 'TV', 'OU', 'SwG', 'EF', 'PAU'];
  const WEIGHTS = {
    S: 1.0, W: 0.85, B: 1.3, C: 1.8, UC: 1.5,
    TV: 1.4, OU: 1.4, SwG: 1.3, EF: 1.0, PAU: 1.0
  };
  const ALIASES = {
    S: 'S', W: 'W', B: 'B', C: 'C', UC: 'UC', TV: 'TV', OU: 'OU',
    SWG: 'SwG', SW: 'SwG', EF: 'EF', PAU: 'PAU',
    OUTDOOR: 'OU', OUTDOORS: 'OU'
  };
  const TOKEN_RE = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
  const HAS_UNIT_RE = /\d+(?:\.\d+)?\s*(?:SwG|SWG|UC|TV|OU|PAU|EF|BEP|OUTDOORS?|[SWBC])\b/i;
  const PAREN_S_RE = /\(\s*S\s*\)/i;
  const NOISE_WORDS = {
    HALF:1, PRICE:1, CLEAN:1, CLEANED:1, CREDIT:1, REFUND:1, SAVE:1, SAVED:1,
    TOTAL:1, FULL:1, HOUR:1, HOURS:1, PM:1, AM:1, AS:1, AND:1, NEED:1, ACS:1,
    BEDROOM:1, BEDROOMS:1, TODAY:1, DID:1, ONLY:1, FILTER:1, FILTERS:1, FAN:1,
    FANS:1, COIL:1, KITCHEN:1, MASTER:1, LIVING:1, ROOM:1, ROOMS:1, CANNOT:1,
    CANT:1, ACCESS:1, FOR:1, THE:1, WITH:1, FROM:1, WILL:1, COME:1, BACK:1,
    AFTER:1, MR:1, WONG:1, FIXED:1, BROKEN:1, IS:1, IN:1, OF:1, TO:1, A:1,
    PLUS:1, ALL:1, THERE:1, TAKE:1, OUT:1, UNIT:1, UNITS:1, PER:1, OFF:1,
    RESCHEDULE:1, RESCHEDULED:1, RETURN:1, RETURNS:1, VISIT:1, FREE:1,
    INFLUENCER:1, COLLAB:1, DAY:1, FINISHED:1, G:1, F:1, OTHER:1, BOTH:1,
    DINING:1, HELPER:1, POOR:1, INSTALLATION:1, SEE:1, NICK:1, CHAT:1,
    SUPER:1, HEAVY:1, PPL:1, PEOPLE:1, KIDS:1, BABY:1, TOILET:1, SPACE:1,
    ENOUGH:1, NOT:1, NO:1, SO:1, DIDNT:1, DIDN:1, REPAIR:1, NEXT:1, BY:1,
    ON:1, AT:1, INTO:1, TWO:1, ACCOUNTS:1, DIVIDED:1, WINE:1, CHILLERS:1,
    CHILLER:1, THERMAL:1, AUG:1, MAY:1, JUN:1, JUL:1, SEP:1, OCT:1, NOV:1,
    DEC:1, JAN:1, FEB:1, MAR:1, APR:1, ADDRESSES:1, BRAND:1, NEW:1,
    GRILLS:1, GRILL:1, REACH:1, HE:1, DEDUCT:1, DEDCUT:1, SMASH:1
  };
  const EQUIPMENT_UNKNOWN = {
    VENTILATOR:1, VENTILATIOR:1, DEHUMIDIFIER:1, FS:1, PH:1, LEAK:1,
    LEAKING:1, INTERVIEW:1, FILMING:1, BATHROOM:1, TECHNICIAN:1
  };
  const LEAD_MAP = { matthew:'Matthew', tiago:'Tiago', nick:'Nick', alun:'Alun', iggi:'Iggi', josh:'Josh', jut:'Josh' };
  const POINTS_TABLE = [
    { type:'S', points:1, note:'Split — baseline' },
    { type:'W', points:0.85, note:'Window — lower density' },
    { type:'B', points:1.3, note:'Built-in' },
    { type:'C', points:1.8, note:'Cassette' },
    { type:'UC', points:1.5, note:'Under-ceiling' },
    { type:'TV', points:1.4, note:'TV-unit' },
    { type:'OU', points:1.4, note:'Outdoor unit' },
    { type:'SwG', points:1.3, note:'Split with grill' },
    { type:'EF', points:1, note:'Exhaust fan' },
    { type:'PAU', points:1, note:'PAU' },
    { type:'R', points:0, note:'Return visit — tracked, 0 points' }
  ];
  const RULES = {
    unitAttribution: 'team_lead only (helpers never credited)',
    BEP: 'never counted (free add-on)',
    halfClean: '0.5 unit of that type',
    halfPrice: 'not a half-clean — full unit',
    arrow: 'score the last segment that still has unit tokens (what was cleaned)',
    B: 'built-in',
    C: 'cassette'
  };
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function r1(n){ return Math.round((Number(n) + 1e-12) * 10) / 10; }
  function r2(n){ return Math.round((Number(n) + 1e-12) * 100) / 100; }
  function emptyUnits(){
    const o = {};
    UNIT_TYPES.forEach(k => { o[k] = 0; });
    return o;
  }
  function mondayOf(iso){
    const p = iso.split('-').map(Number);
    const dt = new Date(p[0], p[1] - 1, p[2]);
    const day = dt.getDay();
    const offset = day === 0 ? 6 : day - 1;
    dt.setDate(dt.getDate() - offset);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function weekLabel(mondayIso){
    const p = mondayIso.split('-').map(Number);
    return String(p[2]).padStart(2, '0') + ' ' + MONTHS[p[1] - 1];
  }
  function weekRange(startMonday, endMonday){
    const out = [];
    const p = startMonday.split('-').map(Number);
    let cur = new Date(p[0], p[1] - 1, p[2]);
    const e = endMonday.split('-').map(Number);
    const end = new Date(e[0], e[1] - 1, e[2]);
    while (cur <= end) {
      out.push(cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0'));
      cur.setDate(cur.getDate() + 7);
    }
    return out;
  }
  function hktToday(){
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }
  function isCrew(job){
    const source = String(job && job.source || '').trim();
    const jid = String(job && job.job_id || '').trim();
    return source === 'team-day-crew' || jid.indexOf('crew-') === 0;
  }
  function canonicalType(token){
    const t = String(token || '').toUpperCase();
    if (t === 'BEP') return 'BEP';
    return ALIASES[t] || null;
  }
  function addUnit(counts, typ, n){
    if (typ === 'BEP' || !typ) return;
    counts[typ] = (counts[typ] || 0) + Number(n);
  }
  function unitsDictCounts(job){
    const units = job && job.units;
    if (!units || typeof units !== 'object' || Array.isArray(units)) return null;
    const counts = emptyUnits();
    Object.keys(units).forEach(k => {
      const typ = canonicalType(k);
      if (typ && typ !== 'BEP') {
        const n = Number(units[k] || 0);
        if (!isNaN(n)) addUnit(counts, typ, n);
      }
    });
    return UNIT_TYPES.some(k => counts[k]) ? counts : null;
  }
  function isEmptyAcs(job){
    const acs = job && job.acs;
    return acs == null || String(acs).trim() === '';
  }
  function isReturn(job){
    if (job && job.is_return === true) return true;
    if (String(job && job.job_type || '').trim().toLowerCase() === 'return') return true;
    return isEmptyAcs(job) && unitsDictCounts(job) == null;
  }
  function jobDate(job){
    const raw = String(job && job.date || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }
  function hasUnitTokens(text){
    return HAS_UNIT_RE.test(text || '');
  }
  function lastUnitSegment(acs){
    let s = String(acs || '').replace(/\u00a0/g, ' ').trim();
    if (!s) return '';
    s = s.replace(/=\s*>/g, '=>');
    const parts = s.split(/\s*=>\s*|\s*>\s*/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return s;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (hasUnitTokens(parts[i]) || /half\s*clean/i.test(parts[i])) return parts[i];
    }
    return parts[parts.length - 1];
  }
  function stripHalfPrice(text){
    let s = String(text || '').replace(/\([^)]*half\s*price[^)]*\)/gi, ' ');
    s = s.replace(/half\s*prices?/gi, ' ');
    return s;
  }
  function impliedType(acs){
    const found = [];
    const re = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
    let m;
    while ((m = re.exec(acs || ''))) {
      const typ = canonicalType(m[2]);
      if (typ && typ !== 'BEP' && found.indexOf(typ) === -1) found.push(typ);
    }
    return found.length === 1 ? found[0] : null;
  }
  function halfToken(n, typ){
    return ' ' + (Number(n) * 0.5) + typ + ' ';
  }
  function replaceAll(s, re, fn){
    return s.replace(re, fn);
  }
  function replaceOnce(s, re, fn){
    let done = false;
    return s.replace(re, function () {
      if (done) return arguments[0];
      done = true;
      return fn.apply(null, arguments);
    });
  }
  function rewriteHalfClean(segment, original){
    let s = segment;
    s = s.replace(/\([^)]*need return[^)]*\)/gi, ' ');
    s = s.replace(/need return for \d+(?:\.\d+)?\s*[A-Za-z]+/gi, ' ');
    const uncleanRe = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*(?:cannot be cleaned|can'?t clean|no access|didn'?t clean|didnt clean)/i;
    let m = uncleanRe.exec(s);
    while (m) {
      const typ = canonicalType(m[2]);
      const n = parseFloat(m[1]);
      const prefix = s.slice(0, m.index);
      const suffix = s.slice(m.index + m[0].length);
      const precededByPlus = /\+\s*$/.test(prefix);
      let nextPrefix = prefix;
      if (typ && typ !== 'BEP' && !precededByPlus) {
        nextPrefix = replaceOnce(prefix, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/, function (all, num, tok) {
          if (canonicalType(tok) !== typ) return all;
          const left = parseFloat(num) - n;
          return left > 0 ? ' ' + left + typ + ' ' : ' ';
        });
      }
      s = nextPrefix + ' ' + suffix;
      uncleanRe.lastIndex = 0;
      m = uncleanRe.exec(s);
    }
    s = s.replace(/\(\s*,\s*/g, '(');

    function halfNType(all, num, tok){
      const typ = canonicalType(tok);
      if (!typ || typ === 'BEP') return all;
      return halfToken(num, typ);
    }
    function splitNM(all, num, tok, halfN){
      const typ = canonicalType(tok);
      if (!typ || typ === 'BEP') return all;
      const n = parseFloat(num);
      const hn = parseFloat(halfN);
      return ' ' + Math.max(n - hn, 0) + typ + ' ' + (hn * 0.5) + typ + ' ';
    }
    s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?[^)]*\)?/gi, splitNM);

    const restateRe = /\(\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+half\s*clean(?:ed)?[^)]*\)/gi;
    let restated = false;
    s = s.replace(restateRe, function (all, num, tok, offset, whole) {
      if (restated) return all;
      const typ = canonicalType(tok);
      if (!typ || typ === 'BEP') return all;
      const n = parseFloat(num);
      const before = whole.slice(0, offset);
      const after = whole.slice(offset + all.length);
      const pattern = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + typ + '\\b', 'i');
      if (pattern.test(before)) {
        restated = true;
        const dropped = replaceOnce(before, pattern, function (mm, cnt) {
          const left = parseFloat(cnt) - n;
          if (left <= 0) return halfToken(n, typ);
          return ' ' + left + typ + ' ' + halfToken(n, typ);
        });
        s = dropped + after;
        return all;
      }
      return halfToken(num, typ);
    });
    if (restated) {
      /* s already rebuilt */
    }

    s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*\(\s*half\s*(?:clean(?:ed)?)?[^)]*\)/gi, halfNType);
    s = replaceAll(s, /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\(?\s*half\s*clean(?:ed)?\b[^)]*\)?/gi, halfNType);

    m = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+can only half clean/i.exec(s);
    if (m) {
      const typ = canonicalType(m[2]);
      const n = parseFloat(m[1]);
      if (typ && typ !== 'BEP') {
        const prefix = s.slice(0, m.index);
        const suffix = s.slice(m.index + m[0].length);
        const pattern = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + typ + '\\b', 'i');
        if (pattern.test(prefix)) {
          s = replaceOnce(prefix, pattern, function (all, cnt) {
            const left = parseFloat(cnt) - n;
            if (left <= 0) return halfToken(n, typ);
            return ' ' + left + typ + ' ' + halfToken(n, typ);
          }) + suffix;
        } else {
          s = prefix + halfToken(n, typ) + suffix;
        }
      }
    }

    function fullPlusHalf(all, a, b){
      const typ = impliedType(original) || impliedType(segment);
      if (!typ) return all;
      return ' ' + (parseFloat(a) + parseFloat(b) * 0.5) + typ + ' ';
    }
    s = replaceAll(s, /(\d+(?:\.\d+)?)\s*full(?:\s*clean)?s?\s*\+?\s*(\d+(?:\.\d+)?)\s*half\s*clean/gi, fullPlusHalf);
    s = replaceAll(s, /(\d+(?:\.\d+)?)\s*full\s+(\d+(?:\.\d+)?)\s*half\s*clean/gi, fullPlusHalf);

    if (/both\s+half\s*clean/i.test(s)) {
      s = s.replace(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g, function (all, num, tok) {
        const typ = canonicalType(tok);
        if (!typ || typ === 'BEP') return all;
        return halfToken(num, typ);
      });
      s = s.replace(/both\s+half\s*clean(?:ed)?/gi, ' ');
    }

    let leftover = /half\s*clean/i.test(s);
    if (leftover) {
      const m3 = /(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?/i.exec(s);
      const typ = impliedType(original);
      if (m3 && typ) {
        const n = parseFloat(m3[1]);
        s = replaceOnce(s, /(\d+(?:\.\d+)?)\s*half\s*clean(?:ed)?/i, function () { return halfToken(n, typ); });
        s = replaceOnce(s, new RegExp('(\\d+(?:\\.\\d+)?)\\s*(' + typ + ')\\b', 'i'), function (all, cnt, tok) {
          if (canonicalType(tok) !== typ) return all;
          const left = parseFloat(cnt) - n;
          return left <= 0 ? ' ' : ' ' + left + typ + ' ';
        });
      }
    }
    leftover = /half\s*clean/i.test(s);
    return [s, !leftover];
  }
  function parsePlainUnits(text){
    const counts = emptyUnits();
    const unknown = [];
    const re = /(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g;
    let m;
    while ((m = re.exec(text || ''))) {
      const typ = canonicalType(m[2]);
      if (typ === 'BEP') continue;
      if (typ) { addUnit(counts, typ, parseFloat(m[1])); continue; }
      const word = m[2].toUpperCase();
      if (NOISE_WORDS[word] || word === 'FULL' || word === 'HALF' || EQUIPMENT_UNKNOWN[word]) continue;
      unknown.push(m[1] + m[2]);
    }
    return [counts, unknown];
  }
  function parseAcs(acs){
    const raw = String(acs || '').replace(/\u00a0/g, ' ').trim();
    if (!raw) return [emptyUnits(), true, 'empty_return'];
    if (/team\s*meeting/i.test(raw)) return [emptyUnits(), true, 'zero_skip'];
    if (/\bleak(?:ing)?\b/i.test(raw)) return [emptyUnits(), true, 'zero_day'];
    if (/\brefunds?\b/i.test(raw) && !hasUnitTokens(raw) && !PAREN_S_RE.test(raw)) return [emptyUnits(), true, 'zero_day'];
    if (/\bcall\b/i.test(raw) && !hasUnitTokens(raw) && !PAREN_S_RE.test(raw)) return [emptyUnits(), true, 'zero_day'];
    if (/^(PH|INTERVIEW|FILMING|TECHNICIAN INTERVIEW)$/i.test(raw)) return [emptyUnits(), false, 'non-unit ACS'];
    let segment = lastUnitSegment(raw);
    segment = stripHalfPrice(segment);
    const hw = rewriteHalfClean(segment, raw);
    const rewritten = hw[0];
    const halfSure = hw[1];
    if (/half\s*clean/i.test(segment) && !halfSure) return [emptyUnits(), false, 'ambiguous half-clean'];
    const pu = parsePlainUnits(rewritten);
    let counts = pu[0];
    const unknown = pu[1];
    if (!UNIT_TYPES.some(k => counts[k]) && (PAREN_S_RE.test(raw) || PAREN_S_RE.test(rewritten))) {
      addUnit(counts, 'S', 1);
    }
    if (!UNIT_TYPES.some(k => counts[k])) {
      if (unknown.length) return [emptyUnits(), false, 'unparsed ACS'];
      return [emptyUnits(), false, 'no countable units'];
    }
    return [counts, true, ''];
  }
  function unitsFromJob(job){
    const dictCounts = unitsDictCounts(job);
    if (isEmptyAcs(job)) {
      if (dictCounts) return [dictCounts, true, ''];
      return [emptyUnits(), true, 'empty_return'];
    }
    return parseAcs(job.acs);
  }
  function pointsFor(counts){
    return UNIT_TYPES.reduce((s, k) => s + WEIGHTS[k] * Number(counts[k] || 0), 0);
  }
  function totalUnits(counts){
    return UNIT_TYPES.reduce((s, k) => s + Number(counts[k] || 0), 0);
  }
  function trendFor(rows){
    const active = rows.filter(r => r.workday);
    if (active.length < 6) return 'Stable';
    const last = active.slice(-4);
    const prev = active.slice(-8, -4);
    function pace(chunk){
      const days = chunk.reduce((s, r) => s + r.workday, 0);
      const pts = chunk.reduce((s, r) => s + r.points, 0);
      return days ? pts / days : 0;
    }
    const a = pace(last);
    const b = pace(prev);
    if (a > b * 1.05) return 'Improving';
    if (a < b * 0.95) return 'Declining';
    return 'Stable';
  }
  function zeroRow(week){
    const o = {
      week: week, weekLabel: weekLabel(week), workday: 0, totalUnits: 0, returns: 0,
      points: 0, pointsDay: 0, unitsDay: 0
    };
    UNIT_TYPES.forEach(k => { o[k] = 0; });
    return o;
  }
  function weekRow(week, days, units, returns, points, typeCounts){
    const workday = days.size;
    if (workday === 0 && units === 0 && returns === 0) return zeroRow(week);
    const o = {
      week: week,
      weekLabel: weekLabel(week),
      workday: workday,
      totalUnits: r1(units),
      returns: returns,
      points: r2(points),
      pointsDay: workday ? r2(points / workday) : 0,
      unitsDay: workday ? r2(units / workday) : 0
    };
    UNIT_TYPES.forEach(k => {
      const val = typeCounts[k] || 0;
      o[k] = val ? r1(val) : 0;
    });
    return o;
  }
  function techRecord(name, rows){
    const totalPoints = r2(rows.reduce((s, r) => s + r.points, 0));
    const totalUnits = r1(rows.reduce((s, r) => s + (typeof r.totalUnits === 'number' ? r.totalUnits : 0), 0));
    const totalDays = rows.reduce((s, r) => s + r.workday, 0);
    const totalReturns = rows.reduce((s, r) => s + r.returns, 0);
    const unitTotals = {};
    UNIT_TYPES.forEach(k => { unitTotals[k] = 0; });
    rows.forEach(r => {
      UNIT_TYPES.forEach(k => { unitTotals[k] += Number(r[k] || 0); });
    });
    UNIT_TYPES.forEach(k => { unitTotals[k] = r1(unitTotals[k]); });
    unitTotals.R = totalReturns;
    const pointsDay = totalDays ? r2(totalPoints / totalDays) : 0;
    const unitsDay = totalDays ? r2(totalUnits / totalDays) : 0;
    return {
      name: name,
      totalPoints: totalPoints,
      totalUnits: totalUnits,
      totalDays: totalDays,
      totalReturns: totalReturns,
      totalReturnPoints: 0,
      pointsDay: pointsDay,
      unitsDay: unitsDay,
      ownAvgPointsDay: pointsDay,
      trend: trendFor(rows),
      weeksActive: rows.filter(r => r.workday).length,
      unitTotals: unitTotals,
      weeks: rows
    };
  }

  function scoreJobs(jobs, today){
    const todayIso = today || hktToday();
    const perTechWeek = {};
    const perTechDay = {};
    TECH_ORDER.forEach(n => {
      perTechWeek[n] = {};
      perTechDay[n] = {};
    });
    function bucket(lead, week){
      if (!perTechWeek[lead][week]) {
        perTechWeek[lead][week] = { days: new Set(), units: 0, returns: 0, points: 0, types: emptyUnits(), jobs: 0 };
      }
      return perTechWeek[lead][week];
    }
    function addDay(lead, d, points, units, returns, types){
      if (!perTechDay[lead][d]) perTechDay[lead][d] = { points: 0, units: 0, returns: 0, jobs: 0, types: emptyUnits() };
      const day = perTechDay[lead][d];
      day.points += points || 0;
      day.units += units || 0;
      day.returns += returns || 0;
      day.jobs += 1;
      if (types) {
        UNIT_TYPES.forEach(k => { day.types[k] += types[k] || 0; });
      }
    }

    (jobs || []).forEach(job => {
      if (!job) return;
      if (job.deleted === true || job.deleted === 'true') return;
      if (isCrew(job)) return;
      const d = jobDate(job);
      if (d.indexOf('2026') !== 0) return;
      const future = d > todayIso;
      const leadRaw = String(job.team_lead || '').trim();
      const lead = LEAD_MAP[leadRaw.toLowerCase()];
      if (!lead) return;
      if (SKIP_LEADS[lead.toLowerCase()]) return;
      if (TECH_ORDER.indexOf(lead) === -1) return;

      if (isReturn(job)) {
        if (!future) {
          const b = bucket(lead, mondayOf(d));
          b.returns += 1;
          b.days.add(d);
          b.jobs += 1;
        }
        addDay(lead, d, 0, 0, 1);
        return;
      }
      const u = unitsFromJob(job);
      const counts = u[0];
      const sure = u[1];
      const reason = u[2];
      if (reason === 'empty_return') {
        if (!future) {
          const b = bucket(lead, mondayOf(d));
          b.returns += 1;
          b.days.add(d);
          b.jobs += 1;
        }
        addDay(lead, d, 0, 0, 1);
        return;
      }
      if (reason === 'zero_skip') return;
      if (reason === 'zero_day') {
        if (!future) {
          const b = bucket(lead, mondayOf(d));
          b.days.add(d);
          b.jobs += 1;
        }
        addDay(lead, d, 0, 0, 0);
        return;
      }
      if (!sure) return;
      const pts = pointsFor(counts);
      const units = totalUnits(counts);
      if (!future) {
        const b = bucket(lead, mondayOf(d));
        b.points += pts;
        b.units += units;
        b.days.add(d);
        b.jobs += 1;
        UNIT_TYPES.forEach(k => { b.types[k] += counts[k] || 0; });
      }
      addDay(lead, d, pts, units, 0, counts);
    });

    const start = '2026-01-05';
    let lastJobMonday = start;
    TECH_ORDER.forEach(name => {
      Object.keys(perTechWeek[name]).forEach(w => {
        if (w > lastJobMonday) lastJobMonday = w;
      });
    });
    const end = mondayOf(todayIso) > lastJobMonday ? mondayOf(todayIso) : lastJobMonday;
    const weeks = weekRange(start, end);
    const technicians = {};
    TECH_ORDER.forEach(name => {
      const rows = weeks.map(week => {
        const b = perTechWeek[name][week];
        if (!b) return zeroRow(week);
        return weekRow(week, b.days, b.units, b.returns, b.points, b.types);
      });
      technicians[name] = techRecord(name, rows);
    });
    const ranking = TECH_ORDER.map(n => {
      const t = {};
      Object.keys(technicians[n]).forEach(k => { if (k !== 'weeks') t[k] = technicians[n][k]; });
      return t;
    }).sort((a, b) => (b.pointsDay - a.pointsDay) || (b.totalPoints - a.totalPoints) || (a.name < b.name ? -1 : 1));
    const teamPoints = r2(TECH_ORDER.reduce((s, n) => s + technicians[n].totalPoints, 0));
    const teamUnits = r1(TECH_ORDER.reduce((s, n) => s + technicians[n].totalUnits, 0));
    const teamDays = TECH_ORDER.reduce((s, n) => s + technicians[n].totalDays, 0);
    const teamReturns = TECH_ORDER.reduce((s, n) => s + technicians[n].totalReturns, 0);
    const daily = {};
    TECH_ORDER.forEach(n => {
      daily[n] = Object.keys(perTechDay[n]).sort().map(d => {
        const row = perTechDay[n][d];
        const out = {
          date: d,
          points: r2(row.points),
          units: r1(row.units),
          returns: row.returns,
          jobs: row.jobs || 0
        };
        UNIT_TYPES.forEach(k => { out[k] = r1((row.types && row.types[k]) || 0); });
        return out;
      });
    });
    return {
      generated: todayIso,
      source: 'Firestore breathe-easy-performance/jobs 2026; half-clean=0.5; half-price ignored; arrow=actual cleaned; BEP=0; returns=0 pts; team_lead only',
      cutoff: 'earned through ' + todayIso,
      pointsTable: POINTS_TABLE,
      rules: RULES,
      team: {
        totalPoints: teamPoints,
        totalUnits: teamUnits,
        totalDays: teamDays,
        totalReturns: teamReturns,
        avgPointsDay: teamDays ? r1(teamPoints / teamDays) : 0
      },
      weeks: weeks,
      weekLabels: weeks.map(weekLabel),
      returnPointsWeight: 0,
      ranking: ranking,
      technicians: technicians,
      daily: daily
    };
  }

  global.BEScoreJobs = scoreJobs;
  global.BEScoreHktToday = hktToday;
  global.BEScoreJobLead = function (job) {
    const raw = String(job && job.team_lead || '').trim();
    return LEAD_MAP[raw.toLowerCase()] || '';
  };
  global.BEScoreJobIsCrew = isCrew;
  global.BEScoreJobDate = jobDate;
  global.BEScoreJobUnits = function (job) {
    if (isReturn(job)) return { isReturn: true, counts: emptyUnits(), total: 0, points: 0 };
    const u = unitsFromJob(job);
    const counts = u[0];
    return { isReturn: false, counts: counts, total: totalUnits(counts), points: pointsFor(counts), sure: u[1] };
  };
})(typeof window !== 'undefined' ? window : this);
