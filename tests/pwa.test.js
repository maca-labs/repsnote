import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const scope = 'https://example.test/repsnote/';
const dist = new URL('../dist/', import.meta.url);

test('the launcher opens the repository subpath and its PNGs match their declared sizes', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  assert.equal(new URL(manifest.scope, scope).href, scope);
  assert.equal(new URL(manifest.id, new URL(scope).origin).href, scope);
  assert.equal(manifest.display, 'standalone');
  for (const icon of [...manifest.icons, {src:'./icons/apple-touch-icon.png', sizes:'180x180'}]) {
    const png = await readFile(new URL(icon.src, dist));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('the service worker installs a complete static snapshot and ignores other apps on the same origin', async () => {
  const events = {};
  let cached;
  const snapshots = new Map();
  const caches = {async open(name) {
    if (!snapshots.has(name)) {
      const entries = new Map();
      snapshots.set(name,{
        async addAll(requests) {
          cached = Array.from(requests,r=>r.url);
          for (const url of cached) entries.set(url,new Response(url));
        },
        match:key=>entries.get(key), put:(key,value)=>entries.set(key,value),
      });
    }
    return snapshots.get(name);
  }};
  const self = {
    registration:{scope}, addEventListener:(name,fn)=>{events[name]=fn;}, skipWaiting:()=>{},
  };
  const source = await readFile(new URL('sw.js', dist), 'utf8');
  vm.runInNewContext(source, {self, URL, Request, caches});
  let installed;
  events.install({waitUntil: promise=>{installed=promise;}});
  await installed;
  assert.ok(cached.includes(scope+'index.html'));
  const files = await Promise.all(cached.map(async url=>{
    assert.ok(url.startsWith(scope));
    const path = url.slice(scope.length);
    const bytes = await readFile(new URL(path, dist));
    if (path.endsWith('.js')) {
      for (const [,dependency] of bytes.toString('utf8').matchAll(/\bimport\s+[^'";]+?\sfrom\s+['"](\.[^'"]+)['"]/g)) {
        assert.ok(cached.includes(new URL(dependency,url).href), `Missing offline module: ${dependency}`);
      }
    }
    return path;
  }));
  assert.ok(files.includes('app.js') && files.includes('styles.css'));
  for (const path of ['https://example.test/another-repo/app.js',scope+'backup.json',scope+'app.js?personal=1']) {
    events.fetch({request:new Request(path), respondWith:()=>assert.fail('Unexpected interception: '+path)});
  }
});
