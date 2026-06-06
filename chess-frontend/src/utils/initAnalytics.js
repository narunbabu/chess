/**
 * Analytics bootstrap for Chess99.
 *
 * Dynamically injects Google Analytics 4 (gtag), Meta Pixel, and Microsoft
 * Clarity — but ONLY when the matching env var is set. With no IDs configured
 * (e.g. local dev) this is a no-op, so nothing breaks and no network calls fire.
 *
 * The existing `track()` helper in analytics.js pushes to `window.gtag`, so once
 * GA4 is loaded here every existing trackUI/trackGame/etc. call starts reporting.
 * We also forward to Meta Pixel so ad platforms can optimize toward conversions.
 *
 * Required env (set in .env.production):
 *   REACT_APP_GA_MEASUREMENT_ID   e.g. G-XXXXXXXXXX
 *   REACT_APP_META_PIXEL_ID       e.g. 1234567890123456
 *   REACT_APP_CLARITY_ID          e.g. abcdefghij
 */

const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
const META_PIXEL_ID = process.env.REACT_APP_META_PIXEL_ID;
const CLARITY_ID = process.env.REACT_APP_CLARITY_ID;

let initialized = false;

function loadGA4(id) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // We send SPA page_views manually on route change (see analytics.trackPageView),
  // but allow the initial automatic page_view so the first landing is captured.
  window.gtag('config', id, { send_page_view: true });
}

function loadMetaPixel(id) {
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', id);
  window.fbq('track', 'PageView');
}

function loadClarity(id) {
  /* eslint-disable */
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
  /* eslint-enable */
}

/**
 * Initialize all configured analytics providers. Safe to call once at app start.
 */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  try {
    if (GA_ID) loadGA4(GA_ID);
    if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
    if (CLARITY_ID) loadClarity(CLARITY_ID);

    if (process.env.NODE_ENV === 'development') {
      const active = [GA_ID && 'GA4', META_PIXEL_ID && 'MetaPixel', CLARITY_ID && 'Clarity']
        .filter(Boolean);
      console.log('[Analytics] initialized:', active.length ? active.join(', ') : 'none (no IDs set)');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Analytics] init failed:', error);
    }
  }
}

export default initAnalytics;
