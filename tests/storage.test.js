import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, localDate, newSet, shiftDay } from '../dist/core.js';

const dataKey='repnote:v1:real';
const modeKey='repnote:mode';
let session=0;

// Drive the app's real event handlers. Stand-ins for the browser let tests fail
// individual localStorage writes and delay delivery of a second tab's change.
async function openApp(t, original=JSON.stringify(blankState())){
  const values=new Map([[modeKey,'real'],[dataKey,original]]);
  const events={}, windowEvents={};
  const app={}, toast={classList:{add(){},remove(){}}};
  const input={id:'import-file',dataset:{}};
  const modal={
    open:false, addEventListener(){}, close(){this.open=false;}, showModal(){this.open=true;},
    querySelector(selector){return selector==='#import-file'?input:null;}
  };
  const dom={'#app':app,'#modal':modal,'#toast':toast,'#timer-root':{},'#celebration':{}};
  const storage={
    getItem:key=>values.get(key)??null,
    setItem(key,value){
      if(key===this.failKey)throw new DOMException('quota','QuotaExceededError');
      values.set(key,value);
    }
  };
  const globals={
    localStorage:storage, document:{querySelector:key=>dom[key],addEventListener:(key,fn)=>{events[key]=fn;}},
    window:{addEventListener:(key,fn)=>{windowEvents[key]=fn;}},
    navigator:{locks:{request:async (key,fn)=>{assert.match(key,/^repnote:v1:(real|demo)$/);return fn();}}}
  };
  for(const [key,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  }
  t.mock.method(globalThis,'setInterval',()=>0);
  t.mock.method(globalThis,'setTimeout',()=>0);
  await import('../dist/app.js?storage-test='+ ++session);
  const click=(action,details={})=>events.click({target:{closest:()=>({dataset:{action,...details}})}});
  async function importText(text){
    await click('settings');
    input.files=[{size:Buffer.byteLength(text),text:async ()=>text}];
    await events.change({target:input});
  }
  return {app,modal,toast,click,storage,values,events,windowEvents,importText,read:()=>JSON.parse(values.get(dataKey))};
}

test('a failed write restores both the screen and the stored state', async t=>{
  const ui=await openApp(t);
  ui.storage.failKey=dataKey;
  await ui.click('unit',{unit:'lbs'});
  assert.equal(ui.read().settings.unit,'kg');
  assert.match(ui.app.innerHTML,/data-unit="kg" class="active"/);
  assert.match(ui.toast.innerHTML,/保存できません/);
  ui.storage.failKey=null;
  await ui.click('favorite',{id:'leg-press'});
  assert.equal(ui.read().settings.unit,'kg');
  assert.equal(ui.read().favorites.includes('leg-press'),false);
});

test('an oversized file is rejected before reading it into memory', async t=>{
  const ui=await openApp(t);
  const original=ui.values.get(dataKey);
  await ui.click('settings');
  const input=ui.modal.querySelector('#import-file');
  let wasRead=false;
  input.files=[{size:64*1024*1024+1, text:async ()=>{wasRead=true; return '{}';}}];
  await ui.events.change({target:input});
  assert.equal(wasRead,false);
  assert.match(ui.toast.innerHTML,/64MiB/);
  assert.equal(ui.values.get(dataKey),original);
});

test('a write from a second tab wins even when the storage event has not arrived', async t=>{
  const ui=await openApp(t);
  const remote=ui.read();
  remote.settings.timerSeconds=180;
  ui.values.set(dataKey,JSON.stringify(remote));
  await ui.click('unit',{unit:'lbs'});
  assert.deepEqual(ui.read(),remote);
  assert.match(ui.toast.innerHTML,/別のタブ/);
  await ui.click('unit',{unit:'lbs'});
  assert.equal(ui.read().settings.timerSeconds,180);
  assert.equal(ui.read().settings.unit,'lbs');
});

test('invalid, wrong-mode, failed, and confirmed restores preserve their respective stores',async t=>{
  const ui=await openApp(t);
  const original=ui.values.get(dataKey);
  const backup={...blankState(),sample:false};
  backup.settings.unit='lbs';
  for(const invalid of ['{bad',JSON.stringify({...backup,sample:true}),JSON.stringify({...backup,schemaVersion:99})]){
    await ui.importText(invalid);
    await ui.click('confirm-import');
    assert.equal(ui.values.get(dataKey),original);
    assert.match(ui.toast.innerHTML,/読み込めません/);
  }
  await ui.importText(JSON.stringify(backup));
  ui.storage.failKey=dataKey;
  await ui.click('confirm-import');
  assert.equal(ui.values.get(dataKey),original);
  assert.match(ui.app.innerHTML,/data-unit="kg" class="active"/);
  // Mode preference is a separate setting. A replacement writes only one key.
  ui.storage.failKey=modeKey;
  await ui.importText(JSON.stringify(backup));
  await ui.click('confirm-import');
  assert.equal(ui.read().settings.unit,'lbs');
  assert.equal(ui.read().sample,undefined);
  assert.match(ui.toast.innerHTML,/復元しました/);
});

test('a storage update discards a staged restore and closes its stale confirmation',async t=>{
  const ui=await openApp(t);
  await ui.importText(JSON.stringify({...blankState(),sample:false}));
  assert.equal(ui.modal.open,true);
  const remote=ui.read();
  remote.settings.unit='lbs';
  ui.values.set(dataKey,JSON.stringify(remote));
  ui.windowEvents.storage({key:dataKey,storageArea:ui.storage});
  assert.equal(ui.modal.open,false);
  await ui.click('confirm-import');
  assert.deepEqual(ui.read(),remote);
});

test('an unreadable original can only be replaced by a successful confirmed restore',async t=>{
  const ui=await openApp(t,'{damaged');
  await ui.click('unit',{unit:'lbs'});
  assert.equal(ui.values.get(dataKey),'{damaged');
  await ui.importText(JSON.stringify(blankState()));
  ui.storage.failKey=dataKey;
  await ui.click('confirm-import');
  assert.equal(ui.values.get(dataKey),'{damaged');
  ui.storage.failKey=null;
  await ui.importText(JSON.stringify(blankState()));
  await ui.click('confirm-import');
  assert.deepEqual(ui.read(),blankState());
});

test('the inline trash button removes its own set on the selected day and undo restores its position', async t=>{
  const state=blankState();
  const day=shiftDay(localDate(),-1);
  const sets=[newSet(30,8), {...newSet(40,6),completed:true}, newSet(30,8)];
  state.workouts[day]={title:'PUSH',note:'',exercises:[{id:'press',exerciseId:'dumbbell-press',sets}]};
  const ui=await openApp(t,JSON.stringify(state));
  await ui.click('day',{date:day});
  const buttons=[...ui.app.innerHTML.matchAll(/<button\b[^>]*data-action="delete-set"[^>]*>/g)];
  assert.equal(buttons.length,3);
  const button=buttons[1][0];
  const id=button.match(/data-id="([^"]+)"/)[1];
  const date=button.match(/data-date="([^"]+)"/)[1];
  assert.equal(id,sets[1].id);
  assert.equal(date,day);
  assert.match(button,/aria-label="ダンベルプレス セット2を削除"/);
  await ui.click('delete-set',{id,date});
  assert.deepEqual(ui.read().workouts[day].exercises[0].sets,[sets[0],sets[2]]);
  await ui.click('delete-set',{id,date});
  await ui.click('undo');
  assert.deepEqual(ui.read().workouts,state.workouts);
});

