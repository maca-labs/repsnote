import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiPrompt } from '../dist/ai-prompt.js';
import { blankState, newSet, setExerciseUnit } from '../dist/core.js';

const day = '2026-11-22';
const previous = '2026-11-21';

test('AI prompt includes only selected-day completed sets, with local names, units and set flags', () => {
  const state = blankState();
  state.settings.unit = 'lbs';
  state.customExercises.push({id:'local-row', name:'ジムAのロー', load:'stack'});
  setExerciseUnit(state,'cable-fly','kg');
  state.workouts[day] = {title:'PULL', exercises:[
    {exerciseId:'local-row', sets:[
      {...newSet(45.359237, 8), completed:true, assisted:true, kind:'warmup', rpe:6.5},
      newSet(3, 77),
    ]},
    {exerciseId:'cable-fly', sets:[{...newSet(4, 12), completed:true}]},
    {exerciseId:'dumbbell-press', sets:[newSet(20, 15)]},
  ]};
  state.workouts[previous] = {title:'前日のメニュー', exercises:[]};
  const prompt = buildAiPrompt(state, day, {sample:true});
  assert.match(prompt, /2026-11-22の記録（架空のサンプル）/);
  assert.match(prompt, /ジムAのロー.*1セット.*100 lbs × 8 回（マシン表示・ウォームアップ・補助あり） RPE 6.5/);
  assert.match(prompt, /4 kg × 12 回（片側の表示重量）/);
  assert.doesNotMatch(prompt, /77 回|ダンベルプレス|前日のメニュー/);
});

test('AI prompt scales each logged meal, includes same-day measurement and active targets', () => {
  const state = blankState();
  const base = {meal:'朝食', name:'オートミール', kcal:120, p:10, f:4, c:12};
  state.meals[day] = [
    {...base, basis:'100g', amount:150},
    {...base, meal:'間食', name:'ヨーグルト', basis:'serving', amount:0.5},
  ];
  state.meals[previous] = [{...base, name:'前日の食品', basis:'serving', amount:1}];
  state.body = [{date:previous, kg:78.3}, {date:day, kg:77.9}];
  state.plan = {startDate:day, targetDate:'2027-01-01', targetWeight:76, kcal:0, p:125, f:0, c:0};
  const before = structuredClone(state);
  const prompt = buildAiPrompt(state, day);
  assert.match(prompt, /朝食.*オートミール（150 g） 180 kcal/);
  assert.match(prompt, /間食.*ヨーグルト（0.5食分） 60 kcal/);
  assert.match(prompt, /240 kcal／たんぱく質 20 g／脂質 8 g／炭水化物 24 g/);
  assert.match(prompt, /当日の体重　77.9 kg/);
  assert.match(prompt, /2027-01-01までに体重 76 kg\nP 125 g/);
  assert.doesNotMatch(prompt, /前日の食品|78.3|サンプル/);
  assert.deepEqual(state, before);
});

test('empty days do not imply zero intake, rest, another measurement or an out-of-period goal', () => {
  const state = blankState();
  state.body.push({date:previous, kg:80});
  state.plan = {startDate:'2027-01-01', targetDate:'2027-03-01', targetWeight:75, kcal:2100, p:100, f:50, c:240};
  const prompt = buildAiPrompt(state, day);
  assert.match(prompt, /完了セットの記録なし/);
  assert.match(prompt, /食事の記録なし/);
  assert.doesNotMatch(prompt, /休養日|0 kcal|当日の体重|設定した目標/);
});

test('AI prompt lists each completed cardio interval and keeps exercise kcal separate from food', () => {
  const state = blankState();
  state.workouts[day] = {title:'朝の運動', exercises:[
    {exerciseId:'cardio-treadmill', sets:[
      {completed:true, minutes:18.5, distanceKm:2.4, inclinePct:-2, speedKmh:7, kcal:128.5, steps:0},
      {completed:false, minutes:67, kcal:999},
      {completed:true, minutes:3, distanceKm:0},
    ]},
    {exerciseId:'dumbbell-press', sets:[{...newSet(10,8), completed:true}]},
  ]};
  state.meals[day] = [{name:'ヨーグルト', meal:'朝食', basis:'serving', amount:1, kcal:80, p:4, f:1, c:12}];
  const prompt = buildAiPrompt(state, day);
  assert.match(prompt, /トレッドミル（有酸素）　2回：18\.5分 \/ 2\.4 km \/ 傾斜 -2% \/ 速度 7 km\/h \/ 消費 128\.5 kcal \/ 0歩、3分 \/ 0 km/);
  assert.match(prompt, /ダンベルプレス.*10 kg × 8 回/);
  assert.match(prompt, /記録分の合計　80 kcal/);
  assert.doesNotMatch(prompt, /67分|999|NaN|undefined/);
});
