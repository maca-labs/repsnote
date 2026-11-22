import assert from 'node:assert/strict';
import test from 'node:test';
import { createInstallController } from '../dist/install.js';

function browser() {
  const events = new EventTarget();
  events.location = {protocol:'https:'};
  events.isSecureContext = true;
  events.matchMedia = () => ({matches:false});
  const values = new Map();
  const storage = {getItem:key=>values.get(key), setItem:(key,value)=>values.set(key,value)};
  const registrations = [];
  const nav = {serviceWorker:{async register(path){ registrations.push(path); }}};
  function offer(prompt, userChoice) {
    const event = new Event('beforeinstallprompt', {cancelable:true});
    Object.assign(event, {prompt, userChoice});
    events.dispatchEvent(event);
    assert.ok(event.defaultPrevented);
  }
  return {events,nav,storage,registrations,offer};
}

test('the initial installation offer survives rerenders but does not return on a later visit', () => {
  const {events,nav,storage,registrations} = browser();
  const first = createInstallController(events,nav,storage);
  assert.ok(first.shouldShowBanner());
  assert.deepEqual(registrations,['./sw.js']);
  first.markBannerShown();
  assert.ok(first.shouldShowBanner());
  assert.equal(createInstallController(events,nav,storage).shouldShowBanner(),false);
  first.dismissBanner();
  assert.equal(first.shouldShowBanner(),false);
});

test('native installation prompts once during user activation and tracks actual completion', async () => {
  const {events,nav,storage,offer} = browser();
  let notifications = 0;
  const ui = createInstallController(events,nav,storage,()=>notifications++);
  let calls = 0;
  let choose;
  const choice = new Promise(resolve=>{ choose=resolve; });
  offer(()=>{calls++; return choice;});
  const first = ui.requestInstall();
  const second = ui.requestInstall();
  assert.equal(calls,1);
  choose({outcome:'accepted'});
  assert.deepEqual(await Promise.all([first,second]),['accepted','accepted']);
  assert.equal(ui.shouldShowBanner(),false);
  assert.equal(ui.isInstalled(),false);
  events.dispatchEvent(new Event('appinstalled'));
  assert.equal(notifications,1);
  assert.ok(ui.isInstalled());
  assert.equal(await ui.requestInstall(),'installed');
  assert.equal(createInstallController(events,nav,storage).isInstalled(),false);
});

test('native dismissal, unavailable prompts and prompt errors allow manual installation', async () => {
  const {events,nav,storage,offer} = browser();
  const ui = createInstallController(events,nav,storage);
  assert.equal(await ui.requestInstall(),'manual');
  offer(async()=>{}, Promise.resolve({outcome:'dismissed'}));
  assert.equal(await ui.requestInstall(),'dismissed');
  assert.equal(await ui.requestInstall(),'manual');
  offer(()=>{throw Error('no longer available');});
  assert.equal(await ui.requestInstall(),'manual');
  offer(async()=>({outcome:'accepted'}));
  assert.equal(await ui.requestInstall(),'accepted');
});

test('iOS and installed display modes work with unavailable storage or service workers', async () => {
  const {events,nav} = browser();
  const storage = {getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};
  nav.serviceWorker.register = async()=>{throw Error('blocked');};
  Object.assign(nav,{platform:'MacIntel',maxTouchPoints:5});
  const ui = createInstallController(events,nav,storage);
  assert.ok(ui.isIOS());
  ui.markBannerShown();
  assert.ok(ui.shouldShowBanner());
  ui.dismissBanner();
  assert.equal(ui.shouldShowBanner(),false);
  nav.standalone=true;
  assert.equal(await ui.requestInstall(),'installed');
  nav.standalone=false;
  events.matchMedia=()=>({matches:true});
  assert.equal(createInstallController(events,nav,undefined).shouldShowBanner(),false);
});

test('file and insecure pages skip service worker registration', () => {
  const {events,nav,storage,registrations} = browser();
  events.location.protocol='file:';
  createInstallController(events,nav,storage);
  events.location.protocol='http:';
  events.isSecureContext=false;
  createInstallController(events,nav,storage);
  assert.deepEqual(registrations,[]);
});
