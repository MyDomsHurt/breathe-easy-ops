/**
 * Google allowlist gate — same project and emails as /td.
 */

import {
  ensureFirebaseApp,
  isAllowedEmail,
} from '../../shared/firebase-config.js';

export function startScheduleAuth() {
  return new Promise((resolve, reject) => {
    const login = document.getElementById('loginScreen');
    const app = document.getElementById('appRoot');

    function showLogin() {
      if (login) login.hidden = false;
      if (app) app.hidden = true;
    }

    function showApp() {
      if (login) login.hidden = true;
      if (app) app.hidden = false;
    }

    function setError(msg) {
      const el = document.getElementById('loginError');
      if (!el) return;
      el.textContent = msg || '';
      el.hidden = !msg;
    }

    function paintUser(user) {
      const chip = document.getElementById('userChip');
      if (chip) chip.textContent = (user && (user.displayName || user.email)) || '';
    }

    if (typeof firebase === 'undefined') {
      setError('Firebase SDK failed to load. Check your connection.');
      showLogin();
      reject(new Error('Firebase SDK missing'));
      return;
    }

    ensureFirebaseApp();
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const btn = document.getElementById('btnGoogle');
    if (btn) {
      btn.addEventListener('click', () => {
        setError('');
        btn.disabled = true;
        auth.signInWithPopup(provider)
          .catch((err) => setError((err && err.message) || 'Sign-in failed. Try again.'))
          .finally(() => { btn.disabled = false; });
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => { auth.signOut(); });
    }

    let settled = false;
    auth.onAuthStateChanged((user) => {
      if (!user) {
        paintUser(null);
        showLogin();
        if (!settled) return;
        window.location.reload();
        return;
      }
      if (!isAllowedEmail(user.email)) {
        auth.signOut().then(() => {
          showLogin();
          setError('This Google account is not authorised for the scheduler.');
        });
        return;
      }
      paintUser(user);
      showApp();
      if (!settled) {
        settled = true;
        resolve(user);
      }
    });
  });
}
