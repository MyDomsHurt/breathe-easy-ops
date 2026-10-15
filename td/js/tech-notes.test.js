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
    'td/css/' + name,
    '../' + name,
    '../td/' + name,
    '../td/css/' + name,
    '../css/' + name,
    'firestore.rules',
    '../firestore.rules',
    'storage.rules',
    '../storage.rules',
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
const css = readSrc('app.css');

const box = fnBody(src, 'techNotesBoxHtml');
assert(box.indexOf('Technician notes') !== -1, '1 technician notes heading');
assert(box.indexOf('<textarea') !== -1, '1 text area');
assert(box.indexOf('techNotesSave') !== -1, '1 Save');
assert(box.indexOf('techNotesLogBtn') === -1, '1 no Notes button');
assert(box.indexOf('>Notes<') === -1, '1 Notes button removed');
assert(box.indexOf('techNotesHistoryBtn') !== -1, '1 notebook icon opens history');
assert(box.indexOf('tech-notes-history-icon') !== -1, '1 notebook svg');
assert(box.indexOf('tech-notes-heading') !== -1, '1 label and icon sit together');
assert(box.indexOf('Technician notes') < box.indexOf('techNotesHistoryBtn'), '1 icon sits immediately to the right of Technician notes');
assert(box.indexOf('tech-notes-heading') < box.indexOf('Technician notes'), '1 heading wraps the words');
assert(box.indexOf('techNotesHistoryBtn') < box.indexOf('tech-notes-text'), '1 icon is not on the far side of the block');
assert(css.indexOf('.tech-notes-heading') !== -1, '1 heading css');
assert(css.indexOf('margin-right: auto') === -1, '1 label does not push the icon away');
assert(css.indexOf('margin-left: auto') === -1, '1 icon does not sit on the far side');
assert(box.indexOf('techNotesLog') !== -1, '1 log mount');
assert(box.indexOf('display:none') !== -1, '1 closed log is hidden');
assert(box.indexOf('tech-note-item') === -1, '1 closed box does not list notes');
assert(box.indexOf('photo') === -1, '1 no photo button');
assert(box.indexOf('type="file"') !== -1, '1 file input on the box');
assert(box.indexOf('id="techNotesFile"') !== -1, '1 one file input');
assert(box.indexOf('multiple') !== -1, '1 file input accepts multiple files');
assert(box.indexOf('id="techNotesFile"') < box.indexOf('id="techNotesProgress"'), '1 file then progress');
assert(box.indexOf('id="techNotesProgress"') !== -1, '1 progress bar on the box');
assert(box.indexOf('id="techNotesProgressBar"') !== -1, '1 bar fill');
assert(box.indexOf('id="techNotesProgress"') < box.indexOf('techNotesSave'), '1 progress bar stays above Save');
assert(box.indexOf('tech-notes-save-row') !== -1, '1 compact Save row');
assert(box.indexOf('id="techNotesFile"') < box.indexOf('techNotesSave'), '1 Save sits under the file input');
assert(css.indexOf('.tech-notes-save-row') !== -1 && css.indexOf('justify-content: flex-end') !== -1, '1 Save is right-aligned');
assert(box.indexOf('id="techNotesProgress"') < box.indexOf('id="techNotesLog"'), '1 bar sits on the box');
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
assert(bindFn.indexOf('fileEl.value = ') !== -1, '2 file input clears on success');
assert(bindFn.indexOf("'Saved'") !== -1, '2 Saved state shows');
assert(bindFn.indexOf("saveBtn.textContent = 'Save'") !== -1, '2 Saved then clears');
assert(bindFn.indexOf('loadTechNotes') !== -1, '2 history loads that client');
assert(bindFn.indexOf('loadTechNotes(job') !== -1, '2 history uses the job');
assert(bindFn.indexOf('techNotesHistoryBtn') !== -1, '2 notebook icon opens the history');
assert(bindFn.indexOf('paintTechNoteHistoryMark') !== -1, '2 notebook icon highlights when the history has notes');
assert(fnBody(src, 'paintTechNoteHistoryMark').indexOf('has-notes') !== -1, '2 has-notes class');
assert(bindFn.indexOf('closeTechNotesLog') !== -1, '2 close tucks the log away');
assert(bindFn.indexOf('loadTechNote(') === -1, '2 does not fill the box from a replaced doc');
assert(bindFn.indexOf('writeTechNote') !== -1, '2 writes the note document first');
assert(bindFn.indexOf('uploadTechNoteFiles') !== -1, '2 then uploads every file');
assert(bindFn.indexOf('writeTechNote') < bindFn.indexOf('uploadTechNoteFiles'), '2 note first, then Storage');
assert(bindFn.indexOf('addTechNoteFiles') !== -1, '2 then the files array');
assert(bindFn.indexOf('uploadTechNoteFiles') < bindFn.indexOf('addTechNoteFiles'), '2 files array after Storage');
assert(bindFn.indexOf('resume') === -1, '2 no resume after the sheet closes');
assert(bindFn.indexOf('showTechNoteProgress') !== -1, '2 bar shows while the file uploads');
assert(bindFn.indexOf('hideTechNoteProgress') !== -1, '2 bar hides when the upload finishes or fails');
print('ok 2 Save adds a note; box clears; week stays off this note');

