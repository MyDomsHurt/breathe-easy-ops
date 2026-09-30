/**
 * Jeff-only: compare live undeleted September jobs to the glance file.
 * Match by job_id, then team + date + client + start clock.
 * Does not write. Fix lives on the signed-in store.
 */

import { inSeptember } from '../../scripts/september-glance.js';
import { isCrewNote } from '../../shared/team-day.js';
import { formatTime24 } from './utils.js';
import { validateSeptemberGlance } from './september-load.js';

export { validateSeptemberGlance };

function fold(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function ymd(value) {
  return String(value == null ? '' : value).slice(0, 10);
}

function startClock(job) {
  const raw = job && job.time != null ? String(job.time) : '';
  return formatTime24(raw) || fold(raw);
}

function slotKey(job) {
  return [
    fold(job && job.team_lead),
    ymd(job && job.date),
    fold(job && job.client_name),
    startClock(job),
  ].join('\0');
}

export function liveSeptemberJobs(liveJobs) {
  const out = [];
  for (const job of liveJobs || []) {
    if (!job || !job.job_id) continue;
    if (isCrewNote(job)) continue;
    if (job.deleted === true || job.deleted === 'true') continue;
    if (!inSeptember(job.date)) continue;
    out.push(job);
  }
  return out;
}

function displayName(file, live) {
  const fromFile = String((file && file.client_name) || '').trim();
  if (fromFile) return fromFile;
  return String((live && live.client_name) || '').trim() || '—';
}

function sepDay(iso) {
  const d = ymd(iso);
  const day = parseInt(d.slice(8, 10), 10);
  if (!day) return d || '—';
  return day + ' Sep';
}

export function mismatchLine(row) {
  const name = String((row && row.name) || '').trim() || '—';
  const fileDay = sepDay(row && row.fileDate);
  const boardDay = sepDay(row && row.boardDate);
  const teamDiff = fold(row && row.fileTeam) !== fold(row && row.boardTeam);
  if (teamDiff) {
    const fileTeam = String((row && row.fileTeam) || '').trim() || '—';
    const boardTeam = String((row && row.boardTeam) || '').trim() || '—';
    return name + ' file ' + fileDay + ' ' + fileTeam + ' / board ' + boardDay + ' ' + boardTeam;
  }
  return name + ' file ' + fileDay + ' / board ' + boardDay;
}

export function planCheckSeptember(fileJobs, liveJobs) {
  const files = [];
  for (const job of fileJobs || []) {
    if (!job || !job.job_id) continue;
    if (isCrewNote(job)) continue;
    files.push(job);
  }
  const board = liveSeptemberJobs(liveJobs);

  const boardById = new Map();
  for (const job of board) boardById.set(String(job.job_id), job);

  const usedFile = new Set();
  const usedBoard = new Set();
  const mismatches = [];

  for (const file of files) {
    const id = String(file.job_id);
    const live = boardById.get(id);
    if (!live) continue;
    usedFile.add(id);
    usedBoard.add(String(live.job_id));
    const fileDate = ymd(file.date);
    const boardDate = ymd(live.date);
    const fileTeam = String(file.team_lead || '').trim();
    const boardTeam = String(live.team_lead || '').trim();
    if (fileDate !== boardDate || fold(fileTeam) !== fold(boardTeam)) {
      mismatches.push({
        job_id: String(live.job_id),
        name: displayName(file, live),
        fileDate,
        boardDate,
        fileTeam,
        boardTeam,
        date: ymd(file.date),
        team_lead: file.team_lead == null ? '' : String(file.team_lead),
        time: file.time == null ? '' : String(file.time),
        client_name: file.client_name == null ? '' : String(file.client_name),
        base: live,
      });
    }
  }

  mismatches.sort((a, b) => {
    const d = String(a.fileDate).localeCompare(String(b.fileDate));
    if (d) return d;
    return String(a.name).localeCompare(String(b.name));
  });

  const leftoverFile = files.filter((j) => !usedFile.has(String(j.job_id)));
  const leftoverBoard = board.filter((j) => !usedBoard.has(String(j.job_id)));

  const boardBySlot = new Map();
  for (const job of leftoverBoard) {
    const k = slotKey(job);
    const list = boardBySlot.get(k) || [];
    list.push(job);
    boardBySlot.set(k, list);
  }

  let missingCount = 0;
  for (const file of leftoverFile) {
    const cands = boardBySlot.get(slotKey(file));
    if (cands && cands.length) {
      const live = cands.shift();
      usedBoard.add(String(live.job_id));
    } else {
      missingCount += 1;
    }
  }

  let extraCount = 0;
  for (const job of leftoverBoard) {
    if (!usedBoard.has(String(job.job_id))) extraCount += 1;
  }

  return {
    missingCount,
    extraCount,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

export function planCheckSeptemberLines(plan) {
  const missing = plan && plan.missingCount != null ? plan.missingCount : 0;
  const extra = plan && plan.extraCount != null ? plan.extraCount : 0;
  const n = plan && plan.mismatchCount != null ? plan.mismatchCount : 0;
  const lines = [
    missing + ' in the file, missing on the board',
    extra + ' on the board, not in the file',
    n + ' same job, wrong date or team',
  ];
  const rows = plan && Array.isArray(plan.mismatches) ? plan.mismatches : [];
  for (const row of rows) lines.push(mismatchLine(row));
  return lines;
}
