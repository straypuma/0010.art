// 0010.art: progressive enhancement only. The page works without this file;
// it only adds view titles and the lightbox, and runs only in response to clicks, keys and swipes.
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // Tab title follows the view.
  const setTitle = () => {
    const view = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    document.title = view && view.dataset.title ? `${view.dataset.title} — 0010` : '0010';
  };
  addEventListener('hashchange', setTitle);
  setTitle();

  // Lightbox: native <dialog>, so Esc, focus trapping and focus return come for free.
  const lb = $('#lightbox');
  if (!lb || !lb.showModal) return;
  const view = $('img', lb), title = $('.lb-title', lb), year = $('.lb-year', lb), count = $('.lb-count', lb);
  let list = [], i = 0, token = 0, startX = null, swiped = false;

  const show = n => {
    i = (n + list.length) % list.length;
    const a = list[i], thumb = $('img', a), t = ++token;
    view.src = thumb.currentSrc || thumb.src; // already decoded: shows instantly, then sharpens
    view.alt = thumb.alt;
    title.textContent = a.dataset.title;
    year.textContent = a.dataset.year && a.closest('#works, #buy') ? a.dataset.year : '';
    count.textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    const full = new Image();
    full.src = a.href;
    full.decode().then(() => { if (t === token) view.src = full.src; }, () => {});
    if (list.length > 1) [i + 1, i - 1].forEach(k => { new Image().src = list[(k + list.length) % list.length].href; });
  };
  const close = () => { if (history.state && history.state.lightbox) history.back(); else lb.close(); };

  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-lb]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    const group = a.closest('[data-lb-group]');
    list = group ? [...group.querySelectorAll('a[data-lb]')] : [a];
    show(list.indexOf(a));
    lb.showModal();
    history.pushState({ lightbox: true }, ''); // so Back closes the viewer
  });
  addEventListener('popstate', () => { if (lb.open) lb.close(); });
  lb.addEventListener('cancel', e => { e.preventDefault(); close(); });
  lb.addEventListener('close', () => { token++; view.removeAttribute('src'); });
  $('.lb-prev', lb).addEventListener('click', () => show(i - 1));
  $('.lb-next', lb).addEventListener('click', () => show(i + 1));
  $('.lb-close', lb).addEventListener('click', close);
  lb.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  });
  // Swipe between pieces; a tap on the dark area closes.
  lb.addEventListener('pointerdown', e => { startX = e.clientX; swiped = false; });
  lb.addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50 && list.length > 1) { swiped = true; show(i + (dx < 0 ? 1 : -1)); }
  });
  $('.lb-stage', lb).addEventListener('click', e => {
    if (swiped) { swiped = false; return; }
    if (e.target !== view) close();
  });
})();
