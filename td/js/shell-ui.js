/* Compact | Detailed toggle styling for universal light shell */
(function () {
  function paint() {
    var compact = document.getElementById('densityCompact');
    var detailed = document.getElementById('densityDetailed');
    var isCompact = document.body.classList.contains('compact');
    if (compact) compact.classList.toggle('be-on', isCompact);
    if (detailed) detailed.classList.toggle('be-on', !isCompact);
  }
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].attributeName === 'class') { paint(); break; }
    }
  });
  if (document.body) {
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'densityCompact' || t.id === 'densityDetailed' || (t.closest && t.closest('#densityToggle'))) {
      setTimeout(paint, 0);
      setTimeout(paint, 50);
    }
  });

  var menuBtn = document.getElementById('userMenuBtn');
  var menu = document.getElementById('userMenu');
  function closeMenu() {
    if (!menu || !menuBtn) return;
    menu.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu(e) {
    if (!menu || !menuBtn) return;
    e.preventDefault();
    e.stopPropagation();
    var open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', toggleMenu);
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', closeMenu);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint);
  } else {
    paint();
  }
  setTimeout(paint, 200);
  window.__beShellPaint = paint;
})();