eval(
  fnBody(src, 'esc') + '\n' +
  fnBody(src, 'techNotePayload') + '\n' +
  fnBody(src, 'techNotesNewestFirst') + '\n' +
  fnBody(src, 'techNoteAtLabel') + '\n' +
  fnBody(src, 'techNoteFilesOnNote') + '\n' +
  fnBody(src, 'techNoteFileIsImage') + '\n' +
  fnBody(src, 'techNoteFilesHtml') + '\n' +
  fnBody(src, 'techNotePhoneKey') + '\n' +
  fnBody(src, 'techNoteAddressKey') + '\n' +
  fnBody(src, 'techNoteSameClient') + '\n' +
  fnBody(src, 'techNoteIsVisitJob') + '\n' +
  fnBody(src, 'techNoteClientJobIds') + '\n' +
  fnBody(src, 'techNoteAuthorName') + '\n' +
  fnBody(src, 'techNoteJobById') + '\n' +
  fnBody(src, 'techNoteJobAddress') + '\n' +
  fnBody(src, 'techNoteJobIsReturn') + '\n' +
  fnBody(src, 'liveAcsBadges') + '\n' +
  fnBody(src, 'techNoteLogItemHtml') + '\n' +
  fnBody(src, 'techNoteLogHtml') + '\n' +
  'globalThis.__techNotePayload = techNotePayload;\n' +
  'globalThis.__techNoteAtLabel = techNoteAtLabel;\n' +
  'globalThis.__techNoteLogHtml = techNoteLogHtml;\n' +
  'globalThis.__techNoteClientJobIds = techNoteClientJobIds;\n' +
  'globalThis.__techNoteSameClient = techNoteSameClient;\n' +
  'globalThis.__techNoteAuthorName = techNoteAuthorName;\n'
);

const poon = {
  job_id: '2026-10-14-matthew-poon',
  team_lead: 'Matthew',
  notes: 'call first',
  client_name: 'Poon Kit Tung',
  mobile: '+85261112222',
  address: '88 Foo Road, Tai Po (N-T)',
  acs: '1B'
};
const poonPrior = {
  job_id: '2026-09-01-matthew-poon',
  team_lead: 'Matthew',
  client_name: 'Poon Kit Tung',
  mobile: '61112222',
  address: '12 Old Street'
};
const otherClient = {
  job_id: '2026-10-14-matthew-other',
  team_lead: 'Matthew',
  client_name: 'Someone Else',
  mobile: '+85299998888',
  address: '1 Other Road'
};
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
const clientIds = globalThis.__techNoteClientJobIds(poon, [poon, poonPrior, otherClient]);
assert(clientIds.indexOf(poon.job_id) !== -1, '3 this job is in history');
assert(clientIds.indexOf(poonPrior.job_id) !== -1, '3 prior visit matched by phone');
assert(clientIds.indexOf(otherClient.job_id) === -1, '3 other client is out');
assert(globalThis.__techNoteSameClient(poon, { job_id: 'addr', address: poon.address, mobile: '' }) === true, '3 prior visit matched by address');
print('ok 3 Poon Kit Tung: add, clear fields, newest first, closed log empty');

