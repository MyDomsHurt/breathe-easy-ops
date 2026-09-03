/* Header switcher is in HTML — keep height sync only */
(function () {
  function measure() {
    var header = document.querySelector('#appRoot header');
    if (!header) return;
    var h = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--app-header-h', h + 'px');
  }
  window.addEventListener('resize', measure);
  document.addEventListener('DOMContentLoaded', function () {
    measure();
    setTimeout(measure, 300);
  });
  var root = document.getElementById('appRoot');
  if (root && window.MutationObserver) {
    new MutationObserver(measure).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
})();
