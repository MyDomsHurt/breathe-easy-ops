import { jobOnSiteMinutes } from './job-duration.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function eq(acs, expected, label) {
  const got = jobOnSiteMinutes({ acs, source: 'test' });
  assert(got === expected, (label || acs) + ' got ' + got);
}

eq('2W', 90);
eq('2C', 105);
eq('2S 1C', 140);
eq('3B', 135);
eq('3S', 135);
eq('1C', 50);
eq('1B', 45);
eq('4S', 180);

assert(jobOnSiteMinutes({ job_type: 'return' }) === 45, 'return');
assert(jobOnSiteMinutes({ job_type: 'return', acs: '' }) === 45, 'return blank ACS');
assert(jobOnSiteMinutes({ acs: '' }) === 45, 'blank ACS');
assert(jobOnSiteMinutes({ acs: null }) === 45, 'null ACS');
assert(jobOnSiteMinutes({}) === 45, 'missing ACS');

print('ok job-duration fixtures');
