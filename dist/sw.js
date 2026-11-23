const scope = self.registration.scope;
const cachePrefix = `reps-note:${scope}:shell:`;
// GitHub Pages substitutes the commit SHA so every release installs a complete offline snapshot.
const cacheName = cachePrefix + '__BUILD_REVISION__';
const shell = new Set([
  'index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'app.js', 'ai-prompt.js', 'calorie-history.js', 'catalog.js',
  'core.js', 'install.js', 'timer-sound.js', 'month-share.js', 'share.js', 'workout-input.js', 'catalog-settings.js',
  'meal-import.js', 'meal-import-ui.js', 'workout-import.js', 'workout-import-ui.js', 'workout-backup.js',
].map(path => new URL(path, scope).href));
const indexUrl = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const requests = Array.from(shell, url => new Request(url, {cache:'reload', credentials:'omit'}));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const key = request.mode === 'navigate' && (path === scope || path === indexUrl) ? indexUrl : url.href;
  if (shell.has(key)) event.respondWith(fetchShell(request, key));
});

async function fetchShell(request, key) {
  let response;
  try {
    response = await fetch(request, {cache:'no-cache'});
    if (response.status < 500) return response;
  } catch {
    // The network is unavailable; the installed version remains usable.
  }
  return await caches.match(key, {cacheName}) ?? response ?? Response.error();
}
