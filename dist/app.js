import {EXERCISES} from './catalog.js';
import {getExercises,getRoutines,editExercise,saveRoutine,deleteRoutine,EXERCISE_GROUPS} from './catalog-settings.js';
import {openMealImport} from './meal-import-ui.js';
import {openWorkoutImport} from './workout-import-ui.js';
import {mergeWorkoutImport} from './workout-import.js';
import * as C from './core.js';
import { calorieHistoryChart } from './calorie-history.js';
import {editedWeightKg, weightPresets} from './workout-input.js';
import { buildAiPrompt } from './ai-prompt.js';
import { monthlyShareReport, drawMonthlySummary } from './month-share.js';
import { createInstallController } from './install.js';
import { createTimerSound } from './timer-sound.js';
import {
  cardEntryHeight, cardRowHeight, currentWeightLabel, planNutritionLines, setDetails, sharedWorkout,
  shareFilename, workoutCardLayout, workoutCsv,
} from './share.js';

const PATHS={
  'copy-previous': [
    'M3 16.5V3.8a1.6 1.6 0 0 1 1.6-1.6h12',
    'M7.3 5.5h13.2a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H7.3a1.5 1.5 0 0 1-1.5-1.5V7a1.5 1.5 0 0 1 1.5-1.5Z',
    'M9.3 12a5 5 0 0 1 9.1-1M18.4 8.7v2.7h-2.7',
    'M18.7 15.5a5 5 0 0 1-9.1 1M9.6 18.8v-2.7h2.7',
    'M14 10.8v3.1l1.7 1.1',
  ].join(' '),
  dumbbell:'M6 6v12M3 9v6m15-9v12m3-9v6M6 12h12',food:'M4 3v6a3 3 0 0 0 6 0V3M7 3v19M19 3c-4 4-4 10 0 10V3m0 10v9',chart:'M4 4v16h17M7 14l4-5 4 3 5-8',crown:'m3 6 5 4 4-7 4 7 5-4-2 12H5L3 6Zm3 15h12',calendar:'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 3v4l-3 3-3 1-1 3h-4l-1-3-3-1-3-3v-4l3-3 3-1 1-3Z',share:'M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2',plus:'M12 5v14M5 12h14',copy:'M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2ZM16 4V2H2v14h2',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',more:'M5 12h.01M12 12h.01M19 12h.01',search:'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm6 14 5 5',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v6h4',edit:'m16 3 5 5-12 12H4v-5L16 3Zm-2 2 5 5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',shield:'M12 3 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-3Zm-4 9 3 3 5-6',save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',upload:'M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5',fire:'M12 2c1 6 7 6 7 13a7 7 0 1 1-14 0c0-3 2-5 3-6 0 3 1 4 2 4 2-3 3-6 2-11Z',target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 4h.01',history:'M3 10a9 9 0 1 1 1 7M3 3v7h7M12 7v6l4 2',pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4Z',reset:'M3 9a9 9 0 1 1 0 6M3 3v6h6',weight:'M7 6h10l4 15H3L7 6Zm2 0V4a3 3 0 0 1 6 0v2',list:'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',chevron:'m9 5 7 7-7 7',heart:'M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]??PATHS.dumbbell}"/></svg>`;
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(a,label,ic='',cls='',attrs='')=>`<button type="button" data-action="${a}" class="button ${cls}" ${attrs}>${ic?icon(ic):''}${h(label)}</button>`;
const ib=(a,label,ic,attrs='',cls='')=>`<button type="button" data-action="${a}" class="icon-button ${cls}" title="${h(label)}" aria-label="${h(label)}" ${attrs}>${icon(ic)}</button>`;
const nf=C.fmt;
const app=document.querySelector('#app');const modal=document.querySelector('#modal');
let installStorage;
try { installStorage=window.localStorage; } catch {}
const install=createInstallController(window, navigator, installStorage, updateInstallControls);
const timerSound=createTimerSound(window);
let today=C.localDate();
let view='workout',day=today,month=day.slice(0,7),prGroup='すべて',searchText='',searchGroup='お気に入り',toastTimeout,undoState=null,undoFingerprint='',storageProblem='',loadBlocked=false;
let mode='demo',state;
try{mode=localStorage.getItem('repnote:mode')??(localStorage.getItem('repnote:v1:real')?'real':'demo');if(!['demo','real'].includes(mode))mode='demo';}catch{storageProblem='このブラウザでは保存が使えません。設定からバックアップを書き出せます。';}
const storageKey=()=>`repnote:v1:${mode}`;
const noteDrafts=new Map();
const noteSelector='textarea[data-change="session-note"]';
let refreshingNote=false;
function noteDraftKey(date,owner=mode){return `repnote:note-draft:${owner}:${date}`;}
function getNoteDraft(key){
  if(noteDrafts.has(key))return noteDrafts.get(key);
  try{
    const draft=JSON.parse(window.sessionStorage?.getItem(key)??'null');
    if(typeof draft?.base==='string'&&typeof draft.text==='string'){
      noteDrafts.set(key,draft);
      return draft;
    }
  }catch{}
}
function setNoteDraft(key,draft){
  if(draft)noteDrafts.set(key,draft);else noteDrafts.delete(key);
  try{
    if(draft)window.sessionStorage?.setItem(key,JSON.stringify(draft));
    else window.sessionStorage?.removeItem(key);
  }catch{} // The open tab still keeps the draft when sessionStorage is unavailable.
}
function rememberNoteDraft(field){
  const key=noteDraftKey(field.dataset.date,field.dataset.mode);
  const draft={base:getNoteDraft(key)?.base??field.defaultValue,text:field.value};
  setNoteDraft(key,draft);
  return draft;
}
const exerciseIds=EXERCISES.map(e=>e.id);
let loadedRaw, committedState;
function load(){
  loadedRaw=undefined;
  loadBlocked=false;
  storageProblem='';
  try{
    loadedRaw=localStorage.getItem(storageKey());
    if(loadedRaw===null)state=mode==='demo'?C.demoState():C.blankState();
    else{
      const parsed=JSON.parse(loadedRaw);
      state=C.validateState(parsed,exerciseIds);
      const t=parsed.timer;
      if(t&&(t.endAt===null||Number.isFinite(t.endAt))&&Number.isFinite(t.remaining)&&t.remaining>=0){
        // A running legacy timer kept its selected seconds in remaining until first paused.
        const duration=t.duration??(t.endAt?t.remaining:state.settings.timerSeconds);
        state.timer={endAt:t.endAt,remaining:t.remaining,finished:t.finished===true||(t.endAt===null&&t.remaining===0),
          ...(typeof t.exerciseId==='string'&&[...EXERCISES,...state.customExercises].some(ex=>ex.id===t.exerciseId)?{exerciseId:t.exerciseId}:{}),
          duration:Number.isFinite(duration)&&duration>=10&&duration<=3600?duration:state.settings.timerSeconds};
      }
    }
  }catch{
    state=C.blankState();
    loadBlocked=true;
    storageProblem='保存データを読み込めませんでした。元データは保持しています。「設定」で書き出し・復元ができます。';
  }
  committedState=JSON.stringify(state);
  if(!state.settings.timerSound)void timerSound.disarm();
}
load();
function invalidateHistory(){
  undoState=null;
  stagedImport=null;
}
function refreshFromStorage(){
  const field=app.querySelector(noteSelector);
  const focused=field&&field===document.activeElement;
  if(field&&field.value!==field.defaultValue)rememberNoteDraft(field);
  invalidateHistory();
  load();
  // Replacing a focused textarea can dispatch change while removing the old node.
  refreshingNote=true;
  try{
    if(modal.open)modal.close();
    render();
  }finally{refreshingNote=false;}
  if(focused){
    const next=app.querySelector(noteSelector);
    next?.focus({preventScroll:true});
    next?.setSelectionRange(field.selectionStart,field.selectionEnd,field.selectionDirection);
  }
  toast(storageProblem||'別のタブの変更を反映しました。最新の記録を確認してください');
}
// Check the stored revision inside a per-mode lock before modifying any records.
function withRecordLock(edit,{allowRecovery=false,allowDayChange=false}={}){
  const key=storageKey(), selectedDay=day, current=state;
  function run(){
    if(key!==storageKey()||(!allowDayChange&&selectedDay!==day)||current!==state){
      toast('表示が変わりました。最新の記録を確認してください');
      return;
    }
    try{
      if(loadedRaw!==undefined&&localStorage.getItem(key)!==loadedRaw){refreshFromStorage();return;}
    }catch{
      toast('保存領域を読み取れないため、変更を保存できません');
      return;
    }
    if(loadBlocked&&!allowRecovery){toast(storageProblem);return;}
    return edit();
  }
  if(navigator.locks)return navigator.locks.request(key,run).catch(()=>toast('記録の保存を開始できませんでした'));
  return run();
}
function save({restoring=false}={}){
  try{
    if(loadBlocked&&!restoring)throw new Error(storageProblem);
    C.validateState(state,exerciseIds);
    const raw=JSON.stringify(state);
    localStorage.setItem(storageKey(),raw);
    loadedRaw=committedState=raw;
    storageProblem='';
    loadBlocked=false;
    return true;
  }catch(err){
    state=JSON.parse(committedState);
    undoState=null;
    storageProblem=loadBlocked?storageProblem:'変更を保存できませんでした。直前の記録を保持しています。'+(err.name==='Error'?' '+err.message:'');
    if(modal.open)modal.close();
    render();
    toast(storageProblem);
    return false;
  }
}
function commit(message){
  if(!save())return false;
  render();
  if(message)toast(message);
  return true;
}
function toast(message,undo=false){const el=document.querySelector('#toast');el.innerHTML=`<span>${h(message)}</span>${undo?'<button data-action="undo">元に戻す</button>':''}`;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),undo?8000:3500);}
function undoable(fn,message){
  undoState=structuredClone(state);
  fn();
  undoFingerprint=JSON.stringify({...state,timer:null});
  if(!save())return false;
  render();
  toast(message,true);
  return true;
}
const catalog=()=>getExercises(state);
function showWorkoutImport(){
  openWorkoutImport({openDialog,modal,h,bindForm,catalog:catalog(),toast,onMerge(parsed,mapping){
    const result=mergeWorkoutImport(state,parsed,mapping,catalog());
    if(result.added || result.linked){
      state=result.state;
      if(!commit())return false;
    }
    modal.close();
    toast(`追加 ${result.added}件・重複 ${result.duplicates}件・対象外 ${result.skipped}件`);
    return true;
  }});
}
function showMealImport(){
  const targetDay=day;
  openMealImport({day:targetDay,modal,openDialog,bindForm,h,toast,onSave(entries){
    state.meals[targetDay]=[...(state.meals[targetDay]??[]),...entries];
    if(!commit(`${entries.length}件の食事を取り込みました`))return false;
    modal.close();
    return true;
  }});
}
const exercise=id=>catalog().find(e=>e.id===id)??{id,name:'未登録の種目',group:'',equipment:'',load:'total'};
const getWorkout=()=>state.workouts[day]??{title:'WORKOUT',exercises:[],note:''};
function ensureWorkout(date=day){return state.workouts[date]??=( {title:'WORKOUT',exercises:[],note:''});}
const instance=id=>getWorkout().exercises.find(e=>e.id===id);
const setById=id=>getWorkout().exercises.flatMap(e=>e.sets).find(s=>s.id===id);
const unit=()=>state.settings.unit;
const exerciseUnit=id=>C.exerciseUnit(state,id);
function unitSwitch(label='標準の重量単位・合計ボリュームの表示単位',instanceId,selectedUnit=unit()){
  const context=instanceId?` data-instance="${h(instanceId)}"`:'';
  const buttons=['kg','lbs'].map(value=>{
    const active=selectedUnit===value;
    return `<button type="button" data-action="unit" data-unit="${value}" class="${active?'active':''}" aria-pressed="${active}"${context}>${value}</button>`;
  });
  return `<div class="unit-switch" role="group" aria-label="${h(label)}" title="${h(label)}">${buttons.join('')}</div>`;
}
const weight=(kg,displayUnit,dec=2)=>nf(C.fromKg(kg,displayUnit),dec);
const dateLabel=(d,long=false)=>C.parseDay(d).toLocaleDateString('ja-JP',{month:'long',day:'numeric',...(long?{year:'numeric',weekday:'short'}:{})});
const loadLabel=e=>e.id==='cable-fly'?'片側の表示重量':({single:'片手の重量',total:'合計重量',stack:'マシン表示の重量',body:'追加重量（自重は0）',cardio:'時間・距離など'}[e.load]);
const shortLoad=e=>e.id==='cable-fly'?'片側の表示重量':({single:'片手',total:'合計',stack:'表示重量',body:'追加重量',cardio:'時間・距離など'}[e.load]);
const progress=(value,target)=>target>0?Math.max(0,Math.min(100,value/target*100)):0;
function describeSet(set,ex,showWeights=true){
  const u=exerciseUnit(ex.id);
  return setDetails(set,showWeights ? weight(set.kg,u) : null,u,shortLoad(ex));
}
const NAV=[['workout','トレーニング','dumbbell','筋トレ'],['food','食事・PFC','food','食事'],['body','からだ・計画','chart','からだ'],['records','自己ベスト','crown','ベスト'],['history','カレンダー','calendar','履歴']];
function installBanner(){
  return `<section class="install-banner" id="install-banner" aria-label="アプリのインストール">
    <img src="./icon.svg" alt="" width="38" height="38">
    <strong>REPS NOTEをホーム画面に追加</strong>
    ${btn('install-app','インストール','download')}
    ${ib('dismiss-install','インストール案内を閉じる','close')}
  </section>`;
}
function installSettings(){
  return `<div class="settings-row" id="install-settings"><div><h3>アプリのインストール</h3><p>${install.isInstalled()?'インストール済み':'ホーム画面からREPS NOTEを開けます。'}</p></div>
    ${install.isInstalled()?'':btn('install-app','インストール','download','','data-source="settings"')}</div>`;
}
function updateInstallControls(){
  if (!install.shouldShowBanner()) document.querySelector('#install-banner')?.remove();
  const row=modal.querySelector('#install-settings');
  if (row) row.outerHTML=installSettings();
}
async function requestInstall(fromSettings){
  const result=await install.requestInstall();
  install.dismissBanner();
  updateInstallControls();
  if(result==='manual'){
    const instructions=install.isIOS()
      ? ['SafariでREPS NOTEを開き、「共有」をタップします。','「ホーム画面に追加」を選び、「追加」をタップします。']
      : ['ブラウザーのメニューを開きます。','「アプリをインストール」または「ホーム画面に追加」があれば選択します。'];
    const help=install.isIOS()?'':'項目が見つからない場合は、ChromeやEdgeでこのページを開いてください。';
    openDialog('ホーム画面に追加',`<ol class="install-steps">${instructions.map(line=>`<li>${h(line)}</li>`).join('')}</ol>
      ${help?`<p class="mini-subtitle">${h(help)}</p>`:''}
      <div class="modal-actions">${fromSettings?btn('settings','設定に戻る'):btn('close','閉じる')}</div>`);
  }else if(result==='accepted') toast('インストールを受け付けました');
}
function render(){
  const title=NAV.find(n=>n[0]===view)?.[1]??'トレーニング';
  const showInstall=install.shouldShowBanner();
  app.innerHTML=`<aside class="sidebar"><div class="brand"><img src="./icon.svg" alt="">REPS NOTE</div><nav class="nav" aria-label="メインメニュー">${NAV.map(([id,label,ic])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(ic)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><button class="nav-item" data-action="settings">${icon('settings')}設定・バックアップ</button></div></aside>
  <main class="shell"><header class="topbar"><div><div class="eyebrow">REPS NOTE</div><h1>${title}</h1></div><div class="top-actions">${unitSwitch()}<button class="button primary" data-action="share" aria-label="記録をシェア">${icon('share')}<span class="share-label">記録をシェア</span></button>${ib('settings','設定・バックアップ','settings','', 'header-settings')}</div></header>
  ${showInstall?installBanner():''}
  ${mode==='demo'?`<div class="demo-banner"><span>サンプル表示中 · 架空の記録</span><button data-action="start-real">自分の記録をはじめる</button></div>`:''}
  ${storageProblem?`<div class="error-banner" role="alert">${h(storageProblem)}</div>`:''}
  ${view==='workout'?renderWorkout():view==='food'?renderFood():view==='body'?renderBody():view==='records'?renderRecords():renderHistory()}
  </main><nav class="mobile-nav" aria-label="メインメニュー">${NAV.map(([id,label,ic,short])=>`<button data-action="nav" data-view="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span>${short}</span></button>`).join('')}</nav>`;
  if(showInstall) install.markBannerShown();
  renderTimer();
}
function dateStrip(){
  const dow=C.parseDay(day).getDay();
  const start=C.shiftDay(day,-((dow+6)%7));
  return `<div class="date-control between">
    <div class="row"><input type="date" value="${day}" aria-label="記録する日付" data-change="date">${day!==today?btn('today','今日','','ghost'):''}</div>
    ${btn('copy-ai-prompt','AIへの質問文をコピー','copy','ai-copy','title="選択日のトレーニング・食事をまとめてコピー"')}
  </div><div class="week">${Array.from({length:7},(_,i)=>{const d=C.shiftDay(start,i),has=C.workoutStats(state.workouts[d]).sets>0;return `<button class="day ${d===day?'active':''} ${d===today?'today':''}" data-action="day" data-date="${d}" aria-label="${dateLabel(d)}の記録" aria-pressed="${d===day}"><div class="dow">${['月','火','水','木','金','土','日'][i]}</div><div class="num">${C.parseDay(d).getDate()}</div><div class="day-dot ${has?'':'blank'}"></div></button>`;}).join('')}</div>`;
}

