import test from 'node:test';
import assert from 'node:assert/strict';
import {fromKg, newSet} from '../dist/core.js';
import {editedWeightKg, weightRange} from '../dist/workout-input.js';

test('editing reps in lbs keeps the canonical kg even with equivalent decimal formatting', () => {
  const originalKg = 32.12345678;
  const displayed = Number(fromKg(originalKg, 'lbs').toFixed(6));
  const options = {unit:'lbs', originalKg, displayed, completed:true, load:'single'};
  assert.equal(editedWeightKg(displayed.toFixed(8), options), originalKg);
  assert.equal(editedWeightKg('100', options), 45.359237);
});

test('quick weight selection and detailed corrections enforce the same completed-set rule', () => {
  const set = {...newSet(30), completed:true};
  const options = {unit:'kg', originalKg:set.kg, displayed:30, completed:true, load:'stack'};
  assert.throws(() => { set.kg = editedWeightKg('0', options); });
  assert.equal(set.kg, 30);
  assert.equal(editedWeightKg('0', {...options, completed:false}), 0);
  assert.equal(editedWeightKg('0', {...options, load:'body'}), 0);
  for (const value of ['5001', 'NaN', '-1', '', null]) {
    assert.throws(() => editedWeightKg(value, options));
  }
});

test('dumbbell and machine weight lists honor the configured increment in the active unit', () => {
  assert.deepEqual(weightRange(2.5, 'single', 'kg').slice(0, 4), [0, 2.5, 5, 7.5]);
  assert.deepEqual(weightRange(5, 'single', 'lbs').slice(0, 4), [0, 5, 10, 15]);
  assert.equal(weightRange(1.25, 'stack', 'kg').at(-1), 400);
});
