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
  const app={querySelector:()=>null}, toast={classList:{add(){},remove(){}}};
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
    CSS:{escape:value=>String(value)},
    localStorage:storage, document:{querySelector:key=>dom[key],addEventListener:(key,fn)=>{events[key]=fn;}},
    window:{addEventListener:(key,fn)=>{windowEvents[key]=fn;}},
    navigator:{locks:{request:async (key,fn)=>{assert.match(key,/^repnote:v1:(real|demo)$/);return fn();}}}
  };
  for(const [key,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  }
  let tick;
  t.mock.method(globalThis,'setInterval',callback=>{tick=callback;return 0;});
  t.mock.method(globalThis,'setTimeout',()=>0);
  await import('../dist/app.js?storage-test='+ ++session);
  const click=(action,details={})=>events.click({target:{closest:()=>({dataset:{action,...details}})}});
  async function importText(text){
    await click('settings');
    input.files=[{size:Buffer.byteLength(text),text:async ()=>text}];
    await events.change({target:input});
  }
  return {app,modal,toast,click,storage,values,events,windowEvents,importText,tick,read:()=>JSON.parse(values.get(dataKey))};
}

test('sharing a plan keeps edited or empty post text through image changes, copying and native sharing', async t=>{
  const state=blankState(), day=localDate();
  state.plan={startDate:day,targetDate:shiftDay(day,28),startWeight:70,targetWeight:69,kcal:800,p:60,f:30,c:90};
  const ui=await openApp(t,JSON.stringify(state));
  const post={value:'',defaultValue:''};
  const fields={
    kind:{value:'plan'},format:{value:'square'},theme:{value:'dark'},
    caption:{value:''},date:{checked:true},weights:{checked:false}
  };
  const context={measureText:text=>({width:text.length*16}),fillRect(){},fillText(){}};
  const canvas={isConnected:true,getContext:()=>context,toBlob:callback=>callback(new Blob(['picture'],{type:'image/png'}))};
  ui.modal.querySelector=selector=>{
    if(selector==='#share-text')return post;
    if(selector==='#share-canvas')return canvas;
    return fields[selector.match(/^\[name="share-(\w+)"\]$/)?.[1]]??null;
  };
  ui.modal.querySelectorAll=()=>[];
  const change=async(name,properties)=>{
    const target=Object.assign(fields[name],properties,{name:'share-'+name,dataset:{}});
    await ui.events.change({target});
  };
  let shared,copied;
  navigator.canShare=()=>true;
  navigator.share=async payload=>{shared=payload;};
  navigator.clipboard={writeText:async text=>{copied=text;}};
  await ui.click('share-plan');
  assert.match(post.value,/800 kcal/);
  const edited=post.value.split('\n').filter(line=>!line.includes('800 kcal')).join('\n')+'\n今週の記録';
  post.value=edited;
  await change('theme',{value:'light'});
  assert.equal(post.value,edited);
  await change('format',{value:'portrait'});
  assert.equal(canvas.height,1350);
  assert.equal(post.value,edited);
  await change('caption',{value:'ひとこと'});
  await ui.click('share-copy');
  await ui.click('share-native');
  assert.equal(copied,edited);
  assert.equal(shared.text,edited);
  assert.equal(shared.files[0].type,'image/png');
  post.value='';
  await change('format',{value:'story'});
  assert.equal(post.value,'');
  await ui.click('share-native');
  assert.equal(shared.text,'');
  window.confirm=()=>false;
  await change('weights',{checked:true});
  assert.equal(post.value,'');
  window.confirm=()=>true;
  await change('weights',{checked:true});
  assert.match(post.value,/70kg/);
  post.value+='\n追記';
  await change('weights',{checked:false});
  assert.doesNotMatch(post.value,/70kg/);
  await change('date',{checked:false});
  assert.doesNotMatch(post.value,/目標日/);
  await change('kind',{value:'food'});
  assert.match(post.value,/食事記録/);
  assert.doesNotMatch(post.value,/800 kcal/);
});

