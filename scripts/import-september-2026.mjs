#!/usr/bin/env node
/**
 * One-shot: load the approved September 2026 glance JSON into Firestore jobs.
 *
 *   node scripts/import-september-2026.mjs --file <json>           # dry-run
 *   node scripts/import-september-2026.mjs --file <json> --apply   # writes
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (service account JSON). No key in the repo.
 * firebase-admin lives under scripts/ (`cd scripts && npm install`).
 *
 * Do not commit the JSON. Do not send crew notes through store.importJobs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadGlance, softDeleteIds, SEP_FROM, SEP_TO } from './september-glance.js';

const PROJECT = 'breathe-easy-performance';
const COLLECTION = 'jobs';
const BATCH_LIMIT = 400;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  let file = '';
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--file') {
      file = argv[i + 1] || '';
      i += 1;
    } else if (a.startsWith('--file=')) file = a.slice('--file='.length);
  }
  return { file, apply };
}

async function openFirestore() {
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!cred) {
    die('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path. Do not put the key in the repo.');
  }
  let initializeApp;
  let applicationDefault;
  let getApps;
  let getFirestore;
  try {
    ({ initializeApp, applicationDefault, getApps } = await import('firebase-admin/app'));
    ({ getFirestore } = await import('firebase-admin/firestore'));
  } catch (err) {
    die('firebase-admin is missing. Run: cd scripts && npm install\n' + ((err && err.message) || err));
  }
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT,
    });
  }
  return getFirestore();
}

async function listLiveSeptember(db) {
  const snap = await db.collection(COLLECTION)
    .where('date', '>=', SEP_FROM)
    .where('date', '<=', SEP_TO)
    .get();
  return snap.docs.map((doc) => {
    const data = doc.data() || {};
    return { ...data, job_id: data.job_id || doc.id };
  });
}

async function commitInChunks(db, writers) {
  for (let i = 0; i < writers.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = writers.slice(i, i + BATCH_LIMIT);
    for (const write of chunk) write(batch);
    await batch.commit();
  }
}

function toDoc(job) {
  const out = {};
  Object.keys(job || {}).forEach((key) => {
    const value = job[key];
    if (value === undefined) return;
    out[key] = value;
  });
  return out;
}

async function applyWrites(db, jobs, crew, deleteIds) {
  const col = db.collection(COLLECTION);
  const deletes = deleteIds.map((id) => (batch) => {
    batch.set(col.doc(String(id)), { deleted: true }, { merge: true });
  });
  const upserts = jobs.map((job) => (batch) => {
    batch.set(col.doc(String(job.job_id)), toDoc(job), { merge: true });
  });
  const notes = crew.map((note) => (batch) => {
    batch.set(col.doc(String(note.job_id)), {
      job_id: note.job_id,
      date: note.date,
      team_lead: note.team_lead,
      team_members: note.team_members,
      source: note.source,
      deleted: false,
    }, { merge: true });
  });
  await commitInChunks(db, deletes);
  await commitInChunks(db, upserts);
  await commitInChunks(db, notes);
}

async function main() {
  const { file, apply } = parseArgs(process.argv.slice(2));
  if (!file) {
    die('Usage: node scripts/import-september-2026.mjs --file <json> [--apply]');
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) die('File not found: ' + abs);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    die('Could not read JSON: ' + ((err && err.message) || err));
  }
  const { jobs, crew } = loadGlance(data);
  const db = await openFirestore();
  const live = await listLiveSeptember(db);
  const deletes = softDeleteIds(live, jobs.map((j) => j.job_id));
  if (apply) {
    await applyWrites(db, jobs, crew, deletes);
    console.log('apply');
    console.log(jobs.length + ' job upserts');
    console.log(crew.length + ' crew upserts');
    console.log(deletes.length + ' live September jobs soft-deleted');
  } else {
    console.log('dry-run');
    console.log(jobs.length + ' job upserts');
    console.log(crew.length + ' crew upserts');
    console.log(deletes.length + ' live September jobs would be soft-deleted');
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