const itemFn = fnBody(src, 'techNoteLogItemHtml');
assert(itemFn.indexOf('techNoteAtLabel') !== -1, '6 open log uses at');
assert(itemFn.indexOf('Asia/Hong_Kong') !== -1 || fnBody(src, 'techNoteAtLabel').indexOf('Asia/Hong_Kong') !== -1, '6 Asia/Hong_Kong');
assert(globalThis.__techNoteAtLabel('2026-10-14T05:00:00.000Z') === '14 Oct, 13:00', '6 14 Oct, 13:00');
assert(globalThis.__techNoteAuthorName('jefflamb1992@gmail.com') === 'Admin', '6 jefflamb1992 is Admin');
assert(globalThis.__techNoteAuthorName('info@breathe-easyhk.com') === 'Customer Service', '6 info is Customer Service');
assert(globalThis.__techNoteAuthorName('ruby@breathe-easyhk.com') === 'Ruby', '6 ruby is Ruby');
assert(globalThis.__techNoteAuthorName('joshua@breathe-easyhk.com') === 'Josh', '6 joshua is Josh');
assert(globalThis.__techNoteAuthorName('perry@breathe-easyhk.com') === 'Perry', '6 perry is Perry');
assert(globalThis.__techNoteAuthorName('iggi.king@gmail.com') === 'Iggi', '6 iggi.king is Iggi');
assert(globalThis.__techNoteAuthorName('matthewgross2001@gmail.com') === 'Matthew', '6 matthewgross2001 is Matthew');
assert(globalThis.__techNoteAuthorName('n.marie.lamb@gmail.com') === 'Naiyie', '6 n.marie.lamb is Naiyie');
assert(globalThis.__techNoteAuthorName('neltrestium@gmail.com') === 'Nick', '6 neltrestium is Nick');
assert(globalThis.__techNoteAuthorName('sudor23@gmail.com') === 'Alun', '6 sudor23 is Alun');
assert(globalThis.__techNoteAuthorName('tiagogiri334@gmail.com') === 'Tiago', '6 tiagogiri334 is Tiago');
const noon = globalThis.__techNotePayload(poon, 'gate left open', 'matthewgross2001@gmail.com', '2026-10-14T05:00:00.000Z');
const priorNote = {
  author: 'matthewgross2001@gmail.com',
  job_id: poonPrior.job_id,
  text: 'old gate code',
  at: '2026-09-01T04:00:00.000Z'
};
const poonReturn = {
  job_id: '2026-08-01-matthew-poon',
  team_lead: 'Matthew',
  client_name: 'Poon Kit Tung',
  mobile: '+85261112222',
  address: '88 Foo Road, Tai Po (N-T)',
  is_return: true
};
const returnNote = {
  author: 'iggi.king@gmail.com',
  job_id: poonReturn.job_id,
  text: 'leak back',
  at: '2026-08-01T04:00:00.000Z'
};
const openLog = globalThis.__techNoteLogHtml([noon, priorNote, returnNote], [poon, poonPrior, poonReturn]);
assert(openLog.indexOf('14 Oct, 13:00') !== -1, '6 saved note shows the date and the minute');
assert(openLog.indexOf('gate left open') !== -1, '6 note text stays');
assert(openLog.indexOf('14 Oct, 13:00') < openLog.indexOf('gate left open'), '6 time sits on the note');
assert(openLog.indexOf('Matthew') !== -1, '6 each note shows the name');
assert(openLog.indexOf('matthewgross2001@gmail.com') === -1, '6 no email');
assert(openLog.indexOf('@') === -1, '6 no email address');
assert(openLog.indexOf('88 Foo Road') !== -1, '6 each note shows the address');
assert(openLog.indexOf('live-u') !== -1 && openLog.indexOf('1B') !== -1, '6 each note shows the unit badges');
assert(openLog.indexOf('tech-note-return') !== -1 && openLog.indexOf('Return') !== -1, '6 a return shows a return badge');
assert(openLog.indexOf('Iggi') !== -1, '6 return note shows Iggi');
assert(openLog.indexOf(poon.job_id) !== -1, '6 each note shows the job ID');
assert(openLog.indexOf('old gate code') !== -1, '6 notes from prior visits appear');
assert(openLog.indexOf(poonPrior.job_id) !== -1, '6 prior visit job ID');
assert(openLog.indexOf('gate left open') < openLog.indexOf('old gate code'), '6 newest first across visits');
assert(fnBody(src, 'techNoteLogHtml').indexOf('techNotesNewestFirst') !== -1, '6 text log order stays newest first');
assert(closed.indexOf('14 Oct, 13:00') === -1, '6 closed sheet does not list the time');
assert(closed.indexOf('tech-note-item') === -1, '6 closed sheet does not list notes');
assert(fnBody(src, 'loadTechNotes').indexOf('fetchTechNotes') !== -1, '6 history loads this job and prior visits');
assert(fnBody(src, 'paintTechNoteHistoryMark').indexOf('has-notes') !== -1, '6 notebook icon highlights if notes exist');
assert(css.indexOf('.tech-notes-history-btn.has-notes') !== -1, '6 highlight css');
assert(fnBody(src, 'uploadTechNoteFile').indexOf("technician_notes/'") !== -1, '6 upload path stays');
assert(fnBody(src, 'writeTechNote').indexOf("collection('jobs')") === -1, '6 does not write the job');
assert(box.indexOf('id="techNotesFile"') < box.indexOf('techNotesSave'), '6 Save placement stays');
print('ok 6 Poon Kit Tung: notebook highlights if notes exist; each note shows name, address, unit badges; no email');

