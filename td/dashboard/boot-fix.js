/* Ensure data is loaded after Google sign-in (app.js only routes if DATA already set) */
(function () {
  var prev = window.startDashboard;
  window.startDashboard = function () {
    function showErr(err) {
      console.error(err);
      var el = document.getElementById('app');
      if (el) {
        el.innerHTML =
          '<div style="padding:24px;font-family:system-ui,sans-serif">' +
          '<p style="font-weight:700;color:#b91c1c">Failed to load data.</p>' +
          '<p style="color:#475569;font-size:14px">' + (err && err.message ? err.message : String(err)) + '</p>' +
          '<button type="button" id="be-retry-data" style="margin-top:12px;padding:8px 14px;border-radius:8px;border:0;background:#0d9488;color:#fff;font-weight:700;cursor:pointer">Retry</button>' +
          '</div>';
        var btn = document.getElementById('be-retry-data');
        if (btn) btn.onclick = function () { window.startDashboard(); };
      }
    }
    if (typeof loadData !== 'function') {
      if (typeof prev === 'function') prev();
      return;
    }
    // Always (re)load so a failed early boot does not leave an empty dashboard
    loadData()
      .then(function () {
        if (typeof route === 'function') route();
        else if (typeof prev === 'function') prev();
      })
      .catch(showErr);
  };
})();
