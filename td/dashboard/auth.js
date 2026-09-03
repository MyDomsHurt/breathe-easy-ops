/* Firebase Google Sign-In gate for Breathe-Easy Performance */
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

  if (!window.firebase) {
    console.error("Firebase SDK missing");
    return;
  }

  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  var gate = document.getElementById("login-gate");
  var errEl = document.getElementById("login-error");
  var btn = document.getElementById("btn-google");
  var userChip = document.getElementById("user-chip");

  function setError(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    } else {
      errEl.textContent = "";
      errEl.hidden = true;
    }
  }

  function showGate() {
    document.body.classList.remove("auth-ready");
    document.body.classList.add("auth-pending");
    if (gate) gate.hidden = false;
    if (userChip) userChip.hidden = true;
  }

  function showApp(user) {
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    if (gate) gate.hidden = true;
    if (userChip) {
      userChip.hidden = false;
      var name = user.displayName || user.email || "Signed in";
      var photo = user.photoURL
        ? '<img class="user-avatar" src="' + user.photoURL + '" alt="" referrerpolicy="no-referrer" />'
        : "";
      userChip.innerHTML =
        photo +
        '<span class="user-name">' + name.replace(/</g, "&") + "</span>" +
        '<button type="button" class="btn-signout" id="btn-signout">Sign out</button>';
      var so = document.getElementById("btn-signout");
      if (so) {
        so.addEventListener("click", function () {
          auth.signOut();
        });
      }
    }
    if (typeof window.startDashboard === "function") {
      window.startDashboard();
    }
  }

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

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      window.__dashboardStarted = false;
      showGate();
      setError("");
      return;
    }
    var email = (user.email || "").toLowerCase();
    if (ALLOWED.indexOf(email) === -1) {
      auth.signOut().then(function () {
        showGate();
        setError("This Google account is not authorised for this dashboard.");
      });
      return;
    }
    showApp(user);
  });
})();