async function copyAiPrompt(){
  const text=buildAiPrompt(state,day,{sample:mode==='demo'});
  try{
    await navigator.clipboard.writeText(text);
    toast('AIへの質問文をコピーしました');
  }catch{
    openDialog('AIへの質問文をコピー','<p>質問文を長押しするか、端末のコピー操作でコピーしてください。</p><textarea id="ai-prompt-text" class="share-text" aria-label="AIへの質問文" rows="10" readonly></textarea>');
    const field=modal.querySelector('#ai-prompt-text');
    field.value=text;
    field.focus();
    field.select();
  }
}
function renderWorkout(){const w=getWorkout(),stats=C.workoutStats(w),prs=C.records(state);return `<div class="layout"><section class="main-col">${dateStrip()}<div class="workout-hero"><div><div class="eyebrow">${day===today?'TODAY’S WORKOUT':'WORKOUT LOG'}</div><div class="hero-title">${h(w.title)}</div>${stats.exercises?`<p>${h(catalogGroups(w))}</p>`:''}</div><div class="hero-right">${btn('routines','メニューを選ぶ','list')}</div></div><div class="metric-grid"><div class="metric"><div class="label">${icon('check')}完了セット</div><div class="value">${stats.sets}<span>/ ${stats.total}</span></div></div><div class="metric"><div class="label">${icon('weight')}ボリューム</div><div class="value">${weight(stats.volume,unit(),0)}<span>${unit()}</span></div></div><div class="metric"><div class="label">${icon('dumbbell')}種目</div><div class="value">${stats.exercises}</div></div></div><div class="workout-toolbar"><h2>セットを記録</h2><div class="row">${btn('copy-previous','前回をコピー','copy')}</div></div>
  ${w.exercises.length?w.exercises.map(e=>renderExercise(e,prs)).join(''):`<div class="panel empty">${icon('dumbbell')}<h3>この日のメニューは未登録です</h3><p>前回の記録や保存したメニューから、種目と入力値を呼び出せます。</p>${btn('routines','メニューからはじめる','list','primary')}</div>`}
  <button class="add-exercise" data-action="add-exercise">${icon('plus')}種目を追加</button><div class="panel session-note" style="margin-top:20px"><div class="between"><h3>トレーニングメモ</h3>${btn('save-routine','メニューを保存','save','ghost')}</div>${sessionNoteEditor(w.note)}<div class="save-note">${icon('shield')}${mode==='demo'?'サンプルモードで保存':'このブラウザに自動保存'} · 完了したセットを集計</div></div><div class="small" style="margin-top:14px">ボリューム＝完了したセットの入力重量 × 回数の合計。ダンベルは片手分、自重の体重分は含みません。</div></section><aside class="side-col">${nutritionPanel()}${highlightPanel(prs)}${weightPanel()}<div class="tip-box"><strong>${icon('copy')} セットの複製</strong>行のコピーアイコンで同じ内容のセットを複製。チェックを入れたセットだけが記録に加わります。</div></aside></div>`;}
function sessionNoteEditor(saved){
  const key=noteDraftKey(day);
  let draft=getNoteDraft(key);
  if(draft&&draft.text===saved){setNoteDraft(key,null);draft=null;}
  const conflict=draft&&draft.base!==saved;
  return `${draft?`<div class="info-box" role="status">${conflict?`<strong>別のタブで保存されたメモ</strong><p style="white-space:pre-wrap;overflow-wrap:anywhere">${h(saved)||'（空欄）'}</p>`:''}このタブの下書きは下の欄で編集できます。</div>`:''}
    <textarea placeholder="調子、フォーム、次回気をつけたいこと…" aria-label="トレーニングメモ" maxlength="2000" data-change="session-note" data-date="${day}" data-mode="${mode}" ${draft?'data-review-draft':''}>
${h(draft?.text??saved)}</textarea>
    ${draft?`<div class="row">${btn('save-note-draft','下書きで保存','save','primary',`data-date="${day}"`)}${btn('discard-note-draft','保存済みのメモを使う','','ghost',`data-date="${day}"`)}</div>`:''}`;
}
function saveSessionNote(date,text,field){
  ensureWorkout(date).note=text;
  if(!save())return false;
  setNoteDraft(noteDraftKey(date),null);
  if(field)field.defaultValue=text;
  return true;
}
function catalogGroups(w){return [...new Set(w.exercises.map(e=>exercise(e.exerciseId).group))].filter(Boolean).join('・');}
function options(values,current,formatter=n=>String(n),extra=''){return values.map(n=>`<option value="${n}" ${(typeof n==='number'?Math.abs(n-current)<1e-8:n===current)?'selected':''}>${h(formatter(n))}</option>`).join('')+extra;}
function weightOption({kg, value}, selectedKg) {
  return `<option value="${value}" data-kg="${kg}" ${kg === selectedKg ? 'selected' : ''}>${nf(value, 2)}</option>`;
}
function weightOptions(set, last, ex) {
  const unit = C.exerciseUnit(state, ex.id);
  const near = weightPresets(ex, unit, state.settings.weightStep, set.kg).filter(preset => preset.kg !== set.kg);
  near.push({kg:set.kg, value:C.fromKg(set.kg, unit)});
  near.sort((a,b) => a.kg-b.kg);
  const used = new Set(near.map(preset => preset.kg));
  const recent = [];
  for (const {kg} of last?.sets ?? []) {
    if (!used.has(kg)) {
      recent.push({kg, value:C.fromKg(kg, unit)});
      used.add(kg);
    }
  }
  const group = (label, values) => `<optgroup label="${label}">${values.map(option => weightOption(option, set.kg)).join('')}</optgroup>`;
  return group('現在・近くの重量', near) +
    '<option value="custom">直接入力…</option>' +
    (recent.length ? group('前回の重量', recent) : '') +
    '<optgroup label="すべての重量" data-weight-range></optgroup>';
}

// Populate the full native picker only when it is used, instead of thousands of options per workout.
function expandWeightPicker(event) {
  const el = event.target;
  if (el.dataset?.change !== 'set-weight') return;
  const group = el.querySelector('[data-weight-range]');
  if (!group || group.childElementCount) return;
  const ex = exercise(el.dataset.exercise);
  const existing = new Set(Array.from(el.options, option => option.dataset.kg));
  const values = weightPresets(ex, C.exerciseUnit(state, ex.id), state.settings.weightStep);
  group.innerHTML = values.filter(preset => !existing.has(String(preset.kg))).map(preset => weightOption(preset)).join('');
}
document.addEventListener('pointerdown', expandWeightPicker);
document.addEventListener('focusin', expandWeightPicker);

function renderCardioTable(inst,ex,last){
  const rows=inst.sets.map((set,index)=>{
    const previous=last?.sets[index]??last?.sets.at(-1);
    const label=`${ex.name} セット${index+1}`;
    const attrs=`data-id="${h(set.id)}"`;
    const times=[...new Set([5,10,15,20,25,30,40,45,60,90,120,set.minutes])].sort((a,b)=>a-b);
    const details=C.CARDIO_FIELDS.filter(field=>!field.required && set[field.key]!=null)
      .map(({key,label,unit})=>`${label} ${nf(set[key],2)} ${unit}`).join(' · ');
    return `<div class="cardio-row ${set.completed?'done':''}">
      <span class="set-num">${index+1}</span>
      <select aria-label="${h(label)}の時間（分）" data-change="cardio-minutes" ${attrs}>
        ${options(times,set.minutes,n=>n+' 分','<option value="custom">直接入力…</option>')}
      </select>
      ${btn('edit-set','詳細','edit','cardio-edit',`${attrs} aria-label="${h(label)}の時間・距離などを編集"`)}
      <button type="button" class="complete-check ${set.completed?'checked':''}" data-action="complete-set" ${attrs} data-exercise="${h(ex.id)}" aria-label="${h(label)}を${set.completed?'未完了にする':'完了にする'}" aria-pressed="${set.completed}">${icon('check')}</button>
      ${ib('copy-set',label+'をコピー','copy',`${attrs} data-instance="${h(inst.id)}"`)}
      ${ib('delete-set',label+'を削除','trash',`${attrs} data-date="${day}"`)}
      ${details?`<div class="cardio-values">${h(details)}</div>`:''}
      ${previous?`<div class="cardio-previous">前回 ${h(C.cardioDetails(previous))}</div>`:''}
    </div>`;
  });
  return `<div class="set-table cardio-table"><div class="cardio-labels" aria-hidden="true"><span>SET</span><span>時間</span><span>詳細</span><span>完了</span><span>複製</span><span>削除</span></div>${rows.join('')}</div>`;
}

function cardioEditor(set,ex,date,focusDuration){
  const fields=C.CARDIO_FIELDS.map(field=>{
    const {key,label,unit,min,max,step,required}=field;
    const keyboard=step===1?'numeric':'decimal';
    const attrs=`type="number" min="${min}" max="${max}" step="${step}" inputmode="${keyboard}" ${required?'required':''}`;
    if(key!=='inclinePct')return inputField(key,`${label}（${unit}）`,set[key]??'',attrs);
    return `<div class="field"><label for="field-inclinePct">傾斜（%）</label><div class="signed-number">
      <input id="field-inclinePct" name="inclinePct" value="${h(set.inclinePct??'')}" ${attrs}>
      <button type="button" class="icon-button" data-action="flip-incline" aria-label="入力した傾斜の正負を切り替える" title="傾斜の正負を切り替える">±</button></div></div>`;
  });
  openDialog('有酸素の記録',`<p>${h(ex.name)} · ${dateLabel(date,true)}</p><form aria-describedby="cardio-form-hint"><p id="cardio-form-hint">時間以外は任意です。</p><div class="form-grid cardio-form-fields">${fields.join('')}</div>${formEnd('保存する')}</form>`);
  const incline=modal.querySelector('[name="inclinePct"]');
  if(incline){
    const flip=modal.querySelector('[data-action="flip-incline"]');
    const updateSignButton=()=>{flip.disabled=!Number.isFinite(incline.valueAsNumber)||incline.valueAsNumber===0;};
    incline.addEventListener('input',updateSignButton);
    updateSignButton();
    flip.addEventListener('click',()=>{
      incline.valueAsNumber=-incline.valueAsNumber;
      incline.focus();
    });
  }
  bindForm(data=>{
    const values={};
    for(const field of C.CARDIO_FIELDS){
      const raw=data.get(field.key);
      const value=raw==null||String(raw).trim()===''?null:Number(raw);
      need(C.validCardioValue(field,value),`${field.label}を正しく入力してください。`);
      values[field.key]=value;
    }
    Object.assign(set,values);
    if(commit('有酸素の記録を保存しました'))modal.close();
  });
  if(focusDuration)modal.querySelector('[name="minutes"]')?.focus();
}


