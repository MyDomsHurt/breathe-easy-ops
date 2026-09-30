/**
 * Per-user Booking settings. Doc id is the signed-in email (lowercased).
 * Field team_order. Never reads or writes settings/booking.
 */

import { sanitizeTeamOrder } from './team-order.js?v=1';

const SETTINGS_COLLECTION = 'settings';

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

function docRef() {
  if (!usingSettingsFirestore()) {
    throw new Error('Firebase Firestore SDK is not loaded');
  }
  const email = currentEmail();
  if (!email) {
    throw new Error('Sign in to save team order');
  }
  return firebase.firestore().collection(SETTINGS_COLLECTION).doc(email);
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
  if (!usingSettingsFirestore() || !currentEmail()) {
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
  if (!currentEmail()) {
    throw new Error('Sign in to save team order');
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
