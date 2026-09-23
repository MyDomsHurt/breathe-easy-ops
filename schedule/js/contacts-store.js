/**
 * Firestore contacts store. Separate collection from jobs.
 * Office + Josh only. Jeff-only import is gated in the UI.
 */

import { CONTACTS_COLLECTION } from '../../shared/firebase-config.js';
import { normalizeContact } from '../../shared/contact.js';

const BATCH_LIMIT = 400;

let list = [];
let unsub = null;
const listeners = new Set();

function col() {
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
    throw new Error('Firebase Firestore SDK is not loaded');
  }
  if (!firebase.apps.length) {
    throw new Error('Firebase is not initialised');
  }
  return firebase.firestore().collection(CONTACTS_COLLECTION);
}

function toDoc(c) {
  const out = {};
  Object.keys(c || {}).forEach((key) => {
    const value = c[key];
    if (value === undefined) return;
    out[key] = value;
  });
  return out;
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(list); } catch (err) { console.error(err); }
  });
}

export function allContacts() {
  return list.slice();
}

export function subscribeContacts(fn) {
  if (typeof fn === 'function') listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usingContactsFirestore() {
  try {
    return typeof firebase !== 'undefined'
      && firebase.apps
      && firebase.apps.length
      && typeof firebase.firestore === 'function';
  } catch {
    return false;
  }
}

export function initContactsStore() {
  if (unsub) return Promise.resolve(list);
  if (!usingContactsFirestore()) {
    list = [];
    notify();
    return Promise.resolve(list);
  }
  return new Promise((resolve) => {
    unsub = col().onSnapshot(
      (snap) => {
        list = snap.docs.map((doc) => normalizeContact({
          ...(doc.data() || {}),
          hubspot_id: (doc.data() && doc.data().hubspot_id) || doc.id,
        }));
        notify();
        resolve(list);
      },
      (err) => {
        console.error('Firestore contacts snapshot failed', err);
        list = [];
        notify();
        resolve(list);
      },
    );
  });
}

export async function importContacts(contacts) {
  const rows = (Array.isArray(contacts) ? contacts : [])
    .map((c) => normalizeContact(c))
    .filter((c) => c.hubspot_id);
  if (!rows.length) return { count: 0 };
  if (!usingContactsFirestore()) {
    throw new Error('Sign in to import contacts into the live store');
  }
  const db = firebase.firestore();
  const ref = col();
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const chunk = rows.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const c of chunk) {
      batch.set(ref.doc(String(c.hubspot_id)), toDoc(c), { merge: true });
    }
    await batch.commit();
  }
  return { count: rows.length };
}
