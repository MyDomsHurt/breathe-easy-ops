import { composeFullAddress, FIXTURES, parseAddress } from './address-parse.js';

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

let passed = 0;
for (const fx of FIXTURES) {
  const got = parseAddress(fx.raw);
  for (const [key, expected] of Object.entries(fx.expect)) {
    const actual = key === 'composed' ? composeFullAddress(got) : got[key];
    if (String(actual || '') !== String(expected || '')) {
      fail(`${fx.id}.${key}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    } else {
      passed += 1;
    }
  }
}

if (!process.exitCode) {
  console.log(`ok ${FIXTURES.length} fixtures, ${passed} assertions`);
}
