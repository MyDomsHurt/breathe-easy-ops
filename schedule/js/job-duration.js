import { jobTypeOf, parseAcs } from './utils.js';

const CASS_TABLE = [0, 50, 105, 150, 195, 240, 300];

function cassetteOnSiteMinutes(n) {
  const x = Number(n) || 0;
  if (x <= 0) return 0;
  if (x <= 6 && CASS_TABLE[x] != null) return CASS_TABLE[x];
  if (x > 6) return 300 + 45 * (x - 6);
  const lo = Math.floor(x);
  const hi = Math.ceil(x);
  const a = lo <= 0 ? 0 : CASS_TABLE[lo];
  const b = hi <= 6 ? CASS_TABLE[hi] : 300 + 45 * (hi - 6);
  return a + (x - lo) * (b - a);
}

function unitCount(counts, id) {
  return Number(counts && counts[id] || 0);
}

function hasOnSiteUnits(counts) {
  return unitCount(counts, 'S')
    || unitCount(counts, 'W')
    || unitCount(counts, 'WP')
    || unitCount(counts, 'B')
    || unitCount(counts, 'Bh')
    || unitCount(counts, 'C')
    || unitCount(counts, 'UC')
    || unitCount(counts, 'OU')
    || unitCount(counts, 'SwG');
}

export function jobOnSiteMinutes(job) {
  if (jobTypeOf(job) === 'return') return 45;
  const counts = parseAcs(job && job.acs);
  if (!hasOnSiteUnits(counts)) return 45;
  const mins = 45 * unitCount(counts, 'S')
    + 45 * unitCount(counts, 'W')
    + 45 * unitCount(counts, 'SwG')
    + 50 * unitCount(counts, 'WP')
    + 45 * unitCount(counts, 'B')
    + 25 * unitCount(counts, 'Bh')
    + cassetteOnSiteMinutes(counts.C)
    + cassetteOnSiteMinutes(counts.UC)
    + 30 * unitCount(counts, 'OU');
  return mins < 45 ? 45 : mins;
}
