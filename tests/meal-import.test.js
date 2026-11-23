import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, mealTotals, validateState } from '../dist/core.js';
import { EXERCISES } from '../dist/catalog.js';
import { buildMealSearchPrompt, parseMealResponse, prepareMealImport, reviewedMealDraft } from '../dist/meal-import.js';

const sample = {name:'表示を確認した食品',basis:'serving',portion:'1包装',amount:1,
  kcal:500,p:21,f:12,c:77,source:'検証用の商品表示',estimated:false};
const parse = items => parseMealResponse(JSON.stringify({items}), '夕食');

test('meal search prompt requests sources and distinguishes the serving basis from the amount eaten', () => {
  const prompt = buildMealSearchPrompt('幕の内弁当、バナナ1本');
  for (const text of ['幕の内弁当、バナナ1本','100g','amount','source','estimated','null','販売店の公式商品情報']) assert.ok(prompt.includes(text));
  assert.throws(()=>buildMealSearchPrompt('  '), /入力/);
});

test('AI batch scales serving and gram portions exactly once, preserving optional provenance in a JSON backup', () => {
  const grams = {...sample,name:'参考食品',basis:'100g',portion:'100g',amount:80,kcal:100,p:5,f:4,c:11,estimated:true};
  const drafts = parse([sample, grams]);
  drafts[0].multiplier = .5; drafts[1].multiplier = 1.5;
  const {entries, totals} = prepareMealImport(drafts);
  assert.deepEqual(entries.map(e=>e.amount), [.5,120]);
  assert.equal(entries[1].basis, '100g');
  assert.equal(entries[0].meal,'夕食');
  assert.equal(entries[0].kcal,500);
  assert.deepEqual(totals, mealTotals(entries));
  assert.deepEqual(totals,{kcal:370,p:16.5,f:10.8,c:51.7});
  assert.deepEqual(entries[1].importInfo,{source:'検証用の商品表示',portion:'100g',estimated:true,baseAmount:80,multiplier:1.5});
  const state = blankState(); state.meals['2026-11-23'] = entries;
  const restored = validateState(JSON.parse(JSON.stringify(state)), EXERCISES.map(e=>e.id));
  assert.deepEqual(restored.meals, state.meals);
});

test('null estimates must be reviewed, literal zeros are valid, and duplicate items keep separate IDs', () => {
  const body = JSON.stringify({items:[{...sample,kcal:null,source:''},sample]});
  const rows = parseMealResponse('```json\n'+body+'\n```');
  assert.equal(rows[0].estimated,true);
  assert.equal(rows[0].kcal,null);
  assert.throws(()=>prepareMealImport(rows), /エネルギー/);
  assert.equal(rows[1].id,undefined);
  rows[0].kcal = 0; rows[1].meal = '間食';
  const {entries} = prepareMealImport(rows);
  assert.notEqual(entries[0].id,entries[1].id);
  assert.deepEqual(entries.map(e=>e.meal),['昼食','間食']);
  assert.equal(entries[0].kcal,0);
});

test('changing product facts removes the original attribution while quantity changes retain it', () => {
  const [original] = parse([sample]);
  const scaled = reviewedMealDraft(original, {multiplier:.5, meal:'朝食'});
  assert.equal(scaled.source, original.source);
  assert.equal(scaled.estimated, false);
  const corrected = reviewedMealDraft(original, {kcal:440});
  assert.match(corrected.source, /手入力/);
  assert.equal(corrected.estimated, true);
  const renamed = reviewedMealDraft(original, {name:'別の商品'});
  assert.equal(renamed.portion, '');
  assert.equal(original.source, sample.source);
});

test('size, shape, numeric fields, incomplete gram portions, and multiplied amount are validated before saving', () => {
  assert.throws(()=>parseMealResponse('x'.repeat(256001)),/長すぎ/);
  for(const bad of ['null','{}','{"items":[]}','商品を調べました']) assert.throws(()=>parseMealResponse(bad));
  assert.throws(()=>parse([{...sample,basis:'per-plate'}]),/basis/);
  assert.throws(()=>parse([{...sample,p:true}]), /数値/);
  assert.throws(()=>parse([{...sample,estimated:'false'}]), /estimated/);
  const [unknownGrams] = parse([{...sample,basis:'100g',amount:undefined}]);
  assert.equal(unknownGrams.baseAmount,null);
  assert.throws(()=>prepareMealImport([unknownGrams]),/食べた量/);
  for(const multiplier of [0,-1,Infinity,10001]) {
    const [row] = parse([sample]); row.multiplier=multiplier;
    assert.throws(()=>prepareMealImport([row]),/倍率/);
  }
  assert.throws(()=>prepareMealImport([]),/選んで/);
});
