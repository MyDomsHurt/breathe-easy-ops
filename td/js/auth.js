/* Breathe-Easy Scheduler — Firebase Google Sign-In + email allowlist */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBnfbQ5qlfo0DD7HkryszeNGRclvj0i99Q",
    authDomain: "breathe-easy-performance.firebaseapp.com",
    projectId: "breathe-easy-performance",
    storageBucket: "breathe-easy-performance.firebasestorage.app",
    messagingSenderId: "42449914362",
    appId: "1:42449914362:web:0c727c239807c6da773c43"
  };

  const ALLOWED = [
    "iamruby112@gmail.com",
    "iggi.king@gmail.com",
    "itstartswiththemind@gmail.com",
    "jefflamb1992@gmail.com",
    "joshua@breathe-easyhk.com",
    "matthewgross2001@gmail.com",
    "n.marie.lamb@gmail.com",
    "neltrestium@gmail.com",
    "sudor23@gmail.com",
    "tiagogiri334@gmail.com"
  ].map(function (e) { return e.toLowerCase(); });

  function isAllowed(email) {
    return ALLOWED.indexOf((email || "").toLowerCase().trim()) !== -1;
  }

  function showLogin() {
    const login = document.getElementById("loginScreen");
    const app = document.getElementById("appRoot");
    if (login) login.classList.remove("hidden");
    if (app) app.classList.add("hidden");
  }

  function showApp() {
    const login = document.getElementById("loginScreen");
    const app = document.getElementById("appRoot");
    if (login) login.classList.add("hidden");
    if (app) app.classList.remove("hidden");
  }

  function setError(msg) {
    const el = document.getElementById("loginError");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function updateUserChip(user) {
    const chip = document.getElementById("userChip");
    if (!chip || !user) return;
    chip.textContent = user.displayName || user.email || "Signed in";
    chip.classList.remove("hidden");
  }

  function boot() {
    if (!window.firebase) {
      console.error("Firebase SDK missing");
      setError("Firebase SDK failed to load. Check your connection.");
      showLogin();
      return;
    }

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const btn = document.getElementById("btnGoogle");
    if (btn) {
      btn.addEventListener("click", function () {
        setError("");
        btn.disabled = true;
        auth
          .signInWithPopup(provider)
          .catch(function (err) {
            console.error(err);
            setError(err.message || "Sign-in failed. Try again.");
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        auth.signOut();
      });
    }

    const isLocal =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.protocol === "file:";

    if (isLocal) {
      const localUser = { email: "local@preview", displayName: "Local preview" };
      updateUserChip(localUser);
      showApp();
      if (typeof window.onAuthReady === "function") {
        window.onAuthReady(localUser);
      }
      return;
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        showLogin();
        setError("");
        return;
      }

      if (!isAllowed(user.email)) {
        auth.signOut().then(function () {
          showLogin();
          setError("This Google account is not authorised for the scheduler.");
        });
        return;
      }

      updateUserChip(user);
      showApp();

      if (typeof window.onAuthReady === "function") {
        window.onAuthReady(user);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
