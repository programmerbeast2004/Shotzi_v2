/**
 * scrollToSection.js
 * ------------------
 * Rock-solid hash-anchor scrolling for Shotzi.
 *
 * Problems it solves:
 *  1. CSS scroll-margin-top is ignored by JS scrollIntoView()
 *  2. Navbar height varies across breakpoints (58px mobile / 66px desktop + 8px top-2)
 *  3. Cross-page navigation: DOM element may not exist yet when the hook fires
 *  4. Layout shift: images and fonts push content down after first paint
 *
 * Strategy:
 *  - Measure the ACTUAL rendered navbar height + sticky offset from the DOM on every call.
 *  - Use window.scrollTo() with a manual offset. Never scrollIntoView (it ignores CSS scroll-margin).
 *  - Retry up to MAX_RETRIES times so we survive cross-page navigation lag.
 *  - After the initial scroll, do one final correction at FINAL_CORRECTION_MS to
 *    counteract layout reflow caused by images/fonts loading in.
 */

const NAVBAR_SELECTOR = 'header';
const EXTRA_PADDING = 20;
const MAX_RETRIES = 18;
const RETRY_DELAY_MS = 80;
const FINAL_CORRECTION_MS = 700;

function getNavOffset() {
  const navbar = document.querySelector(NAVBAR_SELECTOR);
  if (!navbar) return 90;
  const rect = navbar.getBoundingClientRect();
  const stickyTop = parseFloat(getComputedStyle(navbar).top) || 0;
  return rect.height + stickyTop + EXTRA_PADDING;
}

function doScroll(element, behavior) {
  const offset = getNavOffset();
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior });
}

export function scrollToSection(id, { instant = false } = {}) {
  if (!id || typeof document === 'undefined') return;

  let tries = 0;
  let correctionTimer = null;
  const behavior = instant ? 'instant' : 'smooth';

  const attempt = () => {
    const el = document.getElementById(id);

    if (!el) {
      if (tries < MAX_RETRIES) {
        tries++;
        setTimeout(attempt, RETRY_DELAY_MS);
      }
      return;
    }

    doScroll(el, behavior);

    clearTimeout(correctionTimer);
    correctionTimer = setTimeout(() => {
      const el2 = document.getElementById(id);
      if (el2) doScroll(el2, 'instant');
    }, FINAL_CORRECTION_MS);
  };

  requestAnimationFrame(() => setTimeout(attempt, 60));
}

export function scrollToCurrentHash({ instant = false } = {}) {
  const hash = window.location.hash;
  if (!hash) return;
  scrollToSection(hash.replace(/^#/, ''), { instant });
}
