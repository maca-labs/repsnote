import { allSets, bodyMeasurementAsOf, cardioDetails, compareBodyMeasurements, fmt, fromKg } from './core.js';
import { workoutCsvSetId } from './workout-import.js';

function workoutCounts(strength, cardio) {
  if (!cardio) return strength+'セット';
  return (strength ? '筋トレ'+strength+'セット・' : '')+'有酸素'+cardio+'回';
}

export function sharedWorkout(workout, getExercise, showWeights, describeStrengthSet, recordUpdates = 0) {
  const entries = [];
  let strengthSets = 0, cardioSessions = 0, cardioMinutes = 0;
  for (const entry of workout.exercises) {
    const exercise = getExercise(entry.exerciseId);
    const cardio = exercise.load === 'cardio';
    const rows = [];
    for (const [index, set] of entry.sets.entries()) {
      if (!set.completed) continue;
      let detail;
      if (cardio) {
        detail = cardioDetails(set);
        cardioMinutes += set.minutes;
      } else {
        detail = describeStrengthSet(set, exercise, showWeights);
        if (set.rpe != null) detail += ' RPE '+fmt(set.rpe,2);
      }
      rows.push({ordinal:(index+1)+(cardio ? '回目' : 'セット目'), detail});
    }
    if (!rows.length) continue;
    if (cardio) cardioSessions += rows.length;
    else strengthSets += rows.length;
    entries.push({exerciseId:entry.exerciseId, name:exercise.name, cardio, rows, count:rows.length+(cardio ? '回' : 'セット')});
  }
  const summary = workoutCounts(strengthSets, cardioSessions)+'完了';
  const recordUpdateLabel = `自己ベスト更新 ${recordUpdates}種目`;
  const textLines = [workout.title+'｜'+summary, recordUpdateLabel];
  for (const entry of entries) {
    textLines.push(entry.name+'（'+entry.count+'）', ...entry.rows.map(row => row.ordinal+'　'+row.detail));
  }
  return {entries, cardioMinutes, cardioSessions, strengthSets, recordUpdateLabel, textLines};
}

export const cardEntryHeight = 54, cardRowHeight = 38, cardFooterHeight = 46;

function cardDetailLines(detail, cardio, fitsLine) {
  if (fitsLine(detail)) return [detail];
  const parts = cardio ? detail.split(' / ') : detail.split(/(?=（)|(?= RPE )/);
  const lines = [];
  let line = '';
  for (const part of parts) {
    const next = line + (cardio && line ? ' / ' : '') + part;
    if (line && !fitsLine(next)) {
      lines.push(line);
      line = part.trimStart();
    } else line = next;
  }
  lines.push(line);
  return lines;
}

export function workoutCardLayout(entries, available, fitsLine = () => true) {
  const items = entries.map(entry => ({
    entry, count:0, rows:entry.rows.map(row => ({...row, lines:cardDetailLines(row.detail, entry.cardio, fitsLine)})),
  }));
  const needed = items.reduce((total, item) => total + cardEntryHeight
    + item.rows.reduce((height, row) => height + row.lines.length * cardRowHeight, 0), 0);
  let remaining = available - (needed <= available ? 0 : cardFooterHeight);
  // Reserve an initial set for each exercise before allocating further rows.
  for (const item of items) {
    const height = cardEntryHeight + item.rows[0].lines.length * cardRowHeight;
    if (remaining < height) continue;
    item.count = 1;
    remaining -= height;
  }
  const visible = items.filter(item => item.count);
  while (remaining >= cardRowHeight) {
    let added = false;
    for (const item of visible) {
      const next = item.rows[item.count];
      if (!next || next.lines.length * cardRowHeight > remaining) continue;
      item.count++;
      remaining -= next.lines.length * cardRowHeight;
      added = true;
    }
    if (!added) break;
  }
  let hiddenStrength = 0, hiddenCardio = 0;
  for (const {entry, count} of items) {
    const hidden = entry.rows.length - count;
    if (entry.cardio) hiddenCardio += hidden;
    else hiddenStrength += hidden;
  }
  const remainder = hiddenStrength + hiddenCardio ? 'ほか '+workoutCounts(hiddenStrength, hiddenCardio)+'（投稿文に全件掲載）' : '';
  return {visible, remainder};
}

export function workoutCsv(state, getExercise, loadLabel) {
  const rows = [[
    '日付','メニュー','種目','重量(kg)','重量(lbs)','回数','完了','種類','補助','RPE','重量の意味',
    '時間(分)','距離(km)','傾斜(%)','速度(km/h)','消費カロリー(kcal)','歩数','REPS NOTE セットID',
  ]];
  for (const set of allSets(state)) {
    const exercise = getExercise(set.exerciseId);
    const status = set.completed ? '完了' : '未完了';
    const common = [set.date, state.workouts[set.date].title, exercise.name];
    const csvId = workoutCsvSetId(set);
    if (exercise.load === 'cardio') {
      rows.push([...common, '', '', '', status, '有酸素', '', '', '',
        set.minutes, set.distanceKm, set.inclinePct, set.speedKmh, set.kcal, set.steps, csvId]);
    } else {
      rows.push([...common, set.kg, fromKg(set.kg,'lbs'), set.reps, status,
        set.kind === 'work' ? 'メイン' : 'ウォームアップ', set.assisted ? 'あり' : 'なし',
        set.rpe, loadLabel(exercise), '', '', '', '', '', '', csvId]);
    }
  }
  function cell(value) {
    const text = typeof value === 'string' && /^[=+@\-]/.test(value) ? "'"+value : String(value ?? '');
    return '"'+text.replaceAll('"','""')+'"';
  }
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}

export function currentWeightLabel(measurements, today, now) {
  const measuredByToday = bodyMeasurementAsOf(today,now);
  let latest;
  for (const entry of measurements) {
    if (measuredByToday(entry) && (!latest || compareBodyMeasurements(entry,latest)>=0)) latest = entry;
  }
  return latest ? `現在 ${fmt(latest.kg)} kg` : '現在の体重は未記録';
}

export function setDetails(set, weight, unit, load) {
  const qualifiers = weight == null ? [] : [load];
  if (set.kind === 'warmup') qualifiers.push('ウォームアップ');
  if (set.assisted) qualifiers.push('補助あり');
  const reps = `${set.reps} 回`;
  return (weight == null ? reps : `${weight} ${unit} × ${reps}`)+(qualifiers.length ? '（'+qualifiers.join('・')+'）' : '');
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

export function shareFilename(kind, showDate, workoutDay, today, month = workoutDay.slice(0,7)) {
  const date = kind === 'month' ? month : kind === 'plan' ? today : workoutDay;
  return `REPS NOTE-${kind}${showDate ? '-' + date : ''}.png`;
}
