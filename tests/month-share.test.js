import assert from 'node:assert/strict';
import test from 'node:test';
import { drawMonthlySummary, monthlyShareReport } from '../dist/month-share.js';

const empty = {
  month:'2026-11', trainingDays:0, strengthSets:0, volumeKg:0, updatedExercises:0,
  cardioSessions:0, cardioMinutes:0, mealDays:0, avgKcal:null,
  bodyDays:0, firstWeightKg:null, lastWeightKg:null,
};
const mixed = {
  ...empty, trainingDays:6, strengthSets:31, volumeKg:45.359237, updatedExercises:2,
  cardioSessions:7, cardioMinutes:122.75, mealDays:3, avgKcal:1450.25,
  bodyDays:2, firstWeightKg:70.25, lastWeightKg:69.5,
};

test('monthly text uses the selected month, unit and recorded-day averages', () => {
  const report = monthlyShareReport(mixed, 'lbs', true, true);
  assert.equal(report.dateLabel,'2026年11月');
  assert.deepEqual(report.textLines, [
    '2026年11月の月間まとめ','トレーニング日数 6日','筋トレ完了セット 31セット','自己ベスト更新 2種目',
    '総ボリューム 100 lbs','有酸素 7回 / 計122.75分','食事の記録日数 3日','記録日平均の摂取カロリー 1,450 kcal',
    '体重（初回 → 最終） 70.25 → 69.5 kg',
  ]);
  const hidden = monthlyShareReport(mixed, 'lbs', false, false);
  assert.equal(hidden.dateLabel,'');
  assert.equal(hidden.textLines[0],'月間まとめ');
  assert.doesNotMatch(JSON.stringify(hidden),/2026|11月|総ボリューム|\bkg\b|\blbs\b|70\.25|69\.5/);
  assert.ok(hidden.textLines.includes('体重の記録日数 2日'));
  assert.ok(hidden.textLines.includes('自己ベスト更新 2種目'));
});

test('distinguishes a missing log from a recorded zero and a single weigh-in', () => {
  const absent = monthlyShareReport(empty, 'kg', true, true);
  assert.equal(absent.rows.length,0);
  assert.ok(absent.textLines.includes(absent.emptyMessage));
  const recorded = monthlyShareReport({
    ...empty, trainingDays:1, strengthSets:1, mealDays:1, avgKcal:0, bodyDays:1, firstWeightKg:69.5, lastWeightKg:69.5,
  }, 'kg', true, true);
  assert.equal(recorded.emptyMessage,'');
  assert.ok(recorded.textLines.includes('総ボリューム 0 kg'));
  assert.ok(recorded.textLines.includes('記録日平均の摂取カロリー 0 kcal'));
  assert.ok(recorded.textLines.includes('体重（記録1日） 69.5 kg'));
  assert.doesNotMatch(recorded.textLines.join('\n'),/→|有酸素|NaN/);
});

test('monthly canvas fits all text above the caption for each supported size', () => {
  const report = monthlyShareReport(mixed, 'kg', true, true);
  for (const height of [1080,1350,1920]) {
    const room = height - 1080;
    const top = 350 + Math.round(room * .1) + Math.round(room * .05);
    const contentEnd = height - 150;
    const drawn = [];
    const drawing = {
      left:72, right:1008, width:936, y:top, contentEnd, room,
      ink:'#171717', secondary:'#5B5B5B',
      divider(y){ assert.ok(y >= top && y < contentEnd); },
      label(value,x,y){ assert.ok(x >= 72 && x <= 1008 && y > top && y < contentEnd); drawn.push(value); },
      metric(value, name,x,y,maxWidth){ assert.ok(x >= 72 && x + maxWidth <= 1008 && y + 42 < contentEnd); drawn.push(value,name); },
    };
    drawMonthlySummary(report, drawing);
    for (const item of [...report.metrics,...report.rows]) {
      assert.ok(drawn.includes(item.cardLabel ?? item.label));
      assert.ok(drawn.includes(item.value));
    }
  }
});
