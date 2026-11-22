import { fmt, mealTotals, parseDay, shiftDay } from './core.js';

const compact = new Intl.NumberFormat('ja-JP', {notation: 'compact', maximumFractionDigits: 1});
const monthDay = new Intl.DateTimeFormat('ja-JP', {month: 'numeric', day: 'numeric'});

export function calorieHistory(meals, selectedDay) {
  return Array.from({length: 7}, (_, index) => {
    const date = shiftDay(selectedDay, index - 6);
    const entries = meals[date];
    return {date, kcal: entries?.length ? mealTotals(entries).kcal : null};
  });
}

export function calorieHistoryChart(meals, selectedDay) {
  const days = calorieHistory(meals, selectedDay);
  return `<section class="panel calorie-history" style="margin-top:16px">
    <div class="panel-heading"><h2>摂取カロリーの推移</h2><span class="small">7日間 · kcal</span></div>
    ${historyGraphic(days, selectedDay)}
  </section>`;
}

function historyGraphic(days, selectedDay) {
  if (days.every(day => day.kcal === null)) {
    return '<p class="mini-subtitle">選んだ日までの7日間に食事の記録はありません。</p>';
  }

  const maximum = Math.max(1, ...days.map(day => day.kcal ?? 0));
  const baseline = 103;
  const description = days.map(({date, kcal}) =>
    `${date} ${kcal === null ? '未記録' : fmt(kcal, 0) + ' kcal'}`).join('、');
  const columns = days.map(({date, kcal}, index) => {
    const x = 25 + index * 50;
    const height = (kcal ?? 0) / maximum * 77;
    const color = date === selectedDay ? '#222' : '#727272';
    const value = kcal === null ? '—' : kcal >= 10000 ? compact.format(kcal) : fmt(kcal, 0);
    return `<g>
      <rect x="${x-10}" y="${baseline-height}" width="20" height="${height}" rx="2" fill="${color}"/>
      <text x="${x}" y="${baseline-height-6}" fill="${color}" font-weight="600">${value}</text>
      <text x="${x}" y="125" fill="#575757">${monthDay.format(parseDay(date))}</text>
    </g>`;
  }).join('');

  return `<svg class="chart" style="max-height:200px" viewBox="0 0 350 133" role="img" aria-label="${description}" text-anchor="middle" font-size="15">
      <path d="M0 26H350 M0 65H350" stroke="#e5e5e5" stroke-dasharray="3 4"/>
      <path d="M0 ${baseline}H350" stroke="#c4c4c4"/>
      ${columns}
    </svg>
    ${days.some(day => day.kcal === null) ? '<div class="small">— は未記録</div>' : ''}`;
}
