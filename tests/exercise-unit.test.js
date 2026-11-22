import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES } from '../dist/catalog.js';
import { blankState, demoState, exerciseUnit, setExerciseUnit, validateState } from '../dist/core.js';

const catalogIds = EXERCISES.map(ex => ex.id);
const roundTrip = state => validateState(JSON.parse(JSON.stringify(state)), catalogIds);

test('legacy v1 settings use their original display unit until an exercise gets its own unit', () => {
  const state = demoState('2026-11-22');
  state.settings.unit = 'lbs';
  const restored = roundTrip(state);
  assert.deepEqual(restored, state);
  assert.equal(exerciseUnit(restored, 'dumbbell-press'), 'lbs');
  setExerciseUnit(restored, 'dumbbell-press', 'kg');
  assert.equal(exerciseUnit(restored, 'leg-press'), 'lbs');
  assert.equal(restored.settings.unit, 'lbs');
  assert.deepEqual(restored.workouts, state.workouts);
  assert.equal(exerciseUnit(roundTrip(restored), 'dumbbell-press'), 'kg');
});

test('an explicit exercise unit survives a change in the default, including special custom exercise IDs', () => {
  const state = blankState();
  const ids = ['__proto__', 'constructor', 'toString'];
  state.customExercises = ids.map(id => ({...EXERCISES[0], id}));
  for (const id of ids) {
    assert.equal(exerciseUnit(state, id), 'kg');
    setExerciseUnit(state, id, 'kg');
  }
  state.settings.unit = 'lbs';
  const restored = roundTrip(state);
  for (const id of ids) assert.equal(exerciseUnit(restored, id), 'kg');
  assert.equal(exerciseUnit(restored, 'leg-press'), 'lbs');
  setExerciseUnit(restored, '__proto__', 'lbs');
  assert.equal(exerciseUnit(restored, '__proto__'), 'lbs');
  assert.equal(exerciseUnit(state, '__proto__'), 'kg');
});

test('unit overrides must reference known exercises and use supported units', () => {
  const state = blankState();
  assert.throws(() => setExerciseUnit(state, 'missing', 'lbs'));
  assert.throws(() => setExerciseUnit(state, 'leg-press', 'stones'));
  assert.deepEqual(state, blankState());
  for (const units of [null, [], 'kg', {missing: 'kg'}, {'leg-press': 'stones'}, {'leg-press': null}]) {
    state.settings.exerciseUnits = units;
    assert.throws(() => roundTrip(state), /重量単位/);
  }
});