test('cardio records use time and optional metrics throughout editing, completion and draft copies',async t=>{
  const ui=await openApp(t);
  const exercise='cardio-treadmill',day=localDate();
  const entries=()=>ui.read().workouts[day].exercises[0];
  await ui.click('add-exercise');
  await ui.click('search-group',{group:'有酸素'});
  assert.equal((ui.modal.innerHTML.match(/class="option-main"/g)??[]).length,10);
  await ui.click('choose-exercise',{id:exercise});
  const {id:instance,sets:[initial]}=entries(),id=initial.id;
  assert.deepEqual(initial,{id,minutes:10,distanceKm:null,completed:false});
  assert.doesNotMatch(ui.app.innerHTML,/data-change="set-(weight|reps)"/);
  assert.match(ui.app.innerHTML,/data-change="cardio-minutes"/);
  const minutes=value=>ui.events.change({target:{dataset:{change:'cardio-minutes',id},value}});
  await minutes('30');
  await minutes('-1');
  assert.equal(entries().sets[0].minutes,30);
  await ui.click('edit-set',{id});
  assert.doesNotMatch(ui.modal.innerHTML,/name="(kg|reps|inputUnit)"/);
  assert.match(ui.modal.innerHTML,/name="inclinePct"[^>]+inputmode="decimal"/);
  assert.match(ui.modal.innerHTML,/data-action="flip-incline"/);
  assert.match(ui.modal.innerHTML,/name="steps"[^>]+inputmode="numeric"/);
  const error={};
  const form={querySelector:()=>error};
  ui.modal.contains=element=>element===form;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'FormData');
  let values={minutes:'22.25',distanceKm:'3.15',inclinePct:'-1.5',speedKmh:'8.5',kcal:'0',steps:'2000.5'};
  Object.defineProperty(globalThis,'FormData',{configurable:true,value:class {get(key){return values[key];}}});
  t.after(()=>Object.defineProperty(globalThis,'FormData',descriptor));
  const submit=()=>ui.modal.onsubmit({preventDefault(){},target:form});
  await submit();
  assert.match(error.textContent,/歩数/);
  assert.equal(entries().sets[0].minutes,30);
  values.steps='2000';
  await submit();
  const saved={id,completed:false,minutes:22.25,distanceKm:3.15,inclinePct:-1.5,speedKmh:8.5,kcal:0,steps:2000};
  assert.deepEqual(entries().sets[0],saved);
  await ui.click('complete-set',{id,exercise});
  assert.equal(entries().sets[0].completed,true);
  assert.equal(ui.read().settings.exerciseUnits?.[exercise],undefined);
  assert.equal(ui.read().timer,null);
  await ui.click('add-three-sets',{id:instance});
  assert.equal(new Set(entries().sets.map(set=>set.id)).size,4);
  for(const set of entries().sets.slice(1))assert.deepEqual({...set,id},saved);
  await ui.click('edit-set',{id});
  values.distanceKm='';
  values.kcal='';
  await submit();
  assert.equal(entries().sets[0].distanceKm,null);
  assert.equal(entries().sets[0].kcal,null);
  await ui.click('delete-set',{date:day,id});
  assert.equal(entries().sets.length,3);
  await ui.click('undo');
  assert.equal(entries().sets[0].id,id);
  await ui.click('day',{date:shiftDay(day,1)});
  await ui.click('copy-previous');
  const copies=ui.read().workouts[shiftDay(day,1)].exercises[0].sets;
  assert.equal(copies.length,1);
  assert.deepEqual(copies[0],{...entries().sets[0],id:copies[0].id,completed:false});
});

