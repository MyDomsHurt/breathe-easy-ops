/**
 * Seed data: Schedule Master week 17–22 Aug 2026.
 * Embedded WEEK_JOBS is the source of truth so the board cannot fail
 * just because a JSON fetch is blocked.
 */

import { TEAM_META } from './config.js';
import { weekNumber } from './utils.js';
import { WEEK_JOBS } from './week-data.js';

let cached = null;

function normalize(rows) {
  return (Array.isArray(rows) ? rows : []).map((j) => ({
    ...j,
    week: j.week || weekNumber(j.date),
    team_members: j.team_members || TEAM_META[j.team_lead]?.members || j.team_lead,
    is_return: j.is_return || j.job_type === 'return',
    source: j.source || 'schedule-master-2026-08-17',
  }));
}

export async function loadSeedJobs() {
  if (cached && cached.length) return cached;
  cached = normalize(WEEK_JOBS);
  return cached;
}

export function buildSeedJobs() {
  return cached || normalize(WEEK_JOBS);
}

export function uniqueClientsFrom(jobs) {
  const map = new Map();
  for (const j of jobs) {
    const key = String(j.mobile || j.client_name).replace(/\s+/g, '');
    if (!map.has(key)) {
      map.set(key, {
        name: j.client_name,
        mobile: j.mobile,
        address: j.address,
        district: j.district,
      });
    }
  }
  return [...map.values()];
}
