import { composePhone, FIXTURES, parsePhone } from './phone-parse.js';

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

let passed = 0;
for (const fx of FIXTURES) {
  if (fx.id === 'compose') {
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

if (!process.exitCode) {
  console.log(`ok ${FIXTURES.length} fixtures, ${passed} assertions`);
}
