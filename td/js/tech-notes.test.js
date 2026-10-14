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
assert(box.indexOf('techNotesLogBtn') !== -1, '1 log button');
assert(box.indexOf('techNotesLog') !== -1, '1 log mount');
assert(box.indexOf('display:none') !== -1, '1 closed log is hidden');
assert(box.indexOf('tech-note-item') === -1, '1 closed box does not list notes');
assert(box.indexOf('photo') === -1, '1 no photo button');
const bodyFn = fnBody(src, 'modalBodyHtml');
assert(bodyFn.indexOf('modalNotesHtml') !== -1, '1 office notes');
assert(bodyFn.indexOf('techNotesBoxHtml') !== -1, '1 technician box in the sheet');
assert(bodyFn.indexOf('modalNotesHtml') < bodyFn.indexOf('techNotesBoxHtml'), '1 technician notes under office notes');
print('ok 1 Technician notes box under office notes; log closed');

const payloadFn = fnBody(src, 'techNotePayload');
assert(payloadFn.indexOf('author:') !== -1, '2 writes author');
assert(payloadFn.indexOf('job_id:') !== -1, '2 writes job_id');
assert(payloadFn.indexOf('text:') !== -1, '2 writes text');
assert(payloadFn.indexOf('at:') !== -1, '2 writes at');
assert(payloadFn.indexOf('team_lead:') === -1, '2 no team_lead on the note');
assert(payloadFn.indexOf('by:') === -1, '2 no by field');
const writeFn = fnBody(src, 'writeTechNote');
assert(writeFn.indexOf("collection('technician_notes')") !== -1 || src.indexOf("collection('technician_notes')") !== -1, '2 technician_notes collection');
assert(writeFn.indexOf('.add(payload)') !== -1, '2 Save adds a note document');
assert(writeFn.indexOf('.set(payload)') === -1, '2 does not replace');
assert(writeFn.indexOf('.doc(') === -1, '2 add does not replace a job-id doc');
assert(writeFn.indexOf("collection('jobs')") === -1, '2 does not write the job');
assert(writeFn.indexOf('updateJob') === -1, '2 no updateJob');
assert(src.indexOf('function vanRequestText') !== -1, '2 vanRequestText stays');
const cardBody = src.slice(src.indexOf('function jobCard'), src.indexOf('function bindCardClicks'));
assert(cardBody.indexOf('technician_notes') === -1, '2 week does not read this note');
assert(cardBody.indexOf('techNotes') === -1, '2 week card has no technician box');
const bindFn = fnBody(src, 'bindTechNotes');
assert(bindFn.indexOf("ta.value = ''") !== -1, '2 box clears');
assert(bindFn.indexOf("'Saved'") !== -1, '2 Saved state shows');
assert(bindFn.indexOf("saveBtn.textContent = 'Save'") !== -1, '2 Saved then clears');
assert(bindFn.indexOf('loadTechNotes') !== -1, '2 log loads that job');
assert(bindFn.indexOf('closeTechNotesLog') !== -1, '2 close tucks the log away');
assert(bindFn.indexOf('loadTechNote(') === -1, '2 does not fill the box from a replaced doc');
print('ok 2 Save adds a note; box clears; week stays off this note');

eval(
  fnBody(src, 'esc') + '\n' +
  fnBody(src, 'techNotePayload') + '\n' +
  fnBody(src, 'techNotesNewestFirst') + '\n' +
  fnBody(src, 'techNoteLogItemHtml') + '\n' +
  fnBody(src, 'techNoteLogHtml') + '\n' +
  'globalThis.__techNotePayload = techNotePayload;\n' +
  'globalThis.__techNoteLogHtml = techNoteLogHtml;\n'
);

const poon = { job_id: '2026-10-14-matthew-poon', team_lead: 'Matthew', notes: 'call first', client_name: 'Poon Kit Tung' };
assert(globalThis.__techNotePayload(poon, '   ', 'matthewgross2001@gmail.com') == null, '3 empty save does nothing');
assert(globalThis.__techNotePayload(poon, '', 'matthewgross2001@gmail.com') == null, '3 blank save does nothing');
const first = globalThis.__techNotePayload(poon, 'gate left open', 'matthewgross2001@gmail.com', '2026-10-14T01:00:00.000Z');
assert(first && first.text === 'gate left open', '3 first note text');
assert(first.author === 'matthewgross2001@gmail.com', '3 author');
assert(first.job_id === '2026-10-14-matthew-poon', '3 job_id');
assert(first.at === '2026-10-14T01:00:00.000Z', '3 at');
assert(first.team_lead == null, '3 no team_lead on the document');
const again = globalThis.__techNotePayload(poon, 'pin at the door', 'matthewgross2001@gmail.com', '2026-10-14T02:00:00.000Z');
assert(again.text === 'pin at the door', '3 second note is its own document');
assert(again.job_id === first.job_id, '3 same job');
assert(again.at !== first.at, '3 does not replace');
assert(poon.notes === 'call first', '3 office notes are unchanged');
const log = globalThis.__techNoteLogHtml([first, again]);
assert(log.indexOf('pin at the door') !== -1, '3 log has the later note');
assert(log.indexOf('gate left open') !== -1, '3 log has the earlier note');
assert(log.indexOf('pin at the door') < log.indexOf('gate left open'), '3 newest first');
const closed = fnBody(src, 'techNotesBoxHtml');
assert(closed.indexOf('gate left open') === -1, '3 closed sheet does not list the note');
assert(closed.indexOf('pin at the door') === -1, '3 closed sheet does not list the later note');
print('ok 3 Poon Kit Tung: add, clear fields, newest first, closed log empty');

const techBlock = rules.slice(rules.indexOf('match /technician_notes'), rules.indexOf('match /technician_notes') + 1200);
assert(rules.indexOf('match /technician_notes/{noteId}') !== -1, '4 technician_notes rule');
assert(techBlock.indexOf('isOffice()') !== -1 && techBlock.indexOf('isJosh()') !== -1, '4 office or Josh may read and write any');
assert(techBlock.indexOf('allow write: if isOffice() || isJosh()') !== -1, '4 office or Josh write any');
assert(techBlock.indexOf('isLead()') !== -1, '4 a lead may add');
assert(techBlock.indexOf('request.resource.data.author == email()') !== -1, '4 lead adds as themselves');
assert(techBlock.indexOf('resource.data.job_id') !== -1, '4 lead reads notes on a job');
assert(techBlock.indexOf('get(/databases/$(database)/documents/jobs/$(resource.data.job_id)).data.team_lead == leadName()') !== -1, '4 lead reads notes on their jobs');
assert(techBlock.indexOf('get(/databases/$(database)/documents/jobs/$(request.resource.data.job_id)).data.team_lead == leadName()') !== -1, '4 lead adds on their jobs');
assert(rules.indexOf('The app does not deploy rules') !== -1, '4 Jeff publishes the rules');
print('ok 4 firestore.rules: lead add as themselves; read on their jobs; office or Josh any');

assert(html.indexOf('js/app.js?v=52') !== -1, '5 js cache');
assert(html.indexOf('css/app.css?v=50') !== -1, '5 css cache stays');
assert(html.indexOf('firebase-firestore-compat.js') !== -1, '5 Firebase compat on the page');
print('ok 5 cache js/app.js?v=52');

print('ok tech-notes cases');
