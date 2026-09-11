/*
  ACHARYLAB STANDARD COOKIE BANNER — one snippet for all apps.
  Apps without tracking/analytics set REQUIRED=true: show a single
  informational notice (DPDP does not require consent for essential cookies).
  Apps with analytics set REQUIRED=false to show accept/reject.
  Drop into the app's bundle or static root; call initCookieBanner() on load.
  Persists choice in localStorage 'acharylab-cookie-consent' (v1|reject|granted).
*/
(function () {
  var CONFIG = {
    REQUIRED: true,          // true = essential cookies only (notice, no choice)
    NO_COOKIES: false,       // true = app is browser-only, store consent notice only
    TEXT: "This site uses essential cookies to keep it working. We do not use tracking or advertising cookies.",
    ACCEPT: "Okay",
    REJECT: "Decline",
    POLICIES: true           // link to /privacy and /terms
  };
  var HTML =
    '<div id="acharylab-cookie-banner" role="region" aria-label="Cookie notice" ' +
    'style="position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:520px;' +
    'background:#111;color:#fafafa;border:1px solid #262626;border-left:3px solid #FF3D00;' +
    'border-radius:10px;padding:16px 18px;font:13.5px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;' +
    'box-shadow:0 12px 40px rgba(0,0,0,0.5)">' +
    '<div style="margin-bottom:10px">' + CONFIG.TEXT + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button id="acharylab-cookie-accept" style="background:#FF3D00;color:#fff;border:0;border-radius:6px;' +
    'padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer">' + CONFIG.ACCEPT + '</button>' +
    (CONFIG.REQUIRED ? '' :
      '<button id="acharylab-cookie-reject" style="background:transparent;color:#c9c4b8;border:1px solid #333;' +
      'border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer">' + CONFIG.REJECT + '</button>') +
    (CONFIG.POLICIES ?
      '<a href="/privacy" style="color:#c9c4b8;align-self:center;margin-left:auto;text-decoration:underline">Privacy</a>' +
      '<a href="/terms" style="color:#c9c4b8;align-self:center;text-decoration:underline">Terms</a>' : '') +
    '</div></div>';

  window.initCookieBanner = function (opts) {
    if (opts) { for (var k in opts) if (opts.hasOwnProperty(k)) CONFIG[k] = opts[k]; }
    try {
      if (localStorage.getItem('acharylab-cookie-consent')) return; // already decided
      var el = document.createElement('div');
      el.innerHTML = HTML;
      document.body.appendChild(el.firstChild);
      var accept = document.getElementById('acharylab-cookie-accept');
      var reject = document.getElementById('acharylab-cookie-reject');
      if (accept) accept.addEventListener('click', function () {
        localStorage.setItem('acharylab-cookie-consent', CONFIG.REQUIRED ? 'v1' : 'granted');
        el.remove();
      });
      if (reject) reject.addEventListener('click', function () {
        localStorage.setItem('acharylab-cookie-consent', 'reject');
        el.remove();
      });
    } catch (e) { /* storage unavailable; show nothing */ }
  };
})();