/**
 * Firestore settings/booking. Office + Josh read; Jeff writes team_order.
 */

import { sanitizeTeamOrder } from './team-order.js?v=1';

const SETTINGS_COLLECTION = 'settings';
const BOOKING_DOC = 'booking';
const JEFF_EMAIL = 'jefflamb1992@gmail.com';

let order = sanitizeTeamOrder(null);
let unsub = null;
const listeners = new Set();

function usingSettingsFirestore() {
  try {
    return typeof firebase !== 'undefined'
      && firebase.apps
      && firebase.apps.length
      && typeof firebase.firestore === 'function';
  } catch {
    return false;
  }
}

function docRef() {
  if (!usingSettingsFirestore()) {
    throw new Error('Firebase Firestore SDK is not loaded');
  }
  return firebase.firestore().collection(SETTINGS_COLLECTION).doc(BOOKING_DOC);
}

function currentEmail() {
  try {
    return String(
      (typeof firebase !== 'undefined'
        && firebase.auth
        && firebase.auth().currentUser
        && firebase.auth().currentUser.email) || '',
    ).toLowerCase().trim();
  } catch {
    return '';
  }
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(order); } catch (err) { console.error(err); }
  });
}

export function teamOrder() {
  return order.slice();
}

export function subscribeSettings(fn) {
  if (typeof fn === 'function') listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initSettingsStore() {
  if (unsub) return Promise.resolve(order);
  if (!usingSettingsFirestore()) {
    order = sanitizeTeamOrder(null);
    notify();
    return Promise.resolve(order);
  }
  return new Promise((resolve) => {
    unsub = docRef().onSnapshot(
      (snap) => {
        const raw = snap.exists ? (snap.data() || {}).team_order : null;
        order = sanitizeTeamOrder(raw);
        notify();
        resolve(order);
      },
      (err) => {
        console.error('Firestore settings snapshot failed', err);
        order = sanitizeTeamOrder(null);
        notify();
        resolve(order);
      },
    );
  });
}

export async function writeTeamOrder(next) {
  if (currentEmail() !== JEFF_EMAIL) {
    throw new Error('Only Jeff can change team order');
  }
  if (!usingSettingsFirestore()) {
    throw new Error('Sign in to save team order');
  }
  const sanitized = sanitizeTeamOrder(next);
  await docRef().set({ team_order: sanitized }, { merge: true });
  order = sanitized;
  notify();
  return order.slice();
}
