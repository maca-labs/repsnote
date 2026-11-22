import assert from 'node:assert/strict';
import test from 'node:test';
import {EXERCISES} from '../dist/catalog.js';
import {
  CARDIO_FIELDS, blankState, cardioDetails, cloneExercise, eligible, lastExercise,
  mealTotals, newCardioSet, newSet, records, validateState, validCardioValue, workoutStats,
} from '../dist/core.js';

const ids = EXERCISES.map(exercise => exercise.id);
const day = '2026-11-22';
function fixture(exerciseId = 'cardio-running', set = newCardioSet()) {
  const state = blankState();
  state.workouts[day] = {title:'', note:'', exercises:[{id:'activity', exerciseId, note:'', sets:[set]}]};
  return state;
}

test('ten unique cardio exercises are searchable using Japanese and English names', () => {
  const cardio = EXERCISES.filter(exercise => exercise.load === 'cardio');
  assert.equal(cardio.length, 10);
  assert.equal(new Set(ids).size, ids.length);
  for (const exercise of cardio) {
    assert.equal(exercise.group, '有酸素');
    assert.ok(exercise.aliases.some(alias => /^[a-z]/i.test(alias)));
    assert.ok(exercise.aliases.some(alias => /[^\x00-\x7F]/.test(alias)));
    const state = fixture(exercise.id);
    assert.deepEqual(validateState(state, ids), state);
  }
});

test('cardio records round trip with optional, zero, decimal and downhill measurements', () => {
  const set = newCardioSet();
  assert.deepEqual(set, {id:set.id, minutes:10, distanceKm:null, completed:false});
  assert.equal(cardioDetails(set), '10分');
  Object.assign(set, {minutes:20.01, distanceKm:3, inclinePct:-2.35, speedKmh:0, kcal:120.25, steps:1000, completed:true});
  const state = fixture('cardio-treadmill', set);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state)), ids), state);
  assert.equal(cardioDetails(set), '20.01分 / 3 km / 傾斜 -2.35% / 速度 0 km/h / 消費 120.25 kcal / 1,000歩');
  assert.deepEqual(mealTotals(state.meals[day]), {kcal:0, p:0, f:0, c:0});
});

test('UI and backup validation share cardio units, limits and precision', () => {
  for (const field of CARDIO_FIELDS) {
    const valid = [field.min, field.max, field.step];
    if (!field.required) valid.push(null, undefined, 0);
    for (const value of valid) {
      assert.equal(validCardioValue(field, value), true);
      const set = {...newCardioSet(), [field.key]:value};
      assert.doesNotThrow(() => validateState(fixture('cardio-running',set), ids));
    }
    const invalid = [field.min - 1, field.max + 1, '1', NaN, Infinity, field.step / 10];
    if (field.required) invalid.push(null, undefined, 0);
    for (const value of invalid) {
      assert.equal(validCardioValue(field, value), false);
      const set = {...newCardioSet(), [field.key]:value};
      assert.throws(() => validateState(fixture('cardio-running',set), ids));
    }
  }
  assert.throws(() => validateState(fixture('cardio-running', newSet(10,10)), ids));
  assert.throws(() => validateState(fixture('barbell-bench', newCardioSet()), ids));
  assert.throws(() => validateState(fixture('cardio-running', {...newCardioSet(), kg:5}), ids));
  assert.throws(() => validateState(fixture('barbell-bench', {...newSet(10,10), minutes:5}), ids));
});

test('completed cardio counts once and preserves metrics when copied without creating strength volume or PRs', () => {
  const completed = {...newCardioSet(), minutes:20, distanceKm:3, completed:true};
  assert.equal(cardioDetails(completed), '20分 / 3 km');
  assert.equal(eligible(completed), false);
  const state = fixture('cardio-running', completed);
  const workout = state.workouts[day];
  workout.exercises[0].sets.push(newCardioSet());
  workout.exercises.push({id:'weights', exerciseId:'barbell-bench', sets:[{...newSet(30,4), completed:true}]});
  assert.deepEqual(workoutStats(workout), {sets:2, total:3, volume:120, exercises:2});
  assert.deepEqual(Object.keys(records(state)), ['barbell-bench']);
  const previous = lastExercise(state, 'cardio-running', '2026-11-23');
  const copied = cloneExercise(previous);
  assert.equal(copied.sets.length, 1);
  assert.notEqual(copied.sets[0].id, completed.id);
  assert.deepEqual(copied.sets[0], {...completed, id:copied.sets[0].id, completed:false});
});
