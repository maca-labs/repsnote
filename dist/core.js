import { EXERCISES, ROUTINES } from './catalog.js';

export const SCHEMA = 1;
export const LB_KG = 0.45359237;
export const EPS = 1e-6;
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDay = d => new Date(`${d}T12:00:00`);
export function shiftDay(d,n) { const t=parseDay(d); t.setDate(t.getDate()+n); return localDate(t); }
export const daysBetween = (a,b) => Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
export const fromKg = (kg,u) => u==='lbs' ? kg/LB_KG : kg;
export const toKg = (n,u) => u==='lbs' ? n*LB_KG : n;
export const fmt = (n,dec=1) => Number(n).toLocaleString('ja-JP',{maximumFractionDigits:dec});
export const eligible = s => s.completed && s.kind==='work' && !s.assisted && Number.isFinite(s.kg) && s.kg>=0 && Number.isInteger(s.reps) && s.reps>0;
export function blankState() {
  return {schemaVersion:SCHEMA,settings:{unit:'kg',autoTimer:true,timerSeconds:90,weightStep:2.5},favorites:['dumbbell-press','leg-press','lat-pulldown','seated-cable-row','lateral-raise'],customExercises:[],routines:[],workouts:{},meals:{},foods:[],body:[],plan:null,timer:null};
}
export const newSet = (kg=0,reps=10) => ({id:uid(),kg,reps,completed:false,kind:'work',assisted:false,rpe:null});
export const cloneSet = s => ({...s,id:uid(),completed:false});
export const cloneExercise = e => ({...e,id:uid(),sets:e.sets.map(cloneSet)});
export function allSets(state) {
  return Object.entries(state.workouts).flatMap(([date,w])=>w.exercises.flatMap(e=>e.sets.map(s=>({...s,date,exerciseId:e.exerciseId,instanceId:e.id}))));
}
export function records(state) {
  const bodyweightIds = new Set([...EXERCISES, ...state.customExercises]
    .filter(exercise => exercise.load === 'body').map(exercise => exercise.id));
  // Older versions allowed clearing the weight of a completed machine/weighted set.
  // Keep the source editable, but zero added load is a valid PR only for bodyweight exercises.
  const candidates = allSets(state).filter(set =>
    eligible(set) && (set.kg > 0 || bodyweightIds.has(set.exerciseId)));
  const maxima = new Map();
  for (const set of candidates) {
    maxima.set(set.exerciseId, Math.max(set.kg, maxima.get(set.exerciseId) ?? 0));
  }
  const out = Object.create(null);
  for (const set of candidates) {
    if (maxima.get(set.exerciseId) - set.kg > EPS) continue;
    const best = out[set.exerciseId];
    if (!best || set.reps > best.reps || (set.reps === best.reps && set.date >= best.date)) {
      out[set.exerciseId] = set;
    }
  }
  return out;
}
export function workoutStats(w) {
  const exercises=w?.exercises??[];
  const done=exercises.flatMap(e=>e.sets).filter(s=>s.completed && s.reps>0);
  return {sets:done.length,total:exercises.reduce((n,e)=>n+e.sets.length,0),volume:done.reduce((n,s)=>n+s.kg*s.reps,0),exercises:exercises.length};
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
export const macroEnergy = m => m.p*4+m.f*9+m.c*4;
export function planStats(plan,body=[],today=localDate()) {
  if(!plan)return null;
  const span=daysBetween(plan.startDate,plan.targetDate);
  const values=body.filter(b=>b.date>=plan.startDate && b.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
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
  if(!obj(s.settings)||!['kg','lbs'].includes(s.settings.unit)||typeof s.settings.autoTimer!=='boolean'||!num(s.settings.timerSeconds,10,3600)||!num(s.settings.weightStep,.25,20))bad('設定が正しくありません。');
  if(!array(s.customExercises)||!unique(s.customExercises.map(e=>e?.id)))bad('カスタム種目が正しくありません。');
  for(const e of s.customExercises)if(!obj(e)||!id(e.id)||!str(e.name)||!['胸','背中','肩','腕','脚','体幹'].includes(e.group)||!['バーベル','ダンベル','マシン','ケーブル','自重'].includes(e.equipment)||!['single','total','stack','body'].includes(e.load)||!array(e.aliases,50)||!e.aliases.every(a=>str(a)))bad('種目の値が正しくありません。');
  const known=new Set([...exerciseIds,...s.customExercises.map(e=>e.id)]);
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
        if(!obj(set)||!id(set.id)||!num(set.kg,0,5000)||!Number.isInteger(set.reps)||!num(set.reps,1,999)||typeof set.completed!=='boolean'||!['work','warmup'].includes(set.kind)||typeof set.assisted!=='boolean'||!(set.rpe==null||num(set.rpe,1,10)))bad('重量・回数・セットの値が正しくありません。');
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
    for(const m of ms){if(!nutrition(m)||!id(m.id)||!num(m.amount,.01,10000)||!['朝食','昼食','夕食','間食'].includes(m.meal))bad('食事の値が正しくありません。');foodIds.push(m.id);}
  }
  if(!unique(foodIds))bad('食事IDが重複しています。');
  if(!array(s.body,20000)||!unique(s.body.map(b=>b?.date)))bad('体重の記録が正しくありません。');
  for(const b of s.body)if(!obj(b)||!date(b.date)||!num(b.kg,10,500)||!(b.bodyFat==null||num(b.bodyFat,1,80)))bad('体重・体脂肪率が正しくありません。');
  if(s.plan!==null){const p=s.plan;if(!obj(p)||!date(p.startDate)||!date(p.targetDate)||daysBetween(p.startDate,p.targetDate)<=0||!num(p.startWeight,10,500)||!num(p.targetWeight,10,500)||!['kcal','p','f','c'].every(k=>num(p[k],0,100000)))bad('目標の値・期間が正しくありません。');}
  // Timer state is ephemeral and deliberately not restored from a backup.
  return {...structuredClone(s),timer:null};
}
