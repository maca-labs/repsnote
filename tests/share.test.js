import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../dist/catalog.js';
import { blankState, newSet } from '../dist/core.js';
import {
  cardEntryHeight, cardFooterHeight, cardRowHeight, currentWeightLabel, planNutritionLines,
  setDetails, sharedWorkout, shareFilename, workoutCardLayout, workoutCsv,
} from '../dist/share.js';

test('shared current weight comes from an actual nonfuture measurement', () => {
  const future = {date:'2026-12-01', kg:80};
  assert.equal(currentWeightLabel([future], '2026-11-22'), '現在の体重は未記録');
  assert.equal(currentWeightLabel([future, {date:'2026-11-20',kg:72.5}], '2026-11-22'), '現在 72.5 kg');
});

test('shared weights retain per-hand, warm-up and assistance qualifiers', () => {
  assert.equal(setDetails({reps:5, kind:'warmup', assisted:true}, '15', 'kg', '片手'),
    '15 kg × 5 回（片手・ウォームアップ・補助あり）');
});

test('only configured nutrition targets appear, including macros without a calorie target', () => {
  assert.deepEqual(planNutritionLines({kcal:0, p:110, f:0, c:0}), ['P 110 g']);
  assert.deepEqual(planNutritionLines({kcal:1800, p:0, f:0, c:0}), ['1日の目標  1,800 kcal']);
  assert.deepEqual(planNutritionLines({kcal:0, p:0, f:0, c:0}), []);
});

test('PNG and shared file names follow the date setting and the date on the card', () => {
  for (const kind of ['food','workout','plan']) {
    assert.equal(shareFilename(kind, false, '2026-11-14', '2026-11-22'), `REPS NOTE-${kind}.png`);
  }
  assert.equal(shareFilename('plan', true, '2026-11-14', '2026-11-22'), 'REPS NOTE-plan-2026-11-22.png');
  assert.equal(shareFilename('food', true, '2026-11-14', '2026-11-22'), 'REPS NOTE-food-2026-11-14.png');
  assert.equal(shareFilename('month', true, '2027-01-02', '2027-01-15', '2026-12'), 'REPS NOTE-month-2026-12.png');
  assert.equal(shareFilename('month', false, '2027-01-02', '2027-01-15', '2026-12'), 'REPS NOTE-month.png');
});

const lookup = id => EXERCISES.find(exercise => exercise.id === id);

test('share text and image use each completed row in order, including different reps at the same weight', () => {
  const workout = {title:'朝の運動', exercises:[
    {exerciseId:'dumbbell-press', sets:[
      {...newSet(10,12), completed:true, kind:'warmup'}, newSet(77,13),
      {...newSet(20,8), completed:true}, {...newSet(20,6), completed:true, rpe:8.5, assisted:true},
    ]},
    {exerciseId:'cardio-treadmill', sets:[
      {completed:true, minutes:24.25, distanceKm:2.64, inclinePct:-1.5, speedKmh:6.5, kcal:135.5, steps:0},
      {completed:false, minutes:99}, {completed:true, minutes:5, kcal:0},
    ]},
  ]};
  const describe = (set, exercise, show) => setDetails(set,show ? set.kg : null,'kg','片手');
  const report = sharedWorkout(workout, lookup, true, describe, 1);
  assert.equal(report.recordUpdateLabel,'自己ベスト更新 1種目');
  assert.deepEqual(report.textLines.slice(0,6), [
    '朝の運動｜筋トレ3セット・有酸素2回完了', report.recordUpdateLabel, 'ダンベルプレス（3セット）',
    '1セット目　10 kg × 12 回（片手・ウォームアップ）', '3セット目　20 kg × 8 回（片手）',
    '4セット目　20 kg × 6 回（片手・補助あり） RPE 8.5',
  ]);
  assert.deepEqual(report.textLines.slice(6), [
    'トレッドミル（2回）','1回目　24.25分 / 2.64 km / 傾斜 -1.5% / 速度 6.5 km/h / 消費 135.5 kcal / 0歩',
    '3回目　5分 / 消費 0 kcal',
  ]);
  assert.equal(report.cardioMinutes, 29.25);
  const full = workoutCardLayout(report.entries, 2000, value => value.length <= 35);
  assert.equal(full.remainder,'');
  assert.deepEqual(full.visible.map(item => item.count), [3,2]);
  const wrapped = full.visible[1].rows[0];
  assert.ok(wrapped.lines.length > 1);
  assert.equal(wrapped.lines.join(' / '), wrapped.detail);
  assert.ok(wrapped.lines.every(line => line.length <= 35));

  // With room for two headers and three single-line rows, both exercises appear.
  const small = workoutCardLayout(report.entries, 2*cardEntryHeight + 3*cardRowHeight + cardFooterHeight);
  assert.deepEqual(small.visible.map(item => item.count), [2,1]);
  assert.match(small.remainder, /ほか 筋トレ1セット・有酸素1回/);
  const hidden = sharedWorkout(workout, lookup, false, describe, 1);
  assert.ok(hidden.textLines.includes(report.recordUpdateLabel));
  assert.doesNotMatch(hidden.textLines.join('\n'), /\b(?:kg|lbs)\b/);
  assert.match(hidden.textLines.join('\n'), /4セット目　6 回（補助あり） RPE 8.5/);
  assert.deepEqual(hidden.entries[1],report.entries[1]);
});

test('workout shares show zero when no previous best was improved', () => {
  const report = sharedWorkout({title:'オフ',exercises:[]}, lookup, false, setDetails, 0);
  assert.equal(report.recordUpdateLabel,'自己ベスト更新 0種目');
  assert.ok(report.textLines.includes(report.recordUpdateLabel));
});

test('CSV retains v1 strength columns, all cardio metrics and drafts, quoted text and signed numbers', () => {
  const state = blankState();
  state.workouts['2026-11-22'] = {title:'=名,"A"', exercises:[
    {exerciseId:'pushup', sets:[{...newSet(0,10), completed:true}]},
    {exerciseId:'cardio-treadmill', sets:[
      {completed:true, minutes:12.75, distanceKm:0, inclinePct:-2, speedKmh:6.5, kcal:0, steps:0},
      {completed:false, minutes:3},
    ]},
  ]};
  const [header, strength, cardio, draft] = workoutCsv(state,lookup,() => '追加重量').split('\r\n');
  assert.match(header, /"時間\(分\)","距離\(km\)","傾斜\(%\)","速度\(km\/h\)","消費カロリー\(kcal\)","歩数"$/);
  assert.match(strength, /"'=名,""A""","プッシュアップ","0","0","10","完了","メイン","なし","","追加重量","","","","","",""$/);
  assert.match(cardio, /"トレッドミル","","","","完了","有酸素","","","","12.75","0","-2","6.5","0","0"$/);
  assert.match(draft, /"トレッドミル","","","","未完了","有酸素","","","","3","","","","",""$/);
});