test('undo cannot cross later changes, restored data or a mode switch',async t=>{
  const original=blankState();
  original.body=[{date:localDate(),kg:70,bodyFat:null}];
  const ui=await openApp(t,JSON.stringify(original));
  await ui.click('delete-body',{date:localDate()});
  await ui.click('undo');
  assert.deepEqual(ui.read().body,original.body);
  await ui.click('delete-body',{date:localDate()});
  await ui.click('unit',{unit:'lbs'});
  await ui.click('undo');
  assert.equal(ui.read().body.length,0);
  assert.equal(ui.read().settings.unit,'lbs');
  await ui.importText(JSON.stringify(original));
  await ui.click('confirm-import');
  await ui.click('delete-body',{date:localDate()});
  await ui.importText(JSON.stringify(blankState()));
  await ui.click('confirm-import');
  await ui.click('undo');
  assert.equal(ui.read().body.length,0);
  await ui.importText(JSON.stringify(original));
  await ui.click('confirm-import');
  await ui.click('delete-body',{date:localDate()});
  await ui.click('switch-mode');
  await ui.click('switch-mode');
  await ui.click('undo');
  assert.equal(ui.read().body.length,0);
});

test('midnight advances today while keeping a historical day or open editor on its date',async t=>{
  const start=new Date(2026,10,22,23,59);
  let now=start.getTime();
  const NativeDate=Date;
  class TestDate extends NativeDate{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  globalThis.Date=TestDate;
  t.after(()=>{globalThis.Date=NativeDate;});
  const ui=await openApp(t);
  const first=localDate(start);
  const tomorrow=shiftDay(first,1);
  now=start.getTime()+120_000;
  ui.events.visibilitychange();
  assert.ok(ui.app.innerHTML.includes('type="date" value="'+tomorrow+'"'));
  await ui.click('day',{date:first});
  now=start.getTime()+86_520_000;
  ui.events.visibilitychange();
  assert.ok(ui.app.innerHTML.includes('type="date" value="'+first+'"'));
  await ui.click('today');
  const editorDay=localDate();
  await ui.click('settings');
  now=start.getTime()+172_920_000;
  ui.events.visibilitychange();
  assert.ok(ui.app.innerHTML.includes('type="date" value="'+editorDay+'"'));
});