function focusSet(id, field = 'set-weight', reveal = false) {
  const row = `[data-id="${CSS.escape(id)}"]`;
  const el = app.querySelector(`[data-change="${field}"]${row}`) ??
    (field === 'set-weight' ? app.querySelector(`[data-change="cardio-minutes"]${row}`) : null);
  el?.focus({preventScroll:true});
  if (reveal) el?.scrollIntoView({block:'nearest'});
}
function renderStrengthTable(inst,ex,last,prs,u){return `<div class="set-table"><div class="set-grid labels"><span>SET</span><span class="previous">前回</span><div class="weight-heading"><span>重量</span>${unitSwitch(`${ex.name}の重量表示単位`,inst.id,u)}</div><span>回数</span><span>完了</span><span>複製</span><span></span><span>削除</span></div>${inst.sets.map((s,i)=>{const prev=last?.sets[i]??last?.sets.at(-1),isPR=prs[ex.id]?.id===s.id;return `<div class="set-grid set-row ${s.completed?'done':''}"><div class="set-num">${s.kind==='warmup'?'W':i+1}${isPR?icon('crown','tiny-crown'):s.assisted?'<span class="small">補</span>':''}</div><div class="previous ${prev?'has-previous':''}">${prev?`<span class="previous-label">前回 </span>${weight(prev.kg,u)} × ${prev.reps}`:'—'}</div><select aria-label="${h(ex.name)} セット${i+1}の重量（${u}）" data-change="set-weight" data-exercise="${h(ex.id)}" data-load="${ex.load}" data-id="${h(s.id)}">${weightOptions(s,last,ex)}</select><select aria-label="${h(ex.name)} セット${i+1}の回数" data-change="set-reps" data-id="${h(s.id)}">${options([...new Set([...Array.from({length:30},(_,i)=>i+1),40,50,60,100,s.reps])].sort((a,b)=>a-b),s.reps,n=>n,'<option value="custom">直接入力…</option>')}</select><button class="complete-check ${s.completed?'checked':''}" data-action="complete-set" data-id="${h(s.id)}" data-exercise="${h(ex.id)}" aria-label="${h(ex.name)} セット${i+1}を${s.completed?'未完了にする':'完了にする'}" aria-pressed="${s.completed}">${icon('check')}</button>${ib('copy-set',`${ex.name} セット${i+1}をコピー`,'copy',`data-id="${h(s.id)}" data-instance="${h(inst.id)}"`)}${ib('edit-set',`${ex.name} セット${i+1}の詳細を編集`,'more',`data-id="${h(s.id)}"`)}${ib('delete-set',`${ex.name} セット${i+1}を削除`,'trash',`data-id="${h(s.id)}" data-date="${day}"`)}</div>`;}).join('')}</div>`;}
function renderExercise(inst,prs){const ex=exercise(inst.exerciseId),last=C.lastExercise(state,ex.id,day),u=exerciseUnit(ex.id);return `<article class="exercise-card" id="exercise-${h(inst.id)}"><div class="exercise-head"><div class="row"><div class="badge-icon">${icon(ex.load==='cardio'?'heart':'dumbbell')}</div><div><div class="exercise-title">${h(ex.name)}</div><div class="exercise-sub">${h(ex.group)} · ${h(ex.equipment)} · ${h(loadLabel(ex))}</div></div></div><div class="exercise-tools">${ib('favorite',state.favorites.includes(ex.id)?'お気に入りから外す':'お気に入りに追加','star',`data-id="${h(ex.id)}"`,state.favorites.includes(ex.id)?'active':'')}${ib('exercise-menu','種目の編集・削除','more',`data-id="${h(inst.id)}"`)}</div></div>${ex.load==='cardio'?renderCardioTable(inst,ex,last):renderStrengthTable(inst,ex,last,prs,u)}<div class="exercise-footer">
  ${ib('add-set',ex.name+'のセットを1つ追加','plus',`data-id="${h(inst.id)}"`)}
  <button type="button" class="icon-button" data-action="add-three-sets" data-id="${h(inst.id)}" title="最後のセットを3つコピーして追加" aria-label="${h(ex.name)}の最後のセットを3つコピーして追加" ${inst.sets.length?'':'disabled'}>
    ${icon('copy')}<span class="set-count-badge" aria-hidden="true">3</span>
  </button>
  ${ib('copy-exercise-previous',ex.name+'の前回のセットをコピー'+(last?`（${dateLabel(last.date)}）`:''),'copy-previous',`data-id="${h(inst.id)}"`)}
  ${ib('timer-open',ex.name+'の休憩タイマー','clock',`data-exercise="${h(ex.id)}" aria-haspopup="dialog"`,'exercise-timer-button')}
</div>${inst.note?`<div class="exercise-note">${h(inst.note)}</div>`:''}</article>`;}
function macroRows(t,plan=state.plan){return [['p','P','たんぱく質','#202020'],['f','F','脂質','#656565'],['c','C','炭水化物','#969696']].map(([key,abbr,label,color])=>`<div class="progress-row"><div class="progress-info"><span class="progress-label"><i class="macro-dot" style="background:${color}"></i><strong>${abbr}</strong>${label}</span><span class="mono">${nf(t[key])}<span class="muted"> / ${plan?.[key]>0?nf(plan[key])+' g':'目標未設定'}</span></span></div><div class="progress-track"><div class="progress-fill" style="background:${color};width:${progress(t[key],plan?.[key])}%"></div></div></div>`).join('');}
function calorieRing(t,big=false){const target=state.plan?.kcal;return `<div class="ring-wrap"><div class="cal-ring" style="--value:${progress(t.kcal,target)};--ring:${target&&t.kcal>target?'#222222':'#444444'}"><div class="inner">${icon('fire')}${big?'<div class="small">ENERGY</div>':''}</div></div><div><div class="ring-number">${nf(t.kcal,0)}<span>kcal</span></div><div class="mini-subtitle">${target>0?`目標 ${nf(target,0)} kcal`:'カロリー目標は未設定'}</div>${target>0?`<div class="pill" style="margin-top:9px">${t.kcal<=target?'あと':'目標より'} ${nf(Math.abs(target-t.kcal),0)} kcal${t.kcal>target?'多い':''}</div>`:''}</div></div>`;}
function nutritionPanel(){const t=C.mealTotals(state.meals[day]);return `<section class="panel"><div class="panel-heading"><h2>${day===today?'今日の栄養':'この日の栄養'}</h2><span class="tag">${dateLabel(day)}</span></div>${calorieRing(t)}${macroRows(t)}${btn('nav-food','食事を記録する','plus','full')}</section>`;}
function highlightPanel(prs){const pr=Object.values(prs).sort((a,b)=>b.date.localeCompare(a.date))[0];const u=pr?exerciseUnit(pr.exerciseId):unit();return `<section class="panel record-highlight"><div class="record-crown">${icon('crown')}</div><div class="eyebrow">PERSONAL BEST</div><h2>${pr?h(exercise(pr.exerciseId).name):'自己ベストは未登録です'}</h2><div class="big-record">${pr?weight(pr.kg,u):'—'}<span>${u}</span></div><div class="mini-subtitle">${pr?`${pr.reps} 回 · ${h(shortLoad(exercise(pr.exerciseId)))} · ${dateLabel(pr.date)}`:'完了したセットからベストを見つけます'}</div><button class="text-button" data-action="nav" data-view="records">すべての自己ベストを見る</button></section>`;}
function weightPanel(){const values=state.body.filter(C.bodyMeasurementAsOf(day<today?day:today)).sort(C.compareBodyMeasurements),latest=values.at(-1),first=values[0];return `<section class="panel"><div class="panel-heading" style="margin-bottom:8px"><h2>からだの変化</h2>${icon('chart')}</div><div class="mini-weight">${latest?nf(latest.kg):'—'}<span>kg</span>${latest&&first?`<span class="change">初回比 ${latest.kg-first.kg>0?'+':''}${nf(latest.kg-first.kg)} kg</span>`:''}</div>${miniChart(values)}<div class="between"><span class="small">${latest?measurementLabel(latest)+'の記録':'体重の記録からはじめよう'}</span><button class="text-button" data-action="nav" data-view="body">計画を見る</button></div></section>`;}
function measurementLabel(entry, long=false){
  return dateLabel(entry.date,long)+(entry.time?' '+entry.time:'');
}

// Use local calendar coordinates. An untimed reading occupies the start of its day on the chart.
function measurementPosition({date,time}){
  return Date.parse(date+'T'+(time||'00:00')+':00Z');
}

