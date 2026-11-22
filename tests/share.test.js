import test from 'node:test';
import assert from 'node:assert/strict';
import { currentWeightLabel, planNutritionLines, setDetails, shareFilename } from '../dist/share.js';

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
});