test('set table switches pin the exercise unit independently of the header and other exercises', async t=>{
  const state=blankState();
  const day=localDate();
  state.workouts[day]={title:'PUSH',note:'',exercises:[
    {id:'press',exerciseId:'dumbbell-press',sets:[{...newSet(45.359237,6),completed:true}]},
    {id:'leg',exerciseId:'leg-press',sets:[newSet(134.5,8)]}
  ]};
  const ui=await openApp(t,JSON.stringify(state));
  const active=(id,u)=>ui.app.innerHTML.includes(`data-unit="${u}" class="active" aria-pressed="true" data-instance="${id}"`);
  await ui.click('unit',{instance:'press',unit:'lbs'});
  assert.equal(ui.read().settings.unit,'kg');
  assert.ok(active('press','lbs'));
  assert.ok(active('leg','kg'));
  await ui.click('unit',{instance:'leg',unit:'kg'});
  await ui.click('unit',{unit:'lbs'});
  assert.equal(ui.read().settings.unit,'lbs');
  assert.deepEqual(ui.read().settings.exerciseUnits,{'dumbbell-press':'lbs','leg-press':'kg'});
  assert.ok(active('press','lbs'));
  assert.ok(active('leg','kg'));
  assert.deepEqual(ui.read().workouts,state.workouts);
});

test('each completed exercise starts its chosen duration only on opt-in, and reset uses that duration', async t=>{
  let now=Date.now();
  t.mock.method(Date,'now',()=>now);
  const state=blankState();
  state.settings.exerciseRestSeconds={'leg-press':120};
  const day=localDate();
  state.workouts[day]={title:'Workout',note:'',exercises:['leg-press','dumbbell-press'].map(exerciseId=>({
    id:'entry-'+exerciseId,exerciseId,sets:[{...newSet(20,10),id:'set-'+exerciseId,assisted:true}]
  }))};
  const ui=await openApp(t,JSON.stringify(state));
  const complete=exercise=>ui.click('complete-set',{id:'set-'+exercise,exercise});
  await complete('leg-press');
  assert.equal(ui.read().timer,null);
  assert.equal(ui.read().settings.exerciseUnits['leg-press'],'kg');
  await ui.events.change({target:{dataset:{change:'setting-auto'},checked:true}});
  await complete('dumbbell-press');
  assert.equal(ui.read().timer.duration,90);
  await complete('leg-press'); // Return to draft.
  await complete('leg-press');
  assert.equal(ui.read().timer.duration,120);
  now+=7000;
  await ui.click('pause-timer');
  assert.equal(ui.read().timer.remaining,113);
  assert.equal(ui.read().timer.endAt,null);
  await ui.click('pause-timer');
  assert.equal(ui.read().timer.endAt,now+113000);
  await ui.click('reset-timer');
  assert.equal(ui.read().timer.endAt,now+120000);
});

test('the saved duration of a paused timer survives reload, while old timers remain usable',async t=>{
  const state=blankState();
  state.timer={duration:35,endAt:null,remaining:22,finished:false};
  const ui=await openApp(t,JSON.stringify(state));
  await ui.click('reset-timer');
  assert.equal(ui.read().timer.remaining,35);
  const legacy={...state,timer:{endAt:Date.now()+60000,remaining:60,finished:false}};
  ui.values.set(dataKey,JSON.stringify(legacy));
  ui.windowEvents.storage({key:dataKey,storageArea:ui.storage});
  await ui.click('reset-timer');
  assert.equal(ui.read().timer.duration,60);
  assert.equal(ui.read().timer.remaining,60);
});

test('a rest timer chimes once on visible completion, and stays silent when muted or long overdue',async t=>{
  let now=Date.now(), chimes=0;
  t.mock.method(Date,'now',()=>now);
  const ui=await openApp(t);
  window.AudioContext=class {
    state='running';
    currentTime=0;
    createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},start(){chimes++;},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
    close(){this.state='closed';}
  };
  const sound=checked=>ui.events.change({target:{dataset:{change:'setting-timer-sound'},checked}});
  const start=()=>ui.click('start-timer',{seconds:10,exercise:'leg-press'});
  await sound(true);
  assert.equal(ui.read().settings.timerSound,true);
  await start();
  await ui.tick();
  assert.equal(chimes,0);
  now+=10000;
  await Promise.all([ui.tick(),ui.tick()]);
  await ui.tick();
  assert.equal(ui.read().timer.finished,true);
  assert.equal(chimes,1);

  await start();
  await sound(false);
  now+=10000;
  await ui.tick();
  assert.equal(ui.read().timer.finished,true);
  assert.equal(chimes,1);

  await sound(true);
  await start();
  document.hidden=true;
  now+=10000;
  await ui.tick();
  assert.equal(chimes,1);
  now+=60000;
  document.hidden=false;
  await ui.tick();
  assert.equal(ui.read().timer.finished,true);
  assert.equal(chimes,1);
});

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

