function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function readSrc(name) {
  if (typeof readFile !== 'function') fail('jsc readFile missing');
  const paths = [
    name,
    'td/' + name,
    'td/js/' + name,
    '../' + name,
    '../td/' + name,
  ];
  for (const p of paths) {
    try {
      const s = readFile(p);
      if (s != null && String(s).length) return String(s);
    } catch (e) {}
  }
  fail('cannot read ' + name);
}

function fnBody(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) fail('missing ' + name);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail('unclosed ' + name);
}

const src = readSrc('app.js');
const html = readSrc('index.html');

const cardAt = src.indexOf('function jobCard');
assert(cardAt !== -1, 'jobCard stays');
const cardBody = src.slice(cardAt, src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('compact-time') !== -1, 'jobCard time');
assert(cardBody.indexOf('liveAcsBadges') !== -1, 'jobCard units');
assert(cardBody.indexOf('compact-name') !== -1, 'jobCard name');
assert(cardBody.indexOf('detailed-phone') !== -1, 'jobCard phone');
assert(cardBody.indexOf('compact-addr') !== -1, 'jobCard address');
assert(cardBody.indexOf('compact-notes') !== -1, 'jobCard note');
assert(cardBody.indexOf('compact-col-meta') === -1, 'jobCard no stamp');
assert(html.indexOf('js/app.js?v=48') !== -1, 'js cache');
assert(html.indexOf('css/app.css?v=49') !== -1, 'css cache stays');
print('ok 1 jobCard unchanged; js/app.js?v=48');

const jobsJson = JSON.stringify([
  { job_id: '2026-10-08-matthew-1', date: '2026-10-08', team_lead: 'Matthew', time: '08:30', client_name: 'First' },
  { job_id: '2026-10-08-matthew-2', date: '2026-10-08', team_lead: 'Matthew', time: '11:00', client_name: 'Last' },
  { job_id: 'crew-2026-10-08-matthew', date: '2026-10-08', team_lead: 'Matthew', time: '12:00', client_name: 'Crew', source: 'team-day-crew' },
  { job_id: '2026-10-08-matthew-gone', date: '2026-10-08', team_lead: 'Matthew', time: '13:00', client_name: 'Deleted', deleted: true },
  { job_id: 'holiday-2026-10-08', date: '2026-10-08', team_lead: 'Matthew', time: '14:00', client_name: 'Holiday', source: 'company-day' },
  { job_id: '2026-10-08-tiago-1', date: '2026-10-08', team_lead: 'Tiago', time: '15:00', client_name: 'Other team' }
]);

eval(
  'var window = globalThis.window || (globalThis.window = {});\n' +
  fnBody(src, 'timeToMinutes') + '\n' +
  fnBody(src, 'jobSortMinutes') + '\n' +
  fnBody(src, 'ordinal') + '\n' +
  fnBody(src, 'isCrewNote') + '\n' +
  fnBody(src, 'isPaintedDayJob') + '\n' +
  fnBody(src, 'sameDayTeamJobs') + '\n' +
  fnBody(src, 'vanRequestText') + '\n' +
  'var allJobs = ' + jobsJson + ';\n' +
  'var filtered = allJobs.filter(function (j) { return isPaintedDayJob(j); });\n' +
  'globalThis.__vanFirst = vanRequestText(allJobs[0]);\n' +
  'globalThis.__vanLast = vanRequestText(allJobs[1]);\n'
);

const firstText = globalThis.__vanFirst;
const lastText = globalThis.__vanLast;
assert(firstText.indexOf('1st job: First') !== -1, 'first is 1st');
assert(firstText.indexOf('\u2192 2nd job: Last') !== -1, 'first next is 2nd painted');
assert(firstText.indexOf('3rd job') === -1, 'first does not skip to a 3rd');
assert(lastText.indexOf('2nd job: Last') !== -1, 'last painted is 2nd');
assert(lastText.indexOf('\u2192 Office') !== -1, 'last card arrows to Office');
assert(lastText.indexOf('3rd job') === -1, 'last card is not a 3rd job');
assert(lastText.indexOf('Crew') === -1, 'crew note is not a next job');
assert(lastText.indexOf('Deleted') === -1, 'deleted job is not a next job');
assert(lastText.indexOf('Holiday') === -1, 'holiday row is not a next job');
assert(lastText.indexOf('Other team') === -1, 'other team is not a next job');
print('ok 2 last painted card arrows to Office, not a 3rd job');

print('ok van-request cases');
