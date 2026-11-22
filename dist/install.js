const bannerKey = 'repnote:install-banner-seen';

async function registerServiceWorker(win, nav) {
  if (!['https:', 'http:'].includes(win.location?.protocol) || win.isSecureContext === false) return;
  try {
    await nav.serviceWorker?.register('./sw.js');
  } catch {
    // The online journal remains available if this browser blocks service workers.
  }
}

export function createInstallController(win, nav, storage, onInstalled) {
  let marked = false;
  try {
    marked = storage?.getItem(bannerKey) === '1';
  } catch {
    // A storage restriction should not interrupt startup or installation.
  }
  let bannerVisible = !marked;
  let installedThisVisit = false;
  let deferredPrompt = null;
  let pending = null;

  function isInstalled() {
    return installedThisVisit || nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
  }

  function markBannerShown() {
    if (marked) return;
    marked = true;
    try {
      storage?.setItem(bannerKey, '1');
    } catch {
      // Keep this visit's state even when preferences cannot be saved.
    }
  }

  function dismissBanner() {
    bannerVisible = false;
    markBannerShown();
  }

  win.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    installedThisVisit = false;
  });
  win.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedThisVisit = true;
    dismissBanner();
    onInstalled?.();
  });
  if (isInstalled()) dismissBanner();
  registerServiceWorker(win, nav);

  async function showNativePrompt(event) {
    try {
      const result = await event.prompt() ?? await event.userChoice;
      if (result?.outcome === 'accepted' || result?.outcome === 'dismissed') {
        dismissBanner();
        return result.outcome;
      }
    } catch {
      // The browser may revoke a previously offered prompt.
    }
    return isInstalled() ? 'installed' : 'manual';
  }

  async function requestInstall() {
    if (isInstalled()) return 'installed';
    if (pending) return pending;
    if (!deferredPrompt) return 'manual';
    const event = deferredPrompt;
    deferredPrompt = null;
    // Invoke prompt in the click handler's user activation, before yielding.
    pending = showNativePrompt(event).finally(() => { pending = null; });
    return pending;
  }

  return {
    shouldShowBanner: () => bannerVisible && !isInstalled(),
    markBannerShown,
    dismissBanner,
    isInstalled,
    isIOS: () => /iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
    requestInstall,
  };
}
