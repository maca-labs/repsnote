import test from 'node:test';
import assert from 'node:assert/strict';
import {fromKg, newSet} from '../dist/core.js';
import {editedWeightKg, weightPresets} from '../dist/workout-input.js';

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

test('dumbbell presets use the same 2kg grid in both units, including near off-grid weights', () => {
  const dumbbell={equipment:'ダンベル', load:'single'};
  for (const unit of ['kg','lbs']) {
    const presets=weightPresets(dumbbell, unit, 2.5);
    assert.deepEqual(presets.map(p=>p.kg), Array.from({length:31}, (_,i)=>i*2));
    assert.equal(presets[1].value, fromKg(2,unit));
    const near=weightPresets(dumbbell, unit, 5, 11.5);
    assert.deepEqual(near.map(p=>p.kg), [8,10,12,14,16]);
    assert.equal(weightPresets({...dumbbell,load:'total'},unit,5)[1].kg,2);
  }
});

test('other equipment keeps the configured step in kg or lbs regardless of its load label', () => {
  const machine={equipment:'マシン',load:'single'};
  assert.deepEqual(weightPresets(machine,'kg',2.5).slice(0,4).map(p=>p.value),[0,2.5,5,7.5]);
  assert.deepEqual(weightPresets(machine,'lbs',5).slice(0,4).map(p=>p.value),[0,5,10,15]);
  assert.equal(weightPresets({...machine,load:'stack'},'kg',1.25).at(-1).kg,400);
});
