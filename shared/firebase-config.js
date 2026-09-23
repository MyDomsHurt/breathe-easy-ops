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
  'iggi.king@gmail.com',
  'info@breathe-easyhk.com',
  'jefflamb1992@gmail.com',
  'joshua@breathe-easyhk.com',
  'matthewgross2001@gmail.com',
  'n.marie.lamb@gmail.com',
  'neltrestium@gmail.com',
  'perry@breathe-easyhk.com',
  'ruby@breathe-easyhk.com',
  'sudor23@gmail.com',
  'tiagogiri334@gmail.com',
];

export const OFFICE_EMAILS = [
  'jefflamb1992@gmail.com',
  'info@breathe-easyhk.com',
  'ruby@breathe-easyhk.com',
  'perry@breathe-easyhk.com',
  'n.marie.lamb@gmail.com',
];

export const JEFF_EMAIL = 'jefflamb1992@gmail.com';
export const JOSH_EMAIL = 'joshua@breathe-easyhk.com';

export const LEAD_EMAILS = {
  'matthewgross2001@gmail.com': 'Matthew',
  'tiagogiri334@gmail.com': 'Tiago',
  'neltrestium@gmail.com': 'Nick',
  'sudor23@gmail.com': 'Alun',
  'iggi.king@gmail.com': 'Iggi',
};

export const USER_NAMES = {
  'jefflamb1992@gmail.com': 'Admin',
  'info@breathe-easyhk.com': 'Customer Service',
  'ruby@breathe-easyhk.com': 'Ruby',
  'joshua@breathe-easyhk.com': 'Josh',
  'perry@breathe-easyhk.com': 'Perry',
  'iggi.king@gmail.com': 'Iggi',
  'matthewgross2001@gmail.com': 'Matthew',
  'n.marie.lamb@gmail.com': 'Naiyie',
  'neltrestium@gmail.com': 'Nick',
  'sudor23@gmail.com': 'Alun',
  'tiagogiri334@gmail.com': 'Tiago',
};

export function displayNameForEmail(email) {
  const raw = String(email || '').trim();
  if (!raw) return '—';
  const mapped = USER_NAMES[raw.toLowerCase()];
  if (mapped) return mapped;
  const at = raw.indexOf('@');
  return at > 0 ? raw.slice(0, at) : raw;
}

export const JOBS_COLLECTION = 'jobs';

const ALLOWED = ALLOWLIST.map((e) => e.toLowerCase());
const OFFICE = OFFICE_EMAILS.map((e) => e.toLowerCase());

function emailKey(email) {
  return String(email || '').toLowerCase().trim();
}

export function isAllowedEmail(email) {
  return ALLOWED.indexOf(emailKey(email)) !== -1;
}

export function isOfficeEmail(email) {
  return OFFICE.indexOf(emailKey(email)) !== -1;
}

export function isJeffEmail(email) {
  return emailKey(email) === JEFF_EMAIL;
}

export function isJoshEmail(email) {
  return emailKey(email) === JOSH_EMAIL;
}

export function isBookingAllowedEmail(email) {
  return isOfficeEmail(email);
}

export function leadTeamForEmail(email) {
  return LEAD_EMAILS[emailKey(email)] || '';
}

export function viewerForEmail(email) {
  const key = emailKey(email);
  if (!key) return { kind: 'none', team: '' };
  if (OFFICE.indexOf(key) !== -1) return { kind: 'office', team: '' };
  if (key === JOSH_EMAIL) return { kind: 'josh', team: 'Josh' };
  const team = LEAD_EMAILS[key];
  if (team) return { kind: 'lead', team: team };
  return { kind: 'none', team: '' };
}

export function firestoreLeadFilter(email) {
  return leadTeamForEmail(email);
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
  window.BE_OFFICE_EMAILS = OFFICE_EMAILS;
  window.BE_LEAD_EMAILS = LEAD_EMAILS;
  window.BEViewerForEmail = viewerForEmail;
}
