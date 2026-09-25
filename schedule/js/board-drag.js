let capturedId = '';
let suppressUntil = 0;

export function beginDrag(id) {
  capturedId = String(id || '');
  return capturedId;
}

export function capturedDragId() {
  return capturedId;
}

export function clearCapturedDrag() {
  capturedId = '';
}

export function armClickSuppress(ms = 300, now = Date.now()) {
  suppressUntil = now + ms;
}

export function consumeClickSuppress(now = Date.now()) {
  if (now < suppressUntil) {
    suppressUntil = 0;
    return true;
  }
  return false;
}

export function resolveDropId(dataText, captured = capturedId) {
  const fromData = String(dataText || '').trim();
  if (fromData) return fromData;
  return String(captured || '').trim();
}

export function jobDropKind(id) {
  if (id === 'new-appointment') return 'new';
  if (!id || id === 'lunch') return 'other';
  return 'job';
}

export function applyJobDrop(id, deps) {
  const kind = jobDropKind(id);
  if (kind === 'new') {
    deps.openBooking({
      date: deps.date,
      team_lead: deps.team,
      time: '',
      stack_order: deps.slot,
    });
    return 'open';
  }
  if (kind !== 'job') return 'skip';
  deps.placeJobInSlot(id, deps.date, deps.team, deps.slot);
  return 'move';
}

export function handleCellClick(openBooking, payload, now = Date.now()) {
  if (consumeClickSuppress(now)) return 'suppressed';
  openBooking(payload);
  return 'open';
}

export function pointerMoved(dx, dy, threshold = 8) {
  return Math.hypot(Number(dx) || 0, Number(dy) || 0) >= threshold;
}

export function pointerJobUp(opts) {
  const moved = !!opts.moved;
  const capturedId = String(opts.capturedId || '');
  const date = opts.overDate || '';
  const team = opts.overTeam || '';
  const slot = opts.slot;
  const deps = {
    date,
    team,
    slot,
    placeJobInSlot: opts.placeJobInSlot,
    openBooking: opts.openBooking,
  };
  const kind = jobDropKind(capturedId);

  if (moved && kind === 'job' && date && team) {
    applyJobDrop(capturedId, deps);
    armClickSuppress(300, opts.now || Date.now());
    return 'move';
  }
  if (!moved && kind === 'job') {
    const job = opts.getJob ? opts.getJob(capturedId) : { job_id: capturedId };
    if (job) opts.openBooking(job);
    return 'open-job';
  }
  if (!moved && date && team) {
    opts.openBooking({
      date,
      team_lead: team,
      stack_order: slot,
    });
    return 'open-new';
  }
  return 'none';
}