const uploadBody = fnBody(src, 'uploadTechNoteFile');
assert(uploadBody.indexOf("technician_notes/'") !== -1, '9 upload path stays');
assert(uploadBody.indexOf('.put(file)') !== -1, '9 still puts the whole file');
assert(uploadBody.indexOf("state_changed") !== -1, '9 listens for progress');
assert(uploadBody.indexOf('bytesTransferred') !== -1, '9 fills with the percentage');
const multiFn = fnBody(src, 'uploadTechNoteFiles');
assert(multiFn.indexOf('uploadTechNoteFile') !== -1, '9 uploads every file through the path');
assert(multiFn.indexOf('techNoteFilesProgress') !== -1, '9 overall percentage across the files');
assert(multiFn.indexOf('Promise.all') !== -1, '9 waits for every file');
assert(bindFn.indexOf('writeTechNote') < bindFn.indexOf('showTechNoteProgress'), '9 note still writes first');
assert(bindFn.indexOf('writeTechNote') < bindFn.indexOf('uploadTechNoteFiles'), '9 then upload every file');
assert(bindFn.indexOf('uploadTechNoteFiles') < bindFn.indexOf('addTechNoteFiles'), '9 files array after all files are in Storage');
assert(fnBody(src, 'techNoteLogHtml').indexOf('techNotesNewestFirst') !== -1, '9 notes log order stays');
assert(itemFn.indexOf('techNoteFilesHtml') !== -1, '9 notes log still shows files under the note');
eval(fnBody(src, 'techNoteFilesProgress') + '\nglobalThis.__techNoteFilesProgress = techNoteFilesProgress;\n');
assert(globalThis.__techNoteFilesProgress([50, 50], [100, 100]) === 50, '9 bar is overall across the set');
assert(globalThis.__techNoteFilesProgress([100, 300], [100, 300]) === 100, '9 bar fills for the set');
assert(globalThis.__techNoteFilesProgress([100, 0], [100, 100]) === 50, '9 half the set is 50');
const poonFileLog = globalThis.__techNoteLogHtml([{
  author: first.author,
  job_id: poon.job_id,
  text: first.text,
  at: '2026-10-14T05:00:00.000Z',
  files: [
    { id: 'poon-1', name: 'gate.jpg', size: 10, type: 'image/jpeg', url: 'https://example.test/poon1.jpg' },
    { id: 'poon-2', name: 'door.jpg', size: 12, type: 'image/jpeg', url: 'https://example.test/poon2.jpg' }
  ]
}]);
assert(poonFileLog.indexOf('gate left open') !== -1, '9 Poon Kit Tung note appears');
assert(poonFileLog.indexOf('tech-note-thumb') !== -1, '9 Poon Kit Tung files appear');
assert(poonFileLog.indexOf('https://example.test/poon1.jpg') !== -1, '9 first photo in the log');
assert(poonFileLog.indexOf('https://example.test/poon2.jpg') !== -1, '9 second photo in the log');
assert(bindFn.indexOf('loadTechNotes') !== -1, '9 note and files appear when they finish');
assert(bindFn.indexOf("ta.value = ''") !== -1, '9 box clears when all finish');
print('ok 9 Poon Kit Tung: pick two photos and Save; both appear in the log; the bar fills for the set');

