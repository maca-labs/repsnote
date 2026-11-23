import assert from 'node:assert/strict';
import test from 'node:test';
import {readMealPhotoDraft, writeMealPhotoDraft} from '../dist/meal-import-draft.js';

test('a photo import returns to its selected day and mode with only the form data', t=>{
  const items = new Map();
  const storage = {
    getItem:key=>items.get(key) ?? null, setItem:(key,value)=>items.set(key,value), removeItem:key=>items.delete(key),
  };
  const prior = Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:storage}});
  t.after(()=>{
    if (prior) Object.defineProperty(globalThis,'window',prior);
    else delete globalThis.window;
  });
  const draft = {mode:'photo', menu:'お弁当', response:'', group:'昼食', stage:'source', previousReview:[]};
  writeMealPhotoDraft('real','2026-11-21',{...draft,preview:'blob:test',file:'private-image'});
  assert.deepEqual(readMealPhotoDraft('real'),{day:'2026-11-21',...draft});
  assert.equal(readMealPhotoDraft('demo'),null);
  assert.doesNotMatch([...items.values()][0],/blob:test|private-image/);
  writeMealPhotoDraft('real','2026-02-30',draft);
  assert.equal(readMealPhotoDraft('real'),null);
  writeMealPhotoDraft('real','2026-11-21',draft);
  writeMealPhotoDraft('real','2026-11-21',null);
  assert.equal(readMealPhotoDraft('real'),null);
});
