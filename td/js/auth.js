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

  var REDIRECT_FLAG = "td-auth-redirect";

  function setButtonBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    var svg = btn.querySelector("svg");
    btn.textContent = "";
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(busy ? " Signing in…" : " Sign in with Google"));
  }

  function authErrorMessage(err) {
    if (!err) return "Sign-in failed. Try again.";
    var code = err.code || "";
    if (code === "auth/unauthorized-domain") {
      return "This site is not authorised for Google sign-in. Ask Jeff to add it in Firebase Authorized domains.";
    }
    if (code === "auth/network-request-failed") {
      return "Network error during sign-in. Check your connection and try again.";
    }
    if (code === "auth/web-storage-unsupported") {
      return "This browser blocked sign-in storage. Try Chrome without private mode.";
    }
    return err.message || "Sign-in failed. Try again.";
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
    var returning = false;
    try { returning = sessionStorage.getItem(REDIRECT_FLAG) === "1"; } catch (e) {}
    if (returning) setButtonBusy(btn, true);

    auth.getRedirectResult()
      .then(function (result) {
        try { sessionStorage.removeItem(REDIRECT_FLAG); } catch (e) {}
        if (!result || !result.user) {
          setButtonBusy(btn, false);
          return;
        }
        if (!isAllowed(result.user.email)) {
          setButtonBusy(btn, false);
          return auth.signOut().then(function () {
            showLogin();
            setError("This Google account is not authorised for TD.");
          });
        }
      })
      .catch(function (err) {
        try { sessionStorage.removeItem(REDIRECT_FLAG); } catch (e) {}
        console.error(err);
        setButtonBusy(btn, false);
        showLogin();
        setError(authErrorMessage(err));
      });

    if (btn) {
      btn.addEventListener("click", function () {
        setError("");
        setButtonBusy(btn, true);
        try { sessionStorage.setItem(REDIRECT_FLAG, "1"); } catch (e) {}
        auth.signInWithRedirect(provider).catch(function (err) {
          try { sessionStorage.removeItem(REDIRECT_FLAG); } catch (e2) {}
          console.error(err);
          setButtonBusy(btn, false);
          setError(authErrorMessage(err));
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
        return;
      }

      if (!isAllowed(user.email)) {
        auth.signOut().then(function () {
          showLogin();
          setError("This Google account is not authorised for TD.");
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
