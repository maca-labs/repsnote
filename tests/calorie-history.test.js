import test from 'node:test';
import assert from 'node:assert/strict';
import { calorieHistory, calorieHistoryChart } from '../dist/calorie-history.js';

const food = (kcal, basis, amount) => ({kcal, basis, amount, p: 10, f: 4, c: 12});

test('weekly calorie totals use food label energy and quantities through the selected day', () => {
  const meals = {
    '2025-12-25': [food(9999, 'serving', 1)],
    '2025-12-27': [],
    '2025-12-30': [food(0, 'serving', 1)],
    '2026-01-01': [food(120, '100g', 150), food(120, 'serving', 0.5)],
    '2026-01-02': [food(8888, 'serving', 1)],
  };
  assert.deepEqual(calorieHistory(meals, '2026-01-01'), [
    {date: '2025-12-26', kcal: null}, {date: '2025-12-27', kcal: null},
    {date: '2025-12-28', kcal: null}, {date: '2025-12-29', kcal: null},
    {date: '2025-12-30', kcal: 0}, {date: '2025-12-31', kcal: null},
    {date: '2026-01-01', kcal: 240},
  ]);
});

test('calorie chart exposes zero and missing days separately, including an empty week', () => {
  const meals = {'2024-02-29': [food(0, 'serving', 1)]};
  const html = calorieHistoryChart(meals, '2024-03-01');
  assert.match(html, /2024-02-29 0 kcal、2024-03-01 未記録/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(calorieHistoryChart(meals, '2024-03-07'), /食事の記録はありません/);
});
