// 0010.art: progressive enhancement only. The page works without this file;
// it adds view titles, justified rows for works and the lightbox, and runs only in
// response to clicks, keys, swipes and size changes.
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  // Tab title follows the view.
  const setTitle = () => {
    const view = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    document.title = view && view.dataset.title ? `${view.dataset.title} — 0010` : '0010';
  };
  addEventListener('hashchange', setTitle);
  setTitle();

  // Works: justified rows. Each row spans the full width at one shared height, and the
  // row breaks are chosen (dynamic programming over the pieces) so that row heights stay
  // as close as possible to a target. .wide (16:9) pieces get a full-width row of their
  // own. Runs only when the grid's width changes: ResizeObserver reports it after layout
  // and before paint, so the fallback layout never flashes.
  const works = $('#works .grid');
  if (works && window.ResizeObserver) {
    const items = [...works.children].map(li => ({
      li, r: parseFloat(li.style.getPropertyValue('--r')), wide: li.classList.contains('wide'),
    }));
    const layout = W => {
      const gap = parseFloat(getComputedStyle(works).columnGap) || 0;
      const T = Math.max(180, Math.min(440, W * 0.3));
      const setRow = (a, b, h) => {
        for (let k = a; k < b; k++) items[k].li.style.width = `${(h * items[k].r).toFixed(2)}px`;
      };
      // Lays out items[from..to) as rows. Only the gallery's final row may stay
      // under-full (kept at the target height instead of being stretched).
      const solve = (from, to, final) => {
        const n = to - from, best = [0], prev = [0];
        for (let j = 1; j <= n; j++) {
          best[j] = Infinity;
          let sum = 0;
          for (let i = j - 1; i >= 0; i--) {
            sum += items[from + i].r;
            const h = (W - gap * (j - i - 1)) / sum;
            const cost = best[i] + (j === n && final && h > T ? 0 : (h - T) ** 2);
            if (cost < best[j]) { best[j] = cost; prev[j] = i; }
            if (h < T / 2) break; // more pieces would only make the row shorter
          }
        }
        for (let j = n; j > 0; j = prev[j]) {
          const a = from + prev[j], b = from + j;
          let sum = 0;
          for (let k = a; k < b; k++) sum += items[k].r;
          let h = (W - 1 - gap * (b - a - 1)) / sum; // 1px slack: rounding never wraps a row
          if (b === to) h = final ? Math.min(h, T) : Math.min(h, T * 1.5);
          setRow(a, b, h);
        }
      };
      let start = 0;
      items.forEach((it, k) => {
        if (!it.wide) return;
        if (k > start) solve(start, k, false);
        it.li.style.width = '100%';
        start = k + 1;
      });
      if (start < items.length) solve(start, items.length, true);
    };
    let lastW = 0;
    works.classList.add('justified');
    new ResizeObserver(([entry]) => {
      const W = Math.floor(entry.contentRect.width);
      if (W && W !== lastW) { lastW = W; layout(W); } // 0 while the works view is hidden
    }).observe(works);
  }

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
