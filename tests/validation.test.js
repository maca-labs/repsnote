import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, ROUTINES } from '../dist/catalog.js';
import { blankState, cloneSet, lastExercise, newSet, records, validateState } from '../dist/core.js';

const ids = EXERCISES.map(exercise => exercise.id);
const day = '2026-11-21';

function workoutWith(sets, exerciseId = 'leg-press') {
  const state = blankState();
  state.workouts[day] = {title: 'LEGS', note: '', exercises: [{
    id: 'session-1', exerciseId, sets,
  }]};
  return state;
}

test('previous weight and repetition hints use only sets actually completed', () => {
  const performed = {...newSet(50, 8), completed: true};
  const laterDraft = newSet(75, 12);
  const state = workoutWith([laterDraft, performed]);
  assert.deepEqual(lastExercise(state, 'leg-press', '2026-11-22').sets, [performed]);
  assert.deepEqual(state.workouts[day].exercises[0].sets, [laterDraft, performed]);
});

test('zero-weight historical entries remain recoverable, with PRs only for bodyweight loads', () => {
  const completed = {...newSet(0, 12), completed: true};
  for (const [exerciseId, bodyweight] of [['leg-press', false], ['crunch', true], ['custom-body', true]]) {
    const state = workoutWith([completed], exerciseId);
    state.customExercises = [{id: 'custom-body', name: '自重', group: '腕', equipment: '自重', load: 'body', aliases: []}];
    const restored = validateState(state, ids);
    assert.deepEqual(restored.workouts, state.workouts);
    assert.equal(records(restored)[exerciseId]?.id, bodyweight ? completed.id : undefined);
  }
});

test('successive near-equal loads cannot drift away from the actual maximum', () => {
  const sets = [0, 1, 2, 3].map(i => ({...newSet(100 - i * 0.0000008, i + 1), completed: true}));
  for (const order of [sets, [...sets].reverse()]) {
    assert.equal(records(workoutWith(order))['leg-press'].id, sets[1].id);
  }
});

test('v1 sessions above 200 sets and libraries above 100 routines round-trip', () => {
  const set = {...newSet(50, 8), completed: true};
  const state = workoutWith([set, ...Array.from({length: 200}, () => cloneSet(set))]);
  state.routines = Array.from({length: 101}, (_, n) => ({
    id: 'user-' + n, name: 'LEGS', subtitle: '', exerciseIds: ['leg-press'],
  }));
  const restored = validateState(JSON.parse(JSON.stringify(state)), ids);
  assert.deepEqual(restored, state);
  assert.equal(records(restored)['leg-press'].id, set.id);
});

test('imports reject IDs that alias built-in routines or break editing and selection', () => {
  const state = workoutWith([newSet(50, 8)]);
  state.routines = [{...ROUTINES[0], name: 'カスタム'}];
  assert.throws(() => validateState(state, ids), /メニューID/);
  state.routines = [];
  state.favorites.push(state.favorites[0]);
  assert.throws(() => validateState(state, ids), /お気に入り/);
  state.favorites.pop();
  state.workouts[day].exercises[0].sets[0].id = ' ';
  assert.throws(() => validateState(state, ids), /セット/);
});
