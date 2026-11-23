import { mealTotals, uid } from './core.js';

export const mealGroups = ['朝食', '昼食', '夕食', '間食'];
export const nutrients = {kcal:'エネルギー（kcal）', p:'たんぱく質（g）', f:'脂質（g）', c:'炭水化物（g）'};

export function buildMealSearchPrompt(menu) {
  const query = String(menu ?? '').trim();
  if (!query) throw new Error('食べたものを入力してください。');
  return [
    '次の食事を食品ごとに調べ、REPS NOTEへの取り込み用JSONを作ってください。',
    '市販品はメーカーや販売店の公式商品情報を優先し、一般食品は文部科学省の食品成分データベースなどで確認してください。',
    '商品名・地域・分量を特定できないときは推定と明記し、別商品の表示値を確定値として扱わないでください。検索できないときや不明な数値はnullとし、0で埋めないでください。',
    '各食品に name（食品名）、basis（1食分あたりなら"serving"、100gあたりなら"100g"）、portion（表示の基準量の説明）、amount（食べた食数、100g基準なら実際に食べたグラム数）、kcal、p、f、c（PFCはグラム）、source（出典名と確認できたURL）、estimated（推定ならtrue）を入れてください。',
    '栄養値はbasisの基準量あたりです。量による掛け算はアプリで行います。1食分あたりで個数の指定がなければamountは1、100gあたりで食べた重量が不明ならamountはnullにしてください。',
    '返答は {"items":[...]} のJSONを1つだけ。数値は半角数字で、単位は付けないでください。',
    '', '食べたもの', query,
  ].join('\n');
}

function textField(value, max, field, row) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error(`${row}件目の${field}を確認してください（${max}文字まで）。`);
  return value.trim();
}

function numberOrNull(value, field, row) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${row}件目の${field}には数値かnullを指定してください。`);
  return value;
}

export function parseMealResponse(input, defaultMeal = '昼食') {
  const raw = String(input ?? '').trim();
  if (raw.length > 256000) throw new Error('回答が長すぎます。食品を分けて取り込んでください。');
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let data;
  try { data = JSON.parse(fenced ? fenced[1] : raw); }
  catch { throw new Error('AIの回答のJSON全体を貼り付けてください。'); }
  if (!Array.isArray(data?.items) || !data.items.length || data.items.length > 100) {
    throw new Error('itemsに食品を1〜100件入れてください。');
  }
  if (!mealGroups.includes(defaultMeal)) throw new Error('食事の区分を選んでください。');
  return data.items.map((item,index) => {
    const row = index + 1;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${row}件目の食品を確認してください。`);
    if (!['serving','100g'].includes(item.basis)) throw new Error(`${row}件目のbasisはservingまたは100gで指定してください。`);
    if (item.estimated != null && typeof item.estimated !== 'boolean') throw new Error(`${row}件目のestimatedにはtrueまたはfalseを指定してください。`);
    const source = textField(item.source, 2000, '出典', row);
    const draft = {
      name:textField(item.name, 200, '食品名', row), basis:item.basis,
      portion:textField(item.portion, 250, '基準量', row),
      baseAmount:item.amount === undefined && item.basis === 'serving' ? 1 : numberOrNull(item.amount,'量',row),
      multiplier:1, source, estimated:item.estimated !== false || !source,
      meal:item.meal ?? defaultMeal,
    };
    if (!mealGroups.includes(draft.meal)) throw new Error(`${row}件目の食事区分を確認してください。`);
    for (const [key,label] of Object.entries(nutrients)) draft[key] = numberOrNull(item[key],label,row);
    return draft;
  });
}

export function reviewedMealDraft(original, fields) {
  const draft = {...original, ...fields};
  const renamed = draft.name.trim() !== original.name;
  if (renamed || Object.keys(nutrients).some(key => draft[key] !== original[key])) {
    draft.source = '取り込み時に手入力で修正';
    draft.estimated = true;
    if (renamed) draft.portion = '';
  }
  return draft;
}

const editableFields = ['name','meal','baseAmount',...Object.keys(nutrients)];

export function reconcileMealReview(drafts, previous = []) {
  const matches = new Map();
  const remaining = new Set(previous);
  function group(rows, getKey) {
    const groups = new Map();
    for (const row of rows) {
      const key = getKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return groups;
  }
  function matchBy(key, allowIdentical = false) {
    const oldGroups = group(remaining, row => key(row.original));
    const newGroups = group(drafts.filter(draft => !matches.has(draft)), key);
    for (const [id, foods] of newGroups) {
      const old = oldGroups.get(id);
      if (!old || foods.length !== old.length || (foods.length > 1 && !allowIdentical)) continue;
      foods.forEach((food, i) => {
        matches.set(food, old[i]);
        remaining.delete(old[i]);
      });
    }
  }
  // Identical duplicate foods keep their occurrence order. Weaker matches must be unique.
  matchBy(draft => JSON.stringify(draft), true);
  matchBy(draft => JSON.stringify([draft.name,draft.basis,draft.portion,draft.source]));
  const foodKey = draft => JSON.stringify([draft.name,draft.basis]);
  matchBy(foodKey);
  const edited = row => !row.included || row.scale !== '1' ||
    editableFields.some(key => row.original[key] !== row.values[key]);
  const uncertain = new Set([...remaining].filter(edited).map(row => foodKey(row.original)));
  return drafts.map(original => {
    const saved = matches.get(original);
    const needsReview = !saved && uncertain.has(foodKey(original));
    const values = {...original};
    if (saved) {
      for (const key of editableFields) {
        // A correction in the answer wins for that fact. Keep an explicit per-food meal choice.
        if (saved.values[key] !== saved.original[key] && (key === 'meal' || original[key] === saved.original[key])) {
          values[key] = saved.values[key];
        }
      }
    }
    return {original, values, included:saved?.included ?? !needsReview,
      scale:saved?.scale ?? '1', multiple:saved?.multiple ?? '1', needsReview};
  });
}

// Convert a reviewed food to the same base-unit representation used by manual food entry.
export function mealImportEntry(draft) {
  const name = draft.name.trim();
  if (!name || name.length > 200) throw new Error('食品名を入力してください。');
  if (!mealGroups.includes(draft.meal) || !['serving','100g'].includes(draft.basis)) throw new Error('食事区分と基準を確認してください。');
  if (!Number.isFinite(draft.baseAmount) || draft.baseAmount <= 0) throw new Error('食べた量を入力してください。');
  if (!Number.isFinite(draft.multiplier) || draft.multiplier <= 0) throw new Error('倍率は0より大きい数を入力してください。');
  const amount = draft.baseAmount * draft.multiplier;
  if (!Number.isFinite(amount) || amount < .01 || amount > 10000) throw new Error('倍率をかけた量は0.01〜10000の範囲にしてください。');
  const entry = {name, basis:draft.basis, amount, meal:draft.meal};
  for (const [key,label] of Object.entries(nutrients)) {
    const value = draft[key];
    if (!Number.isFinite(value) || value < 0 || value > 100000) throw new Error(`${label}を0〜100000で入力してください。`);
    entry[key] = value;
  }
  entry.importInfo = {
    portion:draft.portion, source:draft.source, estimated:draft.estimated,
    baseAmount:draft.baseAmount, multiplier:draft.multiplier,
  };
  return entry;
}

export function prepareMealImport(drafts) {
  if (!drafts.length) throw new Error('取り込む食品を1件以上選んでください。');
  const entries = drafts.map(mealImportEntry);
  return {entries:entries.map(entry => ({...entry, id:uid()})), totals:mealTotals(entries)};
}
