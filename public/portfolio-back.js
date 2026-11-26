(() => {
  const source = new URLSearchParams(window.location.search).get('utm_source');
  const portfolio = new URL('https://je-tu-il.github.io/#catalogue');
  const script = document.currentScript;
  const bundled = script && new URL(script.src).pathname.endsWith('/assets/portfolio-back.js');
  const destination = bundled ? new URL('../index.html#catalogue', script.src) : portfolio;
  const scope = bundled ? window.location.pathname.match(/\/projects\/[^/]+/)?.[0] : '';
  const key = 'je-tu-il:portfolio-entry' + (scope || '');
  const fromPortfolio = source === 'portfolio';

  let showBack = fromPortfolio;
  try {
    if (source) {
      if (fromPortfolio) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    }
    showBack = showBack || sessionStorage.getItem(key) === '1';
  } catch {
    // The URL marker also works when storage is disabled.
  }
  if (!showBack) return;

  const back = document.createElement('a');
  if (document.referrer) {
    const previous = new URL(document.referrer);
    const index = new URL('index.html', destination);
    const home = new URL('./', destination);
    if (previous.origin === index.origin && [index.pathname, home.pathname].includes(previous.pathname)) {
      destination.search = previous.search;
    }
  }
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
      top: max(0.5rem, env(safe-area-inset-top));
      left: max(0.5rem, env(safe-area-inset-left));
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 1px solid #756b5c;
      border-radius: 50%;
      background: #f8f3e8;
      color: #24241f;
      font: 700 22px/1 system-ui, sans-serif;
      cursor: pointer;
    }
    .portfolio-back:focus-visible { outline: 2px solid #315e79; outline-offset: 3px; }
  `;
  document.head.append(style);
  document.body.append(back);
})();
