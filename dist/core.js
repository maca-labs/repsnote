import { EXERCISES, ROUTINES } from './catalog.js';
import { EXERCISE_GROUPS, validateCatalogOverrides } from './catalog-settings.js';

export const SCHEMA = 1;
export const LB_KG = 0.45359237;
export const EPS = 1e-6;
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const localTime = (d = new Date()) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
export const parseDay = d => new Date(`${d}T12:00:00`);
export function shiftDay(d,n) { const t=parseDay(d); t.setDate(t.getDate()+n); return localDate(t); }
export const daysBetween = (a,b) => Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
export const fromKg = (kg,u) => u==='lbs' ? kg/LB_KG : kg;
export const toKg = (n,u) => u==='lbs' ? n*LB_KG : n;
const validUnit = unit => unit === 'kg' || unit === 'lbs';
export function exerciseUnit(state, exerciseId) {
  const units = state.settings.exerciseUnits;
  return units && Object.hasOwn(units, exerciseId) ? units[exerciseId] : state.settings.unit;
}
function requireKnownExercise(state, exerciseId) {
  if (!EXERCISES.some(ex => ex.id === exerciseId) && !state.customExercises.some(ex => ex.id === exerciseId)) {
    throw new Error('種目が見つかりません。');
  }
}
export function setExerciseUnit(state, exerciseId, unit) {
  if (!validUnit(unit)) throw new Error('重量の単位が正しくありません。');
  requireKnownExercise(state, exerciseId);
  state.settings.exerciseUnits = {...state.settings.exerciseUnits, [exerciseId]: unit};
}
const validRestSeconds = seconds => Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600;
export function exerciseRestSeconds(state, exerciseId) {
  const rests = state.settings.exerciseRestSeconds;
  return rests && Object.hasOwn(rests, exerciseId) ? rests[exerciseId] : state.settings.timerSeconds;
}
export function setExerciseRestSeconds(state, exerciseId, seconds) {
  requireKnownExercise(state, exerciseId);
  if (seconds === null) {
    if (state.settings.exerciseRestSeconds) delete state.settings.exerciseRestSeconds[exerciseId];
    return;
  }
  if (!validRestSeconds(seconds)) throw new Error('休憩時間は10～3600秒の整数で入力してください。');
  state.settings.exerciseRestSeconds = {...state.settings.exerciseRestSeconds, [exerciseId]: seconds};
}
export const fmt = (n,dec=1) => Number(n).toLocaleString('ja-JP',{maximumFractionDigits:dec});
export const CARDIO_FIELDS = [
  {key:'minutes', label:'時間', unit:'分', min:0.01, max:1440, step:0.01, required:true},
  {key:'distanceKm', label:'距離', unit:'km', min:0, max:1000, step:0.01, required:false},
  {key:'inclinePct', label:'傾斜', unit:'%', min:-100, max:100, step:0.01, required:false},
  {key:'speedKmh', label:'速度', unit:'km/h', min:0, max:300, step:0.01, required:false},
  {key:'kcal', label:'消費カロリー', unit:'kcal', min:0, max:100000, step:0.01, required:false},
  {key:'steps', label:'歩数', unit:'歩', min:0, max:1000000, step:1, required:false},
];
const cardioIds = new Set(EXERCISES.filter(ex => ex.load === 'cardio').map(ex => ex.id));
export function validCardioValue(field, value) {
  if (value == null) return !field.required;
  if (!Number.isFinite(value) || value < field.min || value > field.max) return false;
  return field.step === 1 ? Number.isSafeInteger(value) : Number(value.toFixed(2)) === value;
}
export function cardioDetails(set) {
  const prefix = {inclinePct:'傾斜 ', speedKmh:'速度 ', kcal:'消費 '};
  return CARDIO_FIELDS.filter(field => set[field.key] != null).map(({key,unit}) => {
    const space = /^[a-z]/.test(unit) ? ' ' : '';
    return `${prefix[key] ?? ''}${fmt(set[key], 2)}${space}${unit}`;
  }).join(' / ');
}
export const eligible = s => !Object.hasOwn(s, 'minutes') && s.completed && s.kind==='work' && !s.assisted && Number.isFinite(s.kg) && s.kg>=0 && Number.isInteger(s.reps) && s.reps>0;
export function blankState() {
  return {schemaVersion:SCHEMA,settings:{unit:'kg',autoTimer:false,timerSound:false,timerSeconds:90,weightStep:2.5},favorites:['dumbbell-press','leg-press','lat-pulldown','seated-cable-row','lateral-raise'],customExercises:[],routines:[],workouts:{},meals:{},foods:[],body:[],plan:null,timer:null};
}
export const newSet = (kg=0,reps=10) => ({id:uid(),kg,reps,completed:false,kind:'work',assisted:false,rpe:null});
export const newCardioSet = () => ({id:uid(), minutes:10, distanceKm:null, completed:false});
export const cloneSet = s => ({...s,id:uid(),completed:false});
export const cloneExercise = e => ({...e,id:uid(),sets:e.sets.map(cloneSet)});
export function allSets(state) {
  return Object.entries(state.workouts).flatMap(([date,w])=>w.exercises.flatMap(e=>e.sets.map(s=>({...s,date,exerciseId:e.exerciseId,instanceId:e.id}))));
}
function bodyweightExerciseIds(state) {
  return new Set([...EXERCISES, ...state.customExercises]
    .filter(exercise => exercise.load === 'body').map(exercise => exercise.id));
}
function canSetRecord(set, bodyweight) {
  // Older versions allowed clearing the weight of a completed machine/weighted set.
  // Keep the source editable, but zero added load is a valid PR only for bodyweight exercises.
  return eligible(set) && (set.kg > 0 || bodyweight);
}
function preferredRecord(set, best) {
  return !best || set.reps > best.reps || (set.reps === best.reps && set.date >= best.date);
}
function addRecordCandidates(ranks, date, entries, bodyweightIds, exerciseIds) {
  for (const entry of entries) {
    const id = entry.exerciseId;
    if (exerciseIds && !exerciseIds.has(id)) continue;
    const bodyweight = bodyweightIds.has(id);
    for (const set of entry.sets) {
      if (!canSetRecord(set, bodyweight)) continue;
      if (!ranks.has(id)) ranks.set(id, {maxKg:set.kg, peers:new Map()});
      const rank = ranks.get(id);
      if (rank.maxKg - set.kg > EPS) continue;
      if (set.kg > rank.maxKg) {
        rank.maxKg = set.kg;
        for (const kg of rank.peers.keys()) {
          if (rank.maxKg - kg > EPS) rank.peers.delete(kg);
        }
      }
      // A future weight within EPS can break a tie. Retain the best at each exact weight.
      const candidate = {...set, date, exerciseId:id, instanceId:entry.id};
      if (preferredRecord(candidate, rank.peers.get(set.kg))) {
        rank.peers.delete(set.kg);
        rank.peers.set(set.kg, candidate);
      }
    }
  }
}
function bestRecord(rank) {
  let best;
  for (const set of rank.peers.values()) {
    if (preferredRecord(set, best)) best = set;
  }
  return best;
}
export function records(state) {
  const ranks = new Map();
  const bodyweightIds = bodyweightExerciseIds(state);
  for (const [date, workout] of Object.entries(state.workouts)) {
    addRecordCandidates(ranks, date, workout.exercises, bodyweightIds);
  }
  const out = Object.create(null);
  for (const [id, rank] of ranks) out[id] = bestRecord(rank);
  return out;
}
function countRecordUpdates(state, sortedDays) {
  const exerciseIds = new Set();
  for (const day of sortedDays) {
    for (const entry of state.workouts[day].exercises) exerciseIds.add(entry.exerciseId);
  }
  if (!exerciseIds.size) return 0;
  const prior = new Map();
  const bodyweightIds = bodyweightExerciseIds(state);
  for (const [date, workout] of Object.entries(state.workouts)) {
    if (date < sortedDays[0]) addRecordCandidates(prior, date, workout.exercises, bodyweightIds, exerciseIds);
  }
  const updated = new Set();
  for (const day of sortedDays) {
    const entries = state.workouts[day].exercises;
    for (const {exerciseId, sets} of entries) {
      const rank = prior.get(exerciseId);
      if (!rank || updated.has(exerciseId)) continue;
      const bodyweight = bodyweightIds.has(exerciseId);
      const bestReps = bodyweight ? bestRecord(rank).reps : 0;
      if (sets.some(set => canSetRecord(set, bodyweight) &&
        (set.kg > rank.maxKg + EPS || (bodyweight && set.kg >= rank.maxKg - EPS && set.reps > bestReps)))) {
        updated.add(exerciseId);
      }
    }
    // The full day's sets become eligible as a baseline only on later days.
    if (day !== sortedDays.at(-1)) addRecordCandidates(prior, day, entries, bodyweightIds, exerciseIds);
  }
  return updated.size;
}
export function recordUpdateCount(state, day) {
  return state.workouts[day] ? countRecordUpdates(state, [day]) : 0;
}
export function workoutStats(w) {
  const exercises = w?.exercises ?? [];
  const rows = exercises.flatMap(exercise => exercise.sets);
  const done = rows.filter(set => set.completed && (set.minutes > 0 || set.reps > 0));
  const volume = done.reduce((sum, set) => Object.hasOwn(set, 'minutes') ? sum : sum + set.kg * set.reps, 0);
  return {sets:done.length, total:rows.length, volume, exercises:exercises.length};
}
export function lastExercise(state,id,before) {
  const dates=Object.keys(state.workouts).filter(d=>d<before).sort().reverse();
  for (const date of dates) {
    const e = state.workouts[date].exercises.find(e => e.exerciseId === id && e.sets.some(s => s.completed));
    if (e) return {...e, date, sets: e.sets.filter(s => s.completed)};
  }
  return null;
}
export function mealTotals(entries=[]) {
  return entries.reduce((a,m)=>{ for(const k of ['kcal','p','f','c'])a[k]+=m[k]*m.amount/(m.basis==='100g'?100:1); return a; },{kcal:0,p:0,f:0,c:0});
}
export function compareBodyMeasurements(a,b) {
  // An untimed legacy measurement sorts before timed entries from that day.
  // Equal times retain insertion order in a stable sort.
  return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');
}
export function bodyMeasurementAsOf(day, now = new Date()) {
  const throughTime = day === localDate(now) ? localTime(now) : '23:59';
  return entry => entry.date < day || (entry.date === day && (entry.time ?? '') <= throughTime);
}
export function monthlySummary(state, month) {
  const inMonth = date => date.startsWith(month+'-');
  const workoutDates = Object.keys(state.workouts).filter(inMonth).sort();
  let trainingDays = 0, completed = 0, volumeKg = 0, cardioSessions = 0, cardioMinutes = 0;
  for (const day of workoutDates) {
    const workout = state.workouts[day];
    const stats = workoutStats(workout);
    if (!stats.sets) continue;
    trainingDays++;
    completed += stats.sets;
    volumeKg += stats.volume;
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (set.completed && set.minutes > 0) {
          cardioSessions++;
          cardioMinutes += set.minutes;
        }
      }
    }
  }
  const meals = Object.entries(state.meals).filter(([date, entries]) => inMonth(date) && entries.length);
  const kcal = meals.reduce((total, [, entries]) => total + mealTotals(entries).kcal, 0);
  const body = state.body.filter(entry => inMonth(entry.date)).sort(compareBodyMeasurements);
  return {
    month, trainingDays, strengthSets:completed-cardioSessions, volumeKg,
    updatedExercises:countRecordUpdates(state, workoutDates), cardioSessions, cardioMinutes,
    mealDays:meals.length, avgKcal:meals.length ? kcal / meals.length : null,
    bodyDays:new Set(body.map(entry => entry.date)).size, bodyMeasurements:body.length,
    firstWeightKg:body[0]?.kg ?? null, lastWeightKg:body.at(-1)?.kg ?? null,
  };
}
export const macroEnergy = m => m.p*4+m.f*9+m.c*4;
export function planStats(plan,body=[],today=localDate(),now) {
  if(!plan)return null;
  const span=daysBetween(plan.startDate,plan.targetDate);
  const measuredByToday = bodyMeasurementAsOf(today,now);
  const values=body.filter(b=>b.date>=plan.startDate && measuredByToday(b)).sort(compareBodyMeasurements);
  const current=values.at(-1)?.kg??plan.startWeight;
  const delta=plan.targetWeight-plan.startWeight;
  return {current,weekly:span>0?delta/span*7:0,remainingDays:Math.max(0,daysBetween(today,plan.targetDate)),progress:delta===0?100:Math.max(0,Math.min(100,(current-plan.startWeight)/delta*100)),change:current-plan.startWeight,span};
}
export function demoState(today=localDate()) {
  const s=blankState();
  const exercise=(exerciseId,kg,reps,n,completed=n)=>({id:uid(),exerciseId,note:'',sets:Array.from({length:n},(_,i)=>({...newSet(kg,reps),completed:i<completed}))});
  s.workouts[shiftDay(today,-7)]={title:'PUSH',note:'胸と肩。フォームを大切に。',exercises:[exercise('dumbbell-press',32,10,3),exercise('incline-dumbbell-press',26,10,3),exercise('lateral-raise',10,15,3)]};
  s.workouts[shiftDay(today,-5)]={title:'PULL',note:'',exercises:[exercise('lat-pulldown',55,10,3),exercise('seated-cable-row',45,12,3),exercise('dumbbell-curl',12,12,3)]};
  s.workouts[shiftDay(today,-3)]={title:'LEGS',note:'シート位置 3',exercises:[exercise('leg-press',200,12,3),exercise('leg-extension',45,12,3),exercise('leg-curl',35,12,3)]};
  s.workouts[today]={title:'PUSH',note:'肩甲骨を寄せて、ゆっくり下ろす。',exercises:[exercise('dumbbell-press',34,10,3,2),exercise('incline-dumbbell-press',26,10,3,0),exercise('lateral-raise',10,15,3,0)]};
  s.plan={startDate:shiftDay(today,-28),targetDate:shiftDay(today,56),startWeight:80,targetWeight:76,kcal:2300,p:160,f:60,c:280};
  s.body=Array.from({length:9},(_,i)=>({date:shiftDay(today,-28+i*3),kg:Math.round((80-i*.12+(i%3===1?.2:0))*10)/10,bodyFat:null}));
  s.body.push({date:today,kg:78.9,bodyFat:15});
  s.foods=[{id:uid(),name:'オートミールとヨーグルト（サンプル）',basis:'serving',kcal:380,p:23,f:8,c:54},{id:uid(),name:'鶏肉とごはん（サンプル）',basis:'serving',kcal:620,p:43,f:14,c:80},{id:uid(),name:'プロテイン（サンプル）',basis:'serving',kcal:120,p:24,f:1,c:4}];
  s.meals[today]=s.foods.map((f,i)=>({...f,id:uid(),meal:['朝食','昼食','間食'][i],amount:1}));
  return s;
}
// Strict validation precedes replacement. Never execute or render imported HTML.
export function validateState(input,exerciseIds=[]) {
  const bad=m=>{throw new Error(m);};
  const obj=x=>x && typeof x==='object' && !Array.isArray(x);
  const num=(x,min,max)=>typeof x==='number' && Number.isFinite(x) && x>=min && x<=max;
  const str=(x,max=250)=>typeof x==='string' && x.length<=max;
  const id=x=>str(x,100) && x.trim().length>0;
  const date=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && localDate(parseDay(d))===d;
  const array=(x,max=50000)=>Array.isArray(x) && x.length<=max;
  const unique=xs=>new Set(xs).size===xs.length;
  const nutrition=f=>obj(f) && str(f.name) && ['serving','100g'].includes(f.basis) && ['kcal','p','f','c'].every(k=>num(f[k],0,100000));
  if(!obj(input)||input.schemaVersion!==SCHEMA)bad('この形式・バージョンのバックアップには対応していません。');
  const s=input;
  if(!obj(s.settings)||!validUnit(s.settings.unit)||typeof s.settings.autoTimer!=='boolean'||!num(s.settings.timerSeconds,10,3600)||!num(s.settings.weightStep,.25,20))bad('設定が正しくありません。');
  if(Object.hasOwn(s.settings,'timerSound') && typeof s.settings.timerSound!=='boolean')bad('タイマーの終了音の設定が正しくありません。');
  if(!array(s.customExercises)||!unique(s.customExercises.map(e=>e?.id)))bad('カスタム種目が正しくありません。');
  for(const e of s.customExercises)if(!obj(e)||!id(e.id)||!str(e.name)||!EXERCISE_GROUPS.includes(e.group)||!['バーベル','ダンベル','マシン','ケーブル','自重'].includes(e.equipment)||!['single','total','stack','body'].includes(e.load)||!array(e.aliases,50)||!e.aliases.every(a=>str(a)))bad('種目の値が正しくありません。');
  const known=new Set([...exerciseIds,...s.customExercises.map(e=>e.id)]);
  validateCatalogOverrides(s, known);
  if (Object.hasOwn(s.settings, 'exerciseUnits')) {
    const units = s.settings.exerciseUnits;
    if (!obj(units) || !Object.entries(units).every(([id, unit]) => known.has(id) && validUnit(unit))) {
      bad('種目ごとの重量単位が正しくありません。');
    }
  }
  if (Object.hasOwn(s.settings, 'exerciseRestSeconds')) {
    const rests = s.settings.exerciseRestSeconds;
    if (!obj(rests) || !Object.entries(rests).every(([id, seconds]) => known.has(id) && validRestSeconds(seconds))) {
      bad('種目ごとの休憩時間が正しくありません。');
    }
  }
  if(s.customExercises.some(e=>exerciseIds.includes(e.id)))bad('種目IDが重複しています。');
  if(!array(s.favorites)||!s.favorites.every(id=>known.has(id))||!unique(s.favorites)||!array(s.routines))bad('お気に入り・メニューが正しくありません。');
  for(const r of s.routines)if(!obj(r)||!id(r.id)||!str(r.name,80)||!str(r.subtitle)||!array(r.exerciseIds)||!r.exerciseIds.every(id=>known.has(id)))bad('保存メニューが正しくありません。');
  if(!unique([...ROUTINES,...s.routines].map(r=>r.id)))bad('保存メニューIDが重複しています。');
  if(!obj(s.workouts)||Object.keys(s.workouts).length>10000)bad('トレーニング記録が正しくありません。');
  const allIds=[];
  for(const [d,w]of Object.entries(s.workouts)) {
    if(!date(d)||!obj(w)||!str(w.title,80)||!str(w.note,2000)||!array(w.exercises))bad('日付・トレーニングが正しくありません。');
    for(const e of w.exercises) {
      if(!obj(e)||!id(e.id)||!known.has(e.exerciseId)||!str(e.note??'',2000)||!array(e.sets))bad('セットの種目が正しくありません。');
      allIds.push(e.id);
      for(const set of e.sets) {
        if (!obj(set) || !id(set.id) || typeof set.completed !== 'boolean') bad('セットの値が正しくありません。');
        if (Object.hasOwn(set, 'memoImport')) {
          const origin = set.memoImport;
          if (!obj(origin) || !id(origin.id) || !str(origin.receipt,4096) || !origin.receipt.length) {
            bad('セットの取り込み履歴が正しくありません。');
          }
        }
        if (cardioIds.has(e.exerciseId)) {
          const hasStrengthFields = ['kg','reps','kind','assisted','rpe'].some(key => Object.hasOwn(set, key));
          if (hasStrengthFields || !CARDIO_FIELDS.every(field => validCardioValue(field, set[field.key]))) {
            bad('有酸素運動の記録が正しくありません。');
          }
        } else if (CARDIO_FIELDS.some(field => Object.hasOwn(set, field.key)) || !num(set.kg,0,5000) || !Number.isInteger(set.reps) || !num(set.reps,1,999) || !['work','warmup'].includes(set.kind) || typeof set.assisted!=='boolean' || !(set.rpe==null||num(set.rpe,1,10))) {
          bad('重量・回数・セットの値が正しくありません。');
        }
        allIds.push(set.id);
      }
    }
  }
  if(!unique(allIds))bad('セットIDが重複しています。');
  if(!obj(s.meals)||Object.keys(s.meals).length>10000||!array(s.foods))bad('食事記録が正しくありません。');
  const foodIds=[];
  for(const f of s.foods)if(!nutrition(f)||!id(f.id))bad('食品の値が正しくありません。');
  if(!unique(s.foods.map(f=>f.id)))bad('食品IDが重複しています。');
  for(const[d,ms]of Object.entries(s.meals)) {
    if(!date(d)||!array(ms))bad('食事の日付が正しくありません。');
    for(const m of ms){
      if(!nutrition(m)||!id(m.id)||!num(m.amount,.01,10000)||!['朝食','昼食','夕食','間食'].includes(m.meal))bad('食事の値が正しくありません。');
      if (Object.hasOwn(m, 'importInfo')) {
        const info=m.importInfo;
        if (!obj(info) || !str(info.portion,250) || !str(info.source,2000) || typeof info.estimated!=='boolean'
          || !Number.isFinite(info.baseAmount) || info.baseAmount<=0 || !Number.isFinite(info.multiplier) || info.multiplier<=0
          || Math.abs(info.baseAmount*info.multiplier-m.amount)>1e-9*Math.max(1,m.amount)) {
          bad('食事の取り込み元または分量が正しくありません。');
        }
      }
      foodIds.push(m.id);
    }
  }
  if(!unique(foodIds))bad('食事IDが重複しています。');
  if(!array(s.body,20000))bad('体重の記録が正しくありません。');
  const measurementIds=new Set(), legacyDates=new Set();
  for(const b of s.body){
    if(!obj(b)||!date(b.date)||!num(b.kg,10,500)||!(b.bodyFat==null||num(b.bodyFat,1,80)))bad('体重・体脂肪率が正しくありません。');
    if(b.time!=null && (typeof b.time!=='string'||b.time.length!==5||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)))bad('体重の測定時刻が正しくありません。');
    if(Object.hasOwn(b,'id')){
      if(!id(b.id)||measurementIds.has(b.id))bad('体重の記録IDが正しくありません。');
      measurementIds.add(b.id);
    }else{
      if(b.time!=null||legacyDates.has(b.date))bad('体重の記録を識別できません。');
      legacyDates.add(b.date);
    }
  }
  if(s.plan!==null){const p=s.plan;if(!obj(p)||!date(p.startDate)||!date(p.targetDate)||daysBetween(p.startDate,p.targetDate)<=0||!num(p.startWeight,10,500)||!num(p.targetWeight,10,500)||!['kcal','p','f','c'].every(k=>num(p[k],0,100000)))bad('目標の値・期間が正しくありません。');}
  // Timer state is ephemeral and deliberately not restored from a backup.
  return {...structuredClone(s),timer:null};
}
