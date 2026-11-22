import {fromKg, toKg} from './core.js';

// Keep the canonical kg value when the displayed (possibly rounded) input is unchanged.
export function editedWeightKg(raw, {unit, originalKg, displayed, completed, load}) {
  const input = Number(raw);
  if (raw == null || String(raw).trim() === '' || !Number.isFinite(input) || input < 0) {
    throw new Error('重量を正しく入力してください。');
  }
  const kg = input === displayed ? originalKg : toKg(input, unit);
  if (kg > 5000) throw new Error('重量は5000kg以下で入力してください。');
  if (completed && kg === 0 && load !== 'body') {
    throw new Error('完了したセットの重量を入力してください。');
  }
  return kg;
}

export function weightRange(step, load, unit) {
  const maxKgList = load === 'single' ? 60 : load === 'body' ? 50 : 400;
  const max = unit === 'lbs' ? maxKgList * 2.25 : maxKgList;
  const count = Math.floor(max / step);
  return Array.from({length: count + 1}, (_, i) => Number((i * step).toFixed(6)));
}

// Each option carries its exact stored kg as well as the value in the chosen display unit.
export function weightPresets(exercise, unit, configuredStep, aroundKg) {
  const dumbbell = exercise.equipment === 'ダンベル';
  const gridUnit = dumbbell ? 'kg' : unit;
  const step = dumbbell ? 2 : configuredStep;
  let values;
  if (aroundKg === undefined) {
    values = weightRange(step, exercise.load, gridUnit);
  } else {
    const center = Math.round(fromKg(aroundKg, gridUnit) / step);
    values = [];
    for (let i = Math.max(0, center - 2); i <= center + 2; i++) {
      const value = Number((i * step).toFixed(6));
      if (toKg(value, gridUnit) <= 5000) values.push(value);
    }
  }
  return values.map(value => {
    const kg = toKg(value, gridUnit);
    return {kg, value: gridUnit === unit ? value : fromKg(kg, unit)};
  });
}
