/* header-hero-header.js
   Sticky + transparent-over-hero header for Dawn 14.0.0
*/
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('SiteHeaderWrapper');
  const header  = document.getElementById('SiteHeader');
  if (!wrapper || !header) return;

  // Force sticky behavior
  wrapper.dataset.stickyType = 'always';

  const root = document.documentElement;
  const hero = document.querySelector('.section-header + .shopify-section');

  /* --header-height variable -------------------------------------------- */
  const setHeaderHeight = () =>
    root.style.setProperty('--header-height', `${wrapper.offsetHeight}px`);

  new ResizeObserver(() => requestAnimationFrame(setHeaderHeight)).observe(wrapper);
  new MutationObserver(() => requestAnimationFrame(setHeaderHeight))
    .observe(wrapper, { childList: true, subtree: true });
  if (document.fonts) {
    document.fonts.ready.then(() => requestAnimationFrame(setHeaderHeight));
  }
  window.addEventListener('resize', () => requestAnimationFrame(setHeaderHeight));
  setHeaderHeight();

  /* Overlap detection --------------------------------------------------- */
  let rafId;
  const updateState = () => {
    rafId = null;
    const heroRect   = hero ? hero.getBoundingClientRect() : null;
    const headerRect = wrapper.getBoundingClientRect();
    const overlapping =
      heroRect &&
      heroRect.top < headerRect.bottom &&
      heroRect.bottom > headerRect.top;

    if (overlapping) {
      wrapper.classList.add('is-transparent');
      wrapper.classList.remove('is-solid');
      root.classList.add('header-overlap');
    } else {
      wrapper.classList.remove('is-transparent');
      wrapper.classList.add('is-solid');
      root.classList.remove('header-overlap');
    }
  };

  const onScrollOrResize = () => {
    if (!rafId) rafId = requestAnimationFrame(updateState);
  };

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);
  updateState(); // initial state
});
