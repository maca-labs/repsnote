import { EXERCISES } from './catalog.js';
import { cardioDetails, exerciseUnit, fmt, fromKg, mealTotals } from './core.js';
import { planNutritionLines, setDetails } from './share.js';

const LOAD_LABELS = {single: '片手', total: '合計', stack: 'マシン表示', body: '追加重量'};

function workoutLines(state, day) {
  const workout = state.workouts[day];
  const catalog = new Map([...EXERCISES, ...state.customExercises].map(ex => [ex.id, ex]));
  const lines = [];
  for (const entry of workout?.exercises ?? []) {
    const done = entry.sets.filter(set => set.completed);
    if (!done.length) continue;
    const exercise = catalog.get(entry.exerciseId);
    if (exercise?.load === 'cardio') {
      lines.push(`・${exercise.name}（有酸素）　${done.length}回：${done.map(cardioDetails).join('、')}`);
      continue;
    }
    const unit = exerciseUnit(state, entry.exerciseId);
    const load = exercise?.id === 'cable-fly' ? '片側の表示重量' : LOAD_LABELS[exercise?.load] ?? '記録重量';
    const sets = done.map(set => {
      const weight = fmt(fromKg(set.kg, unit), 2);
      const detail = setDetails(set, weight, unit, load);
      return set.rpe == null ? detail : `${detail} RPE ${fmt(set.rpe, 2)}`;
    });
    lines.push(`・${exercise?.name ?? '種目名不明'}　${done.length}セット：${sets.join('、')}`);
  }
  if (!lines.length) return ['完了セットの記録なし'];
  return workout.title ? [workout.title, ...lines] : lines;
}

function mealLines(entries) {
  if (!entries.length) return ['食事の記録なし'];
  const lines = entries.map(entry => {
    const amount = `${fmt(entry.amount, 2)}${entry.basis === '100g' ? ' g' : '食分'}`;
    return `・${entry.meal}　${entry.name}（${amount}） ${fmt(mealTotals([entry]).kcal)} kcal`;
  });
  const {kcal, p, f, c} = mealTotals(entries);
  lines.push(`記録分の合計　${fmt(kcal)} kcal／たんぱく質 ${fmt(p)} g／脂質 ${fmt(f)} g／炭水化物 ${fmt(c)} g`);
  return lines;
}

export function buildAiPrompt(state, day, {sample = false} = {}) {
  const lines = [
    `REPS NOTE｜${day}の記録${sample ? '（架空のサンプル）' : ''}`,
    '',
    '【トレーニング】', ...workoutLines(state, day),
    '',
    '【食事】', ...mealLines(state.meals[day] ?? []),
  ];
  const measurement = state.body.find(entry => entry.date === day);
  if (measurement) lines.push('', `当日の体重　${fmt(measurement.kg, 2)} kg`);
  const plan = state.plan;
  if (plan && plan.startDate <= day && day <= plan.targetDate) {
    lines.push('', '【設定した目標】', `${plan.targetDate}までに体重 ${fmt(plan.targetWeight, 2)} kg`, ...planNutritionLines(plan));
  }
  lines.push('', 'この日の記録から、続けるとよさそうな点と、次回のトレーニングや食事で工夫できる点を教えてください。判断に必要な情報が足りないときは質問してください。');
  return lines.join('\n');
}
