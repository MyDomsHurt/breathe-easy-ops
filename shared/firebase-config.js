/**
 * Public Firebase web config for project breathe-easy-performance.
 * Same values as td/js/auth.js. This is a client API key, not a
 * service-account / private key — do not add those to the repo.
 */

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBnfbQ5qlfo0DD7HkryszeNGRclvj0i99Q',
  authDomain: 'breathe-easy-performance.firebaseapp.com',
  projectId: 'breathe-easy-performance',
  storageBucket: 'breathe-easy-performance.firebasestorage.app',
  messagingSenderId: '42449914362',
  appId: '1:42449914362:web:0c727c239807c6da773c43',
};

export const ALLOWLIST = [
  'iamruby112@gmail.com',
  'iggi.king@gmail.com',
  'itstartswiththemind@gmail.com',
  'jefflamb1992@gmail.com',
  'joshua@breathe-easyhk.com',
  'matthewgross2001@gmail.com',
  'n.marie.lamb@gmail.com',
  'neltrestium@gmail.com',
  'sudor23@gmail.com',
  'tiagogiri334@gmail.com',
];

export const JOBS_COLLECTION = 'jobs';

const ALLOWED = ALLOWLIST.map((e) => e.toLowerCase());

export function isAllowedEmail(email) {
  return ALLOWED.indexOf(String(email || '').toLowerCase().trim()) !== -1;
}

export function isRealSignedInUser(user) {
  if (!user || !user.email) return false;
  if (user.email === 'local@preview') return false;
  return isAllowedEmail(user.email);
}

export function ensureFirebaseApp() {
  if (typeof firebase === 'undefined') return null;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  return firebase.app();
}

export function currentFirebaseUser() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return null;
    return firebase.auth().currentUser || null;
  } catch {
    return null;
  }
}

export function firestoreAvailable() {
  return typeof firebase !== 'undefined'
    && typeof firebase.firestore === 'function'
    && !!firebase.apps.length;
}

export function shouldUseFirestore(user) {
  return firestoreAvailable() && isRealSignedInUser(user || currentFirebaseUser());
}

if (typeof window !== 'undefined') {
  window.BE_FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.BE_ALLOWLIST = ALLOWLIST;
}
