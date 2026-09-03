/* Redirect data loads to Performance data host (shared source) */
(function () {
  var BASE = "https://mydomshurt.github.io/breathe-easy-dashboard";
  var orig = window.fetch;
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url);
    if (url === "data.json" || url === "./data.json") {
      return orig.call(this, BASE + "/data.json", init);
    }
    if (url === "weeks.json" || url === "./weeks.json") {
      return orig.call(this, BASE + "/weeks.json", init);
    }
    return orig.apply(this, arguments);
  };
})();
