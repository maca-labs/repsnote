import { fmt } from './core.js';

export function currentWeightLabel(measurements, today) {
  let latest;
  for (const entry of measurements) {
    if (entry.date <= today && (!latest || entry.date > latest.date)) latest = entry;
  }
  return latest ? `現在 ${fmt(latest.kg)} kg` : '現在の体重は未記録';
}

export function setDetails(set, weight, unit, load) {
  const qualifiers = [load];
  if (set.kind === 'warmup') qualifiers.push('ウォームアップ');
  if (set.assisted) qualifiers.push('補助あり');
  return `${weight} ${unit} × ${set.reps} 回（${qualifiers.join('・')}）`;
}

export function planNutritionLines(plan) {
  const lines = [];
  if (plan.kcal > 0) lines.push(`1日の目標  ${fmt(plan.kcal)} kcal`);
  const macros = ['p', 'f', 'c']
    .filter(key => plan[key] > 0)
    .map(key => `${key.toUpperCase()} ${fmt(plan[key])} g`);
  if (macros.length) lines.push(macros.join('  /  '));
  return lines;
}

export function shareFilename(kind, showDate, workoutDay, today) {
  const date = kind === 'plan' ? today : workoutDay;
  return `REPS NOTE-${kind}${showDate ? '-' + date : ''}.png`;
}
