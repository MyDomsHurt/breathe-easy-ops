import { TEAM_META, TEAMS } from './config.js';
import { startMinutes, timeToMinutes } from './utils.js';

export function sortByTime(jobs) {
  return jobs.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function stackKey(job) {
  const n = Number(job && job.stack_order);
  if (Number.isFinite(n)) return n;
  const mins = timeToMinutes(job && job.time);
  return 1e6 + (mins === 9999 ? 0 : mins);
}

export function sortByStack(jobs) {
  return jobs.slice().sort((a, b) => {
    const d = stackKey(a) - stackKey(b);
    if (d) return d;
    return String(a.job_id || '').localeCompare(String(b.job_id || ''));
  });
}

export function jobsForTeamDay(jobs, date, team) {
  return sortByStack(jobs.filter((j) => j.date === date && j.team_lead === team));
}

export function nextStackOrder(jobs, date, team, exceptId) {
  const list = jobs.filter((j) => j.date === date && j.team_lead === team && j.job_id !== exceptId);
  let max = -1;
  for (const j of list) {
    const k = stackKey(j);
    if (k > max) max = k;
  }
  return max + 1;
}

export function teamMembersOnDay(jobs, date, team) {
  const hit = jobs.find((j) => j.date === date && j.team_lead === team && j.team_members);
  return hit?.team_members || TEAM_META[team]?.members || team;
}

export function districtsForTeamOnDay(jobs, date, team) {
  return [...new Set(
    jobs.filter((j) => j.date === date && j.team_lead === team && j.district).map((j) => j.district)
  )];
}

export function conflictingJobIds(jobs) {
  const groups = new Map();
  for (const j of jobs) {
    const key = startMinutes(j);
    if (key == null) continue;
    const arr = groups.get(key) || [];
    arr.push(j.job_id);
    groups.set(key, arr);
  }
  const ids = new Set();
  for (const arr of groups.values()) {
    if (arr.length > 1) arr.forEach((id) => ids.add(id));
  }
  return ids;
}

export function hasTimeConflict(job, jobs) {
  const key = startMinutes(job);
  if (key == null || !job) return false;
  return jobs.some((j) => (
    j.job_id !== job.job_id
    && j.date === job.date
    && j.team_lead === job.team_lead
    && startMinutes(j) === key
  ));
}

/**
 * Suggest a team for a date: lighter day first, then same-day district
 * clustering, then home areas. Never a hard quota.
 */
export function suggestTeams(jobs, { date, district, teams = TEAMS } = {}) {
  return teams
    .map((team) => {
      const dayJobs = jobsForTeamDay(jobs, date, team);
      const dayDistricts = districtsForTeamOnDay(jobs, date, team);
      const home = TEAM_META[team]?.home || [];
      let score = 40 - dayJobs.length * 6;
      if (district && dayDistricts.includes(district)) score += 16;
      if (district && home.includes(district)) score += 8;
      if (dayJobs.length === 0) score += 8;
      return {
        team,
        jobCount: dayJobs.length,
        dayDistricts,
        members: teamMembersOnDay(jobs, date, team),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function overlapWarning(jobs, { date, team, time }) {
  const mins = timeToMinutes(time);
  if (!time || mins === 9999) return null;
  const near = jobsForTeamDay(jobs, date, team).find((j) => {
    const other = timeToMinutes(j.time);
    if (other === 9999) return false;
    return Math.abs(other - mins) < 45;
  });
  if (!near) return null;
  return `${near.time || 'Another job'} already on ${team} that day`;
}
