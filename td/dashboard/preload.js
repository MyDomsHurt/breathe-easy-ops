/* Force Performance data from the known-good host (avoids 404 on missing local weeks.json) */
(function () {
  var BASE = 'https://mydomshurt.github.io/breathe-easy-dashboard';
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url);
    if (!url) return orig(input, init);
    // strip querystring for match
    var path = String(url).split('?')[0];
    if (path === 'data.json' || path === './data.json' || path.endsWith('/dashboard/data.json')) {
      return orig(BASE + '/data.json', init);
    }
    if (path === 'weeks.json' || path === './weeks.json' || path.endsWith('/dashboard/weeks.json')) {
      return orig(BASE + '/weeks.json', init);
    }
    return orig(input, init);
  };
})();
