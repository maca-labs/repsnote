const scope = self.registration.scope;
const prefix = `reps-note:${scope}:`;
const revision = '__BUILD_REVISION__';
const packaged = /^[0-9a-f]{40}$/.test(revision);
const releasePrefix = scope+'releases/';
const releaseRoot = packaged ? releasePrefix+revision+'/' : scope;
const cacheName = prefix+'release:'+revision;
const publication = prefix+'publication';
const indexUrl = scope+'index.html';
const legacyKey = scope+'__legacy_cache__';
const files = new Set([
  'index.html', 'styles.css', 'icon.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'app.js', 'ai-prompt.js', 'calorie-history.js', 'catalog.js',
  'core.js', 'install.js', 'timer-sound.js', 'month-share.js', 'share.js', 'workout-input.js', 'catalog-settings.js',
  'meal-import.js', 'meal-import-ui.js', 'workout-import.js', 'workout-import-ui.js', 'workout-backup.js',
]);

// Publish the document only after its entire immutable module graph is available.
async function publishRelease() {
  const cache = await caches.open(cacheName);
  await cache.addAll(Array.from(files, file=>new Request(releaseRoot+file,{cache:'reload',credentials:'omit'})));
  const published = await caches.open(publication);
  await published.put(indexUrl,await cache.match(releaseRoot+'index.html'));
}

self.addEventListener('install', event => {
  event.waitUntil(install());
});
async function install() {
  const published = await caches.open(publication);
  const previous = await published.match(indexUrl);
  let oldIndex;
  if (!previous && packaged) {
    // Failed installs of the network-first worker may have left empty caches.
    for (const name of (await caches.keys()).reverse()) {
      if (!name.startsWith(prefix+'shell:')) continue;
      oldIndex = await caches.match(indexUrl,{cacheName:name});
      if (oldIndex) {
        await published.put(legacyKey,new Response(name));
        await (await caches.open(cacheName)).put(legacyKey,new Response(name));
        break;
      }
    }
  }
  try {
    await publishRelease();
  } catch (error) {
    if (!oldIndex) throw error;
    await published.put(indexUrl,oldIndex);
  }
  // Take over from the legacy worker. Later updates can wait while older tabs finish.
  if (!previous) await self.skipWaiting();
}

self.addEventListener('activate', event=>{
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    // On subsequent activation the browser has released all clients of the previous worker.
    if (!(await caches.match(legacyKey,{cacheName}))) {
      for (const key of keys) {
        if ((key.startsWith(prefix+'release:') && key!==cacheName) || key.startsWith(prefix+'shell:')) await caches.delete(key);
      }
      const published = await caches.open(publication);
      await published.delete(legacyKey);
    }
    const index = await caches.match(releaseRoot+'index.html',{cacheName});
    if (index) await (await caches.open(publication)).put(indexUrl,index);
    await self.clients.claim();
  })());
});

let retry;
async function repairMigration() {
  if (!(await caches.match(legacyKey,{cacheName:publication}))) return;
  if (await caches.match(releaseRoot+'index.html',{cacheName})) return;
  // Only this bridge installation needs retrying without a different sw.js revision.
  // A newer waiting worker may already have published its complete release.
  const published = await caches.match(indexUrl,{cacheName:publication});
  if (!published?.url.startsWith(releasePrefix)) {
    retry ??= publishRelease().catch(()=>{}).finally(()=>{retry=null;});
    await retry;
  }
}

self.addEventListener('fetch',event=>{
  const {request} = event;
  if (request.method!=='GET') return;
  const url = new URL(request.url);
  const navigate = request.mode==='navigate' && [scope,indexUrl].includes(url.origin+url.pathname);
  const file = url.href.slice(scope.length);
  if (!url.href.startsWith(scope)) return;
  if (!packaged) {
    // Local source checkouts have mutable filenames and no publish step.
    if (navigate || files.has(file)) event.respondWith(localFile(request,navigate ? indexUrl : url.href));
    return;
  }
  if (navigate) {
    event.waitUntil(repairMigration());
    event.respondWith(caches.match(indexUrl,{cacheName:publication}).then(doc=>doc ?? fetch(request)));
    return;
  }
  const match = /^releases\/([0-9a-f]{40})\/(.+)$/.exec(file);
  if (match && files.has(match[2])) {
    event.respondWith(caches.match(url.href,{cacheName:prefix+'release:'+match[1]}).then(hit=>hit ?? fetch(request)));
  } else if (files.has(file)) {
    event.respondWith(unversionedFile(request,file));
  }
});

async function unversionedFile(request,file) {
  const legacy = await caches.match(legacyKey,{cacheName:publication});
  const old = legacy && await caches.match(scope+file,{cacheName:await legacy.text()});
  return old ?? await caches.match(releaseRoot+file,{cacheName}) ?? fetch(request);
}

async function localFile(request,key) {
  let response;
  try { response=await fetch(request,{cache:'no-cache'}); if(response.status<500)return response; } catch {}
  return await caches.match(key,{cacheName}) ?? response ?? Response.error();
}