const jenny = { job_id: '2026-10-14-matthew-jenny', team_lead: 'Matthew', notes: 'side gate', client_name: 'Jenny Ho' };
const jennyNote = globalThis.__techNotePayload(jenny, 'gate code 1234', 'jefflamb1992@gmail.com', '2026-10-14T05:00:00.000Z');
assert(jennyNote && jennyNote.text === 'gate code 1234', '7 Jenny Ho note text');
assert(jennyNote.job_id === '2026-10-14-matthew-jenny', '7 Jenny Ho job_id');
assert(box.indexOf('Technician notes') < box.indexOf('techNotesHistoryBtn'), '7 Jenny Ho notebook icon is right beside Technician notes');
assert(box.indexOf('tech-notes-heading') !== -1, '7 Jenny Ho icon sits with the label');
assert(css.indexOf('margin-left: auto') === -1, '7 Jenny Ho icon is not on the far side of the block');
assert(box.indexOf('id="techNotesFile"') < box.indexOf('techNotesSave'), '7 Save placement stays under the file input');
assert(fnBody(src, 'fetchTechNotes').indexOf('techNoteClientJobIds') !== -1, '7 history stays');
const jennyLog = globalThis.__techNoteLogHtml([jennyNote]);
assert(jennyLog.indexOf('gate code 1234') !== -1, '7 the note appears in the log');
assert(jennyLog.indexOf('14 Oct, 13:00') !== -1, '7 log time stays');
const uploadFn = fnBody(src, 'uploadTechNoteFile');
assert(uploadFn.indexOf("technician_notes/'") !== -1, '7 Storage path technician_notes/');
assert(uploadFn.indexOf('jobId') !== -1 && uploadFn.indexOf('fileId') !== -1, '7 technician_notes/{job_id}/{fileId}');
assert(uploadFn.indexOf('.put(file)') !== -1, '7 whole file is in Storage');
const fileRefFn = fnBody(src, 'techNoteFileRef');
assert(fileRefFn.indexOf('id:') !== -1, '7 file ref id');
assert(fileRefFn.indexOf('name:') !== -1, '7 file ref name');
assert(fileRefFn.indexOf('size:') !== -1, '7 file ref size');
assert(fileRefFn.indexOf('type:') !== -1, '7 file ref type');
const attachFn = fnBody(src, 'addTechNoteFiles');
assert(attachFn.indexOf('techNotesCol') !== -1, '7 files array uses techNotesCol');
assert(attachFn.indexOf('.update({ files: fileRefs })') !== -1, '7 files array on that note document');
assert(fnBody(src, 'closeModal').indexOf('resume') === -1, '7 no resume after the sheet closes');
assert(fnBody(src, 'closeModal').indexOf('uploadTechNoteFile') === -1, '7 close does not resume the upload');
print('ok 7 Jenny Ho: save a note with one file; note in the log; file under technician_notes/{job_id}/');

