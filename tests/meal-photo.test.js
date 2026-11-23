import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMealPhotoPrompt, validateMealPhoto, canShareMealPhoto, shareMealPhoto} from '../dist/meal-photo.js';
import {parseMealResponse, prepareMealImport} from '../dist/meal-import.js';

const photo = new File(['photo bytes'], '昼食.jpg', {type:'image/jpeg'});

test('a photo prompt works without a menu and asks for the existing import format', () => {
  const prompt = buildMealPhotoPrompt();
  for (const term of ['写真', '栄養成分表示', '{"items":[...]}', 'name', 'basis', 'portion', 'amount', 'kcal', 'たんぱく質', '脂質', '炭水化物', 'source', 'estimated', 'null']) {
    assert.ok(prompt.includes(term), term);
  }
  assert.equal(buildMealPhotoPrompt('   '), prompt);
  assert.ok(buildMealPhotoPrompt('  半分だけ食べた  ').endsWith('\n半分だけ食べた'));
  const [label, estimate] = parseMealResponse(JSON.stringify({items:[
    {name:'包装の表示例', basis:'serving', portion:'1包装', amount:.5, kcal:400, p:20, f:16, c:44,
      source:'写真の栄養成分表示', estimated:false},
    {name:'小鉢', basis:'100g', portion:'100g当たり', amount:null, kcal:48, p:2, f:null, c:9,
      source:'写真からの推定', estimated:true},
  ]}), '昼食');
  assert.deepEqual(prepareMealImport([label]).totals, {kcal:200, p:10, f:8, c:22});
  assert.equal(estimate.baseAmount, null);
  assert.equal(estimate.f, null);
  assert.throws(()=>prepareMealImport([estimate]), /食べた量/);
});

test('mobile photo pickers may omit the MIME type or supply a generic MIME type', () => {
  assert.equal(validateMealPhoto(photo), photo);
  for (const type of ['', 'application/octet-stream', 'image/heic']) {
    const heic = new File(['image'], 'meal.HEIC', {type});
    assert.equal(validateMealPhoto(heic), heic);
  }
  assert.throws(()=>validateMealPhoto(null), /写真を選んで/);
  assert.throws(()=>validateMealPhoto(new File([], 'meal.png', {type:'image/png'})), /データがありません/);
  assert.throws(()=>validateMealPhoto(new File(['text'], 'notes.jpg', {type:'text/plain'})), /画像ファイル/);
  assert.throws(()=>validateMealPhoto(new File(['text'], 'notes.txt')), /画像ファイル/);
});

test('sharing passes the original chosen photo and prompt in the user gesture', async () => {
  const text = buildMealPhotoPrompt('昼食のおにぎり');
  let shared;
  const nav = {
    canShare({files}) { return files.length === 1 && files[0] === photo; },
    share(payload) { shared = payload; return Promise.resolve(); },
  };
  assert.equal(canShareMealPhoto(photo, nav), true);
  const request = shareMealPhoto(photo, text, nav);
  assert.deepEqual(Object.keys(shared).sort(), ['files','text']);
  assert.equal(shared.files[0], photo);
  assert.equal(shared.text, text);
  assert.equal(await request, 'shared');
});

test('unsupported, cancelled and failed handoffs leave manual sharing to the user', async () => {
  let calls = 0;
  const share = () => { calls++; };
  for (const nav of [{share}, {canShare:()=>true}, {share, canShare:()=>false}, {share, canShare(){throw new Error('blocked');}}]) {
    assert.equal(await shareMealPhoto(photo, 'prompt', nav), 'unsupported');
  }
  assert.equal(await shareMealPhoto(new File(['test'],'notes.txt'), 'prompt', {share,canShare:()=>true}), 'unsupported');
  assert.equal(calls, 0);
  for (const [name, result] of [['AbortError','cancelled'],['NotAllowedError','failed']]) {
    const nav = {canShare:()=>true, share:async()=>{throw new DOMException('closed', name);}};
    assert.equal(await shareMealPhoto(photo, 'prompt', nav), result);
  }
});
