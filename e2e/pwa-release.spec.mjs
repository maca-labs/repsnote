import {test, expect} from '@playwright/test';
import {cp, readFile, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {preparePages} from '../scripts/prepare-pages.mjs';

const installTimeout = 20_000;

async function workerState(page) {
  return page.evaluate(async ()=>{
    const reg=await navigator.serviceWorker.getRegistration();
    const scope=new URL('./',location.href).href;
    const index=await caches.match(scope+'index.html',{cacheName:'reps-note:'+scope+':publication'});
    return {
      controlled:Boolean(navigator.serviceWorker.controller),
      installing:reg?.installing?.state ?? null,
      waiting:reg?.waiting?.state ?? null,
      document:index?.url ?? '',
    };
  });
}

async function requestUpdate(page) {
  await page.evaluate(async ()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    if (!registration.installing && !registration.waiting) {
      // Assert the observed network and publication outcomes below. A rejected install is intentional.
      void registration.update().catch(()=>{});
    }
  });
}

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
  test.setTimeout(75_000); // This test installs two complete releases, including a failed attempt.
  const tmp = testInfo.outputPath('site');
  const first='a'.repeat(40), second='b'.repeat(40);
  let active=first, blocked=false;
  let failedRequests=0;
  const server=http.createServer(async (request,response)=>{
    const file=new URL(request.url,'http://localhost').pathname.slice('/repsnote/'.length)||'index.html';
    try {
      if (blocked && file===`releases/${second}/month-share.js`) {
        failedRequests++;
        response.writeHead(503);
        response.end();
        return;
      }
      const data=await readFile(path.join(tmp,active,file));
      const type=({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream';
      response.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Connection':'close','Cache-Control':'no-store'});
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
        window.workerRegistration=navigator.serviceWorker.register('./sw.js');`);
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
    await expect.poll(()=>workerState(page),{message:'initial release controls the page',timeout:installTimeout}).toMatchObject({controlled:true});
    const oldTab=await context.newPage();
    await oldTab.goto(url);
    await expect(oldTab.locator('#app')).toHaveText('first');
    await oldTab.evaluate(()=>window.workerRegistration.then(()=>true));
    await page.evaluate(()=>localStorage.setItem('sample-note','my saved journal'));
    if (legacy) await page.evaluate(async ()=>{
      // A failed addAll in a previous install could leave a newer, empty namespace.
      await caches.open('reps-note:'+new URL('./',location.href).href+':shell:aborted');
    });

    active=second;
    blocked=true;
    if (!legacy) {
      await expect.poll(async ()=>{
        if (!failedRequests) await requestUpdate(page);
        return failedRequests;
      },{message:'the update received a 503 for the new cardio module',timeout:installTimeout}).toBeGreaterThan(0);
      await expect.poll(()=>workerState(page),{message:'failed install leaves the original release published',timeout:installTimeout}).toMatchObject({
        installing:null,waiting:null,document:url+'releases/'+first+'/index.html',
      });
    }
    await page.reload({waitUntil:'commit'});
    await expect(page.locator('#app')).toHaveText('first');
    expect(failedRequests).toBeGreaterThan(0);

    blocked=false;
    if (legacy) {
      // The bridge worker boots a complete legacy cache, then retries publishing on navigation.
      await page.reload();
    }
    await expect.poll(async ()=>{
      const state=await workerState(page);
      if (!legacy && state.document!==url+'releases/'+second+'/index.html') await requestUpdate(page);
      return state.document;
    },{message:'restored connection publishes the complete new document',timeout:installTimeout}).toBe(url+'releases/'+second+'/index.html');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#app')).toHaveText('second');
    expect(await oldTab.evaluate(()=>window.readLater())).toBe('first');
    expect(await page.evaluate(()=>localStorage.getItem('sample-note'))).toBe('my saved journal');
  } finally {
    await new Promise(resolve=>{
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
}