test('mapped CSV import is atomic on quota failure and detects an intervening write before retry', async t=>{
  const original=blankState(), day=localDate();
  original.workouts[day]={title:'保存済み',note:'既存の記録',exercises:[]};
  const ui=await openApp(t,JSON.stringify(original));
  const event={preventDefault(){}};
  const file={files:[], addEventListener(){}}, text={value:'',addEventListener(){}};
  const error={}, preview={}, back={addEventListener(){}}, copyPrompt={addEventListener(){}};
  let previewRows;
  const sourceForm={
    querySelector:key=>({'#workout-import-file':file,'#workout-import-text':text,'#form-error':error,
      '[data-preview-workouts]':preview,'[data-copy-workout-transcription]':copyPrompt})[key],
    addEventListener(name,fn){if(name==='submit')previewRows=fn;}
  };
  const previewList={replaceChildren(...items){this.items=items;}};
  const previewControls={querySelector:()=>({addEventListener(){}})};
  const mappingFields={
    '[data-import-back]':back,'#form-error':error,'[data-preview-range]':{},
    '[data-preview-list]':previewList,'[data-preview-pages]':previewControls,
    '[data-preview-all]':{parentElement:{},addEventListener(){},setAttribute(){}}
  };
  document.createElement=()=>({});
  const mappingForm={querySelector:key=>mappingFields[key]??null};
  ui.modal.querySelector=key=>({'#workout-import-source':sourceForm,'#workout-import-map':mappingForm})[key]??null;
  ui.modal.contains=form=>ui.modal.open&&(form===sourceForm||form===mappingForm);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'FormData');
  Object.defineProperty(globalThis,'FormData',{configurable:true,value:class {
    get(key){return key==='map-0'?'dumbbell-press':null;}
  }});
  t.after(()=>Object.defineProperty(globalThis,'FormData',descriptor));
  async function stage(){
    await ui.click('workout-import');
    text.value='日付,種目,重量(kg),回数\n'+day+',プレス,20,8\n'+day+',プレス,21,6';
    await previewRows(event);
    assert.match(ui.modal.innerHTML,/workout-import-map/);
    assert.match(previewList.items[1].textContent,/21 kg × 6回/);
  }
  const submit=()=>ui.modal.onsubmit({...event,target:mappingForm});
  await stage();
  ui.storage.failKey=dataKey;
  await submit();
  assert.deepEqual(ui.read(),original);
  assert.equal(ui.modal.open,false);
  // A subsequent successful action must not flush an in-memory partial merge.
  ui.storage.failKey=null;
  await ui.click('favorite',{id:'leg-press'});
  assert.deepEqual(ui.read().workouts,original.workouts);

  await stage();
  const remote=ui.read();
  remote.workouts[day].note='別タブの更新';
  ui.values.set(dataKey,JSON.stringify(remote));
  await submit();
  assert.deepEqual(ui.read(),remote);
  assert.match(ui.toast.innerHTML,/別のタブ/);
  await stage();
  await submit();
  const merged=ui.read().workouts[day];
  assert.equal(merged.note,remote.workouts[day].note);
  assert.equal(merged.exercises[0].exerciseId,'dumbbell-press');
  assert.deepEqual(merged.exercises[0].sets.map(s=>s.kg),[20,21]);
  await stage();
  await submit();
  assert.deepEqual(ui.read().workouts[day],merged);
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

test('a storage refresh cannot auto-save a focused note over a second tab; the draft can be resolved explicitly', async t=>{
  const date=localDate(), state=blankState();
  state.workouts[date]={title:'Workout',note:'元のメモ',exercises:[]};
  const ui=await openApp(t,JSON.stringify(state));
  const localDraft='Aの下書き', remoteNote='Bが保存したメモ';
  const field={dataset:{change:'session-note',mode:'real',date},defaultValue:'元のメモ',value:localDraft};
  ui.app.querySelector=selector=>selector.includes('session-note')?field:null;
  const remote=ui.read();
  remote.workouts[date].note=remoteNote;
  ui.values.set(dataKey,JSON.stringify(remote));
  // Chromium commits a focused textarea's change while innerHTML removes it.
  let markup=ui.app.innerHTML;
  let removed=false, blurSave;
  Object.defineProperty(ui.app,'innerHTML',{
    get:()=>markup,
    set(value){
      if(!removed){removed=true;blurSave=ui.events.change({target:field});}
      markup=value;
    }
  });
  ui.windowEvents.storage({key:dataKey,storageArea:ui.storage});
  await blurSave;
  assert.deepEqual(ui.read(),remote);
  assert.match(markup,/Bが保存したメモ/);
  assert.match(markup,/Aの下書き<\/textarea>/);

  field.defaultValue=localDraft;
  field.value='Aの訂正した下書き';
  await ui.events.change({target:field});
  assert.deepEqual(ui.read(),remote);
  // B saves again before A's explicit choice acquires the record lock.
  remote.workouts[date].note='Bの再訂正';
  ui.values.set(dataKey,JSON.stringify(remote));
  await ui.click('save-note-draft',{date});
  assert.deepEqual(ui.read(),remote);
  assert.match(markup,/Bの再訂正/);
  assert.match(markup,/Aの訂正した下書き<\/textarea>/);
  await ui.click('save-note-draft',{date});
  assert.equal(ui.read().workouts[date].note,field.value);
  assert.doesNotMatch(markup,/data-action="save-note-draft"/);
});

test('discarding a note draft keeps the other tab’s note, including a deliberate deletion', async t=>{
  const date=localDate(), state=blankState();
  state.workouts[date]={title:'Workout',note:'元のメモ',exercises:[]};
  const ui=await openApp(t,JSON.stringify(state));
  const field={dataset:{change:'session-note',mode:'real',date},defaultValue:'元のメモ',value:'このタブの下書き'};
  ui.app.querySelector=selector=>selector.includes('session-note')?field:null;
  const remote=ui.read();
  remote.workouts[date].note='';
  ui.values.set(dataKey,JSON.stringify(remote));
  // The storage event is still queued when the user leaves the textarea.
  await ui.events.change({target:field});
  assert.deepEqual(ui.read(),remote);
  assert.match(ui.app.innerHTML,/このタブの下書き<\/textarea>/);
  await ui.click('discard-note-draft',{date});
  assert.deepEqual(ui.read(),remote);
  assert.doesNotMatch(ui.app.innerHTML,/このタブの下書き|data-action="discard-note-draft"/);
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

test('adding three sets appends independent drafts copied from the last set and undoes them together', async t=>{
  const state=blankState();
  state.settings.unit='lbs';
  const day=localDate();
  const source={...newSet(45.359237,7),completed:true,rpe:8.5};
  const originals=[newSet(32,10),source];
  state.workouts[day]={title:'PUSH',note:'',exercises:[
    {id:'press',exerciseId:'dumbbell-press',sets:originals},
    {id:'empty',exerciseId:'leg-press',sets:[]}
  ]};
  const ui=await openApp(t,JSON.stringify(state));
  assert.match(ui.app.innerHTML, /data-action="add-three-sets" data-id="empty"[^>]* disabled/);
  await ui.click('add-three-sets',{id:'empty'});
  assert.deepEqual(ui.read(),state);
  await ui.click('add-three-sets',{id:'press'});
  const [press,empty]=ui.read().workouts[day].exercises;
  assert.deepEqual(press.sets.slice(0,2),originals);
  assert.equal(press.sets.length,5);
  assert.equal(new Set(press.sets.map(set=>set.id)).size,5);
  for(const copy of press.sets.slice(2)){
    assert.deepEqual(copy,{...source,id:copy.id,completed:false});
  }
  assert.deepEqual(empty.sets,[]);
  assert.match(ui.toast.innerHTML,/data-action="undo"/);
  await ui.click('undo');
  assert.deepEqual(ui.read(),state);
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
