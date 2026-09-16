(function () {
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

})();