const jennyImg = {
  author: jennyNote.author,
  job_id: jennyNote.job_id,
  text: jennyNote.text,
  at: jennyNote.at,
  file: { id: 'file-1', name: 'gate.jpg', size: 2048, type: 'image/jpeg', url: 'https://example.test/gate.jpg' }
};
const jennyPdf = {
  author: jennyNote.author,
  job_id: jennyNote.job_id,
  text: 'quote on the door',
  at: '2026-10-14T04:00:00.000Z',
  file: { id: 'file-2', name: 'quote.pdf', size: 100, type: 'application/pdf', url: 'https://example.test/quote.pdf' }
};
const jennyOpen = globalThis.__techNoteLogHtml([jennyPdf, jennyImg]);
assert(jennyOpen.indexOf('gate code 1234') !== -1, '8 Jenny Ho note text stays');
assert(jennyOpen.indexOf('gate.jpg') !== -1 || jennyOpen.indexOf('tech-note-thumb') !== -1, '8 files from that job show');
assert(jennyOpen.indexOf('class="tech-note-thumb"') !== -1, '8 image has a thumbnail');
assert(jennyOpen.indexOf('src="https://example.test/gate.jpg"') !== -1, '8 thumbnail src');
assert(jennyOpen.indexOf('download="gate.jpg"') !== -1, '8 tap downloads the file');
assert(jennyOpen.indexOf('gate code 1234') < jennyOpen.indexOf('tech-note-thumb'), '8 files sit under their note');
assert(jennyOpen.indexOf('quote.pdf') !== -1, '8 non-image is a name label');
assert(jennyOpen.indexOf('class="tech-note-file-name"') !== -1, '8 label with the name');
assert(jennyOpen.indexOf('download="quote.pdf"') !== -1, '8 tap downloads a non-image');
assert(jennyOpen.indexOf('gate code 1234') < jennyOpen.indexOf('quote on the door'), '8 newest notes first');
const loadFn = fnBody(src, 'loadTechNotes');
assert(loadFn.indexOf('attachTechNoteFileUrls') !== -1, '8 open log loads file urls');
assert(fnBody(src, 'techNoteFileUrl').indexOf('getDownloadURL') !== -1, '8 tap uses the download url');
assert(fnBody(src, 'uploadTechNoteFile').indexOf("technician_notes/'") !== -1, '8 upload path stays');
assert(css.indexOf('.tech-note-thumb') !== -1, '8 thumbnail css');
assert(css.indexOf('.tech-note-file-name') !== -1, '8 name label css');
print('ok 8 Jenny Ho open Notes: files show with thumbnails; tap downloads the file');

const techBlock = rules.slice(rules.indexOf('match /technician_notes'), rules.indexOf('match /technician_notes') + 1200);
assert(rules.indexOf('match /technician_notes/{noteId}') !== -1, '4 technician_notes rule');
assert(techBlock.indexOf('isOffice()') !== -1 && techBlock.indexOf('isJosh()') !== -1, '4 office or Josh may read and write any');
assert(techBlock.indexOf('allow write: if isOffice() || isJosh()') !== -1, '4 office or Josh write any');
assert(techBlock.indexOf('isLead()') !== -1, '4 a lead may add');
assert(techBlock.indexOf('request.resource.data.author == email()') !== -1, '4 lead adds as themselves');
assert(techBlock.indexOf('resource.data.job_id') !== -1, '4 lead reads notes on a job');
assert(techBlock.indexOf('get(/databases/$(database)/documents/jobs/$(resource.data.job_id)).data.team_lead == leadName()') !== -1, '4 lead reads notes on their jobs');
assert(techBlock.indexOf('get(/databases/$(database)/documents/jobs/$(request.resource.data.job_id)).data.team_lead == leadName()') !== -1, '4 lead adds on their jobs');
assert(techBlock.indexOf('allow update: if isLead()') !== -1, '4 lead may add the file ref');
assert(rules.indexOf('The app does not deploy rules') !== -1, '4 Jeff publishes the rules');
print('ok 4 firestore.rules: lead add as themselves; read on their jobs; office or Josh any');

const storageRules = readSrc('storage.rules');
assert(storageRules.indexOf('match /technician_notes/{jobId}/{fileId}') !== -1, '4 storage technician_notes/{job_id}/{fileId}');
assert(storageRules.indexOf('The app does not deploy rules') !== -1, '4 Jeff publishes storage rules');
print('ok 4b storage.rules: technician_notes/{jobId}/{fileId}');

assert(html.indexOf('js/app.js?v=69') !== -1, '5 js cache');
assert(html.indexOf('css/app.css?v=55') !== -1, '5 css cache');
assert(html.indexOf('firebase-firestore-compat.js') !== -1, '5 Firebase compat on the page');
assert(html.indexOf('firebase-storage-compat.js') !== -1, '5 Storage SDK on the page');
print('ok 5 cache js/app.js?v=69 css/app.css?v=55');

print('ok tech-notes cases');
