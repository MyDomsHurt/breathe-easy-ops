import { composePhone, FIXTURES, matchHubspotIdByPhone, parsePhone } from './phone-parse.js';

const out = (typeof console !== 'undefined' && console.log)
  ? (...a) => console.log(...a)
  : (...a) => print(a.join(' '));

function fail(msg) {
  out(msg);
  if (typeof process !== 'undefined') process.exitCode = 1;
  else throw new Error(msg);
}

let passed = 0;
for (const fx of FIXTURES) {
  if (fx.id.startsWith('compose')) {
    const actual = composePhone(fx.country, fx.national);
    if (actual !== fx.expect.composed) {
      fail(`${fx.id}: expected ${JSON.stringify(fx.expect.composed)} got ${JSON.stringify(actual)}`);
    } else {
      passed += 1;
    }
    continue;
  }
  const got = parsePhone(fx.raw);
  for (const [key, expected] of Object.entries(fx.expect)) {
    const actual = got[key];
    if (String(actual) !== String(expected)) {
      fail(`${fx.id}.${key}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    } else {
      passed += 1;
    }
  }
}

const contacts = [
  { hubspot_id: '101', phone: '+85291234567' },
  { hubspot_id: '102', phone: '+6598765432' },
  { hubspot_id: '103', phone: '+85291234567' },
  { hubspot_id: '201', phone: '+85261105262' },
];
function expectMatch(raw, wantId, wantStatus) {
  const got = matchHubspotIdByPhone(raw, contacts);
  if (got.hubspot_id !== wantId || got.status !== wantStatus) {
    fail(`match ${raw}: expected ${wantStatus}/${wantId} got ${got.status}/${got.hubspot_id}`);
  } else {
    passed += 1;
  }
}
expectMatch('+6598765432', '102', 'one');
expectMatch('6598765432', '102', 'one');
expectMatch('61105262', '201', 'one');
expectMatch('+85291234567', '', 'ambiguous');
expectMatch('99998888', '', 'unmatched');
expectMatch('', '', 'unmatched');

if (typeof process === 'undefined' || !process.exitCode) {
  out(`ok ${FIXTURES.length} fixtures + matches, ${passed} assertions`);
}
