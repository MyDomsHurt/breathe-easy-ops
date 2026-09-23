import { contactsFromCsv, headerIndex, parseCsv } from './contacts-import.js';
import { cleanLastName, normalizePhone } from '../../shared/contact.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizePhone('9123 4567') === '+85291234567', '8 digit');
assert(normalizePhone('+852 9123 4567') === '+85291234567', 'plus 852');
assert(normalizePhone('85291234567') === '+85291234567', '852 prefix');
assert(normalizePhone('') === '', 'empty phone');
assert(cleanLastName('.') === '', 'dot last name');
assert(cleanLastName('Wong') === 'Wong', 'keep last name');

const csv = 'Record ID,First Name,Last Name,Profile Phone Number,Full Address 1,Billing Address Line 1,Billing Street,Billing City,Billing State,Number of Associated Deals,Total Revenue,Email,Owner\n'
  + '101,Ada,.,9123 4567,"12A, The Morgan, 31 Conduit Road, Mid-Levels (HKN)",Flat 12A,31 Conduit Road,Mid-Levels,Hong Kong Island,2,3400,ada@x.com,skip\n'
  + '102,Ben,Wong,91234568,20 Scenic Villa Drive,4/F Block J,20 Scenic Villa Drive,Pok Fu Lam,HKN,0,,ben@x.com,skip\n';
const rows = contactsFromCsv(csv);
assert(rows.length === 2, 'two contacts');
assert(rows[0].hubspot_id === '101', 'id');
assert(rows[0].first_name === 'Ada', 'first');
assert(rows[0].last_name === '', 'dropped dot');
assert(rows[0].phone === '+85291234567', 'phone');
assert(rows[0].address.indexOf('The Morgan') >= 0, 'full address');
assert(rows[0].address_line1 === 'Flat 12A', 'line1');
assert(rows[0].address_street === '31 Conduit Road', 'street');
assert(rows[0].address_place === 'Mid-Levels', 'place');
assert(rows[0].address_territory === 'Hong Kong Island', 'territory');
assert(rows[0].deals === 2, 'deals');
assert(rows[0].revenue === 3400, 'revenue');
assert(!Object.prototype.hasOwnProperty.call(rows[0], 'email'), 'no extra cols');
assert(headerIndex(parseCsv(csv)[0]).hubspot_id === 0, 'record id col');
assert(rows[1].last_name === 'Wong', 'keep Wong');
console.log('ok');
