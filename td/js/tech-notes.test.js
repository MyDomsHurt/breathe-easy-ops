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
    'firestore.rules',
    '../firestore.rules',
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
const rules = readSrc('firestore.rules');

const box = fnBody(src, 'techNotesBoxHtml');
assert(box.indexOf('Technician notes') !== -1, '1 technician notes heading');
assert(box.indexOf('<textarea') !== -1, '1 text area');
assert(box.indexOf('techNotesSave') !== -1, '1 Save');
assert(box.indexOf('photo') === -1, '1 no photo button');
const bodyFn = fnBody(src, 'modalBodyHtml');
assert(bodyFn.indexOf('modalNotesHtml') !== -1, '1 office notes');
assert(bodyFn.indexOf('techNotesBoxHtml') !== -1, '1 technician box in the sheet');
assert(bodyFn.indexOf('modalNotesHtml') < bodyFn.indexOf('techNotesBoxHtml'), '1 technician notes under office notes');
print('ok 1 Technician notes box under office notes');

const payloadFn = fnBody(src, 'techNotePayload');
assert(payloadFn.indexOf('text:') !== -1, '2 writes text');
assert(payloadFn.indexOf('by:') !== -1, '2 writes by');
assert(payloadFn.indexOf('at:') !== -1, '2 writes at');
assert(payloadFn.indexOf('team_lead:') !== -1, '2 writes team_lead');
const writeFn = fnBody(src, 'writeTechNote');
assert(writeFn.indexOf("collection('technician_notes')") !== -1 || src.indexOf("collection('technician_notes')") !== -1, '2 technician_notes collection');
assert(writeFn.indexOf('.set(payload)') !== -1, '2 Save replaces the note');
assert(writeFn.indexOf("collection('jobs')") === -1, '2 does not write the job');
assert(writeFn.indexOf('updateJob') === -1, '2 no updateJob');
assert(src.indexOf('function vanRequestText') !== -1, '2 vanRequestText stays');
const cardBody = src.slice(src.indexOf('function jobCard'), src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('technician_notes') === -1, '2 week does not read this note');
assert(cardBody.indexOf('techNotes') === -1, '2 week card has no technician box');
print('ok 2 save writes technician_notes only; week stays off this note');

eval(
  fnBody(src, 'techNotePayload') + '\n' +
  'globalThis.__techNotePayload = techNotePayload;\n'
);

const jenny = { job_id: '2026-10-14-matthew-jenny', team_lead: 'Matthew', notes: 'side gate', client_name: 'Jenny Ho' };
assert(globalThis.__techNotePayload(jenny, '   ', 'matthewgross2001@gmail.com') == null, '3 empty save does nothing');
assert(globalThis.__techNotePayload(jenny, '', 'matthewgross2001@gmail.com') == null, '3 blank save does nothing');
const first = globalThis.__techNotePayload(jenny, 'gate left open', 'matthewgross2001@gmail.com', '2026-10-14T01:00:00.000Z');
assert(first && first.text === 'gate left open', '3 first note text');
assert(first.by === 'matthewgross2001@gmail.com', '3 by');
assert(first.at === '2026-10-14T01:00:00.000Z', '3 at');
assert(first.team_lead === 'Matthew', '3 team_lead');
const again = globalThis.__techNotePayload(jenny, 'pin at the door', 'matthewgross2001@gmail.com', '2026-10-14T02:00:00.000Z');
assert(again.text === 'pin at the door', '3 Save replaces it');
assert(jenny.notes === 'side gate', '3 office notes are unchanged');
print('ok 3 Matthew note payload; empty save skips; office notes stay');

const techBlock = rules.slice(rules.indexOf('match /technician_notes'), rules.indexOf('match /technician_notes') + 800);
assert(rules.indexOf('match /technician_notes/{jobId}') !== -1, '4 technician_notes rule');
assert(techBlock.indexOf('isOffice()') !== -1 && techBlock.indexOf('isJosh()') !== -1, '4 office or Josh may write any');
assert(techBlock.indexOf('isLead()') !== -1, '4 a lead may write');
assert(techBlock.indexOf('team_lead == leadName()') !== -1, '4 lead team_lead matches');
assert(rules.indexOf('The app does not deploy rules') !== -1, '4 Jeff publishes the rules');
print('ok 4 firestore.rules: lead if team_lead matches; office or Josh any');

assert(html.indexOf('js/app.js?v=51') !== -1, '5 js cache');
assert(html.indexOf('css/app.css?v=50') !== -1, '5 css cache stays');
assert(html.indexOf('firebase-firestore-compat.js') !== -1, '5 Firebase compat on the page');
print('ok 5 cache js/app.js?v=51');

print('ok tech-notes cases');
