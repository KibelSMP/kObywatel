(function(){
  const STORAGE_KEY_HIDE = 'pwaBanner:hide';
  const STORAGE_KEY_TS = 'pwaBanner:hideTs';
  const HIDE_TTL_DAYS = 180;

  const days = (n)=> n*24*60*60*1000;
  const qs = (s, r=document)=> r.querySelector(s);
  const ce = (t, p={})=> Object.assign(document.createElement(t), p);

  function isStandalone(){
    const iosStandalone = window.navigator.standalone === true;
    const displayMode = window.matchMedia('(display-mode: standalone)').matches;
    return iosStandalone || displayMode;
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    );
  }

  function isSafariMac(){
    const ua = navigator.userAgent;
    const isMac = /Macintosh|Mac OS X/.test(ua) && !(navigator.maxTouchPoints > 1);
  const isSafari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR)\//.test(ua);
    return isMac && isSafari;
  }

  function isSupportedBrowser(){
    const ua = navigator.userAgent.toLowerCase();
    const isChromium = /chrome|chromium|crios|edg\//.test(ua);
    const isAndroid = /android/.test(ua);
    const isFirefoxAndroid = /firefox/.test(ua) && /android/.test(ua);
  if (isIOS()) return true;
  if (isSafariMac()) return true;
    if (isFirefoxAndroid) return true;
    if (isChromium && isAndroid) return true;
    const hasSW = 'serviceWorker' in navigator;
    return hasSW && ('onbeforeinstallprompt' in window || window.matchMedia('(display-mode: browser)').matches);
  }

  function shouldHide(){
    try {
      const hide = localStorage.getItem(STORAGE_KEY_HIDE);
      const ts = parseInt(localStorage.getItem(STORAGE_KEY_TS)||'0',10);
      if (hide === '1' && ts && (Date.now()-ts) < days(HIDE_TTL_DAYS)) return true;
    } catch(_){}
    return false;
  }

  function persistHide(){
    try {
      localStorage.setItem(STORAGE_KEY_HIDE, '1');
      localStorage.setItem(STORAGE_KEY_TS, String(Date.now()));
    } catch(_){}
  }

  function renderBanner(){
    const wrap = ce('div', { className: 'pwa-banner', role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Zainstaluj aplikację' });
    const icon = ce('img', { className: 'pwa-icon', src: '/assets/AppImages/android/android-launchericon-144-144.png', alt: '' });
    const content = ce('div', { className: 'pwa-content' });
    const title = ce('p', { className: 'pwa-title', textContent: 'Zainstaluj kObywatel' });
    const desc = ce('p', { className: 'pwa-desc', textContent: 'Dodaj aplikację do ekranu głównego dla pełnego doświadczenia.' });
    content.append(title, desc);

    const actions = ce('div', { className: 'pwa-actions' });
    const installBtn = ce('button', { className: 'pwa-btn primary', type: 'button', textContent: 'Zainstaluj' });
    const closeBtn = ce('button', { className: 'pwa-close', type: 'button', title: 'Zamknij', 'aria-label': 'Zamknij' });
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    const noMoreWrap = ce('label', { className: 'pwa-nomore' });
    const noMoreChk = ce('input', { type: 'checkbox', id: 'pwa-nomore' });
    const noMoreTxt = ce('span', { textContent: 'Nie pokazuj ponownie' });
    noMoreWrap.append(noMoreChk, noMoreTxt);

    actions.append(noMoreWrap, installBtn, closeBtn);
    wrap.append(icon, content, actions);
    document.body.appendChild(wrap);
    return {wrap, installBtn, closeBtn, noMoreChk};
  }

  function applyUltraSmallMode(ui){
    const ww = Math.min(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    const btn = ui.installBtn;
    if (ww <= 485){
      ui.wrap.dataset.mode = 'compact';
      if (btn && btn.isConnected && !btn.hidden){
        btn.textContent = 'Instaluj';
      }
    } else {
      delete ui.wrap.dataset.mode;
      if (btn && btn.isConnected && !btn.hidden){
        btn.textContent = 'Zainstaluj';
      }
    }
  }

  function showBanner(el){
    el.wrap.setAttribute('data-visible', 'true');
  }
  function hideBanner(el){
    el.wrap.removeAttribute('data-visible');
  }

  function setup(){
    // Nie pokazuj banera, jeśli aplikacja jest uruchomiona jako PWA (standalone)
    if (isStandalone() || !isSupportedBrowser() || shouldHide()) return;
    let deferredPrompt = null;
  const ui = renderBanner();
  applyUltraSmallMode(ui);
  window.addEventListener('resize', ()=> applyUltraSmallMode(ui), { passive: true });

    if (isIOS()) {
      qs('.pwa-desc', ui.wrap).textContent = 'Aby zainstalować na iPhonie lub iPadzie otwórz menu „Udostępnij” → „Dodaj do ekranu początkowego”.';
      if (ui.installBtn && ui.installBtn.isConnected) ui.installBtn.remove();
      showBanner(ui);
    } else if (isSafariMac()) {
      qs('.pwa-desc', ui.wrap).textContent = 'Aby zainstalować na Maku przez Safari otwórz menu „Plik” → „Dodaj do Docka”.';
      if (ui.installBtn && ui.installBtn.isConnected) ui.installBtn.remove();
      showBanner(ui);
    } else {
      window.addEventListener('beforeinstallprompt', (e)=>{
        e.preventDefault();
        deferredPrompt = e;
        showBanner(ui);
      });

      ui.installBtn.addEventListener('click', async ()=>{
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          hideBanner(ui);
          persistHide();
        }
        deferredPrompt = null;
      });
    }

    ui.closeBtn.addEventListener('click', ()=>{
      hideBanner(ui);
      if (ui.noMoreChk.checked) persistHide();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
