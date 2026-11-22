import {EXERCISES,ROUTINES} from './catalog.js';
import * as C from './core.js';
import {editedWeightKg, weightRange} from './workout-input.js';
import { currentWeightLabel, planNutritionLines, setDetails, shareFilename } from './share.js';

const PATHS={dumbbell:'M6 6v12M3 9v6m15-9v12m3-9v6M6 12h12',food:'M4 3v6a3 3 0 0 0 6 0V3M7 3v19M19 3c-4 4-4 10 0 10V3m0 10v9',chart:'M4 4v16h17M7 14l4-5 4 3 5-8',crown:'m3 6 5 4 4-7 4 7 5-4-2 12H5L3 6Zm3 15h12',calendar:'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 3v4l-3 3-3 1-1 3h-4l-1-3-3-1-3-3v-4l3-3 3-1 1-3Z',share:'M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2',plus:'M12 5v14M5 12h14',copy:'M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2ZM16 4V2H2v14h2',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',more:'M5 12h.01M12 12h.01M19 12h.01',search:'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm6 14 5 5',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v6h4',edit:'m16 3 5 5-12 12H4v-5L16 3Zm-2 2 5 5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',shield:'M12 3 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-3Zm-4 9 3 3 5-6',save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',upload:'M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5',fire:'M12 2c1 6 7 6 7 13a7 7 0 1 1-14 0c0-3 2-5 3-6 0 3 1 4 2 4 2-3 3-6 2-11Z',target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 4h.01',history:'M3 10a9 9 0 1 1 1 7M3 3v7h7M12 7v6l4 2',pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4Z',reset:'M3 9a9 9 0 1 1 0 6M3 3v6h6',weight:'M7 6h10l4 15H3L7 6Zm2 0V4a3 3 0 0 1 6 0v2',list:'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',chevron:'m9 5 7 7-7 7',heart:'M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]??PATHS.dumbbell}"/></svg>`;
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(a,label,ic='',cls='',attrs='')=>`<button type="button" data-action="${a}" class="button ${cls}" ${attrs}>${ic?icon(ic):''}${h(label)}</button>`;
const ib=(a,label,ic,attrs='',cls='')=>`<button type="button" data-action="${a}" class="icon-button ${cls}" title="${h(label)}" aria-label="${h(label)}" ${attrs}>${icon(ic)}</button>`;
const nf=C.fmt;
const app=document.querySelector('#app');const modal=document.querySelector('#modal');
let today=C.localDate();
let view='workout',day=today,month=day.slice(0,7),prGroup='すべて',searchText='',searchGroup='お気に入り',toastTimeout,undoState=null,undoFingerprint='',storageProblem='',loadBlocked=false;
let mode='demo',state;
try{mode=localStorage.getItem('repnote:mode')??(localStorage.getItem('repnote:v1:real')?'real':'demo');if(!['demo','real'].includes(mode))mode='demo';}catch{storageProblem='このブラウザでは保存が使えません。設定からバックアップを書き出せます。';}
const storageKey=()=>`repnote:v1:${mode}`;
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
      if(t&&(t.endAt===null||Number.isFinite(t.endAt))&&Number.isFinite(t.remaining)&&t.remaining>=0)
        state.timer={endAt:t.endAt,remaining:t.remaining,finished:t.finished===true};
    }
  }catch{
    state=C.blankState();
    loadBlocked=true;
    storageProblem='保存データを読み込めませんでした。元データは保持しています。「設定」で書き出し・復元ができます。';
  }
  committedState=JSON.stringify(state);
}
load();
function invalidateHistory(){
  undoState=null;
  stagedImport=null;
}
function refreshFromStorage(){
  invalidateHistory();
  load();
  if(modal.open)modal.close();
  render();
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
function undoable(fn,message){undoState=structuredClone(state);fn();undoFingerprint=JSON.stringify({...state,timer:null});if(save()){render();toast(message,true);}}
const catalog=()=>[...EXERCISES,...state.customExercises];
const exercise=id=>catalog().find(e=>e.id===id)??{id,name:'未登録の種目',group:'',equipment:'',load:'total'};
const getWorkout=()=>state.workouts[day]??{title:'WORKOUT',exercises:[],note:''};
function ensureWorkout(date=day){return state.workouts[date]??=( {title:'WORKOUT',exercises:[],note:''});}
const instance=id=>getWorkout().exercises.find(e=>e.id===id);
const setById=id=>getWorkout().exercises.flatMap(e=>e.sets).find(s=>s.id===id);
const unit=()=>state.settings.unit;
const weight=(kg,dec=2)=>nf(C.fromKg(kg,unit()),dec);
const dateLabel=(d,long=false)=>C.parseDay(d).toLocaleDateString('ja-JP',{month:'long',day:'numeric',...(long?{year:'numeric',weekday:'short'}:{})});
const loadLabel=e=>e.id==='cable-fly'?'片側の表示重量':({single:'片手の重量',total:'合計重量',stack:'マシン表示の重量',body:'追加重量（自重は0）'}[e.load]);
const shortLoad=e=>e.id==='cable-fly'?'片側の表示重量':({single:'片手',total:'合計',stack:'表示重量',body:'追加重量'}[e.load]);
const progress=(value,target)=>target>0?Math.max(0,Math.min(100,value/target*100)):0;
const NAV=[['workout','トレーニング','dumbbell','筋トレ'],['food','食事・PFC','food','食事'],['body','からだ・計画','chart','からだ'],['records','自己ベスト','crown','ベスト'],['history','カレンダー','calendar','履歴']];
function render(){
  const title=NAV.find(n=>n[0]===view)?.[1]??'トレーニング';
  app.innerHTML=`<aside class="sidebar"><div class="brand"><img src="./icon.svg" alt="">REPNOTE<span style="color:var(--lime)">.</span></div><div class="brand-caption">積み重ねが、見える。</div><div class="nav-caption">MY ACTIVITY</div><nav class="nav" aria-label="メインメニュー">${NAV.map(([id,label,ic])=>`<button class="nav-item ${view===id?'active':''}" data-action="nav" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(ic)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('spark')}<div>昨日の自分から、<br>ひとつ先へ。</div></div><button class="nav-item" data-action="settings">${icon('settings')}設定・バックアップ</button><div class="sidebar-footer">YOUR PACE. YOUR PROGRESS.</div></div></aside>
  <main class="shell"><header class="topbar"><div><div class="eyebrow">YOUR PERSONAL TRAINING JOURNAL</div><h1>${title}</h1></div><div class="top-actions"><div class="unit-switch" aria-label="トレーニング重量の単位"><button data-action="unit" data-unit="kg" class="${unit()==='kg'?'active':''}" aria-pressed="${unit()==='kg'}">kg</button><button data-action="unit" data-unit="lbs" class="${unit()==='lbs'?'active':''}" aria-pressed="${unit()==='lbs'}">lbs</button></div><button class="button primary" data-action="share" aria-label="記録をシェア">${icon('share')}<span class="share-label">記録をシェア</span></button><button class="avatar" data-action="settings" aria-label="設定を開く">R</button>${ib('settings','設定・バックアップ','settings','', 'mobile-settings')}</div></header>
  ${mode==='demo'?`<div class="demo-banner"><span>サンプルで操作を体験中 · 数値はすべて架空です</span><button data-action="start-real">自分の記録をはじめる</button></div>`:''}
  ${storageProblem?`<div class="error-banner" role="alert">${h(storageProblem)}</div>`:''}
  ${view==='workout'?renderWorkout():view==='food'?renderFood():view==='body'?renderBody():view==='records'?renderRecords():renderHistory()}
  </main><nav class="mobile-nav" aria-label="メインメニュー">${NAV.map(([id,label,ic,short])=>`<button data-action="nav" data-view="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span>${short}</span></button>`).join('')}</nav>`;
  renderTimer();
}
function dateStrip(){const dow=C.parseDay(day).getDay();const start=C.shiftDay(day,-((dow+6)%7));return `<div class="date-control between"><div class="date-label">${dateLabel(day,true)}</div><div class="row"><input type="date" value="${day}" aria-label="記録する日付" data-change="date">${day!==today?btn('today','今日','','ghost'):''}</div></div><div class="week">${Array.from({length:7},(_,i)=>{const d=C.shiftDay(start,i),has=C.workoutStats(state.workouts[d]).sets>0;return `<button class="day ${d===day?'active':''} ${d===today?'today':''}" data-action="day" data-date="${d}" aria-label="${dateLabel(d)}の記録" aria-pressed="${d===day}"><div class="dow">${['月','火','水','木','金','土','日'][i]}</div><div class="num">${C.parseDay(d).getDate()}</div><div class="day-dot ${has?'':'blank'}"></div></button>`;}).join('')}</div>`;}
function renderWorkout(){const w=getWorkout(),stats=C.workoutStats(w),prs=C.records(state);return `<div class="layout"><section class="main-col">${dateStrip()}<div class="workout-hero"><div><div class="eyebrow">${day===today?'TODAY’S WORKOUT':'WORKOUT LOG'}</div><div class="hero-title">${h(w.title)}</div><p>${stats.exercises?catalogGroups(w)+'の日。ひとつずつ、積み重ねよう。':'メニューを選んで、今日の一歩を。'}</p></div><div class="hero-right">${btn('routines','メニューを選ぶ','list')}</div></div><div class="metric-grid"><div class="metric"><div class="label">${icon('check')}完了セット</div><div class="value">${stats.sets}<span>/ ${stats.total}</span></div></div><div class="metric"><div class="label">${icon('weight')}ボリューム</div><div class="value">${weight(stats.volume,0)}<span>${unit()}</span></div></div><div class="metric"><div class="label">${icon('dumbbell')}種目</div><div class="value">${stats.exercises}<span>EXERCISES</span></div></div></div><div class="workout-toolbar"><h2>セットを記録</h2><div class="row">${btn('copy-previous','前回をコピー','copy')}${btn('timer-open','休憩','clock')}</div></div>
  ${w.exercises.length?w.exercises.map(e=>renderExercise(e,prs)).join(''):`<div class="panel empty">${icon('dumbbell')}<h3>今日のメニューをつくろう</h3><p>前回の記録や保存したメニューから、重量と回数をすぐに呼び出せます。</p>${btn('routines','メニューからはじめる','list','primary')}</div>`}
  <button class="add-exercise" data-action="add-exercise">${icon('plus')}種目を追加</button><div class="panel session-note" style="margin-top:20px"><div class="between"><h3>トレーニングメモ</h3>${btn('save-routine','メニューを保存','save','ghost')}</div><textarea placeholder="調子、フォーム、次回気をつけたいこと…" aria-label="トレーニングメモ" maxlength="2000" data-change="session-note">${h(w.note)}</textarea><div class="save-note">${icon('shield')}${mode==='demo'?'サンプルモードで保存':'このブラウザに自動保存'} · 完了したセットを集計</div></div><div class="small" style="margin-top:14px">ボリューム＝完了したセットの入力重量 × 回数の合計。ダンベルは片手分、自重の体重分は含みません。</div></section><aside class="side-col">${nutritionPanel()}${highlightPanel(prs)}${weightPanel()}<div class="tip-box"><strong>${icon('copy')} 同じセットは、もう一度入力しない。</strong>行のコピーアイコンで重量と回数を複製。チェックを入れたセットだけが記録に加わります。</div></aside></div>`;}
function catalogGroups(w){return [...new Set(w.exercises.map(e=>exercise(e.exerciseId).group))].filter(Boolean).join('・');}
function options(values,current,formatter=n=>String(n),extra=''){return values.map(n=>`<option value="${n}" ${(typeof n==='number'?Math.abs(n-current)<1e-8:n===current)?'selected':''}>${h(formatter(n))}</option>`).join('')+extra;}
function weightOptions(set, last) {
  const current = C.fromKg(set.kg, unit());
  const step = state.settings.weightStep;
  const near = new Set([current]);
  const center = Math.round(current / step);
  for (let i = Math.max(0, center - 2); i <= center + 2; i++) {
    const value = Number((i * step).toFixed(6));
    if (C.toKg(value, unit()) <= 5000) near.add(value);
  }
  const recent = [...new Set((last?.sets ?? []).map(s => C.fromKg(s.kg, unit())))].filter(n => !near.has(n));
  const group = (label, values) => `<optgroup label="${label}">${values.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${nf(n, 2)}</option>`).join('')}</optgroup>`;
  return group('現在・近くの重量', [...near].sort((a,b) => a-b)) +
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
  const existing = new Set(Array.from(el.options, option => option.value));
  const values = weightRange(state.settings.weightStep, el.dataset.load, unit());
  group.innerHTML = values.filter(n => !existing.has(String(n))).map(n => `<option value="${n}">${nf(n,2)}</option>`).join('');
}
document.addEventListener('pointerdown', expandWeightPicker);
document.addEventListener('focusin', expandWeightPicker);

function focusSet(id, field = 'set-weight', reveal = false) {
  const el = app.querySelector(`[data-change="${field}"][data-id="${CSS.escape(id)}"]`);
  el?.focus({preventScroll:true});
  if (reveal) el?.scrollIntoView({block:'nearest'});
}
function renderExercise(inst,prs){const ex=exercise(inst.exerciseId),last=C.lastExercise(state,ex.id,day);return `<article class="exercise-card" id="exercise-${h(inst.id)}"><div class="exercise-head"><div class="row"><div class="badge-icon">${icon('dumbbell')}</div><div><div class="exercise-title">${h(ex.name)}</div><div class="exercise-sub">${h(ex.group)} · ${h(ex.equipment)} · ${h(loadLabel(ex))}</div></div></div><div class="exercise-tools">${ib('favorite',state.favorites.includes(ex.id)?'お気に入りから外す':'お気に入りに追加','star',`data-id="${h(ex.id)}"`,state.favorites.includes(ex.id)?'active':'')}${ib('exercise-menu','種目の編集・削除','more',`data-id="${h(inst.id)}"`)}</div></div><div class="set-table"><div class="set-grid labels"><span>SET</span><span class="previous">前回</span><span>重量 ${unit()}</span><span>回数</span><span>完了</span><span>複製</span><span></span></div>${inst.sets.map((s,i)=>{const prev=last?.sets[i]??last?.sets.at(-1),isPR=prs[ex.id]?.id===s.id;return `<div class="set-grid set-row ${s.completed?'done':''}"><div class="set-num">${s.kind==='warmup'?'W':i+1}${isPR?icon('crown','tiny-crown'):s.assisted?'<span class="small">補</span>':''}</div><div class="previous ${prev?'has-previous':''}">${prev?`<span class="previous-label">前回 </span>${weight(prev.kg)} × ${prev.reps}`:'—'}</div><select aria-label="${h(ex.name)} セット${i+1}の重量" data-change="set-weight" data-load="${ex.load}" data-id="${h(s.id)}">${weightOptions(s,last)}</select><select aria-label="${h(ex.name)} セット${i+1}の回数" data-change="set-reps" data-id="${h(s.id)}">${options([...new Set([...Array.from({length:30},(_,i)=>i+1),40,50,60,100,s.reps])].sort((a,b)=>a-b),s.reps,n=>n,'<option value="custom">直接入力…</option>')}</select><button class="complete-check ${s.completed?'checked':''}" data-action="complete-set" data-id="${h(s.id)}" data-exercise="${h(ex.id)}" aria-label="${h(ex.name)} セット${i+1}を${s.completed?'未完了にする':'完了にする'}" aria-pressed="${s.completed}">${icon('check')}</button>${ib('copy-set',`${ex.name} セット${i+1}をコピー`,'copy',`data-id="${h(s.id)}" data-instance="${h(inst.id)}"`)}${ib('edit-set',`${ex.name} セット${i+1}の詳細を編集`,'more',`data-id="${h(s.id)}"`)}</div>`;}).join('')}</div><div class="exercise-footer"><button class="text-button" data-action="add-set" data-id="${h(inst.id)}">${icon('plus')}セットを追加</button><button class="text-button" data-action="copy-exercise-previous" data-id="${h(inst.id)}">${icon('history')}${last?`${dateLabel(last.date)}をコピー`:'前回のセット'}</button></div>${inst.note?`<div class="exercise-note">${h(inst.note)}</div>`:''}</article>`;}
function macroRows(t,plan=state.plan){return [['p','P','たんぱく質','#7da455'],['f','F','脂質','#a58bd2'],['c','C','炭水化物','#e6ab61']].map(([key,abbr,label,color])=>`<div class="progress-row"><div class="progress-info"><span class="progress-label"><i class="macro-dot" style="background:${color}"></i><strong>${abbr}</strong>${label}</span><span class="mono">${nf(t[key])}<span class="muted"> / ${plan?.[key]>0?nf(plan[key])+' g':'目標未設定'}</span></span></div><div class="progress-track"><div class="progress-fill" style="background:${color};width:${progress(t[key],plan?.[key])}%"></div></div></div>`).join('');}
function calorieRing(t,big=false){const target=state.plan?.kcal;return `<div class="ring-wrap"><div class="cal-ring" style="--value:${progress(t.kcal,target)};--ring:${target&&t.kcal>target?'#e7ae68':'#cdf476'}"><div class="inner">${icon('fire')}${big?'<div class="small">ENERGY</div>':''}</div></div><div><div class="ring-number">${nf(t.kcal,0)}<span>kcal</span></div><div class="mini-subtitle">${target>0?`目標 ${nf(target,0)} kcal`:'カロリー目標は未設定'}</div>${target>0?`<div class="pill" style="margin-top:9px">${t.kcal<=target?'あと':'目標より'} ${nf(Math.abs(target-t.kcal),0)} kcal${t.kcal>target?'多い':''}</div>`:''}</div></div>`;}
function nutritionPanel(){const t=C.mealTotals(state.meals[day]);return `<section class="panel"><div class="panel-heading"><h2>${day===today?'今日の栄養':'この日の栄養'}</h2><span class="tag">${dateLabel(day)}</span></div>${calorieRing(t)}${macroRows(t)}${btn('nav-food','食事を記録する','plus','full')}</section>`;}
function highlightPanel(prs){const pr=Object.values(prs).sort((a,b)=>b.date.localeCompare(a.date))[0];return `<section class="panel record-highlight"><div class="record-crown">${icon('crown')}</div><div class="eyebrow">PERSONAL BEST</div><h2>${pr?h(exercise(pr.exerciseId).name):'はじめの一歩も、記録に。'}</h2><div class="big-record">${pr?weight(pr.kg):'—'}<span>${unit()}</span></div><div class="mini-subtitle">${pr?`${pr.reps} 回 · ${h(shortLoad(exercise(pr.exerciseId)))} · ${dateLabel(pr.date)}`:'完了したセットからベストを見つけます'}</div><button class="text-button" data-action="nav" data-view="records">すべての自己ベストを見る</button></section>`;}
function weightPanel(){const values=state.body.filter(b=>b.date<=day).sort((a,b)=>a.date.localeCompare(b.date)),latest=values.at(-1),first=values[0];return `<section class="panel"><div class="panel-heading" style="margin-bottom:8px"><h2>からだの変化</h2>${icon('chart')}</div><div class="mini-weight">${latest?nf(latest.kg):'—'}<span>kg</span>${latest&&first?`<span class="change">初回比 ${latest.kg-first.kg>0?'+':''}${nf(latest.kg-first.kg)} kg</span>`:''}</div>${miniChart(values)}<div class="between"><span class="small">${latest?dateLabel(latest.date)+'の記録':'体重の記録からはじめよう'}</span><button class="text-button" data-action="nav" data-view="body">計画を見る</button></div></section>`;}
function miniChart(values){if(!values.length)return '<div style="height:55px"></div>';const ys=values.map(b=>b.kg),min=Math.min(...ys)-.2,max=Math.max(...ys)+.2;const pts=values.map((v,i)=>[8+i/Math.max(1,values.length-1)*254,75-(v.kg-min)/(max-min)*60]);return `<svg class="mini-graph" viewBox="0 0 270 90" role="img" aria-label="体重の推移"><path d="M8 80H262" stroke="#e8eee2"/><path d="M${pts.map(p=>p.join(',')).join(' L')} L${pts.at(-1)[0]},80 L8,80Z" fill="#f1f6e8"/><path d="M${pts.map(p=>p.join(',')).join(' L')}" fill="none" stroke="#6d9654" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4" fill="#6d9654" stroke="white" stroke-width="2"/></svg>`;}
function renderFood(){const list=state.meals[day]??[],t=C.mealTotals(list);return `<div class="layout"><section class="main-col">${dateStrip()}<div class="panel food-summary">${calorieRing(t,true)}<div>${macroRows(t)}<div class="small" style="margin-top:12px">PFC由来のエネルギー ${nf(C.macroEnergy(t),0)} kcal</div></div></div><div class="section-heading"><h2>食事の記録</h2><div class="row">${btn('copy-food-day','前日をコピー','copy')}${btn('add-food','食事を追加','plus','primary')}</div></div>${['朝食','昼食','夕食','間食'].map(meal=>{const ms=list.filter(m=>m.meal===meal);return `<section class="meal-section"><div class="meal-header"><span>${meal}</span><small>${nf(C.mealTotals(ms).kcal,0)} kcal</small></div>${ms.length?ms.map(m=>{const mt=C.mealTotals([m]);return `<div class="food-item"><div><h3>${h(m.name)}</h3><div class="food-detail">${nf(m.amount,2)}${m.basis==='100g'?' g':' 食分'} · P ${nf(mt.p)} / F ${nf(mt.f)} / C ${nf(mt.c)} g</div></div><div class="row"><div class="food-value">${nf(mt.kcal,0)}<span> kcal</span></div>${ib('copy-food','この食事をコピー','copy',`data-id="${h(m.id)}"`)}${ib('edit-food','この食事を編集','edit',`data-id="${h(m.id)}"`)}</div></div>`;}).join(''):`<button class="empty-line" style="width:100%;text-align:left" data-action="add-food" data-meal="${meal}">＋ ${meal}を記録する</button>`}</section>`;}).join('')}</section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>いつもの食事</h2>${icon('heart')}</div><p class="mini-subtitle">登録した食品を選んで、量だけ入力。</p>${state.foods.length?`<div class="suggestions">${state.foods.map(f=>`<button class="suggestion" data-action="saved-food" data-id="${h(f.id)}">${icon('plus')}${h(f.name.replace('（サンプル）',''))}</button>`).join('')}</div>`:`<div class="empty-line" style="margin-top:15px">食事を追加するときに「いつもの食事に登録」を選べます。</div>`}${btn('manage-foods','登録した食品を管理','edit','full ghost')}</section><section class="panel"><div class="panel-heading"><h2>目標のPFCバランス</h2>${icon('target')}</div><p class="mini-subtitle">自分の計画に合わせて、1日のカロリーとPFC目標を設定。</p>${state.plan?['kcal','p','f','c'].map((k,i)=>`<div class="stat-line"><span>${['カロリー','たんぱく質','脂質','炭水化物'][i]}</span><strong>${state.plan[k]>0?nf(state.plan[k])+(i?' g':' kcal'):'未設定'}</strong></div>`).join(''):''}${btn('edit-plan','目標を設定する','edit','full')}</section><div class="tip-box"><strong>食品の表示値を、そのまま。</strong>カロリーはパッケージの値を入力できます。PFCから計算した値とは、食物繊維や表示の丸めなどで差が出ることがあります。</div></aside></div>`;}
function renderBody(){const plan=state.plan,ps=C.planStats(plan,state.body,today),body=[...state.body].sort((a,b)=>b.date.localeCompare(a.date)),latest=body.filter(b=>b.date<=today)[0];return `<div class="layout"><section class="main-col"><div class="workout-hero"><div><div class="eyebrow">BODY & GOALS</div><div class="hero-title">自分のペースで、育てよう。</div><p>数字の変化も、続けた日々も、ひと目で。</p></div></div><div class="metric-grid"><div class="metric"><div class="label">スタート</div><div class="value">${plan?nf(plan.startWeight):'—'}<span>kg</span></div></div><div class="metric"><div class="label">現在の体重</div><div class="value">${latest?nf(latest.kg):'—'}<span>kg</span></div></div><div class="metric"><div class="label">目標体重</div><div class="value">${plan?nf(plan.targetWeight):'—'}<span>kg</span></div></div></div><section class="panel"><div class="panel-heading"><h2>体重の推移</h2>${btn('add-body','体重を記録','plus','primary')}</div>${bodyChart()}<div class="chart-legend"><span>実際の記録</span><span>計画上のライン</span></div></section><div class="section-heading"><h2>からだの記録</h2><small>体重はkgで記録</small></div><section class="panel">${body.length?body.map(b=>`<div class="body-entry"><div>${dateLabel(b.date,true)}<small>${b.bodyFat!=null?`体脂肪率 ${nf(b.bodyFat)}%`:'体脂肪率の記録なし'}</small></div><div class="row"><strong>${nf(b.kg)} <small style="display:inline">kg</small></strong>${ib('edit-body','体重の記録を訂正','edit',`data-date="${b.date}"`)}</div></div>`).join(''):`<div class="empty">${icon('chart')}<h3>変化を記録しよう</h3><p>体重と、任意で体脂肪率を記録できます。</p></div>`}</section></section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>ボディメイク計画</h2>${icon('target')}</div>${plan?`<div class="pill">${plan.targetWeight<plan.startWeight?'減量':plan.targetWeight>plan.startWeight?'増量':'体重維持'}プラン</div><div class="stat-line"><span>開始</span><strong>${dateLabel(plan.startDate)}</strong></div><div class="stat-line"><span>目標日</span><strong>${dateLabel(plan.targetDate)}</strong></div><div class="stat-line"><span>計画上のペース</span><strong>${ps.weekly>0?'+':''}${nf(ps.weekly,2)} kg/週</strong></div><div class="stat-line"><span>目標日まで</span><strong>${ps.remainingDays} 日</strong></div><div class="progress-row"><div class="progress-info"><span>目標への進み具合</span><strong>${nf(ps.progress,0)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${ps.progress}%"></div></div></div><p class="mini-subtitle" style="margin-top:14px">計画線は開始と目標を結んだ目安です。体重の変化を予測・保証するものではありません。</p>`:'<p class="mini-subtitle">スタートと目標、期間を決めて、実際の記録と見比べられます。</p>'}${btn('edit-plan',plan?'計画・PFC目標を編集':'計画をつくる','edit','full')}${btn('share-plan','計画をシェア','share','full ghost')}</section>${nutritionPanel()}</aside></div>`;}
function bodyChart(){const p=state.plan,bs=state.body.filter(b=>b.date<=today).sort((a,b)=>a.date.localeCompare(b.date));if(!bs.length&&!p)return `<div class="empty">${icon('chart')}<p>体重を記録すると、ここにグラフが表示されます。</p></div>`;const dates=[...bs.map(b=>b.date),...(p?[p.startDate,p.targetDate]:[])].sort(),start=dates[0],end=dates.at(-1),span=Math.max(1,C.daysBetween(start,end));const weights=[...bs.map(b=>b.kg),...(p?[p.startWeight,p.targetWeight]:[])],min=Math.floor(Math.min(...weights)-.5),max=Math.ceil(Math.max(...weights)+.5),xp=d=>52+C.daysBetween(start,d)/span*550,yp=kg=>210-(kg-min)/(max-min)*170;return `<svg class="chart" viewBox="0 0 630 260" role="img" aria-label="体重推移グラフ。実測値は下のからだの記録に掲載。計画線は目標日までの直線。">${Array.from({length:5},(_,i)=>{const val=min+(max-min)/4*i,y=yp(val);return `<line x1="52" x2="602" y1="${y}" y2="${y}" stroke="#e7ece2" stroke-dasharray="4 5"/><text x="43" y="${y+4}" text-anchor="end" font-size="12" fill="#7b8873">${nf(val)}</text>`;}).join('')}<text x="9" y="21" font-size="11" fill="#7b8873">kg</text>${p?`<path d="M${xp(p.startDate)},${yp(p.startWeight)} L${xp(p.targetDate)},${yp(p.targetWeight)}" stroke="#b5c69a" stroke-width="2" stroke-dasharray="6 6" fill="none"/>`:''}${bs.length?`<path d="M${bs.map(b=>`${xp(b.date)},${yp(b.kg)}`).join(' L')}" fill="none" stroke="#487147" stroke-width="3" stroke-linejoin="round"/>${bs.map(b=>`<circle cx="${xp(b.date)}" cy="${yp(b.kg)}" r="4" fill="#487147" stroke="white" stroke-width="2"><title>${b.date}：${b.kg}kg</title></circle>`).join('')}`:''}<text x="52" y="242" font-size="12" fill="#7b8873">${dateLabel(start)}</text><text x="602" y="242" text-anchor="end" font-size="12" fill="#7b8873">${dateLabel(end)}</text></svg>`;}
function renderRecords(){const prs=Object.values(C.records(state)).filter(p=>prGroup==='すべて'||exercise(p.exerciseId).group===prGroup).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="pr-intro"><div><div class="eyebrow" style="color:#b6cf9d">YOUR STRONGEST SELF</div><h2>小さな更新が、大きな自信に。</h2><p>最高重量を一覧で。間違えた記録は、ここから訂正できます。</p></div>${icon('crown')}</div><div class="between"><h2>自己ベスト <span class="muted" style="font-weight:400;font-size:15px">${Object.keys(C.records(state)).length} 種目</span></h2>${btn('record-info','集計ルール','','ghost')}</div><div class="filter-row">${['すべて','胸','背中','肩','腕','脚','体幹'].map(g=>`<button class="chip ${prGroup===g?'active':''}" data-action="pr-group" data-group="${g}">${g}</button>`).join('')}</div><div class="wide-grid">${prs.map(p=>{const e=exercise(p.exerciseId);return `<article class="panel pr-card">${icon('crown')}<span class="pill">${h(e.group)} · ${h(e.equipment)}</span><h3>${h(e.name)}</h3><div class="pr-number">${weight(p.kg)}<span>${unit()} × ${p.reps} 回</span></div><div class="small">${h(shortLoad(e))} · ${dateLabel(p.date,true)}</div><button class="text-button" data-action="edit-record" data-date="${p.date}" data-id="${h(p.id)}">${icon('edit')} 元の記録を訂正する</button></article>`;}).join('')}</div>${!prs.length?`<div class="panel empty">${icon('crown')}<h3>自己ベストはここに並びます</h3><p>ウォームアップ・補助ありを除く、完了したセットの最高重量を集計します。</p>${btn('nav-workout','トレーニングを記録','plus','primary')}</div>`:''}<div class="small" style="margin-top:22px">同じ重量では回数が多いセットを表示。自重種目の0kgは追加重量なしを意味します。異なるマシンはカスタム種目を分けて記録してください。</div>`;}
function renderHistory(){const start=`${month}-01`,startDow=C.parseDay(start).getDay(),gridStart=C.shiftDay(start,-((startDow+6)%7));const dates=Object.keys(state.workouts).filter(d=>state.workouts[d].exercises.length).sort().reverse(),monthDates=dates.filter(d=>d.startsWith(month)),monthSets=monthDates.reduce((n,d)=>n+C.workoutStats(state.workouts[d]).sets,0);return `<div class="layout"><section class="main-col"><section class="panel"><div class="panel-heading"><h2>${Number(month.slice(0,4))}年 ${Number(month.slice(5))}月</h2><div class="row">${btn('previous-month','前月','','ghost')}${btn('next-month','翌月','','ghost')}</div></div><div class="calendar">${['月','火','水','木','金','土','日'].map(d=>`<div class="weekday">${d}</div>`).join('')}${Array.from({length:42},(_,i)=>{const d=C.shiftDay(gridStart,i),st=C.workoutStats(state.workouts[d]);return `<button class="calendar-day ${d.slice(0,7)===month?'':'outside'} ${d===day?'active':''}" data-action="history-date" data-date="${d}" aria-label="${dateLabel(d)}、筋トレ${st.sets}セット、食事${(state.meals[d]??[]).length}件"><span>${C.parseDay(d).getDate()}</span><span class="day-marks">${st.sets?'<span></span>':''}${(state.meals[d]??[]).length?'<span class="food-dot"></span>':''}</span></button>`;}).join('')}</div><div class="small" style="margin-top:16px">緑：完了した筋トレ　 オレンジ：食事記録</div></section><div class="section-heading"><h2>最近のトレーニング</h2><span class="small">タップして確認・訂正</span></div><section class="panel">${dates.length?dates.map(d=>{const w=state.workouts[d],st=C.workoutStats(w);return `<button class="history-item" data-action="history-date" data-date="${d}"><div><h3>${h(w.title)} <span class="pill">${catalogGroups(w)}</span></h3><small>${dateLabel(d,true)} · ${st.exercises}種目 / ${st.sets}セット完了</small></div><div class="history-score">${weight(st.volume,0)} ${unit()}</div></button>`;}).join(''):'<div class="empty">まだ記録がありません。</div>'}</section></section><aside class="side-col"><section class="panel"><div class="panel-heading"><h2>この月の積み重ね</h2>${icon('calendar')}</div><div class="stat-line"><span>トレーニングした日</span><strong>${monthDates.filter(d=>C.workoutStats(state.workouts[d]).sets>0).length} 日</strong></div><div class="stat-line"><span>完了したセット</span><strong>${monthSets} セット</strong></div><div class="stat-line"><span>食事を記録した日</span><strong>${Object.keys(state.meals).filter(d=>d.startsWith(month)&&state.meals[d].length).length} 日</strong></div></section>${highlightPanel(C.records(state))}</aside></div>`;}

function openDialog(title,body,subtitle=''){modal.innerHTML=`<header class="modal-head"><div>${subtitle?`<div class="eyebrow">${h(subtitle)}</div>`:''}<h2 id="modal-title">${h(title)}</h2></div>${ib('close','閉じる','close')}</header><div class="modal-content">${body}</div>`;modal.onsubmit=null;if(!modal.open)modal.showModal();modal.scrollTop=0;}
const inputField=(name,label,value='',attrs='',cls='')=>`<div class="field ${cls}"><label for="field-${name}">${h(label)}</label><input id="field-${name}" name="${name}" value="${h(value)}" ${attrs}></div>`;
const selectField=(name,label,values,value,cls='')=>`<div class="field ${cls}"><label for="field-${name}">${h(label)}</label><select id="field-${name}" name="${name}">${values.map(v=>{const [id,text]=Array.isArray(v)?v:[v,v];return `<option value="${h(id)}" ${id===value?'selected':''}>${h(text)}</option>`;}).join('')}</select></div>`;
const formEnd=(label='保存する',extra='')=>`<div class="form-error" id="form-error" role="alert"></div><div class="modal-actions">${extra}${btn('close','キャンセル')}<button type="submit" class="button primary">${h(label)}</button></div>`;
function bindForm(fn){
  modal.onsubmit=e=>{
    e.preventDefault();
    const form=e.target, data=new FormData(form);
    return withRecordLock(()=>{
      if(!modal.open||!modal.contains(form))return;
      try{fn(data);}catch(err){
        const error=form.querySelector('#form-error');
        if(error)error.textContent=err.message;else toast(err.message);
      }
    });
  };
}
const need=(ok,message)=>{if(!ok)throw Error(message);};
const number=(fd,k,min=0,max=100000)=>{const raw=fd.get(k);const v=Number(raw);need(raw!==null&&raw!==''&&Number.isFinite(v)&&v>=min&&v<=max,`${({kg:'重量',reps:'回数',amount:'量',kcal:'カロリー',p:'たんぱく質',f:'脂質',c:'炭水化物',startWeight:'開始体重',targetWeight:'目標体重'})[k]??k}を正しく入力してください。`);return v;};
function openExercisePicker(reset=true){if(reset){searchText='';searchGroup='お気に入り';}openDialog('種目を追加',`<div class="search-field">${icon('search')}<input id="exercise-search" placeholder="種目名・略称で検索（例：DBプレス）" value="${h(searchText)}" aria-label="種目を検索"></div><div class="filter-row">${['お気に入り','最近','すべて','胸','背中','肩','腕','脚','体幹'].map(g=>`<button class="chip ${g===searchGroup?'active':''}" data-action="search-group" data-group="${g}">${g}</button>`).join('')}</div><div class="exercise-results" id="exercise-results">${exerciseResults()}</div><div class="modal-actions">${btn('custom-exercise','自分の種目をつくる','plus')}</div>`,'QUICK ADD');}
function exerciseResults(){const recents=[...new Set(Object.keys(state.workouts).sort().reverse().flatMap(d=>state.workouts[d].exercises.map(e=>e.exerciseId)))];const q=searchText.normalize('NFKC').toLocaleLowerCase().trim();let list=catalog().filter(e=>(!q||[e.name,e.equipment,...e.aliases].some(v=>v.normalize('NFKC').toLocaleLowerCase().includes(q)))&&(q||searchGroup==='すべて'||(searchGroup==='お気に入り'?state.favorites.includes(e.id):searchGroup==='最近'?recents.includes(e.id):e.group===searchGroup)));if(searchGroup==='最近'&&!q)list.sort((a,b)=>recents.indexOf(a.id)-recents.indexOf(b.id));return list.length?list.map(e=>`<div class="exercise-option"><button class="option-main" data-action="choose-exercise" data-id="${h(e.id)}"><span class="badge-icon">${icon('dumbbell')}</span><span><strong>${h(e.name)}</strong><small>${h(e.group)} · ${h(e.equipment)} · ${h(shortLoad(e))}</small></span></button>${ib('picker-favorite',state.favorites.includes(e.id)?'お気に入りから外す':'お気に入りに追加','star',`data-id="${h(e.id)}"`,state.favorites.includes(e.id)?'active':'')}${ib('choose-exercise',`${e.name}を追加`,'plus',`data-id="${h(e.id)}"`)}</div>`).join(''):`<div class="empty"><h3>種目が見つかりません</h3><p>「すべて」を選ぶか、別の名前で検索してください。</p></div>`;}
function addExercise(id){const w=ensureWorkout();if(w.exercises.some(e=>e.exerciseId===id)){toast('この種目は追加済みです');return false;}const last=C.lastExercise(state,id,day);const inst=last?{id:C.uid(),exerciseId:id,note:last.note??'',sets:last.sets.filter(s=>s.completed).map(C.cloneSet)}:{id:C.uid(),exerciseId:id,note:'',sets:[C.newSet()]};w.exercises.push(inst);return true;}
function customExerciseForm(){openDialog('自分の種目をつくる',`<p>違うマシンや別のフォームは、別の種目として記録すると比較しやすくなります。</p><form><div class="form-grid">${inputField('name','種目名','','required maxlength="100" placeholder="例：レッグプレス（ジムA）"','full')}${selectField('group','部位',['胸','背中','肩','腕','脚','体幹'],'胸')}${selectField('equipment','器具',['バーベル','ダンベル','マシン','ケーブル','自重'],'マシン')}${selectField('load','重量の記録方法',[['total','合計重量'],['single','片手の重量'],['stack','マシン表示の重量'],['body','追加重量（自重は0）']],'stack','full')}</div>${formEnd('作成して追加')}</form>`);bindForm(fd=>{const name=String(fd.get('name')).trim();need(name.length>0,'種目名を入力してください。');need(!catalog().some(e=>e.name===name),'同名の種目があります。別の名前を付けてください。');const id=C.uid();state.customExercises.push({id,name,group:fd.get('group'),equipment:fd.get('equipment'),load:fd.get('load'),aliases:[]});state.favorites.push(id);addExercise(id);modal.close();commit('種目を追加しました');});}
function routineDialog(){const routines=[...ROUTINES,...state.routines];openDialog('メニューを選ぶ',`<p>種目の並びをまとめて追加。前回の完了セットがあれば、重量と回数も引き継ぎます。</p>${routines.map(r=>`<div class="routine-option"><div><h3>${h(r.name)}</h3><p>${h(r.subtitle)} · ${r.exerciseIds.length}種目</p></div><div class="row">${state.routines.some(x=>x.id===r.id)?ib('delete-routine','保存メニューを削除','trash',`data-id="${h(r.id)}"`):''}${btn('use-routine','追加する','plus','',`data-id="${h(r.id)}"`)}</div></div>`).join('')}`,'MY ROUTINES');}
function saveRoutineForm(){if(!getWorkout().exercises.length){toast('先に種目を追加してください');return;}openDialog('メニューを保存',`<p>いまの種目と並び順を保存します。次回は各種目の前回記録を呼び出せます。</p><form>${inputField('name','メニュー名',getWorkout().title,'required maxlength="80"')}${formEnd('保存する')}</form>`);bindForm(fd=>{state.routines.push({id:C.uid(),name:String(fd.get('name')).trim()||'マイメニュー',subtitle:catalogGroups(getWorkout()),exerciseIds:getWorkout().exercises.map(e=>e.exerciseId)});modal.close();commit('マイメニューを保存しました');});}
function setEditor(id,date=day,focusField='kg'){const w=state.workouts[date],inst=w?.exercises.find(e=>e.sets.some(s=>s.id===id)),s=inst?.sets.find(s=>s.id===id);if(!s)return;const ex=exercise(inst.exerciseId);openDialog('セットを訂正する',`<p>${h(ex.name)} · ${dateLabel(date,true)}<br>訂正すると、自己ベストとボリュームも再計算されます。</p><form><div class="form-grid">${inputField('kg',`${loadLabel(ex)}（${unit()}）`,Number(C.fromKg(s.kg,unit()).toFixed(6)),`type="number" min="0" max="${C.fromKg(5000,unit())}" step="any" required inputmode="decimal"`)}${inputField('reps','回数',s.reps,'type="number" min="1" max="999" step="1" required inputmode="numeric"')}${selectField('kind','セットの種類',[['work','メインセット'],['warmup','ウォームアップ']],s.kind)}${inputField('rpe','きつさ RPE（任意）',s.rpe??'','type="number" min="1" max="10" step="any" inputmode="decimal"')}</div><label class="checkbox-row"><input name="completed" type="checkbox" ${s.completed?'checked':''}>完了したセット</label><label class="checkbox-row"><input name="assisted" type="checkbox" ${s.assisted?'checked':''}>補助あり（自己ベストから除外）</label>${formEnd('訂正して保存',btn('delete-set','セットを削除','trash','danger',`data-id="${h(id)}" data-date="${date}"`))}</form>`);const originalDisplay=Number(C.fromKg(s.kg,unit()).toFixed(6));bindForm(fd=>{const kg=editedWeightKg(fd.get('kg'), {unit:unit(),originalKg:s.kg,displayed:originalDisplay,completed:fd.has('completed'),load:ex.load}),reps=number(fd,'reps',1,999);need(Number.isInteger(reps),'回数は整数で入力してください。');const rpe=fd.get('rpe')===''?null:number(fd,'rpe',1,10);Object.assign(s,{kg,reps,kind:fd.get('kind'),rpe,completed:fd.has('completed'),assisted:fd.has('assisted')});modal.close();commit('記録と自己ベストを更新しました');});setTimeout(()=>modal.querySelector(`[name="${focusField}"]`)?.focus(),10);}
function exerciseMenu(id){const inst=instance(id);if(!inst)return;openDialog(exercise(inst.exerciseId).name,`<form><div class="field"><label for="exercise-note">この種目のメモ</label><textarea id="exercise-note" name="note" maxlength="2000" placeholder="シートの位置、グリップ、次回のポイント…">${h(inst.note??'')}</textarea></div>${formEnd('メモを保存',btn('delete-exercise','種目を削除','trash','danger',`data-id="${h(id)}"`))}</form>`);bindForm(fd=>{inst.note=fd.get('note');modal.close();commit('メモを保存しました');});}
function foodForm({entry=null,preset=null,meal='朝食',saveOnly=false}={}){const f=entry??preset??{name:'',basis:'serving',amount:1,meal,kcal:'',p:0,f:0,c:0};openDialog(saveOnly?'登録した食品を編集':entry?'食事を訂正する':'食事を記録',`<p>${saveOnly?'登録済みの食品だけを更新します。過去の食事記録は当時の数値を保持します。':`${dateLabel(day,true)}の食事。パッケージの栄養表示などを入力してください。`}</p><form>${!saveOnly&&state.foods.length?`<div class="field" style="margin-bottom:18px"><label for="saved-food-select">いつもの食事から選ぶ</label><select id="saved-food-select"><option value="">新しく入力する</option>${state.foods.map(x=>`<option value="${h(x.id)}" ${preset?.id===x.id?'selected':''}>${h(x.name)}</option>`).join('')}</select></div>`:''}<div class="form-grid">${inputField('name','食品・メニュー名',f.name,'required maxlength="200"','full')}${!saveOnly?selectField('meal','食事',['朝食','昼食','夕食','間食'],f.meal??meal):''}${selectField('basis','栄養表示の基準',[['serving','1食分あたり'],['100g','100gあたり']],f.basis)}${!saveOnly?inputField('amount',f.basis==='100g'?'食べた量（g）':'食べた量（食分）',f.amount??(f.basis==='100g'?100:1),'type="number" min="0.01" max="10000" step="any" required inputmode="decimal"'):''}${inputField('kcal','基準あたりのカロリー（kcal）',f.kcal,'type="number" min="0" max="100000" step="any" required inputmode="decimal"')}</div><div class="form-grid three" style="margin-top:17px">${['p','f','c'].map((k,i)=>inputField(k,['P たんぱく質（g）','F 脂質（g）','C 炭水化物（g）'][i],f[k],'type="number" min="0" max="100000" step="any" required inputmode="decimal"')).join('')}</div><div class="info-box" id="food-calculation"></div>${!entry&&!saveOnly?'<label class="checkbox-row"><input type="checkbox" name="saveFood" '+(!preset?'checked':'')+'>いつもの食事に登録する</label>':''}${formEnd(saveOnly?'食品を更新':'食事を保存',entry?btn('delete-food','削除','trash','danger',`data-id="${h(entry.id)}"`):'')}</form>`);updateFoodCalculation();bindForm(fd=>{const data={name:String(fd.get('name')).trim(),basis:fd.get('basis'),kcal:number(fd,'kcal'),p:number(fd,'p'),f:number(fd,'f'),c:number(fd,'c')};need(data.name,'食品名を入力してください。');if(saveOnly){const item=state.foods.find(x=>x.id===preset.id);Object.assign(item,data);}else{const record={...data,id:entry?.id??C.uid(),amount:number(fd,'amount',.01,10000),meal:fd.get('meal')};state.meals[day]??=[];if(entry)state.meals[day]=state.meals[day].map(m=>m.id===entry.id?record:m);else state.meals[day].push(record);if(fd.has('saveFood'))state.foods.push({...data,id:C.uid()});}modal.close();commit(saveOnly?'食品を更新しました':'食事を保存しました');});}
function updateFoodCalculation(){const form=modal.querySelector('form'),out=modal.querySelector('#food-calculation');if(!out||!form)return;const fd=new FormData(form),amount=Number(fd.get('amount')??1),basis=fd.get('basis'),mult=fd.has('amount')?(basis==='100g'?amount/100:amount):1;const values={kcal:Number(fd.get('kcal')),p:Number(fd.get('p')),f:Number(fd.get('f')),c:Number(fd.get('c'))};out.textContent=`${fd.has('amount')?'今回の量：':'表示の基準：'}${nf(values.kcal*mult,0)} kcal / P ${nf(values.p*mult)}・F ${nf(values.f*mult)}・C ${nf(values.c*mult)} g（PFC由来 ${nf(C.macroEnergy(values)*mult,0)} kcal）`;}
function manageFoods(){openDialog('いつもの食事を管理',state.foods.length?state.foods.map(f=>`<div class="routine-option"><div><h3>${h(f.name)}</h3><p>${nf(f.kcal)} kcal / ${f.basis==='100g'?'100g':'1食分'}</p></div><div class="row">${ib('edit-saved-food','食品を編集','edit',`data-id="${h(f.id)}"`)}${ib('delete-saved-food','登録から削除','trash',`data-id="${h(f.id)}"`)}</div></div>`).join(''):'<p>食事を記録するときに登録できます。</p>');}
function planForm(){const p=state.plan??{startDate:today,targetDate:C.shiftDay(today,84),startWeight:state.body.filter(b=>b.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0]?.kg??'',targetWeight:'',kcal:0,p:0,f:0,c:0};openDialog('計画と栄養目標',`<p>自分で決めた目標を記録します。開始と目標を結ぶラインで進み具合を確認できます。</p><form><div class="form-grid">${inputField('startWeight','開始体重（kg）',p.startWeight,'type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}${inputField('targetWeight','目標体重（kg）',p.targetWeight,'type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}${inputField('startDate','開始日',p.startDate,'type="date" required')}${inputField('targetDate','目標日',p.targetDate,'type="date" required')}${inputField('kcal','1日のカロリー目標（kcal）',p.kcal||'','type="number" min="0" max="100000" step="1" inputmode="numeric" placeholder="未設定"','full')}</div><div class="form-grid three" style="margin-top:17px">${['p','f','c'].map((k,i)=>inputField(k,['P たんぱく質（g）','F 脂質（g）','C 炭水化物（g）'][i],p[k]||'','type="number" min="0" max="100000" step="any" inputmode="decimal" placeholder="未設定"')).join('')}</div><div class="info-box">カロリー・PFCは空欄または0で未設定。体重は減量・維持・増量のいずれにも使えます。</div>${formEnd('計画を保存',state.plan?btn('delete-plan','計画を削除','trash','danger'):'')}</form>`);bindForm(fd=>{const startDate=fd.get('startDate'),targetDate=fd.get('targetDate');need(C.daysBetween(startDate,targetDate)>0,'目標日は開始日より後にしてください。');const plan={startDate,targetDate,startWeight:number(fd,'startWeight',10,500),targetWeight:number(fd,'targetWeight',10,500)};for(const k of ['kcal','p','f','c'])plan[k]=fd.get(k)===''?0:number(fd,k);state.plan=plan;modal.close();commit('計画と栄養目標を保存しました');});}
function bodyForm(date=null){const entry=state.body.find(b=>b.date===date);openDialog(entry?'からだの記録を訂正':'からだを記録',`<form><div class="form-grid">${inputField('date','日付',entry?.date??today,'type="date" required','full')}${inputField('kg','体重（kg）',entry?.kg??'','type="number" min="10" max="500" step="0.1" required inputmode="decimal"')}${inputField('bodyFat','体脂肪率（%・任意）',entry?.bodyFat??'','type="number" min="1" max="80" step="0.1" inputmode="decimal"')}</div>${formEnd('記録を保存',entry?btn('delete-body','削除','trash','danger',`data-date="${date}"`):'')}</form>`);bindForm(fd=>{const newDate=fd.get('date');need(!state.body.some(b=>b.date===newDate&&b.date!==date),'その日付には記録があります。該当日の記録から訂正してください。');const record={date:newDate,kg:number(fd,'kg',10,500),bodyFat:fd.get('bodyFat')===''?null:number(fd,'bodyFat',1,80)};state.body=state.body.filter(b=>b.date!==date);state.body.push(record);modal.close();commit('からだの記録を保存しました');});}
function settingsDialog(){openDialog('設定・バックアップ',`<div class="settings-row"><div><h3>トレーニング重量の単位</h3><p>切り替えても元の重量は変わりません。</p></div><select aria-label="重量の単位" data-change="setting-unit">${options(['kg','lbs'],unit())}</select></div><div class="settings-row"><div><h3>重量リストの刻み</h3><p>現在の単位での選択幅。直接入力も可能。</p></div><select aria-label="重量の刻み" data-change="setting-step">${options([.5,1,1.25,2,2.5,5,10],state.settings.weightStep,n=>nf(n,2)+' '+unit())}</select></div><div class="settings-row"><div><h3>完了したら休憩タイマー</h3><p>画面へ戻ったときも残り時間を再計算。</p></div><input type="checkbox" aria-label="自動休憩タイマー" data-change="setting-auto" ${state.settings.autoTimer?'checked':''}></div><div class="settings-row"><div><h3>休憩時間</h3><p>通知はこの画面を開いている間に表示。</p></div><select aria-label="休憩時間" data-change="setting-timer">${options([30,60,90,120,180,240,300],state.settings.timerSeconds,n=>n+'秒')}</select></div><div class="divider"></div><h3>大切な記録を、手元に。</h3><p class="mini-subtitle" style="margin-top:9px">記録はこのブラウザに保存されます。別の端末へ移すときや、ブラウザのデータを消す前にバックアップしてください。</p><div class="menu-grid" style="margin-top:17px">${btn('export','バックアップを書き出す','download')}${btn('import','バックアップを読み込む','upload')}${btn('export-csv','セット履歴をCSV保存','list')}${btn('switch-mode',mode==='demo'?'自分の記録に切り替える':'サンプルを別モードで見る','spark')}</div><input type="file" id="import-file" accept="application/json,.json" hidden><div class="info-box">${mode==='demo'?'現在はサンプルモードです。自分の記録とは別に保存されます。':'現在は自分の記録モードです。'}<br>自動同期には対応していません。バックアップは食事・体重・目標を含むJSON形式です。</div>${loadBlocked?btn('export-raw','読み込めなかった元データを保存','download','full'):''}<div class="small">REPNOTE v1.0 · 体重はkg表示。ボリュームは入力重量×回数。自己ベストは推定1RMではなく実際に記録した最高重量。</div>`);const sel=modal.querySelector('[data-change="setting-unit"]');if(sel)sel.value=unit();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function exportBackup(){download(new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),app:'REPNOTE',sample:mode==='demo'})],{type:'application/json'}),`repnote-${mode}-${today}.json`);toast('バックアップを書き出しました');}
function exportCsv(){const rows=[['日付','メニュー','種目','重量(kg)','重量(lbs)','回数','完了','種類','補助','RPE','重量の意味'],...C.allSets(state).map(s=>[s.date,state.workouts[s.date].title,exercise(s.exerciseId).name,s.kg,C.fromKg(s.kg,'lbs'),s.reps,s.completed?'完了':'未完了',s.kind==='work'?'メイン':'ウォームアップ',s.assisted?'あり':'なし',s.rpe??'',loadLabel(exercise(s.exerciseId))])];const cell=v=>{let s=String(v);if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};download(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`repnote-workouts-${today}.csv`);}
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
function timerDialog(){openDialog('休憩タイマー',`<p>次のセットまで、少しひと息。休憩時間を選んでスタートできます。</p><div class="menu-grid">${[60,90,120,180].map(n=>btn('start-timer',n+'秒','clock',n===state.settings.timerSeconds?'lime':'',`data-seconds="${n}"`)).join('')}</div><div class="info-box">完了ボタンからの自動スタートは設定で切り替えられます。音・バックグラウンド通知はありません。</div>`);}
function startTimer(seconds=state.settings.timerSeconds){state.timer={endAt:Date.now()+seconds*1000,remaining:seconds,finished:false};save();renderTimer();}
function timerSeconds(){return state.timer?.endAt?Math.max(0,Math.ceil((state.timer.endAt-Date.now())/1000)):state.timer?.remaining??0;}
function renderTimer(){const root=document.querySelector('#timer-root'),t=state.timer;if(!t){root.innerHTML='';return;}const n=timerSeconds();root.innerHTML=`<div class="timer ${n===0?'finished':''}">${icon('clock')}<div><label>${n===0?'NEXT SET IS YOURS':'REST TIMER'}</label><div class="timer-time" id="timer-display">${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}</div></div><div class="timer-controls">${ib('pause-timer',t.endAt?'一時停止':'再開',t.endAt?'pause':'play')}${ib('reset-timer','タイマーをやり直す','reset')}${ib('close-timer','タイマーを閉じる','close')}</div></div>`;}
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
  if(display)display.textContent=`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  if(n!==0||finishingTimer)return;
  finishingTimer=true;
  try{
    await withRecordLock(()=>{
      if(!state.timer?.endAt||timerSeconds()!==0)return;
      state.timer={endAt:null,remaining:0,finished:true};
      if(save()){renderTimer();toast('休憩が終わりました。次のセットへ。');}
    });
  }finally{finishingTimer=false;}
},500);
function celebrate(ex,s,first=false){const root=document.querySelector('#celebration');root.innerHTML=`<div class="crown-pop">${icon('crown')}<h2>${first?'はじめの記録！':'自己ベスト更新！'}</h2><p>${h(ex.name)}<br><strong>${weight(s.kg)} ${unit()} × ${s.reps} 回</strong> · ${h(shortLoad(ex))}</p></div>${Array.from({length:12},(_,i)=>`<i class="confetti" style="--r:${i*30}deg;--x:${Math.cos(i*Math.PI/6)*170}px;--y:${Math.sin(i*Math.PI/6)*140+80}px;background:${['#cdf476','#e8c66c','#a2c8a9'][i%3]}"></i>`).join('')}`;setTimeout(()=>{root.innerHTML='';},2400);}
let sharePrefs={kind:'workout',format:'square',theme:'dark',date:true,weights:true,caption:''},shareBlob=null,shareRevision=0;
function shareDialog(kind=null){sharePrefs.kind=kind??(view==='food'?'food':view==='body'?'plan':'workout');sharePrefs.weights=sharePrefs.kind!=='plan';openDialog('記録を、あなたらしくシェア',`<div class="share-layout"><div><div class="share-preview"><canvas id="share-canvas" aria-label="共有画像のプレビュー"></canvas></div><div class="share-caption">${mode==='demo'?'画像にも「SAMPLE」を表示します。':'保存前に、公開してよい内容か確認できます。'}</div></div><div class="share-controls">${selectField('share-kind','シェアする内容',[['workout','トレーニング'],['food','食事・PFC'],['plan','ボディメイク計画']],sharePrefs.kind)}${selectField('share-format','画像サイズ',[['square','正方形 1:1'],['portrait','投稿向け 4:5'],['story','ストーリー 9:16']],sharePrefs.format)}${selectField('share-theme','デザイン',[['dark','フォレスト'],['light','ホワイト']],sharePrefs.theme)}${inputField('share-caption','ひとこと（任意）',sharePrefs.caption,'maxlength="60" placeholder="今日も一歩、前へ。"')}<label class="checkbox-row"><input name="share-date" type="checkbox" ${sharePrefs.date?'checked':''}>日付を表示</label><label class="checkbox-row"><input name="share-weights" type="checkbox" ${sharePrefs.weights?'checked':''}>重量・体重を表示</label>${btn('share-native','SNSに共有','share','primary share-full')}${btn('share-download','画像を保存','download','share-full')}${btn('share-copy','投稿文をコピー','copy','share-full')}</div></div><textarea class="share-text" id="share-text" aria-label="投稿文・自由に編集できます"></textarea><p class="share-caption">SNSへの送信は端末の共有画面から選べます。対応していないブラウザでは、画像を保存して添付してください。</p>`,'SHARE YOUR PROGRESS');drawShare();}
function shareContentText(){const date=sharePrefs.date?dateLabel(sharePrefs.kind==='plan'?today:day,true)+'\n':'';let lines=[];if(sharePrefs.kind==='workout'){const w=getWorkout(),stats=C.workoutStats(w);lines=[`${w.title}｜${stats.sets}セット完了`,...w.exercises.filter(e=>e.sets.some(s=>s.completed)).map(e=>{const done=e.sets.filter(s=>s.completed),best=[...done].sort((a,b)=>b.kg-a.kg||b.reps-a.reps)[0];return `${exercise(e.exerciseId).name}：${done.length}セット${sharePrefs.weights?` / ${setDetails(best,weight(best.kg),unit(),shortLoad(exercise(e.exerciseId)))}`:''}`;})];}else if(sharePrefs.kind==='food'){const t=C.mealTotals(state.meals[day]);lines=[`食事記録 ${nf(t.kcal,0)}kcal`,`P ${nf(t.p)}g / F ${nf(t.f)}g / C ${nf(t.c)}g`];}else{const p=state.plan,ps=C.planStats(p,state.body,today);lines=p?[`ボディメイク計画｜目標への進み具合 ${nf(ps.progress,0)}%`,...(sharePrefs.weights?[`開始 ${nf(p.startWeight)}kg → 目標 ${nf(p.targetWeight)}kg`,currentWeightLabel(state.body,today)]:[]),...(sharePrefs.date?[`目標日 ${p.targetDate}`]:[]),...planNutritionLines(p)]:['ボディメイク計画をつくろう'];}return `${mode==='demo'?'【サンプル】\n':''}${date}${lines.join('\n')}${sharePrefs.caption?'\n'+sharePrefs.caption:''}\n#REPNOTE #筋トレ記録`;}
function roundRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function drawShare(){const canvas=modal.querySelector('#share-canvas');if(!canvas)return;const revision=++shareRevision;shareBlob=null;
  const imageButtons=modal.querySelectorAll('[data-action="share-download"], [data-action="share-native"]');
  for(const button of imageButtons)button.disabled=true;
  canvas.width=1080;canvas.height=sharePrefs.format==='story'?1920:sharePrefs.format==='portrait'?1350:1080;const ctx=canvas.getContext('2d'),H=canvas.height,dark=sharePrefs.theme==='dark',bg=dark?'#14271d':'#fafcf7',ink=dark?'#f6faef':'#172b21',muted=dark?'#b0c2a4':'#69765e',accent=dark?'#cdf476':'#56822f',surface=dark?'#223929':'#edf3e6';ctx.fillStyle=bg;ctx.fillRect(0,0,1080,H);ctx.strokeStyle=dark?'#354a2b':'#e0e9d4';ctx.lineWidth=2;for(const r of [230,300,370]){ctx.beginPath();ctx.arc(1075,40,r,0,Math.PI*2);ctx.stroke();}
  const text=(s,x,y,size=28,color=ink,bold=false,max=920)=>{ctx.font=`${bold?750:400} ${size}px -apple-system, BlinkMacSystemFont, "Noto Sans JP", "Segoe UI", sans-serif`;ctx.fillStyle=color;ctx.textAlign='left';if(ctx.measureText(String(s)).width>max){let str=String(s);while(str.length>0&&ctx.measureText(str+'…').width>max)str=str.slice(0,-1);ctx.fillText(str+'…',x,y);}else ctx.fillText(String(s),x,y);};
  text('REPNOTE.',76,100,37,accent,true);text('YOUR PACE. YOUR PROGRESS.',76,142,18,muted,true);if(mode==='demo')text('SAMPLE',824,100,21,muted,true);let y=230;const kindLabel={workout:'WORKOUT LOG',food:'NUTRITION LOG',plan:'BODYMAKE PLAN'}[sharePrefs.kind];text(kindLabel,76,y,22,accent,true);y+=65;const title=sharePrefs.kind==='workout'?getWorkout().title:sharePrefs.kind==='food'?'食べることも、積み重ね。':'自分のペースで、その先へ。';text(title,76,y,sharePrefs.kind==='workout'?68:46,ink,true);y+=45;if(sharePrefs.date)text(dateLabel(sharePrefs.kind==='plan'?today:day,true),76,y,23,muted);y+=45;
  if(sharePrefs.kind==='workout'){const w=getWorkout(),st=C.workoutStats(w),items=w.exercises.filter(e=>e.sets.some(s=>s.completed));roundRect(ctx,76,y,928,150,24,surface);text(String(st.sets),108,y+78,62,accent,true);text('SETS',108,y+117,20,muted,true);text(String(items.length),350,y+78,62,ink,true);text('EXERCISES',350,y+117,20,muted,true);if(sharePrefs.weights){text(weight(st.volume,0),620,y+78,57,ink,true,345);text(`VOLUME / ${unit()}`,620,y+117,20,muted,true);}y+=200;const limit=Math.min(items.length,Math.max(1,Math.floor((H-y-190)/94)));items.slice(0,limit).forEach(e=>{const done=e.sets.filter(s=>s.completed),best=[...done].sort((a,b)=>b.kg-a.kg||b.reps-a.reps)[0];text(exercise(e.exerciseId).name,80,y,30,ink,true,850);text(`${done.length} SETS${sharePrefs.weights?`   ${setDetails(best,weight(best.kg),unit(),shortLoad(exercise(e.exerciseId)))}`:''}`,80,y+36,23,muted);y+=94;});if(items.length>limit)text(`ほか ${items.length-limit} 種目`,80,y,23,muted);if(!items.length)text('完了したセットを記録しよう。',80,y,30,muted);}
  else if(sharePrefs.kind==='food'){const t=C.mealTotals(state.meals[day]);text(nf(t.kcal,0),76,y+100,118,accent,true,700);text('kcal',730,y+100,35,muted);y+=165;const totalEnergy=C.macroEnergy(t),colors=['#b4db7b','#b49adf','#e9b474'];let barX=76;['p','f','c'].forEach((key,i)=>{const width=totalEnergy>0?t[key]*(key==='f'?9:4)/totalEnergy*928:928/3;ctx.fillStyle=colors[i];ctx.fillRect(barX,y,width,18);barX+=width;});y+=100;['p','f','c'].forEach((key,i)=>{const x=76+i*320;text(['PROTEIN','FAT','CARBS'][i],x,y,19,colors[i],true);text(nf(t[key]),x,y+65,58,ink,true,250);text('g',x+220,y+65,24,muted);});y+=125;['朝食','昼食','夕食','間食'].forEach(meal=>{text(meal,80,y,27,muted);text(`${nf(C.mealTotals((state.meals[day]??[]).filter(m=>m.meal===meal)).kcal,0)} kcal`,700,y,27,ink,true);y+=51;});}
  else{const p=state.plan,ps=C.planStats(p,state.body,today);if(p){roundRect(ctx,76,y,928,200,24,surface);text('GOAL PROGRESS',110,y+52,23,muted,true);text(`${nf(ps.progress,0)}%`,110,y+142,90,accent,true);roundRect(ctx,110,y+173,855,10,5,dark?'#3c5033':'#d3dfc7');if(ps.progress>0)roundRect(ctx,110,y+173,855*ps.progress/100,10,5,accent);y+=250;if(sharePrefs.weights){text(`START   ${nf(p.startWeight)} kg`,80,y,33,muted);text(`GOAL    ${nf(p.targetWeight)} kg`,560,y,33,ink,true);y+=60;text(currentWeightLabel(state.body,today),80,y,33,ink,true);y+=65;}if(sharePrefs.date){text(`目標日  ${dateLabel(p.targetDate,true)}`,80,y,28,muted);y+=60;}for(const line of planNutritionLines(p)){text(line,80,y,28,ink,true);y+=47;}text('計画は目安。変化を見ながら、自分のペースで。',80,Math.min(y+15,H-185),23,muted);}else text('目標を決めて、記録をはじめよう。',80,y+70,35,ink,true);}
  if(sharePrefs.caption)text(sharePrefs.caption,76,H-110,29,ink,false,928);ctx.fillStyle=accent;ctx.fillRect(76,H-67,43,3);text('ONE MORE REP. ONE MORE STEP.',140,H-57,20,muted,true);modal.querySelector('#share-text').value=shareContentText();canvas.toBlob(blob=>{
    if(revision!==shareRevision||!canvas.isConnected)return;
    shareBlob=blob;
    if(!blob){toast('画像を作成できませんでした。設定を変えて再度お試しください');return;}
    for(const button of imageButtons)button.disabled=false;
  },'image/png');}
async function shareNative(){if(!shareBlob){toast('画像を準備中です。もう一度お試しください');return;}const file=new File([shareBlob],shareFilename(sharePrefs.kind,sharePrefs.date,day,today),{type:'image/png'}),text=modal.querySelector('#share-text')?.value??shareContentText();try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'REPNOTE',text});}else{download(shareBlob,file.name);toast('画像のダウンロードを開始しました。SNSで添付してください');}}catch(err){if(err.name!=='AbortError'){download(shareBlob,file.name);toast('共有できなかったため画像のダウンロードを開始しました');}}}
const recordActions=new Set([
  'favorite','picker-favorite','choose-exercise','use-routine','delete-routine','add-set','copy-set','complete-set',
  'delete-set','delete-exercise','copy-exercise-previous','copy-previous','copy-food','copy-food-day','delete-food',
  'delete-saved-food','delete-plan','delete-body','start-timer','pause-timer','reset-timer','close-timer','confirm-import','undo',
  'unit','switch-mode','start-real'
]);
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if(!target)return;
  const d=target.dataset;
  if(recordActions.has(d.action))return withRecordLock(()=>handleAction(d),{allowRecovery:['confirm-import','switch-mode','start-real'].includes(d.action)});
  return handleAction(d);
});
async function handleAction(d){try{switch(d.action){
  case 'nav':view=d.view;render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'nav-food':view='food';render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'nav-workout':view='workout';render();break;
  case 'unit':state.settings.unit=d.unit;commit();break;
  case 'today':day=today;render();break;
  case 'day':day=d.date;render();break;
  case 'history-date':day=d.date;view='workout';render();window.scrollTo({top:0,behavior:'instant'});break;
  case 'previous-month':case 'next-month':{const dt=C.parseDay(month+'-01');dt.setMonth(dt.getMonth()+(d.action==='next-month'?1:-1));month=C.localDate(dt).slice(0,7);render();break;}
  case 'close':modal.close();break;
  case 'settings':settingsDialog();break;
  case 'add-exercise':openExercisePicker();break;
  case 'search-group':searchGroup=d.group;openExercisePicker(false);break;
  case 'favorite':case 'picker-favorite':{const i=state.favorites.indexOf(d.id);if(i<0)state.favorites.push(d.id);else state.favorites.splice(i,1);save();render();if(d.action==='picker-favorite')openExercisePicker(false);break;}
  case 'choose-exercise':if(addExercise(d.id)){const first=getWorkout().exercises.at(-1).sets[0];modal.close();if(commit('種目を追加しました')&&first)focusSet(first.id,'set-weight',true);}break;
  case 'custom-exercise':customExerciseForm();break;
  case 'routines':routineDialog();break;
  case 'use-routine':{const r=[...ROUTINES,...state.routines].find(r=>r.id===d.id);if(!r)return;const had=getWorkout().exercises.length;let count=0;r.exerciseIds.forEach(id=>{if(addExercise(id))count++;});if(!had)ensureWorkout().title=r.name;modal.close();commit(count?`${count}種目を追加しました。セットの完了はチェックで。`:'このメニューの種目はすべて追加済みです');break;}
  case 'save-routine':saveRoutineForm();break;
  case 'delete-routine':undoable(()=>{state.routines=state.routines.filter(r=>r.id!==d.id);},'保存メニューを削除しました');routineDialog();break;
  case 'add-set':{const e=instance(d.id);if(!e)return;const added=e.sets.length?C.cloneSet(e.sets.at(-1)):C.newSet();e.sets.push(added);if(commit('未完了のセットを追加しました'))focusSet(added.id,'set-weight',true);break;}
  case 'copy-set':{const e=instance(d.instance),s=setById(d.id);if(!e||!s)return;const idx=e.sets.findIndex(x=>x.id===s.id);const copy=C.cloneSet(s);e.sets.splice(idx+1,0,copy);if(commit('同じセットをコピーしました'))focusSet(copy.id,'set-weight',true);break;}
  case 'complete-set':{const s=setById(d.id);if(!s)return;if(!s.completed&&s.kg===0&&exercise(d.exercise).load!=='body'){toast('重量を選んでから完了してください');return;}const old=C.records(state)[d.exercise];s.completed=!s.completed;if(!commit())break;if(s.completed){const ex=exercise(d.exercise),isNew=C.records(state)[ex.id]?.id===s.id&&(!old||s.kg>old.kg+C.EPS||(ex.load==='body'&&Math.abs(s.kg-old.kg)<=C.EPS&&s.reps>old.reps));if(isNew)celebrate(ex,s,!old);if(state.settings.autoTimer&&day===today)startTimer();}break;}
  case 'edit-set':setEditor(d.id);break;
  case 'edit-record':setEditor(d.id,d.date);break;
  case 'delete-set':{const w=state.workouts[d.date];undoable(()=>{for(const e of w?.exercises??[])e.sets=e.sets.filter(s=>s.id!==d.id);},'セットを削除し、自己ベストを再計算しました');modal.close();break;}
  case 'exercise-menu':exerciseMenu(d.id);break;
  case 'delete-exercise':undoable(()=>{ensureWorkout().exercises=ensureWorkout().exercises.filter(e=>e.id!==d.id);},'種目を削除しました');modal.close();break;
  case 'copy-exercise-previous':{const e=instance(d.id),last=C.lastExercise(state,e.exerciseId,day);if(!last){toast('前回の完了記録がありません');break;}undoable(()=>{e.sets.push(...last.sets.filter(s=>s.completed).map(C.cloneSet));},`${dateLabel(last.date)}の完了セットを追加しました`);break;}
  case 'copy-previous':{const currentTitle=getWorkout().title;const prior=Object.keys(state.workouts).filter(date=>date<day&&C.workoutStats(state.workouts[date]).sets>0).sort();const prev=prior.filter(date=>state.workouts[date].title===currentTitle).at(-1)??prior.at(-1);if(!prev){toast('コピーできる過去の完了記録がありません');break;}const from=state.workouts[prev];undoable(()=>{const w=ensureWorkout();if(!w.exercises.length)w.title=from.title;for(const e of from.exercises){const completed=e.sets.filter(s=>s.completed).map(C.cloneSet);if(!completed.length)continue;const existing=w.exercises.find(x=>x.exerciseId===e.exerciseId);if(existing)existing.sets.push(...completed);else w.exercises.push({...e,id:C.uid(),sets:completed});}},`${dateLabel(prev)}の完了セットを追加しました`);break;}
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
  case 'edit-body':bodyForm(d.date);break;
  case 'delete-body':undoable(()=>{state.body=state.body.filter(b=>b.date!==d.date);},'からだの記録を削除しました');modal.close();break;
  case 'pr-group':prGroup=d.group;render();break;
  case 'record-info':openDialog('自己ベストのルール','<p>完了したメインセットのうち、補助なしで1回以上できた最高重量を表示します。同重量なら回数の多いセット、同回数なら新しい日付を優先します。</p><div class="info-box">ウォームアップ・補助あり・未完了セットは集計しません。自重種目は追加重量が同じなら回数の増加でも王冠が出ます。その他の種目は最高重量が増えたときに王冠が出ます。</div><p>「元の記録を訂正する」で修正すると、すべての保存済みセットから再計算します。単位切替・読み込み・訂正だけでは王冠の演出を繰り返しません。</p>');break;
  case 'share':shareDialog();break;
  case 'share-plan':shareDialog('plan');break;
  case 'share-download':if(shareBlob){download(shareBlob,shareFilename(sharePrefs.kind,sharePrefs.date,day,today));toast('共有画像のダウンロードを開始しました');}else toast('画像を準備中です');break;
  case 'share-native':await shareNative();break;
  case 'share-copy':{const text=modal.querySelector('#share-text');try{await navigator.clipboard.writeText(text.value);toast('投稿文をコピーしました');}catch{text.focus();text.select();toast('投稿文を選択しました。端末のコピー操作でコピーできます');}break;}
  case 'timer-open':timerDialog();break;
  case 'start-timer':startTimer(Number(d.seconds));modal.close();break;
  case 'pause-timer':if(state.timer){if(state.timer.endAt){state.timer.remaining=timerSeconds();state.timer.endAt=null;}else{state.timer.endAt=Date.now()+(state.timer.remaining||state.settings.timerSeconds)*1000;state.timer.finished=false;}save();renderTimer();}break;
  case 'reset-timer':startTimer();break;
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
  case 'export-raw':download(new Blob([localStorage.getItem(storageKey())??''],{type:'application/json'}),`repnote-original-${today}.json`);break;
  case 'start-real':if(mode==='demo')switchMode();break;
  case 'switch-mode':switchMode();break;
  case 'undo':if(undoState){if(JSON.stringify({...state,timer:null})!==undoFingerprint){undoState=null;toast('その後の変更があるため、履歴から訂正してください');break;}const timer=state.timer;state=undoState;state.timer=timer;undoState=null;commit('元に戻しました');if(modal.open)modal.close();}break;
}}catch(err){console.error('REPNOTE action error',err);toast('操作を完了できませんでした：'+err.message);}}
const recordChanges=new Set(['set-weight','set-reps','setting-unit','setting-step','setting-auto','setting-timer']);
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.change==='session-note'){
    const date=day, note=el.value;
    return withRecordLock(()=>{ensureWorkout(date).note=note;save();},{allowDayChange:true});
  }
  if(recordChanges.has(el.dataset.change))return withRecordLock(()=>handleChange(el));
  return handleChange(el);
});
function handleChange(el){const d=el.dataset;try{
  if(d.change==='date'&&el.value){day=el.value;render();}
  if(d.change==='set-weight'){if(el.value==='custom'){render();setEditor(d.id,day,'kg');}else{const s=setById(d.id);if(s){const displayed=C.fromKg(s.kg,unit());try{s.kg=editedWeightKg(el.value,{unit:unit(),originalKg:s.kg,displayed,completed:s.completed,load:d.load});}catch(err){el.value=String(displayed);throw err;}if(commit())focusSet(d.id);}}}
  if(d.change==='set-reps'){if(el.value==='custom'){render();setEditor(d.id,day,'reps');}else{const s=setById(d.id);if(s){s.reps=Number(el.value);if(commit())focusSet(d.id,'set-reps');}}}
  if(d.change==='setting-unit'){state.settings.unit=el.value;save();render();settingsDialog();}
  if(d.change==='setting-step'){state.settings.weightStep=Number(el.value);save();render();}
  if(d.change==='setting-auto'){state.settings.autoTimer=el.checked;save();}
  if(d.change==='setting-timer'){state.settings.timerSeconds=Number(el.value);save();}
  if(el.id==='import-file'&&el.files?.[0])return importFile(el.files[0]);
  if(el.id==='saved-food-select'&&el.value){const f=state.foods.find(f=>f.id===el.value);if(f){const form=modal.querySelector('form');for(const k of ['name','kcal','p','f','c','basis'])form.elements[k].value=f[k];form.elements.amount.value=f.basis==='100g'?100:1;form.querySelector('label[for="field-amount"]').textContent=f.basis==='100g'?'食べた量（g）':'食べた量（食分）';if(form.elements.saveFood)form.elements.saveFood.checked=false;updateFoodCalculation();}}
  if(el.name==='basis'&&modal.querySelector('#food-calculation')){const amount=modal.querySelector('[name="amount"]');if(amount){amount.value=el.value==='100g'?100:1;modal.querySelector('label[for="field-amount"]').textContent=el.value==='100g'?'食べた量（g）':'食べた量（食分）';}updateFoodCalculation();}
  if(el.name?.startsWith('share-'))updateSharePreferences();
}catch(err){toast(err.message);}}
document.addEventListener('input',event=>{const el=event.target;if(el.id==='exercise-search'){searchText=el.value;modal.querySelector('#exercise-results').innerHTML=exerciseResults();}if(modal.querySelector('#food-calculation'))updateFoodCalculation();if(el.name==='share-caption')updateSharePreferences();});
function updateSharePreferences(){const val=name=>modal.querySelector(`[name="share-${name}"]`);sharePrefs={kind:val('kind').value,format:val('format').value,theme:val('theme').value,caption:val('caption').value,date:val('date').checked,weights:val('weights').checked};drawShare();}
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
window.addEventListener('storage',e=>{
  if(e.storageArea!==localStorage||(e.key!==null&&e.key!==storageKey()))return;
  if(localStorage.getItem(storageKey())!==loadedRaw)refreshFromStorage();
});
render();

