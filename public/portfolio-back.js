(() => {
  const existing = document.querySelector?.('[data-portfolio-back]');
  const source = new URLSearchParams(window.location.search).get('utm_source');
  const portfolio = new URL('https://je-tu-il.github.io/index.html#catalogue');
  const script = document.currentScript;
  const bundled = script && new URL(script.src).pathname.endsWith('/assets/portfolio-back.js');
  const destination = bundled ? new URL('../index.html#catalogue', script.src) : portfolio;
  const scope = bundled ? window.location.pathname.match(/\/projects\/[^/]+/)?.[0] : '';
  const key = 'je-tu-il:portfolio-entry' + (scope || '');

  let showBack = source === 'portfolio';
  if (!existing) {
    try {
      if (source === 'portfolio') sessionStorage.setItem(key, '1');
      else if (source) sessionStorage.removeItem(key);
      showBack = showBack || sessionStorage.getItem(key) === '1';
    } catch {
      // The source parameter works without session storage.
    }
    if (!showBack) return;
  }

  if (document.referrer) {
    const previous = new URL(document.referrer);
    const home = new URL('./', destination);
    if (previous.origin === destination.origin && [destination.pathname, home.pathname].includes(previous.pathname)) {
      destination.search = previous.search;
    }
  }
  if (existing) {
    existing.href = destination.href;
    return;
  }

  const back = document.createElement('a');
  back.href = destination.href;
  back.className = 'portfolio-back';
  back.setAttribute('aria-label', 'Retour au portfolio');
  back.title = 'Retour au portfolio';
  back.textContent = '←';
  const style = document.createElement('style');
  style.textContent = `
    .portfolio-back {
      all: initial;
      box-sizing: border-box;
      position: fixed;
      z-index: 2147483647;
      top: max(.65rem, env(safe-area-inset-top));
      left: max(.65rem, env(safe-area-inset-left));
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      background: #212723;
      color: #fffaf0;
      box-shadow: 3px 3px 0 #a9b986;
      font: 700 1.3rem system-ui, sans-serif;
      cursor: pointer;
    }
    .portfolio-back:hover { background: #315e79; }
    .portfolio-back:focus-visible { outline: 3px solid #315e79; outline-offset: 4px; }
  `;
  document.head.append(style);
  document.body.append(back);
})();