function miniChart(values){if(!values.length)return '<div style="height:55px"></div>';const ys=values.map(b=>b.kg),min=Math.min(...ys)-.2,max=Math.max(...ys)+.2;const start=measurementPosition(values[0]),span=measurementPosition(values.at(-1))-start;const pts=values.map(v=>[8+(span?(measurementPosition(v)-start)/span:0)*254,75-(v.kg-min)/(max-min)*60]);return `<svg class="mini-graph" viewBox="0 0 270 90" role="img" aria-label="体重の推移"><path d="M8 80H262" stroke="#e1e1e1"/><path d="M${pts.map(p=>p.join(',')).join(' L')} L${pts.at(-1)[0]},80 L8,80Z" fill="#f1f1f1"/><path d="M${pts.map(p=>p.join(',')).join(' L')}" fill="none" stroke="#333333" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4" fill="#333333" stroke="white" stroke-width="2"/></svg>`;}
function renderFood(){const list=state.meals[day]??[],t=C.mealTotals(list);return `<div class="layout"><section class="main-col">${dateStrip()}<div class="panel food-summary">${calorieRing(t,true)}<div>${macroRows(t)}<div class="small" style="margin-top:12px">PFC由来のエネルギー ${nf(C.macroEnergy(t),0)} kcal</div></div></div>${calorieHistoryChart(state.meals,day)}<div class="section-heading"><h2>食事の記録</h2><div class="row">${btn('meal-import','AIから一括取込','download')}${btn('copy-food-day','前日をコピー','copy')}${btn('add-food','食事を追加','plus','primary')}</div></div>${['朝食','昼食','夕食','間食'].map(meal=>{const ms=list.filter(m=>m.meal===meal);return `<section class="meal-section"><div class="meal-header"><span>${meal}</span><small>${nf(C.mealTotals(ms).kcal,0)} kcal</small></div>${ms.length?ms.map(m=>{const mt=C.mealTotals([m]);return `<div class="food-item"><div><h3>${h(m.name)}</h3><div class="food-detail">${nf(m.amount,2)}${m.basis==='100g'?' g':' 食分'} · P ${nf(mt.p)} / F ${nf(mt.f)} / C ${nf(mt.c)} g</div></div><div class="row"><div class="food-value">${nf(mt.kcal,0)}<span> kcal</span></div>${ib('copy-food','この食事をコピー','copy',`data-id="${h(m.id)}"`)}${ib('edit-food','この食事を編集','edit',`data-id="${h(m.id)}"`)}</div></div>`;}).join(''):`<button class="empty-line" style="width:100%;text-align:left" data-action="add-food" data-meal="${meal}">＋ ${meal}を記録する</button>`}</section>`;}).join('')}</section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>いつもの食事</h2>${icon('heart')}</div><p class="mini-subtitle">登録した食品を選んで、量だけ入力。</p>${state.foods.length?`<div class="suggestions">${state.foods.map(f=>`<button class="suggestion" data-action="saved-food" data-id="${h(f.id)}">${icon('plus')}${h(f.name.replace('（サンプル）',''))}</button>`).join('')}</div>`:`<div class="empty-line" style="margin-top:15px">食事を追加するときに「いつもの食事に登録」を選べます。</div>`}${btn('manage-foods','登録した食品を管理','edit','full ghost')}</section><section class="panel"><div class="panel-heading"><h2>目標のPFCバランス</h2>${icon('target')}</div><p class="mini-subtitle">自分の計画に合わせて、1日のカロリーとPFC目標を設定。</p>${state.plan?['kcal','p','f','c'].map((k,i)=>`<div class="stat-line"><span>${['カロリー','たんぱく質','脂質','炭水化物'][i]}</span><strong>${state.plan[k]>0?nf(state.plan[k])+(i?' g':' kcal'):'未設定'}</strong></div>`).join(''):''}${btn('edit-plan','目標を設定する','edit','full')}</section><div class="tip-box"><strong>カロリーとPFCの計算</strong>カロリーはパッケージの値を入力できます。PFCから計算した値とは、食物繊維や表示の丸めなどで差が出ることがあります。</div></aside></div>`;}
function bodyRecordAttrs(entry){
  return entry.id ? `data-id="${h(entry.id)}"` : `data-date="${h(entry.date)}"`;
}
function renderBodyEntry(entry){
  const when=measurementLabel(entry,true);
  return `<div class="body-entry"><div>${when}${entry.time?'':' · 時刻未記録'}<small>${entry.bodyFat==null?'体脂肪率の記録なし':'体脂肪率 '+nf(entry.bodyFat)+'%'}</small></div>
    <div class="row"><strong>${nf(entry.kg)} <small style="display:inline">kg</small></strong>
    ${ib('edit-body',when+' '+nf(entry.kg)+'kgの記録を訂正','edit',bodyRecordAttrs(entry))}</div></div>`;
}
function renderBody(){const plan=state.plan,ps=C.planStats(plan,state.body,today),body=[...state.body].sort(C.compareBodyMeasurements).reverse(),latest=body.find(C.bodyMeasurementAsOf(today));return `<div class="layout"><section class="main-col"><div class="workout-hero"><div><div class="eyebrow">BODY LOG</div><div class="hero-title">${plan?(plan.targetWeight<plan.startWeight?'減量プラン':plan.targetWeight>plan.startWeight?'増量プラン':'体重維持プラン'):'体重の記録'}</div>${plan?`<p>${dateLabel(plan.startDate)} — ${dateLabel(plan.targetDate)}</p>`:''}</div></div><div class="metric-grid"><div class="metric"><div class="label">スタート</div><div class="value">${plan?nf(plan.startWeight):'—'}<span>kg</span></div></div><div class="metric"><div class="label">現在の体重</div><div class="value">${latest?nf(latest.kg):'—'}<span>kg</span></div></div><div class="metric"><div class="label">目標体重</div><div class="value">${plan?nf(plan.targetWeight):'—'}<span>kg</span></div></div></div><section class="panel"><div class="panel-heading"><h2>体重の推移</h2>${btn('add-body','体重を記録','plus','primary')}</div>${bodyChart()}<div class="chart-legend"><span>実際の記録</span><span>計画上のライン</span></div></section><div class="section-heading"><h2>からだの記録</h2><small>体重はkgで記録</small></div><section class="panel">${body.length?body.map(renderBodyEntry).join(''):`<div class="empty">${icon('chart')}<h3>変化を記録しよう</h3><p>体重と、任意で体脂肪率を記録できます。</p></div>`}</section></section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>ボディメイク計画</h2>${icon('target')}</div>${plan?`<div class="pill">${plan.targetWeight<plan.startWeight?'減量':plan.targetWeight>plan.startWeight?'増量':'体重維持'}プラン</div><div class="stat-line"><span>開始</span><strong>${dateLabel(plan.startDate)}</strong></div><div class="stat-line"><span>目標日</span><strong>${dateLabel(plan.targetDate)}</strong></div><div class="stat-line"><span>計画上のペース</span><strong>${ps.weekly>0?'+':''}${nf(ps.weekly,2)} kg/週</strong></div><div class="stat-line"><span>目標日まで</span><strong>${ps.remainingDays} 日</strong></div><div class="progress-row"><div class="progress-info"><span>目標への進み具合</span><strong>${nf(ps.progress,0)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${ps.progress}%"></div></div></div><p class="mini-subtitle" style="margin-top:14px">計画線は開始と目標を結んだ目安です。体重の変化を予測・保証するものではありません。</p>`:'<p class="mini-subtitle">スタートと目標、期間を決めて、実際の記録と見比べられます。</p>'}${btn('edit-plan',plan?'計画・PFC目標を編集':'計画をつくる','edit','full')}${btn('share-plan','計画をシェア','share','full ghost')}</section>${nutritionPanel()}</aside></div>`;}
function bodyChart(){
  const plan=state.plan, measurements=state.body.filter(b=>b.date<=today).sort(C.compareBodyMeasurements);
  if(!measurements.length&&!plan)return `<div class="empty">${icon('chart')}<p>体重を記録すると、ここにグラフが表示されます。</p></div>`;
  const bounds=plan?[...measurements,{date:plan.startDate,kg:plan.startWeight},{date:plan.targetDate,kg:plan.targetWeight}].sort(C.compareBodyMeasurements):measurements;
  const first=bounds[0],last=bounds.at(-1),start=measurementPosition(first),span=measurementPosition(last)-start;
  const weights=bounds.map(b=>b.kg),min=Math.floor(Math.min(...weights)-.5),max=Math.ceil(Math.max(...weights)+.5);
  const x=point=>52+(span?(measurementPosition(point)-start)/span:0)*550;
  const y=kg=>210-(kg-min)/(max-min)*170;
  const axisLabel=point=>first.date===last.date?measurementLabel(point):dateLabel(point.date);
  const guides=Array.from({length:5},(_,i)=>{
    const kg=min+(max-min)*i/4;
    return `<line x1="52" x2="602" y1="${y(kg)}" y2="${y(kg)}" stroke="#e2e2e2" stroke-dasharray="4 5"/><text x="43" y="${y(kg)+4}" text-anchor="end" font-size="12" fill="#686868">${nf(kg)}</text>`;
  });
  const showUntimedNote=measurements.some(b=>b.time)&&measurements.some(b=>!b.time);
  return `<svg class="chart" viewBox="0 0 630 260" role="img" aria-label="測定日時ごとの体重。各測定値は下のからだの記録に掲載しています。">
    ${guides.join('')}<text x="9" y="21" font-size="11" fill="#686868">kg</text>
    ${plan?`<path d="M${x({date:plan.startDate})},${y(plan.startWeight)} L${x({date:plan.targetDate})},${y(plan.targetWeight)}" stroke="#777777" stroke-width="2" stroke-dasharray="6 6" fill="none"/>`:''}
    ${measurements.length?`<path d="M${measurements.map(b=>x(b)+','+y(b.kg)).join(' L')}" fill="none" stroke="#252525" stroke-width="3" stroke-linejoin="round"/>`:''}
    ${measurements.map(b=>`<circle cx="${x(b)}" cy="${y(b.kg)}" r="4" fill="#252525" stroke="white" stroke-width="2"><title>${measurementLabel(b,true)}${b.time?'':'（時刻未記録）'}・${b.kg}kg</title></circle>`).join('')}
    <text x="52" y="242" font-size="12" fill="#686868">${axisLabel(first)}</text>
    ${span?`<text x="602" y="242" text-anchor="end" font-size="12" fill="#686868">${axisLabel(last)}</text>`:''}</svg>
    ${showUntimedNote?'<p class="small">時刻が未記録の測定は、その日の先頭に表示します。</p>':''}`;
}
function renderRecords(){const prs=Object.values(C.records(state)).filter(p=>prGroup==='すべて'||exercise(p.exerciseId).group===prGroup).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="pr-intro"><div><div class="eyebrow">PERSONAL BEST</div><h2>種目別の最高重量</h2><p>補助なしで完了したメインセットを集計します。</p></div>${icon('crown')}</div><div class="between"><h2>自己ベスト <span class="muted" style="font-weight:400;font-size:15px">${Object.keys(C.records(state)).length} 種目</span></h2>${btn('record-info','集計ルール','','ghost')}</div><div class="filter-row">${['すべて',...EXERCISE_GROUPS].map(g=>`<button class="chip ${prGroup===g?'active':''}" data-action="pr-group" data-group="${g}">${g}</button>`).join('')}</div><div class="wide-grid">${prs.map(p=>{const e=exercise(p.exerciseId),u=exerciseUnit(e.id);return `<article class="panel pr-card">${icon('crown')}<span class="pill">${h(e.group)} · ${h(e.equipment)}</span><h3>${h(e.name)}</h3><div class="pr-number">${weight(p.kg,u)}<span>${u} × ${p.reps} 回</span></div><div class="small">${h(shortLoad(e))} · ${dateLabel(p.date,true)}</div><button class="text-button" data-action="edit-record" data-date="${p.date}" data-id="${h(p.id)}">${icon('edit')} 元の記録を訂正する</button></article>`;}).join('')}</div>${!prs.length?`<div class="panel empty">${icon('crown')}<h3>自己ベストはここに並びます</h3><p>ウォームアップ・補助ありを除く、完了したセットの最高重量を集計します。</p>${btn('nav-workout','トレーニングを記録','plus','primary')}</div>`:''}<div class="small" style="margin-top:22px">同じ重量では回数が多いセットを表示。自重種目の0kgは追加重量なしを意味します。異なるマシンはカスタム種目を分けて記録してください。</div>`;}
function renderHistory(){const start=`${month}-01`,startDow=C.parseDay(start).getDay(),gridStart=C.shiftDay(start,-((startDow+6)%7));const dates=Object.keys(state.workouts).filter(d=>state.workouts[d].exercises.length).sort().reverse();
  const summary=C.monthlySummary(state,month);
  return `<div class="layout"><section class="main-col"><section class="panel"><div class="panel-heading"><h2>${Number(month.slice(0,4))}年 ${Number(month.slice(5))}月</h2><div class="row">${btn('previous-month','前月','','ghost')}${btn('next-month','翌月','','ghost')}</div></div><div class="calendar">${['月','火','水','木','金','土','日'].map(d=>`<div class="weekday">${d}</div>`).join('')}${Array.from({length:42},(_,i)=>{const d=C.shiftDay(gridStart,i),st=C.workoutStats(state.workouts[d]);return `<button class="calendar-day ${d.slice(0,7)===month?'':'outside'} ${d===day?'active':''}" data-action="history-date" data-date="${d}" aria-label="${dateLabel(d)}、完了した記録${st.sets}件、食事${(state.meals[d]??[]).length}件"><span>${C.parseDay(d).getDate()}</span><span class="day-marks">${st.sets?'<span></span>':''}${(state.meals[d]??[]).length?'<span class="food-dot"></span>':''}</span></button>`;}).join('')}</div><div class="history-calendar-footer"><span class="small">● トレーニング　○ 食事記録</span>${btn('share-month','月間まとめをシェア','share','primary')}</div></section><div class="section-heading"><h2>最近のトレーニング</h2><span class="small">タップして確認・訂正</span></div><section class="panel">${dates.length?dates.map(d=>{const w=state.workouts[d],st=C.workoutStats(w);return `<button class="history-item" data-action="history-date" data-date="${d}"><div><h3>${h(w.title)} <span class="pill">${catalogGroups(w)}</span></h3><small>${dateLabel(d,true)} · ${st.exercises}種目 / ${st.sets}セット完了</small></div><div class="history-score">${weight(st.volume,unit(),0)} ${unit()}</div></button>`;}).join(''):'<div class="empty">まだ記録がありません。</div>'}</section></section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>${Number(month.slice(5))}月の記録</h2>${icon('calendar')}</div><div class="stat-line"><span>トレーニングした日</span><strong>${summary.trainingDays} 日</strong></div><div class="stat-line"><span>筋トレ完了セット</span><strong>${summary.strengthSets} セット</strong></div><div class="stat-line"><span>自己ベスト更新</span><strong>${summary.updatedExercises} 種目</strong></div>${summary.cardioSessions?`<div class="stat-line"><span>有酸素</span><strong>${nf(summary.cardioMinutes,2)} 分</strong></div>`:''}<div class="stat-line"><span>食事を記録した日</span><strong>${summary.mealDays} 日</strong></div></section>${highlightPanel(C.records(state))}</aside></div>`;}

function openDialog(title,body,subtitle=''){modal.innerHTML=`<header class="modal-head"><div>${subtitle?`<div class="eyebrow">${h(subtitle)}</div>`:''}<h2 id="modal-title">${h(title)}</h2></div>${ib('close','閉じる','close')}</header><div class="modal-content">${body}</div>`;modal.onsubmit=null;if(!modal.open)modal.showModal();modal.scrollTop=0;}
const inputField=(name,label,value='',attrs='',cls='')=>`<div class="field ${cls}"><label for="field-${name}">${h(label)}</label><input id="field-${name}" name="${name}" value="${h(value)}" ${attrs}></div>`;
const selectField=(name,label,values,value,cls='')=>`<div class="field ${cls}"><label for="field-${name}">${h(label)}</label><select id="field-${name}" name="${name}">${values.map(v=>{const [id,text]=Array.isArray(v)?v:[v,v];return `<option value="${h(id)}" ${id===value?'selected':''}>${h(text)}</option>`;}).join('')}</select></div>`;
const formEnd=(label='保存する',extra='')=>`<div class="form-error" id="form-error" role="alert"></div><div class="modal-actions">${extra}${btn('close','キャンセル')}<button type="submit" class="button primary">${h(label)}</button></div>`;
function bindForm(fn){
  modal.onsubmit=e=>{
    e.preventDefault();
    const form=e.target, data=new FormData(form);
    if(state.settings.timerSound && (form.id==='rest-timer-form' || e.submitter?.hasAttribute('data-rest-start')))void timerSound.arm();
    return withRecordLock(()=>{
      if(!modal.open||!modal.contains(form))return;
      try{fn(data,e.submitter);}catch(err){
        const error=form.querySelector('#form-error');
        if(error)error.textContent=err.message;else toast(err.message);
      }
    });
  };
}
const need=(ok,message)=>{if(!ok)throw Error(message);};
const number=(fd,k,min=0,max=100000)=>{const raw=fd.get(k);const v=Number(raw);need(raw!==null&&raw!==''&&Number.isFinite(v)&&v>=min&&v<=max,`${({kg:'重量',reps:'回数',amount:'量',kcal:'カロリー',p:'たんぱく質',f:'脂質',c:'炭水化物',startWeight:'開始体重',targetWeight:'目標体重'})[k]??k}を正しく入力してください。`);return v;};
function openExercisePicker(reset=true){if(reset){searchText='';searchGroup='お気に入り';}openDialog('種目を追加',`<div class="search-field">${icon('search')}<input id="exercise-search" placeholder="種目名・略称で検索（例：DBプレス）" value="${h(searchText)}" aria-label="種目を検索"></div><div class="filter-row">${['お気に入り','最近','すべて','有酸素','胸','背中','肩','腕','脚','体幹'].map(g=>`<button class="chip ${g===searchGroup?'active':''}" data-action="search-group" data-group="${g}">${g}</button>`).join('')}</div><div class="exercise-results" id="exercise-results">${exerciseResults()}</div><div class="modal-actions">${btn('custom-exercise','自分の種目をつくる','plus')}</div>`,'QUICK ADD');}
function exerciseResults(){const recents=[...new Set(Object.keys(state.workouts).sort().reverse().flatMap(d=>state.workouts[d].exercises.map(e=>e.exerciseId)))];const q=searchText.normalize('NFKC').toLocaleLowerCase().trim();let list=catalog().filter(e=>(!q||[e.name,e.group,e.equipment,...e.aliases].some(v=>v.normalize('NFKC').toLocaleLowerCase().includes(q)))&&(q||searchGroup==='すべて'||(searchGroup==='お気に入り'?state.favorites.includes(e.id):searchGroup==='最近'?recents.includes(e.id):e.group===searchGroup)));if(searchGroup==='最近'&&!q)list.sort((a,b)=>recents.indexOf(a.id)-recents.indexOf(b.id));return list.length?list.map(e=>`<div class="exercise-option"><button class="option-main" data-action="choose-exercise" data-id="${h(e.id)}"><span class="badge-icon">${icon(e.load==='cardio'?'heart':'dumbbell')}</span><span><strong>${h(e.name)}</strong><small>${h(e.group)} · ${h(e.equipment)} · ${h(shortLoad(e))}</small></span></button>${ib('picker-favorite',state.favorites.includes(e.id)?'お気に入りから外す':'お気に入りに追加','star',`data-id="${h(e.id)}"`,state.favorites.includes(e.id)?'active':'')}${ib('choose-exercise',`${e.name}を追加`,'plus',`data-id="${h(e.id)}"`)}</div>`).join(''):`<div class="empty"><h3>種目が見つかりません</h3><p>「すべて」を選ぶか、別の名前で検索してください。</p></div>`;}
function addExercise(id){const w=ensureWorkout();if(w.exercises.some(e=>e.exerciseId===id)){toast('この種目は追加済みです');return false;}const last=C.lastExercise(state,id,day);const inst=last?{id:C.uid(),exerciseId:id,note:last.note??'',sets:last.sets.filter(s=>s.completed).map(C.cloneSet)}:{id:C.uid(),exerciseId:id,note:'',sets:[exercise(id).load==='cardio'?C.newCardioSet():C.newSet()]};w.exercises.push(inst);return true;}
function customExerciseForm(){openDialog('自分の種目をつくる',`<p>違うマシンや別のフォームは、別の種目として記録すると比較しやすくなります。</p><form><div class="form-grid">${inputField('name','種目名','','required maxlength="100" placeholder="例：レッグプレス（ジムA）"','full')}${selectField('group','部位',['胸','背中','肩','腕','脚','体幹'],'胸')}${selectField('equipment','器具',['バーベル','ダンベル','マシン','ケーブル','自重'],'マシン')}${selectField('load','重量の記録方法',[['total','合計重量'],['single','片手の重量'],['stack','マシン表示の重量'],['body','追加重量（自重は0）']],'stack','full')}</div>${formEnd('作成して追加')}</form>`);bindForm(fd=>{const name=String(fd.get('name')).trim();need(name.length>0,'種目名を入力してください。');need(!catalog().some(e=>e.name===name),'同名の種目があります。別の名前を付けてください。');const id=C.uid();state.customExercises.push({id,name,group:fd.get('group'),equipment:fd.get('equipment'),load:fd.get('load'),aliases:[]});state.favorites.push(id);addExercise(id);modal.close();commit('種目を追加しました');});}
function routineDialog(){
  const routines=getRoutines(state);
  const rows=routines.map(r=>{
    const attrs=`data-id="${h(r.id)}"`;
    return `<div class="routine-option"><div><h3>${h(r.name)}</h3><p>${r.subtitle?h(r.subtitle)+' · ':''}${r.exerciseIds.length}種目</p></div>
      <div class="row">${ib('edit-routine',r.name+'を編集','edit',attrs)}${btn('use-routine','追加する','plus','',attrs)}</div></div>`;
  }).join('');
  openDialog('メニューを選ぶ',`${rows||'<p>メニューを作成すると、種目をまとめて追加できます。</p>'}${btn('new-routine','メニューを作成','plus','full')}`);
}
function routineEditor(id,fromWorkout=false){
  const current=getRoutines(state).find(r=>r.id===id);
  if(id&&!current)return;
  const draft=fromWorkout?getWorkout():null;
  const ids=[...new Set(current?.exerciseIds??draft?.exercises.map(e=>e.exerciseId)??[])];
  const exercises=catalog();
  openDialog(current?'メニューを編集':'メニューを作成',`<form id="routine-editor">
    ${inputField('name','メニュー名',current?.name??draft?.title??'','required maxlength="80"')}
    ${inputField('subtitle','説明（任意）',current?.subtitle??(draft?catalogGroups(draft):''),'maxlength="250"')}
    <h3>種目と順番</h3><ol class="routine-sequence" data-routine-list></ol>
    <div class="routine-add"><label for="routine-add-ex">追加する種目</label><select id="routine-add-ex"></select>
    <button type="button" class="button" data-routine-op="add">種目を追加</button></div>
    ${formEnd('保存する',current?btn('delete-routine','メニューを削除','trash','danger',`data-id="${h(id)}"`):'')}
    </form>`);
  const form=modal.querySelector('#routine-editor');
  const choices=form.querySelector('#routine-add-ex');
  function updateList(){
    const list=form.querySelector('[data-routine-list]');
    list.innerHTML=ids.map((exerciseId,index)=>{
      const name=exercise(exerciseId).name;
      const op=(value,text,label,disabled=false)=>`<button type="button" class="icon-button" data-routine-op="${value}" data-index="${index}" aria-label="${h(name+label)}" ${disabled?'disabled':''}>${text}</button>`;
      return `<li><span>${index+1}. ${h(name)}</span><div>${op('up','↑','を上へ',index===0)}${op('down','↓','を下へ',index===ids.length-1)}${op('remove',icon('trash'),'を外す')}</div></li>`;
    }).join('');
    const remaining=exercises.filter(e=>!ids.includes(e.id));
    choices.innerHTML=remaining.map(e=>`<option value="${h(e.id)}">${h(e.name)}（${h(e.group)}）</option>`).join('');
    choices.disabled=!remaining.length;
    form.querySelector('[data-routine-op="add"]').disabled=!remaining.length;
  }
  updateList();
  form.addEventListener('click',event=>{
    const control=event.target.closest('[data-routine-op]');
    if(!control)return;
    const op=control.dataset.routineOp,index=Number(control.dataset.index);
    let focusIndex=index;
    if(op==='add'){
      if(choices.value&&!ids.includes(choices.value))ids.push(choices.value);
      focusIndex=ids.length-1;
    }else if(op==='remove'){
      ids.splice(index,1);
      focusIndex=Math.min(index,ids.length-1);
    }else{
      focusIndex=index+(op==='up'?-1:1);
      if(focusIndex<0||focusIndex>=ids.length)return;
      [ids[index],ids[focusIndex]]=[ids[focusIndex],ids[index]];
    }
    updateList();
    const row=form.querySelector(`[data-routine-list] li:nth-child(${focusIndex+1})`);
    const focus=(op==='add'&&!choices.disabled)?choices:
      row?.querySelector(`[data-routine-op="${op}"]:enabled`)??row?.querySelector('button:enabled')??choices;
    focus.focus();
  });
  bindForm(fd=>{
    saveRoutine(state,{id:id??C.uid(), name:fd.get('name'), subtitle:fd.get('subtitle'), exerciseIds:ids});
    if(commit('メニューを保存しました'))routineDialog();
  });
}
function confirmRoutineDeletion(id){
  const routine=getRoutines(state).find(r=>r.id===id);
  if(!routine)return;
  openDialog('メニューを削除',`<form><p>「${h(routine.name)}」をメニュー一覧から削除します。記録済みのトレーニングは保持されます。</p>${formEnd('削除する',btn('edit-routine','編集に戻る','','',`data-id="${h(id)}"`))}</form>`);
  bindForm(()=>{if(undoable(()=>deleteRoutine(state,id),'メニューを削除しました'))modal.close();});
}
function editExerciseForm(exerciseId,instanceId){
  const ex=exercise(exerciseId);
  openDialog('種目名・部位を編集',`<form id="exercise-editor"><p>この種目の過去の記録・メニュー・自己ベストにも反映します。</p>
    ${inputField('name','種目名',ex.name,`required maxlength="${Math.max(100,ex.name.length)}"`)}
    ${selectField('group','部位・カテゴリ',EXERCISE_GROUPS,ex.group)}
    ${formEnd('保存する')}</form>`);
  bindForm(fd=>{
    editExercise(state,exerciseId,{name:fd.get('name'),group:fd.get('group')});
    if(commit('種目を更新しました')){if(instanceId)exerciseMenu(instanceId);else openExercisePicker(false);}
  });
}

function setEditor(id,date=day,focusField='kg'){
  const workout=state.workouts[date];
  const entry=workout?.exercises.find(e=>e.sets.some(set=>set.id===id));
  const set=entry?.sets.find(set=>set.id===id);
  if(!set)return;
  const ex=exercise(entry.exerciseId);
  if(ex.load==='cardio')return cardioEditor(set,ex,date,focusField==='minutes');
  let draftUnit=exerciseUnit(ex.id);
  const displayWeight=(kg,u)=>Math.min(Number(C.fromKg(kg,u).toFixed(6)),C.fromKg(5000,u));
  const weightLabel=u=>`${loadLabel(ex)}（${u}）`;
  openDialog('セットを訂正する',`<p>${h(ex.name)} · ${dateLabel(date,true)}<br>訂正すると、自己ベストとボリュームも再計算されます。</p>
    <form><input type="hidden" name="baseKg" value="${set.kg}">
      <div class="form-grid">
        ${inputField('kg',weightLabel(draftUnit),displayWeight(set.kg,draftUnit),`type="number" min="0" max="${C.fromKg(5000,draftUnit)}" step="any" required inputmode="decimal"`)}
        ${selectField('inputUnit','重量の単位',['kg','lbs'],draftUnit)}
        ${inputField('reps','回数',set.reps,'type="number" min="1" max="999" step="1" required inputmode="numeric"')}
        ${selectField('kind','セットの種類',[['work','メインセット'],['warmup','ウォームアップ']],set.kind)}
        ${inputField('rpe','きつさ RPE（任意）',set.rpe??'','type="number" min="1" max="10" step="any" inputmode="decimal"')}
      </div>
      <label class="checkbox-row"><input name="completed" type="checkbox" ${set.completed?'checked':''}>完了したセット</label>
      <label class="checkbox-row"><input name="assisted" type="checkbox" ${set.assisted?'checked':''}>補助あり（自己ベストから除外）</label>
      ${formEnd('訂正して保存',btn('delete-set','セットを削除','trash','danger',`data-id="${h(id)}" data-date="${date}"`))}
    </form>`);
  const form=modal.querySelector('form');
  const {kg:weightInput,baseKg,inputUnit}=form.elements;
  // Keep the precise kg behind the rounded number, including while a submitted form waits for the record lock.
  function readKg(raw,base,u,completed){
    const originalKg=base===''?null:Number(base);
    const displayed=originalKg===null?null:displayWeight(originalKg,u);
    return editedWeightKg(raw,{unit:u,originalKg,displayed,completed,load:ex.load});
  }
  inputUnit.addEventListener('change',()=>{
    if(weightInput.validity.badInput || (weightInput.value!==''&&!weightInput.validity.valid)){
      inputUnit.value=draftUnit;
      weightInput.reportValidity();
      return;
    }
    const kg=weightInput.value===''?null:readKg(weightInput.value,baseKg.value,draftUnit,false);
    draftUnit=inputUnit.value;
    baseKg.value=kg??'';
    weightInput.max=C.fromKg(5000,draftUnit);
    weightInput.value=kg===null?'':displayWeight(kg,draftUnit);
    form.querySelector('label[for="field-kg"]').textContent=weightLabel(draftUnit);
  });
  bindForm(fd=>{
    const selectedUnit=fd.get('inputUnit');
    const kg=readKg(fd.get('kg'),fd.get('baseKg'),selectedUnit,fd.has('completed'));
    const reps=number(fd,'reps',1,999);
    need(Number.isInteger(reps),'回数は整数で入力してください。');
    const rpe=fd.get('rpe')===''?null:number(fd,'rpe',1,10);
    Object.assign(set,{kg,reps,kind:fd.get('kind'),rpe,completed:fd.has('completed'),assisted:fd.has('assisted')});
    C.setExerciseUnit(state,ex.id,selectedUnit);
    modal.close();
    commit('記録と自己ベストを更新しました');
  });
  modal.querySelector(`[name="${focusField}"]`)?.focus();
}
function exerciseMenu(id){
  const inst=instance(id);
  if(!inst)return;
  const rests=state.settings.exerciseRestSeconds;
  const seconds=rests&&Object.hasOwn(rests,inst.exerciseId)?rests[inst.exerciseId]:'';
  openDialog(exercise(inst.exerciseId).name,`${btn('edit-exercise','種目名・部位を編集','edit','full',`data-id="${h(inst.exerciseId)}" data-instance="${h(id)}"`)}<form>
    <div class="field"><label for="exercise-note">この種目のメモ</label><textarea id="exercise-note" name="note" maxlength="2000" placeholder="シートの位置、グリップ、次回のポイント…">${h(inst.note??'')}</textarea></div>
    ${inputField('restSeconds','この種目の休憩時間（秒）',seconds,`type="number" min="10" max="3600" step="1" inputmode="numeric" placeholder="共通設定：${state.settings.timerSeconds}秒"`)}
    <p class="mini-subtitle">次回もこの種目に適用します。空欄の場合は共通設定の${state.settings.timerSeconds}秒を使います。</p>
    ${formEnd('保存する',btn('delete-exercise','種目を削除','trash','danger',`data-id="${h(id)}"`))}
    <button type="submit" class="button full" data-rest-start>${icon('clock')}保存して休憩を開始</button>
  </form>`);
  bindForm((fd,submitter)=>{
    const seconds=fd.get('restSeconds');
    C.setExerciseRestSeconds(state,inst.exerciseId,seconds===''?null:Number(seconds));
    inst.note=fd.get('note');
    const start=submitter?.hasAttribute('data-rest-start');
    if(start)state.timer=runningTimer(C.exerciseRestSeconds(state,inst.exerciseId),inst.exerciseId);
    modal.close();
    if(commit(start?'休憩を開始しました':'メモと休憩時間を保存しました')&&start)timerDialog(inst.exerciseId);
  });
}
function foodForm({entry=null,preset=null,meal='朝食',saveOnly=false}={}){const f=entry??preset??{name:'',basis:'serving',amount:1,meal,kcal:'',p:0,f:0,c:0};openDialog(saveOnly?'登録した食品を編集':entry?'食事を訂正する':'食事を記録',`<p>${saveOnly?'登録済みの食品だけを更新します。過去の食事記録は当時の数値を保持します。':`${dateLabel(day,true)}の食事。パッケージの栄養表示などを入力してください。`}</p><form id="food-entry" data-base-amount="${h(entry?.importInfo?.baseAmount??'')}" data-base-basis="${h(f.basis)}">${foodImportSource(entry)}${!saveOnly&&state.foods.length?`<div class="field" style="margin-bottom:18px"><label for="saved-food-select">いつもの食事から選ぶ</label><select id="saved-food-select"><option value="">新しく入力する</option>${state.foods.map(x=>`<option value="${h(x.id)}" ${preset?.id===x.id?'selected':''}>${h(x.name)}</option>`).join('')}</select></div>`:''}<div class="form-grid">${inputField('name','食品・メニュー名',f.name,'required maxlength="200"','full')}${!saveOnly?selectField('meal','食事',['朝食','昼食','夕食','間食'],f.meal??meal):''}${selectField('basis','栄養表示の基準',[['serving','1食分あたり'],['100g','100gあたり']],f.basis)}${!saveOnly?inputField('amount',f.basis==='100g'?'食べた量（g）':'食べた量（食分）',f.amount??(f.basis==='100g'?100:1),'type="number" min="0.01" max="10000" step="any" required inputmode="decimal"'):''}${inputField('kcal','基準あたりのカロリー（kcal）',f.kcal,'type="number" min="0" max="100000" step="any" required inputmode="decimal"')}</div><div class="form-grid three" style="margin-top:17px">${['p','f','c'].map((k,i)=>inputField(k,['P たんぱく質（g）','F 脂質（g）','C 炭水化物（g）'][i],f[k],'type="number" min="0" max="100000" step="any" required inputmode="decimal"')).join('')}</div>${saveOnly?'':`<div class="food-ratios"><span class="small" data-portion-label></span><div role="group" aria-label="食べた量の倍率">${[.5,1,1.5,2].map(r=>btn('food-ratio',r+'倍','','',`data-food-ratio="${r}"`)).join('')}</div></div>`}<div class="info-box" id="food-calculation"></div>${!entry&&!saveOnly?'<label class="checkbox-row"><input type="checkbox" name="saveFood" '+(!preset?'checked':'')+'>いつもの食事に登録する</label>':''}${formEnd(saveOnly?'食品を更新':'食事を保存',entry?btn('delete-food','削除','trash','danger',`data-id="${h(entry.id)}"`):'')}</form>`);updateFoodCalculation();bindForm(fd=>{const data={name:String(fd.get('name')).trim(),basis:fd.get('basis'),kcal:number(fd,'kcal'),p:number(fd,'p'),f:number(fd,'f'),c:number(fd,'c')};need(data.name,'食品名を入力してください。');if(saveOnly){const item=state.foods.find(x=>x.id===preset.id);Object.assign(item,data);}else{const record={...data,id:entry?.id??C.uid(),amount:number(fd,'amount',.01,10000),meal:fd.get('meal')};if(entry?.importInfo&&['name','basis','kcal','p','f','c'].every(k=>entry[k]===data[k])&&Number.isFinite(entry.importInfo.baseAmount)&&entry.importInfo.baseAmount>0){record.importInfo={...entry.importInfo,multiplier:record.amount/entry.importInfo.baseAmount};}state.meals[day]??=[];if(entry)state.meals[day]=state.meals[day].map(m=>m.id===entry.id?record:m);else state.meals[day].push(record);if(fd.has('saveFood'))state.foods.push({...data,id:C.uid()});}modal.close();commit(saveOnly?'食品を更新しました':'食事を保存しました');});}
function foodImportSource(entry){
  const info=entry?.importInfo;
  if(!info)return '';
  const terms=[info.estimated?'推定値':'AI取込',typeof info.portion==='string'?info.portion:'',typeof info.source==='string'?info.source:''].filter(Boolean);
  return `<p class="small food-source">${terms.map(h).join(' · ')}</p>`;
}
function foodPortionBase(form){
  const base=Number(form.dataset.baseAmount),basis=form.elements.basis.value;
  return form.dataset.baseBasis===basis&&Number.isFinite(base)&&base>0?base:(basis==='100g'?100:1);
}
function updateFoodCalculation(){const form=modal.querySelector('form'),out=modal.querySelector('#food-calculation');if(!out||!form)return;const fd=new FormData(form),amount=Number(fd.get('amount')??1),basis=fd.get('basis'),mult=fd.has('amount')?(basis==='100g'?amount/100:amount):1;const values={kcal:Number(fd.get('kcal')),p:Number(fd.get('p')),f:Number(fd.get('f')),c:Number(fd.get('c'))};const portionLabel=form.querySelector('[data-portion-label]');
  if(portionLabel){const base=foodPortionBase(form);portionLabel.textContent=`1倍の量　${nf(base,2)}${basis==='100g'?' g':'食分'}`;for(const b of form.querySelectorAll('[data-food-ratio]'))b.setAttribute('aria-pressed',String(Math.abs(amount-base*Number(b.dataset.foodRatio))<1e-8));}
  out.textContent=`${fd.has('amount')?'今回の量：':'表示の基準：'}${nf(values.kcal*mult,0)} kcal / P ${nf(values.p*mult)}・F ${nf(values.f*mult)}・C ${nf(values.c*mult)} g（PFC由来 ${nf(C.macroEnergy(values)*mult,0)} kcal）`;}
function manageFoods(){openDialog('いつもの食事を管理',state.foods.length?state.foods.map(f=>`<div class="routine-option"><div><h3>${h(f.name)}</h3><p>${nf(f.kcal)} kcal / ${f.basis==='100g'?'100g':'1食分'}</p></div><div class="row">${ib('edit-saved-food','食品を編集','edit',`data-id="${h(f.id)}"`)}${ib('delete-saved-food','登録から削除','trash',`data-id="${h(f.id)}"`)}</div></div>`).join(''):'<p>食事を記録するときに登録できます。</p>');}
function planForm(){const p=state.plan??{startDate:today,targetDate:C.shiftDay(today,84),startWeight:state.body.filter(C.bodyMeasurementAsOf(today)).sort(C.compareBodyMeasurements).at(-1)?.kg??'',targetWeight:'',kcal:0,p:0,f:0,c:0};openDialog('計画と栄養目標',`<p>自分で決めた目標を記録します。開始と目標を結ぶラインで進み具合を確認できます。</p><form><div class="form-grid">${inputField('startWeight','開始体重（kg）',p.startWeight,'type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}${inputField('targetWeight','目標体重（kg）',p.targetWeight,'type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}${inputField('startDate','開始日',p.startDate,'type="date" required')}${inputField('targetDate','目標日',p.targetDate,'type="date" required')}${inputField('kcal','1日のカロリー目標（kcal）',p.kcal||'','type="number" min="0" max="100000" step="1" inputmode="numeric" placeholder="未設定"','full')}</div><div class="form-grid three" style="margin-top:17px">${['p','f','c'].map((k,i)=>inputField(k,['P たんぱく質（g）','F 脂質（g）','C 炭水化物（g）'][i],p[k]||'','type="number" min="0" max="100000" step="any" inputmode="decimal" placeholder="未設定"')).join('')}</div><div class="info-box">カロリー・PFCは空欄または0で未設定。体重は減量・維持・増量のいずれにも使えます。</div>${formEnd('計画を保存',state.plan?btn('delete-plan','計画を削除','trash','danger'):'')}</form>`);bindForm(fd=>{const startDate=fd.get('startDate'),targetDate=fd.get('targetDate');need(C.daysBetween(startDate,targetDate)>0,'目標日は開始日より後にしてください。');const plan={startDate,targetDate,startWeight:number(fd,'startWeight',10,500),targetWeight:number(fd,'targetWeight',10,500)};for(const k of ['kcal','p','f','c'])plan[k]=fd.get(k)===''?0:number(fd,k);state.plan=plan;modal.close();commit('計画と栄養目標を保存しました');});}
function bodyIndex(target){
  return state.body.findIndex(b=>target.id ? b.id===target.id : !b.id&&b.date===target.date);
}
function bodyForm(target=null){
  const entry=target?state.body[bodyIndex(target)]:null;
  if(target&&!entry)return;
  const clock=C.localTime();
  const requireTime=!entry||Boolean(entry.time);
  openDialog(entry?'からだの記録を訂正':'からだを記録',`<form id="body-form"><div class="form-grid">
    ${inputField('date','測定日',entry?.date??today,'type="date" required')}
    ${inputField('time',requireTime?'測定時刻':'測定時刻（任意）',entry?(entry.time??''):clock,'type="time" step="60"'+(requireTime?' required':''))}
    ${inputField('kg','体重（kg）',entry?.kg??'','type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}
    ${inputField('bodyFat','体脂肪率（%・任意）',entry?.bodyFat??'','type="number" min="1" max="80" step="0.1" inputmode="decimal"')}
    </div>${formEnd('記録を保存',entry?btn('delete-body','削除','trash','danger',bodyRecordAttrs(entry)):'')}</form>`);
  bindForm(fd=>{
    const time=String(fd.get('time')??'');
    need((!requireTime&&time==='')||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time),'測定時刻を入力してください。');
    const record={id:entry?.id??C.uid(),date:fd.get('date'),kg:number(fd,'kg',10,500),bodyFat:fd.get('bodyFat')===''?null:number(fd,'bodyFat',1,80)};
    if(time)record.time=time;
    if(target){
      const index=bodyIndex(target);
      need(index>=0,'訂正する記録が見つかりません。');
      state.body[index]=record;
    }else state.body.push(record);
    modal.close();
    commit('からだの記録を保存しました');
  });
}
function timerSoundRow(){
  return `<label class="settings-row timer-sound-row"><span><strong id="timer-sound-label">タイマーの終了音</strong>
    <small id="timer-sound-help">画面を開いているときに短い音で知らせます。全種目共通です。</small></span>
    <input id="timer-sound-toggle" type="checkbox" data-change="setting-timer-sound" aria-labelledby="timer-sound-label" aria-describedby="timer-sound-help" ${state.settings.timerSound?'checked':''}></label>`;
}
function settingsDialog(){openDialog('設定・バックアップ',`${installSettings()}<div class="settings-row"><div><h3>標準の重量単位</h3><p>単位が未設定の種目と合計ボリュームに使います。</p></div><select aria-label="重量の単位" data-change="setting-unit">${options(['kg','lbs'],unit())}</select></div><div class="settings-row"><div><h3>重量リストの刻み</h3><p>ダンベルは2kg刻み。その他は種目の表示単位で設定した刻みを使います。</p></div><select aria-label="重量の刻み" data-change="setting-step">${options([.5,1,1.25,2,2.5,5,10],state.settings.weightStep,n=>nf(n,2))}</select></div><div class="settings-row"><div><h3>完了したら休憩タイマー</h3><p>画面へ戻ったときも残り時間を再計算。</p></div><input type="checkbox" aria-label="自動休憩タイマー" data-change="setting-auto" ${state.settings.autoTimer?'checked':''}></div>${timerSoundRow()}<div class="settings-row"><div><h3>休憩時間</h3><p>通知はこの画面を開いている間に表示。</p></div><select aria-label="休憩時間" data-change="setting-timer">${options([30,60,90,120,180,240,300],state.settings.timerSeconds,n=>n+'秒')}</select></div><div class="divider"></div><h3>記録のバックアップ</h3><p class="mini-subtitle" style="margin-top:9px">記録はこのブラウザに保存されます。別の端末へ移すときや、ブラウザのデータを消す前にバックアップしてください。</p><div class="menu-grid" style="margin-top:17px">${btn('export','バックアップを書き出す','download')}${btn('import','バックアップを読み込む','upload')}${btn('export-csv','セット履歴をCSV保存','list')}${btn('workout-import','筋トレ記録を取り込む','upload')}${btn('switch-mode',mode==='demo'?'自分の記録に切り替える':'サンプルを別モードで見る','spark')}</div><input type="file" id="import-file" accept="application/json,.json" hidden><div class="info-box">${mode==='demo'?'現在はサンプルモードです。自分の記録とは別に保存されます。':'現在は自分の記録モードです。'}<br>自動同期には対応していません。バックアップは食事・体重・目標を含むJSON形式です。</div>${loadBlocked?btn('export-raw','読み込めなかった元データを保存','download','full'):''}<div class="small">REPS NOTE v1.0 · 体重はkg表示。ボリュームは入力重量×回数。自己ベストは推定1RMではなく実際に記録した最高重量。</div>`);const sel=modal.querySelector('[data-change="setting-unit"]');if(sel)sel.value=unit();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function exportBackup(){download(new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),app:'REPNOTE',sample:mode==='demo'})],{type:'application/json'}),`REPS NOTE-${mode}-${today}.json`);toast('バックアップを書き出しました');}
function exportCsv() {
  const csv = workoutCsv(state, exercise, loadLabel);
  download(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}), `REPS NOTE-workouts-${today}.csv`);
}
let stagedImport=null;
async function importFile(file){
  const input=modal.querySelector('#import-file'), loadingMode=mode;
  stagedImport=null;
  try{
    // Allow indented v1 exports while rejecting oversized files before decoding them in memory.
    need(file.size<=64*1024*1024,'バックアップファイルは64MiB以下にしてください。');
    const raw=JSON.parse(await file.text());
    if(!modal.open||input!==modal.querySelector('#import-file')||loadingMode!==mode||file!==input.files[0])return;
    if(raw?.sample!==undefined)need(raw.sample===(mode==='demo'),
      raw.sample===true?'サンプルのバックアップはサンプルモードで読み込んでください。':'自分の記録のバックアップは自分の記録モードで読み込んでください。');
    const validated=C.validateState(raw,exerciseIds);
    for(const key of ['sample','exportedAt','app'])delete validated[key];
    stagedImport=validated;
    openDialog('バックアップを復元',`<p>現在の${mode==='demo'?'サンプル':'自分の'}記録を、次の内容に入れ替えます。</p><div class="stat-line"><span>トレーニングした日</span><strong>${Object.keys(validated.workouts).length} 日</strong></div><div class="stat-line"><span>セット</span><strong>${C.allSets(validated).length} 件</strong></div><div class="stat-line"><span>食事</span><strong>${Object.values(validated.meals).flat().length} 件</strong></div><div class="stat-line"><span>体重</span><strong>${validated.body.length} 件</strong></div>${raw.sample?'<div class="info-box">このファイルはサンプルモードから書き出されています。</div>':''}<div class="info-box">先に現在の記録をバックアップすると、いつでも戻せます。復元は記録の置き換えなので、同じファイルを読み込んでも件数は増えません。</div><div class="modal-actions">${btn('export','現在の記録を保存','download')}${btn('confirm-import','このデータに入れ替える','upload','primary')}</div>`);}catch(err){stagedImport=null;toast(`読み込めませんでした：${err.message}`);}}
function switchMode(){
  const next=mode==='demo'?'real':'demo';
  try{localStorage.setItem('repnote:mode',next);}
  catch{toast('モードの切り替えを保存できませんでした');return;}
  invalidateHistory();
  mode=next;
  load();
  day=today;
  month=day.slice(0,7);
  view='workout';
  modal.close();
  render();
  toast(storageProblem||(mode==='real'?'自分の記録に切り替えました':'サンプルモードに切り替えました'));
}
function timerDialog(exerciseId){
  const ex=exercise(exerciseId), seconds=C.exerciseRestSeconds(state,exerciseId);
  openDialog('休憩タイマー',`<section id="exercise-timer" data-exercise="${h(exerciseId)}">
    <h3 class="timer-exercise">${h(ex.name)}</h3>
    <div data-timer-current></div>
    <form id="rest-timer-form">
      ${inputField('restSeconds','この種目の休憩時間（秒）',seconds,`type="number" min="10" max="3600" step="1" inputmode="numeric" placeholder="共通設定：${state.settings.timerSeconds}秒"`)}
      <div class="form-error" id="form-error" role="alert"></div>
      <div class="rest-actions">
        <button type="submit" class="button" data-timer-save>時間を保存</button>
        <button type="submit" class="button primary" data-timer-start>${icon('play')}開始</button>
      </div>
    </form>
    ${timerSoundRow()}
  </section>`);
  renderTimer();
  bindForm((fd,submitter)=>{
    const raw=fd.get('restSeconds');
    // Starting at the shared default must keep following future changes to that default.
    if(raw==='' || Number(raw)!==C.exerciseRestSeconds(state,exerciseId)){
      C.setExerciseRestSeconds(state,exerciseId,raw===''?null:Number(raw));
    }
    const duration=C.exerciseRestSeconds(state,exerciseId);
    const start=submitter?.hasAttribute('data-timer-start');
    if(start)state.timer=runningTimer(duration,exerciseId);
    if(!save())return;
    modal.querySelector('[name="restSeconds"]').value=duration;
    renderTimer();
    if(!start)toast('この種目の休憩時間を保存しました');
  });
}
function runningTimer(seconds,exerciseId){
  return {duration:seconds,endAt:Date.now()+seconds*1000,remaining:seconds,finished:false,...(exerciseId?{exerciseId}:{})};
}
function startTimer(seconds,exerciseId){
  state.timer=runningTimer(seconds,exerciseId);
  if(save())renderTimer();
}
function timerSeconds(){return state.timer?.endAt?Math.max(0,Math.ceil((state.timer.endAt-Date.now())/1000)):state.timer?.remaining??0;}
const timerTime=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
function renderTimer(){
  const active=state.timer;
  for(const button of app.querySelectorAll?.('.exercise-timer-button')??[]){
    const current=active?.exerciseId===button.dataset.exercise && !active.finished;
    button.classList.toggle('has-timer',current);
    const label=exercise(button.dataset.exercise).name+'の休憩タイマー'+(current?(active.endAt?'（計測中）':'（一時停止中）'):'');
    button.setAttribute('aria-label',label);
    button.title=label;
  }
  const popup=modal.open&&modal.querySelector('#exercise-timer');
  if(!popup)return;
  const id=popup.dataset.exercise;
  const timer=active?.finished && active.exerciseId!==id ? null : active;
  const own=timer?.exerciseId===id;
  const different=timer&&!own&&!timer.finished;
  const status=!timer?'設定時間':timer.finished?'休憩終了':timer.endAt?'休憩中':'一時停止中';
  const timerName=timer&&!own?(timer.exerciseId?exercise(timer.exerciseId).name:'共通タイマー'):'';
  const current=popup.querySelector('[data-timer-current]');
  const focusedAction=current.contains(document.activeElement)?document.activeElement.dataset.action:null;
  const start=popup.querySelector('[data-timer-start]');
  const startFocused=document.activeElement===start;
  const n=timer?timerSeconds():C.exerciseRestSeconds(state,id);
  current.innerHTML=`<div class="rest-readout">
    <div id="timer-status" role="status">${h(timerName?timerName+' · '+status:status)}</div>
    <div class="timer-time" id="timer-display" role="timer" aria-label="休憩時間">${timerTime(n)}</div>
    </div>${timer?`<div class="rest-actions">
      ${timer.finished?'':btn('pause-timer',timer.endAt?'一時停止':'再開',timer.endAt?'pause':'play','primary')}
      ${timer.finished?'':btn('reset-timer','最初から','reset')}
      ${btn('close-timer',timer.finished?'終了を確認':'停止', 'close')}
    </div>`:''}`;
  start.hidden=Boolean(own&&!timer.finished);
  start.disabled=start.hidden;
  start.innerHTML=icon('play')+(different?'この種目に切り替えて開始':'開始');
  const nextFocus=focusedAction&&current.querySelector(`[data-action="${focusedAction}"]`);
  if(nextFocus)nextFocus.focus({preventScroll:true});
  else if(focusedAction||startFocused&&start.hidden){
    (current.querySelector('button')??start).focus({preventScroll:true});
  }
}
function refreshToday(){
  const next=C.localDate();
  if(next===today)return;
  const followToday=day===today&&!modal.open&&!document.activeElement?.matches('input, textarea, select');
  today=next;
  if(followToday){day=today;month=day.slice(0,7);}
  // Leave an open editor on its selected day, including a focused session note.
  if(!document.activeElement?.matches('textarea[data-change="session-note"]'))render();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday();});
let finishingTimer=false;
setInterval(async ()=>{
  refreshToday();
  if(!state.timer?.endAt)return;
  const n=timerSeconds(),display=document.querySelector('#timer-display');
  if(display)display.textContent=timerTime(n);
  if(n!==0||finishingTimer||document.hidden)return;
  finishingTimer=true;
  try{
    await withRecordLock(()=>{
      if(!state.timer?.endAt||timerSeconds()!==0)return;
      // Returning to an old workout should show the result without sounding a stale alarm.
      const chimeDue=state.settings.timerSound && !document.hidden && Date.now()-state.timer.endAt<=5000;
      state.timer={...state.timer,endAt:null,remaining:0,finished:true};
      if(save()){
        if(chimeDue)timerSound.play();
        renderTimer();
        toast('休憩が終わりました。次のセットへ。');
      }
    });
  }finally{finishingTimer=false;}
},500);
function celebrate(ex,s,first=false){const u=exerciseUnit(ex.id);const root=document.querySelector('#celebration');root.innerHTML=`<div class="crown-pop">${icon('crown')}<h2>${first?'はじめの記録！':'自己ベスト更新！'}</h2><p>${h(ex.name)}<br><strong>${weight(s.kg,u)} ${u} × ${s.reps} 回</strong> · ${h(shortLoad(ex))}</p></div>${Array.from({length:12},(_,i)=>`<i class="confetti" style="--r:${i*30}deg;--x:${Math.cos(i*Math.PI/6)*170}px;--y:${Math.sin(i*Math.PI/6)*140+80}px;background:${['#444444','#858585','#cacaca'][i%3]}"></i>`).join('')}`;setTimeout(()=>{root.innerHTML='';},2400);}
const shareWeightsByKind = {workout:true, food:true, plan:false, month:false};
let shareMonth, shareMonthSummary;
let sharePrefs={kind:'workout',format:'square',theme:'dark',date:true,weights:true,caption:''},shareBlob=null,shareRevision=0;
function shareTemplateFields(selected=''){
  const templates=state.settings.shareTemplates ?? [];
  const saved=templates.length ? selectField('saved-template','保存した定型文',templates.map(t=>t.name),selected)
    + '<div class="template-actions">'+btn('template-apply','投稿文に使う')+btn('template-append','末尾に追加')+btn('template-delete','削除')+'</div>' : '';
  return saved + inputField('template-name','新しい定型文の名前','','maxlength="80" placeholder="例：トレーニング後"')
    + btn('template-save','今の投稿文を保存','save')+'<p class="form-error" role="alert"></p>';
}
function handleShareTemplate(action){
  const fields=modal.querySelector('#share-template-fields');
  const post=modal.querySelector('#share-text');
  if(!fields || !post)return;
  const templates=state.settings.shareTemplates ?? [];
  const selected=fields.querySelector('[name="saved-template"]')?.value;
  const template=templates.find(t=>t.name===selected);
  let nextSelection=selected;
  if(action==='template-save'){
    const name=fields.querySelector('[name="template-name"]');
    try{
      C.addShareTemplate(state.settings,name.value,post.value);
    }catch(err){
      fields.querySelector('[role="alert"]').textContent=err.message;
      return;
    }
    nextSelection=name.value.trim();
  }else if(!template)return;
  else if(action==='template-delete'){
    if(!window.confirm('「'+template.name+'」を定型文から削除しますか？'))return;
    state.settings.shareTemplates=templates.filter(t=>t.name!==selected);
    nextSelection='';
  }else{
    post.value=action==='template-append' && post.value ? post.value+'\n'+template.text : template.text;
    post.focus();
    toast(action==='template-append'?'定型文を末尾に追加しました':'定型文を投稿文に反映しました');
    return;
  }
  if(!save())return;
  fields.innerHTML=shareTemplateFields(nextSelection);
  (fields.querySelector('[name="saved-template"]') ?? fields.querySelector('[name="template-name"]')).focus();
  toast(action==='template-save'?'定型文を保存しました':'定型文を削除しました');
}
function shareDialog(kind=null){
  shareMonth=view==='history'?month:day.slice(0,7);
  shareMonthSummary=null;
  sharePrefs.kind=kind??({food:'food', body:'plan', history:'month'}[view]??'workout');
  sharePrefs.weights=shareWeightsByKind[sharePrefs.kind];
  openDialog('記録をシェア',`<div class="share-layout"><div><div class="share-preview"><canvas id="share-canvas" aria-label="共有画像のプレビュー"></canvas></div><div class="share-caption">${mode==='demo'?'画像にも「SAMPLE」を表示します。':'保存前に、公開してよい内容か確認できます。'}</div></div><div class="share-controls">${selectField('share-kind','シェアする内容',[['workout','トレーニング'],['food','食事・PFC'],['plan','ボディメイク計画'],['month','月間まとめ']],sharePrefs.kind)}${selectField('share-format','画像サイズ',[['square','正方形 1:1'],['portrait','投稿向け 4:5'],['story','ストーリー 9:16']],sharePrefs.format)}${selectField('share-theme','デザイン',[['dark','ブラック'],['light','ホワイト']],sharePrefs.theme)}${inputField('share-caption','ひとこと（任意）',sharePrefs.caption,'maxlength="60" placeholder="記録に添えるコメント"')}<label class="checkbox-row"><input name="share-date" type="checkbox" ${sharePrefs.date?'checked':''}>日付を表示</label><label class="checkbox-row"><input name="share-weights" type="checkbox" ${sharePrefs.weights?'checked':''}>重量・体重を表示</label>${btn('share-native','SNSに共有','share','primary share-full')}${btn('share-download','画像を保存','download','share-full')}${btn('share-copy','投稿文をコピー','copy','share-full')}</div></div><textarea class="share-text" id="share-text" aria-label="投稿文・自由に編集できます"></textarea><details class="share-templates"><summary>投稿文の定型文</summary><div id="share-template-fields">${shareTemplateFields()}</div></details><p class="share-caption">SNSへの送信は端末の共有画面から選べます。対応していないブラウザでは、画像を保存して添付してください。</p>`);drawShare();}
function workoutShareReport(){
  return sharedWorkout(getWorkout(), exercise, sharePrefs.weights, describeSet, C.recordUpdateCount(state, day));
}
function selectedMonthReport() {
  shareMonthSummary ??= C.monthlySummary(state, shareMonth);
  return monthlyShareReport(shareMonthSummary, unit(), sharePrefs.weights, sharePrefs.date);
}
function shareContentText(report) {
  const date = sharePrefs.date && sharePrefs.kind !== 'month' ? dateLabel(sharePrefs.kind === 'plan' ? today : day,true)+'\n' : '';
  let lines;
  if (sharePrefs.kind === 'workout') {
    lines = (report ?? workoutShareReport()).textLines;
  } else if (sharePrefs.kind === 'month') {
    lines = (report ?? selectedMonthReport()).textLines;
  } else if (sharePrefs.kind === 'food') {
    const t = C.mealTotals(state.meals[day]);
    lines = [`食事記録 ${nf(t.kcal,0)}kcal`, `P ${nf(t.p)}g / F ${nf(t.f)}g / C ${nf(t.c)}g`];
  } else {
    const p = state.plan, ps = C.planStats(p,state.body,today);
    lines = p ? [`ボディメイク計画｜目標への進み具合 ${nf(ps.progress,0)}%`,
      ...(sharePrefs.weights ? [`開始 ${nf(p.startWeight)}kg → 目標 ${nf(p.targetWeight)}kg`, currentWeightLabel(state.body,today)] : []),
      ...(sharePrefs.date ? [`目標日 ${p.targetDate}`] : []), ...planNutritionLines(p)] : ['ボディメイク計画をつくろう'];
  }
  return `${mode === 'demo' ? '【サンプル】\n' : ''}${date}${lines.join('\n')}${sharePrefs.caption ? '\n'+sharePrefs.caption : ''}\nREPS NOTE\n#REPSNOTE #筋トレ記録`;
}
function drawShare(resetPost=false) {
  const canvas = modal.querySelector('#share-canvas');
  if (!canvas) return;
  const revision = ++shareRevision;
  shareBlob = null;
  const imageButtons = modal.querySelectorAll('[data-action="share-download"], [data-action="share-native"]');
  for (const button of imageButtons) button.disabled = true;

  canvas.width = 1080;
  canvas.height = {square:1080, portrait:1350, story:1920}[sharePrefs.format];
  const ctx = canvas.getContext('2d');
  const H = canvas.height;
  const dark = sharePrefs.theme === 'dark';
  const paper = dark ? '#171717' : '#fafafa';
  const ink = dark ? '#fafafa' : '#151515';
  const secondary = dark ? '#bababa' : '#5b5b5b';
  const rule = dark ? '#494949' : '#c7c7c7';
  const shades = dark ? ['#fff','#aaa','#777'] : ['#222','#666','#999'];
  const face = 'Arial, "Hiragino Sans", "Yu Gothic", sans-serif';
  const left = 72, right = 1008, width = right - left;
  const room = H - 1080;
  const contentEnd = H - (sharePrefs.caption ? 150 : 76);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, H);

  function label(value, x, y, size=28, color=ink, bold=false, max=width, align='left') {
    ctx.font = (bold ? '700 ' : '400 ') + size + 'px ' + face;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    const source = String(value);
    if (ctx.measureText(source).width <= max) {
      ctx.fillText(source, x, y);
      return;
    }
    const characters = Array.from(source);
    while (characters.length && ctx.measureText(characters.join('')+'…').width > max) characters.pop();
    ctx.fillText(characters.join('')+'…', x, y);
  }
  function divider(y, color=rule, thickness=2) {
    ctx.fillStyle = color;
    ctx.fillRect(left, y, width, thickness);
  }
  function metric(value, unitLabel, x, y, max, size) {
    // Keep every digit of large volumes and food totals, including after a unit change.
    ctx.font = '700 ' + size + 'px ' + face;
    const text = String(value);
    const adjusted = Math.min(size, Math.floor(size * max / Math.max(1, ctx.measureText(text).width)));
    label(text, x, y, adjusted, ink, true, max+1);
    label(unitLabel, x, y+42, 23, secondary, true, max);
  }

  const kind = sharePrefs.kind;
  const log = kind === 'workout' ? workoutShareReport() : kind === 'month' ? selectedMonthReport() : null;
  const brandY = 102 + Math.round(room * .03);
  label('REPS NOTE', left, brandY, 46, ink, true);
  if (sharePrefs.date) {
    const date = kind === 'month' ? log.dateLabel : dateLabel(kind === 'plan' ? today : day,true);
    label(date, right, brandY-4, 25, secondary, false, 490, 'right');
  }
  divider(brandY + 30, ink, 4);
  const headingY = 270 + Math.round(room * .10);
  const category = {workout:'TRAINING LOG',food:'NUTRITION LOG',plan:'BODY PLAN',month:'MONTHLY SUMMARY'}[kind];
  label(category, left, headingY-73, 23, secondary, true);
  if (mode === 'demo') label('SAMPLE', right, headingY-73, 23, secondary, true, 200, 'right');
  const title = kind === 'workout' ? getWorkout().title : kind === 'month' ? log.title : kind === 'food' ? '食事記録' : 'ボディメイク計画';
  label(title, left, headingY+8, 76, ink, true);
  let y = headingY + 80 + Math.round(room * .05);

  if (kind === 'workout') {
    const workout = getWorkout();
    const stats = C.workoutStats(workout);
    label(log.recordUpdateLabel, left, headingY+54, 30, ink, true);
    const count = log.strengthSets + log.cardioSessions;
    const metrics = [
      [count, log.cardioSessions ? (log.strengthSets ? '完了した記録' : '有酸素の記録') : '完了セット'],
      [new Set(log.entries.map(entry => entry.exerciseId)).size, '種目'],
    ];
    if (log.cardioSessions) metrics.push([nf(log.cardioMinutes,2), '有酸素 / 分']);
    if (sharePrefs.weights && log.strengthSets) metrics.push([weight(stats.volume,unit(),0), 'ボリューム / '+unit()]);
    const cell = width / metrics.length;
    metrics.forEach(([value, title], i) => metric(value, title, left+i*cell, y+65, cell-24, 88));
    y += 158 + Math.round(room * .06);
    ctx.font = '400 27px '+face;
    const detailWidth = width-156;
    const {visible, remainder} = workoutCardLayout(log.entries, contentEnd-y,
      value => ctx.measureText(value).width <= detailWidth);
    for (const {entry, rows, count:shown} of visible) {
      divider(y);
      label(entry.name, left, y+38, 32, ink, true, width-200);
      label(entry.count, right, y+38, 25, secondary, true, 175, 'right');
      y += cardEntryHeight;
      for (const row of rows.slice(0,shown)) {
        label(row.ordinal, left, y+25, 23, secondary, false, 150);
        for (const line of row.lines) {
          label(line, left+156, y+25, 27, ink, false, detailWidth);
          y += cardRowHeight;
        }
      }
    }
    if (remainder) label(remainder, left, y+32, 25, secondary);
    if (!count) label('完了した記録はありません', left, y+48, 31, secondary);
  } else if (kind === 'month') {
    drawMonthlySummary(log, {label,metric,divider,left,right,width,y,contentEnd,ink,secondary,room});
  } else if (kind === 'food') {
    const entries = state.meals[day] ?? [];
    const totals = C.mealTotals(entries);
    metric(nf(totals.kcal,0), '摂取カロリー / kcal', left, y+64, width, 108);
    const barY = y+144+Math.round(room*.055);
    const energy = C.macroEnergy(totals);
    ctx.fillStyle = rule;
    ctx.fillRect(left,barY,width,14);
    let barX = left;
    for (const [i,key] of ['p','f','c'].entries()) {
      const segment = energy > 0 ? totals[key]*(key==='f'?9:4)/energy*width : 0;
      ctx.fillStyle = shades[i];
      ctx.fillRect(barX,barY,segment,14);
      barX += segment;
      const x = left+i*width/3;
      ctx.fillRect(x,barY+50,16,16);
      label(['たんぱく質','脂質','炭水化物'][i], x+28, barY+66, 24, secondary, false, width/3-35);
      label(nf(totals[key])+' g', x, barY+126, 49, ink, true, width/3-20);
    }
    y = barY+166+Math.round(room*.07);
    const rowHeight = Math.min(110, (contentEnd-y)/4);
    for (const meal of ['朝食','昼食','夕食','間食']) {
      divider(y);
      label(meal,left,y+rowHeight*.68,30);
      const total = C.mealTotals(entries.filter(m=>m.meal===meal));
      label(nf(total.kcal,0)+' kcal',right,y+rowHeight*.68,30,ink,true,490,'right');
      y += rowHeight;
    }
  } else {
    const p = state.plan;
    if (!p) {
      label('計画は未設定です',left,y+60,34,secondary);
    } else {
      const stats = C.planStats(p,state.body,today);
      metric(nf(stats.progress,0)+'%', '目標への進み具合', left, y+64, width, 108);
      y += 148+Math.round(room*.075);
      ctx.fillStyle = rule;
      ctx.fillRect(left,y,width,13);
      ctx.fillStyle = ink;
      ctx.fillRect(left,y,width*stats.progress/100,13);
      y += 60+Math.round(room*.05);
      const rows = [];
      if (sharePrefs.weights) {
        rows.push('開始 '+nf(p.startWeight)+' kg     目標 '+nf(p.targetWeight)+' kg', currentWeightLabel(state.body,today));
      }
      if (sharePrefs.date) rows.push('目標日  '+dateLabel(p.targetDate,true));
      rows.push(...planNutritionLines(p));
      const rowHeight = Math.min(82+Math.round(room*.04), (contentEnd-y)/Math.max(1,rows.length));
      for (const row of rows) {
        divider(y);
        label(row,left,y+rowHeight*.68,31);
        y += rowHeight;
      }
    }
  }

  if (sharePrefs.caption) {
    divider(H-123,ink,3);
    label(sharePrefs.caption,left,H-65,32);
  }
  const post = modal.querySelector('#share-text');
  const useGeneratedText = resetPost || post.value === post.defaultValue;
  post.defaultValue = shareContentText(log);
  if (useGeneratedText) post.value = post.defaultValue;
  canvas.toBlob(blob=>{
    if (revision !== shareRevision || !canvas.isConnected) return;
    shareBlob = blob;
    if (!blob) {toast('画像を作成できませんでした。設定を変えて再度お試しください');return;}
    for (const button of imageButtons) button.disabled = false;
  }, 'image/png');
}
async function shareNative(){if(!shareBlob){toast('画像を準備中です。もう一度お試しください');return;}const file=new File([shareBlob],shareFilename(sharePrefs.kind,sharePrefs.date,day,today,shareMonth),{type:'image/png'}),text=modal.querySelector('#share-text')?.value??shareContentText();try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'REPS NOTE',text});}else{download(shareBlob,file.name);toast('画像のダウンロードを開始しました。SNSで添付してください');}}catch(err){if(err.name!=='AbortError'){download(shareBlob,file.name);toast('共有できなかったため画像のダウンロードを開始しました');}}}
const recordActions=new Set([
  'template-save','template-delete',
  'save-note-draft',
  'favorite','picker-favorite','choose-exercise','use-routine','delete-routine','add-set','add-three-sets','copy-set','complete-set',
  'delete-set','delete-exercise','copy-exercise-previous','copy-previous','copy-food','copy-food-day','delete-food',
  'delete-saved-food','delete-plan','delete-body','start-timer','pause-timer','reset-timer','close-timer','confirm-import','undo',
  'unit','switch-mode','start-real'
]);
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if (state.settings.timerSound && (state.timer?.endAt || ['timer-open','start-timer','pause-timer','reset-timer'].includes(target?.dataset.action)
    || (state.settings.autoTimer && target?.dataset.action==='complete-set'))) {
    void timerSound.arm();
  }
  if(!target)return;
  const d=target.dataset;
  if(recordActions.has(d.action))return withRecordLock(()=>handleAction(d),{allowRecovery:['confirm-import','switch-mode','start-real'].includes(d.action)});
  return handleAction(d);
});
async function handleAction(d){try{switch(d.action){
  case 'template-save':case 'template-delete':case 'template-append':case 'template-apply':handleShareTemplate(d.action);break;
  case 'copy-ai-prompt':await copyAiPrompt();break;
  case 'save-note-draft':{
    const field=app.querySelector(noteSelector);
    if(d.date===day&&field&&getNoteDraft(noteDraftKey(day))&&saveSessionNote(day,field.value,field))render();
    break;
  }
  case 'discard-note-draft':
    if(d.date===day){setNoteDraft(noteDraftKey(day),null);render();}
    break;
  case 'nav':view=d.view;render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'nav-food':view='food';render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'nav-workout':view='workout';render();break;
  case 'unit':{
    if(d.instance){
      const entry=instance(d.instance);
      if(!entry)break;
      C.setExerciseUnit(state,entry.exerciseId,d.unit);
    }else{
      if(unit()===d.unit)break;
      state.settings.unit=d.unit;
    }
    if(commit()){
      const location=d.instance?`#exercise-${CSS.escape(d.instance)}`:'.top-actions';
      app.querySelector(`${location} .unit-switch [aria-pressed="true"]`)?.focus({preventScroll:true});
    }
    break;
  }
  case 'today':day=today;render();break;
  case 'day':day=d.date;render();break;
  case 'history-date':day=d.date;view='workout';render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'previous-month':case 'next-month':{const dt=C.parseDay(month+'-01');dt.setMonth(dt.getMonth()+(d.action==='next-month'?1:-1));month=C.localDate(dt).slice(0,7);render();break;}
  case 'close':modal.close();break;
  case 'settings':settingsDialog();break;
  case 'install-app':await requestInstall(d.source==='settings');break;
  case 'dismiss-install':install.dismissBanner();updateInstallControls();break;
  case 'add-exercise':openExercisePicker();break;
  case 'search-group':searchGroup=d.group;openExercisePicker(false);break;
  case 'favorite':case 'picker-favorite':{const i=state.favorites.indexOf(d.id);if(i<0)state.favorites.push(d.id);else state.favorites.splice(i,1);save();render();if(d.action==='picker-favorite')openExercisePicker(false);break;}
  case 'choose-exercise':if(addExercise(d.id)){const first=getWorkout().exercises.at(-1).sets[0];modal.close();if(commit('種目を追加しました')&&first)focusSet(first.id,'set-weight',true);}break;
  case 'custom-exercise':customExerciseForm();break;
  case 'routines':routineDialog();break;
  case 'use-routine':{const r=getRoutines(state).find(r=>r.id===d.id);if(!r)return;const had=getWorkout().exercises.length;let count=0;r.exerciseIds.forEach(id=>{if(addExercise(id))count++;});if(!had)ensureWorkout().title=r.name;modal.close();commit(count?`${count}種目を追加しました。セットの完了はチェックで。`:'このメニューの種目はすべて追加済みです');break;}
  case 'save-routine':routineEditor(null,true);break;
  case 'new-routine':routineEditor(null);break;
  case 'edit-routine':routineEditor(d.id);break;
  case 'edit-exercise':editExerciseForm(d.id,d.instance);break;
  case 'delete-routine':confirmRoutineDeletion(d.id);break;
  case 'add-set':{const e=instance(d.id);if(!e)return;const added=e.sets.length?C.cloneSet(e.sets.at(-1)):(exercise(e.exerciseId).load==='cardio'?C.newCardioSet():C.newSet());e.sets.push(added);if(commit('未完了のセットを追加しました'))focusSet(added.id,'set-weight',true);break;}
  case 'add-three-sets':{
    const entry=instance(d.id);
    const source=entry?.sets.at(-1);
    if(!source)break;
    const copies=Array.from({length:3},()=>C.cloneSet(source));
    if(undoable(()=>entry.sets.push(...copies),'未完了のセットを3つ追加しました')){
      focusSet(copies[0].id,'set-weight',true);
    }
    break;
  }
  case 'copy-set':{const e=instance(d.instance),s=setById(d.id);if(!e||!s)return;const idx=e.sets.findIndex(x=>x.id===s.id);const copy=C.cloneSet(s);e.sets.splice(idx+1,0,copy);if(commit('同じセットをコピーしました'))focusSet(copy.id,'set-weight',true);break;}
  case 'complete-set':{
    const set=setById(d.id);
    if(!set)break;
    const ex=exercise(d.exercise);
    if(!set.completed&&set.kg===0&&ex.load!=='body'){
      toast('重量を選んでから完了してください');
      break;
    }
    const old=ex.load==='cardio'?null:C.records(state)[ex.id];
    set.completed=!set.completed;
    if(ex.load!=='cardio'&&set.completed&&!Object.hasOwn(state.settings.exerciseUnits??{},ex.id)){
      C.setExerciseUnit(state,ex.id,C.exerciseUnit(state,ex.id));
    }
    if(!commit()||!set.completed)break;
    const isNew=ex.load!=='cardio'&&C.records(state)[ex.id]?.id===set.id&&(!old||set.kg>old.kg+C.EPS||
      (ex.load==='body'&&Math.abs(set.kg-old.kg)<=C.EPS&&set.reps>old.reps));
    if(isNew)celebrate(ex,set,!old);
    if(state.settings.autoTimer&&day===today)startTimer(C.exerciseRestSeconds(state,ex.id),ex.id);
    break;
  }
  case 'edit-set':setEditor(d.id);break;
  case 'edit-record':setEditor(d.id,d.date);break;
  case 'delete-set':{
    const entry=state.workouts[d.date]?.exercises.find(e=>e.sets.some(s=>s.id===d.id));
    if(!entry)break;
    const index=entry.sets.findIndex(s=>s.id===d.id);
    undoable(()=>entry.sets.splice(index,1),`セット${index+1}を削除しました`);
    if(modal.open)modal.close();
    break;
  }
  case 'exercise-menu':exerciseMenu(d.id);break;
  case 'delete-exercise':undoable(()=>{ensureWorkout().exercises=ensureWorkout().exercises.filter(e=>e.id!==d.id);},'種目を削除しました');modal.close();break;
  case 'copy-exercise-previous':{const e=instance(d.id),last=C.lastExercise(state,e.exerciseId,day);if(!last){toast('前回の完了記録がありません');break;}undoable(()=>{e.sets.push(...last.sets.filter(s=>s.completed).map(C.cloneSet));},`${dateLabel(last.date)}の完了セットを追加しました`);break;}
  case 'copy-previous':{const currentTitle=getWorkout().title;const prior=Object.keys(state.workouts).filter(date=>date<day&&C.workoutStats(state.workouts[date]).sets>0).sort();const prev=prior.filter(date=>state.workouts[date].title===currentTitle).at(-1)??prior.at(-1);if(!prev){toast('コピーできる過去の完了記録がありません');break;}const from=state.workouts[prev];undoable(()=>{const w=ensureWorkout();if(!w.exercises.length)w.title=from.title;for(const e of from.exercises){const completed=e.sets.filter(s=>s.completed).map(C.cloneSet);if(!completed.length)continue;const existing=w.exercises.find(x=>x.exerciseId===e.exerciseId);if(existing)existing.sets.push(...completed);else w.exercises.push({...e,id:C.uid(),sets:completed});}},`${dateLabel(prev)}の完了セットを追加しました`);break;}
  case 'workout-import':showWorkoutImport();break;
  case 'meal-import':showMealImport();break;
  case 'food-ratio':{
    const form=modal.querySelector('#food-entry');
    if(form?.elements.amount){form.elements.amount.value=Number((foodPortionBase(form)*Number(d.foodRatio)).toFixed(8));updateFoodCalculation();}
    break;
  }
  case 'add-food':foodForm({meal:d.meal??'朝食'});break;
  case 'edit-food':foodForm({entry:(state.meals[day]??[]).find(m=>m.id===d.id)});break;
  case 'saved-food':foodForm({preset:state.foods.find(f=>f.id===d.id)});break;
  case 'copy-food':{const f=state.meals[day]?.find(m=>m.id===d.id);if(f)undoable(()=>state.meals[day].push({...f,id:C.uid()}),'食事をコピーしました');break;}
  case 'copy-food-day':{const ms=state.meals[C.shiftDay(day,-1)]??[];if(!ms.length){toast('前日の食事記録がありません');break;}undoable(()=>{state.meals[day]??=[];state.meals[day].push(...ms.map(m=>({...m,id:C.uid()})));},'前日の食事を追加しました');break;}
  case 'delete-food':undoable(()=>{state.meals[day]=state.meals[day].filter(m=>m.id!==d.id);},'食事を削除しました');modal.close();break;
  case 'manage-foods':manageFoods();break;
  case 'edit-saved-food':foodForm({preset:state.foods.find(f=>f.id===d.id),saveOnly:true});break;
  case 'delete-saved-food':undoable(()=>{state.foods=state.foods.filter(f=>f.id!==d.id);},'登録した食品を削除しました');manageFoods();break;
  case 'edit-plan':planForm();break;
  case 'delete-plan':undoable(()=>{state.plan=null;},'計画を削除しました');modal.close();break;
  case 'add-body':bodyForm();break;
  case 'edit-body':bodyForm(d);break;
  case 'delete-body':{
    const index=bodyIndex(d);
    if(index>=0)undoable(()=>{state.body.splice(index,1);},'からだの記録を削除しました');
    modal.close();break;
  }
  case 'pr-group':prGroup=d.group;render();break;
  case 'record-info':openDialog('自己ベストのルール','<p>完了したメインセットのうち、補助なしで1回以上できた最高重量を表示します。同重量なら回数の多いセット、同回数なら新しい日付を優先します。</p><div class="info-box">ウォームアップ・補助あり・未完了セットは集計しません。自重種目は追加重量が同じなら回数の増加でも王冠が出ます。その他の種目は最高重量が増えたときに王冠が出ます。</div><p>「元の記録を訂正する」で修正すると、すべての保存済みセットから再計算します。単位切替・読み込み・訂正だけでは王冠の演出を繰り返しません。</p>');break;
  case 'share':shareDialog();break;
  case 'share-plan':shareDialog('plan');break;
  case 'share-month':shareDialog('month');break;
  case 'share-download':if(shareBlob){download(shareBlob,shareFilename(sharePrefs.kind,sharePrefs.date,day,today,shareMonth));toast('共有画像のダウンロードを開始しました');}else toast('画像を準備中です');break;
  case 'share-native':await shareNative();break;
  case 'share-copy':{const text=modal.querySelector('#share-text');try{await navigator.clipboard.writeText(text.value);toast('投稿文をコピーしました');}catch{text.focus();text.select();toast('投稿文を選択しました。端末のコピー操作でコピーできます');}break;}
  case 'timer-open':if(d.exercise)timerDialog(d.exercise);break;
  case 'start-timer':startTimer(Number(d.seconds),d.exercise);break;
  case 'pause-timer':{
    const timer=state.timer, remaining=timerSeconds();
    // A click between the deadline and the completion tick must not cancel the alarm.
    if(!timer||timer.finished||remaining===0)break;
    if(timer.endAt){timer.remaining=remaining;timer.endAt=null;}
    else timer.endAt=Date.now()+remaining*1000;
    if(save())renderTimer();
    break;
  }
  case 'reset-timer':if(state.timer)startTimer(state.timer.duration,state.timer.exerciseId);break;
  case 'close-timer':state.timer=null;save();renderTimer();break;
  case 'export':exportBackup();break;
  case 'export-csv':exportCsv();break;
  case 'import':modal.querySelector('#import-file')?.click();break;
  case 'confirm-import':if(stagedImport){
    state=stagedImport;
    state.timer=null;
    invalidateHistory();
    if(save({restoring:true})){modal.close();render();toast('バックアップを復元しました');}
  }break;
  case 'export-raw':download(new Blob([localStorage.getItem(storageKey())??''],{type:'application/json'}),`REPS NOTE-original-${today}.json`);break;
  case 'start-real':if(mode==='demo')switchMode();break;
  case 'switch-mode':switchMode();break;
  case 'undo':if(undoState){if(JSON.stringify({...state,timer:null})!==undoFingerprint){undoState=null;toast('その後の変更があるため、履歴から訂正してください');break;}const timer=state.timer;state=undoState;state.timer=timer;undoState=null;commit('元に戻しました');if(modal.open)modal.close();}break;
}}catch(err){console.error('REPS NOTE action error',err);toast('操作を完了できませんでした：'+err.message);}}
const recordChanges=new Set(['set-weight','set-reps','cardio-minutes','setting-unit','setting-step','setting-auto','setting-timer','setting-timer-sound']);
const directEntryFields=new Map([['set-weight','kg'],['set-reps','reps'],['cardio-minutes','minutes']]);
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.value==='custom' && directEntryFields.has(el.dataset.change)){
    // Opening the editor in the selection gesture lets mobile browsers show the keypad.
    // The form still takes the record lock when the user saves.
    const selected=Array.from(el.options).find(option=>option.defaultSelected);
    if(selected)el.value=selected.value;
    return setEditor(el.dataset.id,day,directEntryFields.get(el.dataset.change));
  }
  if(el.dataset.change==='setting-timer-sound'){
    if(el.checked){
      void timerSound.arm().then(ready=>{
        if(!ready && el.isConnected && el.checked)toast('このブラウザでは音声を開始できませんでした。休憩終了は画面でお知らせします。');
      });
    }else void timerSound.disarm();
  }
  if(el.dataset.change==='session-note'){
    if(refreshingNote||el.dataset.mode!==mode)return;
    const date=el.dataset.date, key=noteDraftKey(date);
    const draft=rememberNoteDraft(el);
    if(el.dataset.reviewDraft!==undefined||draft.base!==(state.workouts[date]?.note??''))return;
    return withRecordLock(()=>{
      // Another edit may have queued while this blur was waiting for the lock.
      if(getNoteDraft(key)===draft)saveSessionNote(date,draft.text,el);
    },{allowDayChange:true});
  }
  if(recordChanges.has(el.dataset.change))return withRecordLock(()=>handleChange(el));
  return handleChange(el);
});
function handleChange(el){const d=el.dataset;try{
  if(d.change==='date'&&el.value){day=el.value;render();}
  if(d.change==='cardio-minutes'){
    const set=setById(d.id);
    if(!set || !Object.hasOwn(set,'minutes'))return;
    const minutes=Number(el.value);
    if(!C.validCardioValue(C.CARDIO_FIELDS[0],minutes)){el.value=String(set.minutes);toast('時間を正しく入力してください');return;}
    set.minutes=minutes;
    if(commit())focusSet(d.id,'cardio-minutes');
  }
  if(d.change==='set-weight'){
    const set=setById(d.id);
    if(!set)return;
    const displayUnit=exerciseUnit(d.exercise);
    try{
      const kg=el.selectedOptions[0].dataset.kg;
      set.kg=editedWeightKg(kg,{unit:'kg',originalKg:set.kg,displayed:set.kg,completed:set.completed,load:d.load});
    }catch(err){
      el.value=String(C.fromKg(set.kg,displayUnit));
      throw err;
    }
    C.setExerciseUnit(state,d.exercise,displayUnit);
    if(commit())focusSet(d.id);
  }
  if(d.change==='set-reps'){const s=setById(d.id);if(s){s.reps=Number(el.value);if(commit())focusSet(d.id,'set-reps');}}
  if(d.change==='setting-unit'){state.settings.unit=el.value;save();render();settingsDialog();}
  if(d.change==='setting-step'){state.settings.weightStep=Number(el.value);save();render();}
  if(d.change==='setting-auto'){state.settings.autoTimer=el.checked;save();}
  if(d.change==='setting-timer-sound'){
    state.settings.timerSound=el.checked;
    if(!save()&&!state.settings.timerSound)timerSound.disarm();
  }
  if(d.change==='setting-timer'){state.settings.timerSeconds=Number(el.value);save();}
  if(el.id==='import-file'&&el.files?.[0])return importFile(el.files[0]);
  if(el.id==='saved-food-select'&&el.value){const f=state.foods.find(f=>f.id===el.value);if(f){const form=modal.querySelector('form');for(const k of ['name','kcal','p','f','c','basis'])form.elements[k].value=f[k];form.dataset.baseAmount='';form.elements.amount.value=f.basis==='100g'?100:1;form.querySelector('label[for="field-amount"]').textContent=f.basis==='100g'?'食べた量（g）':'食べた量（食分）';if(form.elements.saveFood)form.elements.saveFood.checked=false;updateFoodCalculation();}}
  if(el.name==='basis'&&modal.querySelector('#food-calculation')){const amount=modal.querySelector('[name="amount"]');if(amount){amount.value=el.value==='100g'?100:1;modal.querySelector('label[for="field-amount"]').textContent=el.value==='100g'?'食べた量（g）':'食べた量（食分）';}updateFoodCalculation();}
  if(el.name?.startsWith('share-'))updateSharePreferences();
}catch(err){toast(err.message);}}
document.addEventListener('input',event=>{const el=event.target;if(el.id==='exercise-search'){searchText=el.value;modal.querySelector('#exercise-results').innerHTML=exerciseResults();}if(modal.querySelector('#food-calculation'))updateFoodCalculation();if(el.name==='share-caption')updateSharePreferences();});
function updateSharePreferences() {
  const field = name => modal.querySelector(`[name="share-${name}"]`);
  const kind = field('kind').value;
  const weights = field('weights');
  if (kind !== sharePrefs.kind) weights.checked = shareWeightsByKind[kind];
  // Switching content or privacy settings must also apply to the text sent with the image.
  const resetPost = kind !== sharePrefs.kind || field('date').checked !== sharePrefs.date || weights.checked !== sharePrefs.weights;
  const post = modal.querySelector('#share-text');
  if (resetPost && post.value !== post.defaultValue &&
      !window.confirm('表示する記録を変更すると、編集中の投稿文を作り直します。変更しますか？')) {
    field('kind').value = sharePrefs.kind;
    field('date').checked = sharePrefs.date;
    weights.checked = sharePrefs.weights;
    return;
  }
  shareWeightsByKind[kind] = weights.checked;
  sharePrefs = {kind, format:field('format').value, theme:field('theme').value,
    caption:field('caption').value, date:field('date').checked, weights:weights.checked};
  drawShare(resetPost);
}
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
window.addEventListener('storage',e=>{
  if(e.storageArea!==localStorage||(e.key!==null&&e.key!==storageKey()))return;
  if(localStorage.getItem(storageKey())!==loadedRaw)refreshFromStorage();
});
window.addEventListener('pagehide',()=>{
  const field=app.querySelector(noteSelector);
  if(field&&field.value!==field.defaultValue)rememberNoteDraft(field);
});
render();

