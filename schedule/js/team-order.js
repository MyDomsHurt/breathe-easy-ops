import { TEAMS } from './config.js';

export function sanitizeTeamOrder(raw, known = TEAMS) {
  const allowed = Array.isArray(known) && known.length ? known : TEAMS;
  const allowedSet = new Set(allowed);
  const seen = new Set();
  const kept = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const name = String(item == null ? '' : item);
      if (!allowedSet.has(name) || seen.has(name)) continue;
      seen.add(name);
      kept.push(name);
    }
  }
  for (const name of allowed) {
    if (!seen.has(name)) kept.push(name);
  }
  return kept;
}

export function visibleTeamOrder(order, visible, known = TEAMS) {
  const slots = sanitizeTeamOrder(order, known);
  const set = new Set(Array.isArray(visible) ? visible : []);
  return slots.filter((name) => set.has(name));
}

export function moveTeam(order, name, delta, known = TEAMS) {
  const next = sanitizeTeamOrder(order, known);
  const i = next.indexOf(name);
  const j = i + Number(delta);
  if (i < 0 || j < 0 || j >= next.length) return next;
  const swap = next[i];
  next[i] = next[j];
  next[j] = swap;
  return next;
}

export function allTeamsVisible(visible, order, known = TEAMS) {
  const slots = sanitizeTeamOrder(order, known);
  const set = new Set(Array.isArray(visible) ? visible : []);
  return slots.every((name) => set.has(name));
}
