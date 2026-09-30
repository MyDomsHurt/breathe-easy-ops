import { TEAMS } from './config.js';
import { allTeamsVisible, moveTeam, sanitizeTeamOrder, visibleTeamOrder } from './team-order.js';

function fail(msg) {
  print('FAIL ' + msg);
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function same(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), msg + ' got ' + JSON.stringify(a));
}

same(sanitizeTeamOrder(null), TEAMS, 'missing → TEAMS');
same(sanitizeTeamOrder(undefined), TEAMS, 'undefined → TEAMS');
same(sanitizeTeamOrder('Josh'), TEAMS, 'non-array → TEAMS');
same(sanitizeTeamOrder({}), TEAMS, 'object → TEAMS');
same(sanitizeTeamOrder([]), TEAMS, 'empty → TEAMS');
print('ok 1 missing or invalid defaults to TEAMS');

same(
  sanitizeTeamOrder(['Iggi', 'Unknown', 'Josh', 'Iggi', 'Matthew']),
  ['Iggi', 'Josh', 'Matthew', 'Tiago', 'Nick', 'Alun'],
  'keep known, drop extra, append missing',
);
print('ok 2 sanitize keeps known order, appends missing, drops the rest');

same(moveTeam(TEAMS, 'Josh', -1), TEAMS, 'first up is no-op');
same(moveTeam(TEAMS, 'Iggi', 1), TEAMS, 'last down is no-op');
same(
  moveTeam(TEAMS, 'Matthew', -1),
  ['Matthew', 'Josh', 'Tiago', 'Nick', 'Alun', 'Iggi'],
  'Matthew up',
);
same(
  moveTeam(['Iggi', 'Josh', 'Matthew', 'Tiago', 'Nick', 'Alun'], 'Iggi', 1),
  ['Josh', 'Iggi', 'Matthew', 'Tiago', 'Nick', 'Alun'],
  'Iggi down',
);
print('ok 3 up / down swap neighbours');

const order = ['Iggi', 'Josh', 'Matthew', 'Tiago', 'Nick', 'Alun'];
same(
  visibleTeamOrder(order, ['Matthew', 'Iggi']),
  ['Iggi', 'Matthew'],
  'visible names keep team_order slots',
);
same(
  visibleTeamOrder(order, ['Matthew', 'Iggi', 'Matthew']),
  ['Iggi', 'Matthew'],
  'check does not append past the slot',
);
print('ok 4 visible set returns to team_order slots');

assert(allTeamsVisible([...TEAMS], order) === true, 'all names visible');
assert(allTeamsVisible(['Josh', 'Matthew'], order) === false, 'subset is not all');
print('ok 5 all teams means every name in team_order is visible');

print('ok team-order cases');
