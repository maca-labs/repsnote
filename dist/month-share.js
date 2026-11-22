import { fmt, fromKg } from './core.js';

export function monthlyShareReport(summary, unit, showWeights, showDate) {
  const [year, month] = summary.month.split('-');
  const title = '月間まとめ';
  const dateLabel = showDate ? `${year}年${Number(month)}月` : '';
  const metrics = [
    {label:'トレーニング日数', value:fmt(summary.trainingDays, 0), unit:'日'},
    {label:'筋トレ完了セット', value:fmt(summary.strengthSets, 0), unit:'セット'},
    {label:'自己ベスト更新', cardLabel:'自己ベスト更新種目数', value:fmt(summary.updatedExercises, 0), unit:'種目'},
  ];
  const rows = [];
  if (showWeights && summary.strengthSets > 0) {
    rows.push({label:'総ボリューム', value:`${fmt(fromKg(summary.volumeKg, unit), 2)} ${unit}`});
  }
  if (summary.cardioSessions > 0) {
    rows.push({label:'有酸素', value:`${fmt(summary.cardioSessions, 0)}回 / 計${fmt(summary.cardioMinutes, 2)}分`});
  }
  if (summary.mealDays > 0) {
    rows.push({label:'食事の記録日数', value:`${summary.mealDays}日`});
    rows.push({label:'記録日平均の摂取カロリー', value:`${fmt(summary.avgKcal, 0)} kcal`});
  }
  if (summary.bodyDays > 0) {
    if (!showWeights) {
      rows.push({label:'体重の記録日数', value:`${summary.bodyDays}日`});
    } else if (summary.bodyDays === 1) {
      rows.push({label:'体重（記録1日）', value:`${fmt(summary.lastWeightKg, 2)} kg`});
    } else {
      rows.push({label:'体重（初回 → 最終）',
        value:`${fmt(summary.firstWeightKg, 2)} → ${fmt(summary.lastWeightKg, 2)} kg`});
    }
  }
  const emptyMessage = !summary.trainingDays && !summary.mealDays && !summary.bodyDays
    ? '集計対象の記録はありません' : '';
  const textLines = [
    dateLabel ? `${dateLabel}の${title}` : title,
    ...metrics.map(item => `${item.label} ${item.value}${item.unit}`),
    ...rows.map(item => `${item.label} ${item.value}`),
  ];
  if (emptyMessage) textLines.push(emptyMessage);
  return {title, dateLabel, metrics, rows, emptyMessage, textLines};
}

export function drawMonthlySummary(report, {label, metric, divider, left, right, width, y, contentEnd, ink, secondary, room}) {
  const cell = width / report.metrics.length;
  report.metrics.forEach((item, index) => {
    metric(item.value, item.cardLabel ?? item.label, left + index * cell, y + 65, cell - 24, 88);
  });

  y += 158 + Math.round(room * .06);
  if (report.emptyMessage) {
    divider(y);
    label(report.emptyMessage, left, y + 56, 32, secondary);
    return;
  }
  const rowHeight = Math.min(108 + room * .08, (contentEnd - y) / Math.max(1, report.rows.length));
  for (const row of report.rows) {
    divider(y);
    const baseline = y + rowHeight * .65;
    label(row.label, left, baseline, 29, secondary, false, width * .42 - 12);
    label(row.value, right, baseline, 32, ink, true, width * .58 - 12, 'right');
    y += rowHeight;
  }
}
