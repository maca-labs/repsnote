import {toKg} from './core.js';

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
