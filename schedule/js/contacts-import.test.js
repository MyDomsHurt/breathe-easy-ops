import { contactsFromCsv, headerIndex, parseCsv } from './contacts-import.js';
import { cleanLastName, mapHubSpotValue, mappedFieldsFromHubSpotProperties, normalizePhone, phoneTail8 } from '../../shared/contact.js';
import { matchesContactQuery, queryContacts } from './contacts-query.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizePhone('9123 4567') === '+85291234567', '8 digit');
assert(normalizePhone('+852 9123 4567') === '+85291234567', 'plus 852');
assert(normalizePhone('85291234567') === '+85291234567', 'plus prefix');
assert(normalizePhone('') === '', 'empty phone');
assert(cleanLastName('.') === '', 'dot last name');
assert(cleanLastName('Wong') === 'Wong', 'keep last name');
assert(phoneTail8('+85261105262') === '61105262', 'tail 8');

const csv = 'Record ID,First Name,Last Name,Profile Phone Number,Full Address 1,Billing Address Line 1,Billing Street,Billing City,Billing State,Number of Associated Deals,Total Revenue,Stream,CRM Tag,Language,Groups,Instagram,Contact owner,Email,Owner\n'
  + '101,Ada,.,61105262,"12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)",Flat 12A,31 Conduit Road,Mid-Levels,Hong Kong Island,2,3400,Referral,Membership,English,Group 5,ada.ig,Jeff Lamb,ada@x.com,skip\n'
  + '102,Ben,Wong,91234568,20 Scenic Villa Drive,4/F Block J,20 Scenic Villa Drive,Pok Fu Lam,HKN,0,,Website,Black List,Chinese,Group 1,ben.ig,Ruby Yang,ben@x.com,skip\n';
const rows = contactsFromCsv(csv);
assert(rows.length === 2, 'two contacts');
assert(rows[0].hubspot_id === '101', 'id');
assert(rows[0].first_name === 'Ada', 'first');
assert(rows[0].last_name === '', 'dropped dot');
assert(rows[0].phone === '+85261105262', 'phone');
assert(rows[0].address_place === 'Mid-Levels', 'place');
assert(rows[0].deals === 2, 'deals');
assert(rows[0].revenue === 3400, 'revenue');
assert(rows[0].stream === 'Referral', 'stream');
assert(rows[0].tag === 'Membership', 'tag');
assert(rows[0].language === 'English', 'language');
assert(rows[0].groups === 'Group 5', 'groups');
assert(rows[0].instagram === 'ada.ig', 'instagram');
assert(rows[0].owner === 'Jeff Lamb', 'owner from Contact owner not Owner col');
assert(!Object.prototype.hasOwnProperty.call(rows[0], 'email'), 'no extra cols');
assert(headerIndex(parseCsv(csv)[0]).hubspot_id === 0, 'record id col');
assert(rows[1].last_name === 'Wong', 'keep Wong');
assert(rows[1].tag === 'Black List', 'ben tag');

assert(matchesContactQuery(rows[0], '61105262'), 'search last 8');
assert(matchesContactQuery(rows[0], 'ada.ig'), 'search instagram');
assert(matchesContactQuery(rows[0], 'Referral'), 'search stream');
assert(matchesContactQuery(rows[0], 'Membership'), 'search tag');
assert(matchesContactQuery(rows[0], 'Ada'), 'search name');

const defaultList = queryContacts(rows, { all: false, query: '' });
assert(defaultList.length === 1 && defaultList[0].first_name === 'Ada', 'default deals > 0');
const allList = queryContacts(rows, { all: true, query: '' });
assert(allList.length === 2, 'all toggle');
const found = queryContacts(rows, { all: false, query: '61105262' });
assert(found.length === 1 && found[0].first_name === 'Ada', 'search full store');
const zeroDeal = queryContacts(rows, { all: false, query: 'Ben' });
assert(zeroDeal.length === 1 && zeroDeal[0].first_name === 'Ben', 'search finds zero-deal');
const tagged = queryContacts(rows, { all: true, tag: 'Black List' });
assert(tagged.length === 1 && tagged[0].first_name === 'Ben', 'tag filter');

assert(mapHubSpotValue('lastname', '.') === '', 'webhook drop dot last name');
assert(mapHubSpotValue('profile_phone_number', '61105262') === '+85261105262', 'webhook phone');
assert(mapHubSpotValue('hubspot_owner_id', 51129811) === '51129811', 'owner as sent');
assert(mapHubSpotValue('num_associated_deals', '3') === 3, 'deals number');
assert(mapHubSpotValue('hubsoot_tags', 'Membership') === 'Membership', 'crm tag');
const mapped = mappedFieldsFromHubSpotProperties({
  firstname: 'Ada',
  lastname: '.',
  profile_phone_number: '61105262',
  email: 'skip@x.com',
});
assert(mapped.first_name === 'Ada', 'map first');
assert(mapped.last_name === '', 'map last');
assert(mapped.phone === '+85261105262', 'map phone');
assert(mapped.email == null, 'no extra hubspot props');
console.log('ok');
