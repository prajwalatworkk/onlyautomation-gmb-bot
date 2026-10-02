(() => {
  const header = document.querySelector('.site-header');
  const menuBtn = document.querySelector('.menu-btn');

  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = open => {
    header.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  if (menuBtn) {
    menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('open')));
    document.querySelectorAll('.mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  }

  const items = document.querySelectorAll('.reveal');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
})();
