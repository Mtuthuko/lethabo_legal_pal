/*! Lethabo living-layer controller (site code; static/living-layer.js stays a byte-identical copy of the kit v1.1.0).
 * Injected once into the Streamlit page by the hidden loader iframe in app.py.
 * The sunbird, gold dust and 3D touches live only on the welcome view (.st-key-hero):
 * never in the chat (masthead, messages, chat input), never on the start-up error.
 * To change the character or its options, edit HOME below (DESIGN.md explains each one). */
(function () {
  'use strict';
  if (window.__lethaboLivingCtl || !window.LivingLayer) return;

  var HOME = {
    character: 'sunbird',
    colors:       { primary: '#007A4D', secondary: '#45C08B', accent: '#FFB612', dark: '#0F1D16', light: '#EFF5F0' },
    colorsOnDark: { primary: '#45C08B', secondary: '#9BE6BF', accent: '#FFB612', dark: '#003624', light: '#FFFFFF' },
    look: 'rich',
    finish: 'satin',
    size: 52,                     // desktop wingspan; phones get 80% (41.6px)
    side: 'right',
    lane: null,                   // automatic: right gutter on desktop, right edge on phones
    perch: '.st-key-hero h1, .st-key-examples [data-testid="stWidgetLabel"]',
    dust: { colors: ['#FFB612', '#FFE2A0', '#FFFFFF'], amount: 0.55, ambient: true, trail: true },
    ghost: false,
    calm: false,
    intro: true,
    introDelay: 1200,
    zIndex: 60,                   // under Streamlit's header (999990) and menus
    safeTop: 60,                  // stHeader is position:absolute in 1.66, so 'auto' measures 0
    scroller: '[data-testid="stMain"]',
    toggle: { position: 'bottom-left', label: 'Moving effects', bg: '#003624', fg: '#FFB612', line: 'rgba(255,255,255,.5)' },
    tilt: '.st-key-examples button',
    depth: null,
    reveal: null,
    magnetic: '.st-key-hero [data-testid="stBaseButton-primary"]',
    storageKey: 'lethabo-living',
    mobileScale: 0.8
  };

  var mode = 'none', researching = false, pending = 0;

  function sync() {
    pending = 0;
    var hero = document.querySelector('.st-key-hero');
    var want = hero ? 'home' : 'none';
    if (want !== mode) {
      if (window.__livingLayer) window.__livingLayer.destroy();
      if (want === 'home') window.LivingLayer.init(HOME);
      mode = want;
    }
    // "Okay, sharp!": one loop when the visitor's topic is accepted and research starts.
    var nowResearching = !!(hero && hero.querySelector('[data-testid="stSpinner"]'));
    if (nowResearching && !researching) {
      setTimeout(function () {
        var ll = window.__livingLayer;
        if (ll && mode === 'home') ll.celebrate();
      }, 300);
    }
    researching = nowResearching;
  }

  // Throttle, not debounce: the spinner's elapsed-time text mutates continuously while research runs.
  new MutationObserver(function () { if (!pending) pending = setTimeout(sync, 200); })
    .observe(document.body, { childList: true, subtree: true });

  window.__lethaboLivingCtl = { sync: sync, mode: function () { return mode; } };
  sync();
})();
