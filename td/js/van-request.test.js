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
    'netlify/functions/' + name,
    'td/netlify/functions/' + name,
    '../td/netlify/functions/' + name,
    'netlify.toml',
    'td/netlify.toml',
    '../td/netlify.toml',
    '../netlify.toml',
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
assert(html.indexOf('js/app.js?v=59') !== -1, 'js cache');
assert(html.indexOf('css/app.css?v=51') !== -1, 'css cache');
print('ok 1 jobCard unchanged; js/app.js?v=59');

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

const openAt = src.indexOf('function openModal');
const openBody = src.slice(openAt, src.indexOf('function closeModal'));
assert(openBody.indexOf('copyVanBtn') !== -1, '3 copyVanBtn click');
assert(openBody.indexOf('copyText(vanText)') !== -1, '3 copies vanRequestText');
assert(openBody.indexOf("flashVanBtn(vanBtn, 'Copied'") !== -1, '3 Copied');
assert(openBody.indexOf("flashVanBtn(vanBtn, 'Copy failed'") !== -1, '3 Copy failed still opens');
assert(openBody.indexOf('vanDiscordChannel()') !== -1, '3 opens the channel');
assert(openBody.indexOf('tab.close()') === -1, '3 copy fail still opens');
assert(src.indexOf("fetch('/.netlify/functions/van-discord'") === -1, '3 does not post to Discord');
assert(src.indexOf('function postVanRequest') === -1, '3 no post helper');
assert(src.indexOf('https://discord.com/channels/1547059756642861066/1547070087343898674') !== -1, '3 Discord channel');
assert(src.indexOf('discord.com/api/webhooks') === -1, '3 no webhook');
assert(src.indexOf('DISCORD_VAN_WEBHOOK') === -1, '3 no webhook env');
print('ok 3 Copy van request copies then opens the channel');

print('ok van-request cases');
