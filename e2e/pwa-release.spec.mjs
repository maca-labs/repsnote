import {test, expect} from '@playwright/test';
import {cp, readFile, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {preparePages} from '../scripts/prepare-pages.mjs';

// The earlier PWA cached unversioned files and checked the network one file at a time.
const legacyWorker = `
  const name = 'reps-note:'+self.registration.scope+':shell:older';
  self.oninstall = event=>event.waitUntil((async ()=>{
    const cache = await caches.open(name);
    await cache.addAll(['./index.html','./styles.css','./app.js','./month-share.js','./share.js']);
    await self.skipWaiting();
  })());
  self.onactivate = event=>event.waitUntil(self.clients.claim());
  self.onfetch = event=>event.respondWith((async ()=>{
    const key=event.request.mode==='navigate' ? new URL('index.html',self.registration.scope) : event.request;
    try { const response=await fetch(event.request); if(response.status<500)return response; } catch {}
    return await caches.match(key,{cacheName:name}) || Response.error();
  })());`;

for (const legacy of [false,true]) {
test(`${legacy ? 'legacy network-first' : 'versioned'} PWA survives a partial update and launches the new release offline`, async ({context,page},testInfo)=>{
  const tmp = testInfo.outputPath('site');
  const first='a'.repeat(40), second='b'.repeat(40);
  let active=first, blocked=false;
  const server=http.createServer(async (request,response)=>{
    const file=new URL(request.url,'http://localhost').pathname.slice('/repsnote/'.length)||'index.html';
    try {
      if (blocked && file.endsWith('month-share.js')) {response.writeHead(503);response.end();return;}
      const data=await readFile(path.join(tmp,active,file));
      const type=({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream';
      response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
      response.end(data);
    }catch{response.writeHead(404);response.end();}
  });
  try {
    const source=path.join(tmp,'src');
    await cp(new URL('../dist/',import.meta.url),source,{recursive:true});
    for(const [revision,name] of [[first,'first'],[second,'second']]){
      await writeFile(path.join(source,'month-share.js'),`export const ${name} = "${name}";`);
      await writeFile(path.join(source,'share.js'),`export const release = "${name}";`);
      await writeFile(path.join(source,'app.js'),`import {${name}} from './month-share.js';
        document.querySelector('#app').textContent=${name};
        window.readLater=()=>import('./share.js').then(m=>m.release);
        navigator.serviceWorker.register('./sw.js');`);
      const output=path.join(tmp,revision);
      if (legacy && revision===first) {
        await cp(source,output,{recursive:true});
        await writeFile(path.join(output,'sw.js'),legacyWorker);
        const oldHtml=await readFile(path.join(output,'index.html'),'utf8');
        await writeFile(path.join(output,'index.html'),oldHtml.replace(/<script>[\s\S]*?<\/script>/,''));
      } else await preparePages(source,output,revision);
    }
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/repsnote/';
    await page.goto(url);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const oldTab=await context.newPage();
    await oldTab.goto(url);
    await expect(oldTab.locator('#app')).toHaveText('first');
    await page.evaluate(()=>localStorage.setItem('sample-note','my saved journal'));
    if (legacy) await page.evaluate(async ()=>{
      // A failed addAll in a previous install could leave a newer, empty namespace.
      await caches.open('reps-note:'+new URL('./',location.href).href+':shell:aborted');
    });

    active=second;
    blocked=true;
    if (!legacy) await page.evaluate(async ()=>{
      const registration=await navigator.serviceWorker.ready;
      const failed=new Promise(resolve=>registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve();});
      },{once:true}));
      await registration.update();
      await failed;
    });
    await page.reload({waitUntil:'commit'});
    await expect(page.locator('#app')).toHaveText('first');

    blocked=false;
    if (legacy) {
      // The bridge worker boots a complete legacy cache, then retries publishing on navigation.
      await page.reload();
      await expect.poll(()=>page.evaluate(async revision=>{
        const cacheName='reps-note:'+new URL('./',location.href).href+':publication';
        const index=await caches.match(new URL('./index.html',location.href),{cacheName});
        return index?.url.includes('/releases/'+revision+'/');
      },second)).toBe(true);
    } else await page.evaluate(async ()=>{
      const registration=await navigator.serviceWorker.ready;
      await registration.update();
      const worker=registration.installing;
      if(worker)await new Promise(resolve=>worker.addEventListener('statechange',()=>{
        if(['installed','activated','redundant'].includes(worker.state))resolve();
      }));
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#app')).toHaveText('second');
    expect(await oldTab.evaluate(()=>window.readLater())).toBe('first');
    expect(await page.evaluate(()=>localStorage.getItem('sample-note'))).toBe('my saved journal');
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
}
