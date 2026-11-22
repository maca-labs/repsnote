import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankState,
  cloneExercise,
  cloneSet,
  daysBetween,
  demoState,
  fromKg,
  macroEnergy,
  mealTotals,
  newSet,
  planStats,
  records,
  shiftDay,
  toKg,
  validateState,
  workoutStats,
} from '../dist/core.js';
import { EXERCISES } from '../dist/catalog.js';

const TODAY = '2026-11-22';
const PREVIOUS = '2026-11-20';
const EXERCISE_IDS = EXERCISES.map(exercise => exercise.id);
const EXERCISE_ID = 'dumbbell-press';
const PLAN = {
  startDate: '2026-11-01',
  targetDate: '2026-12-27',
  startWeight: 80,
  targetWeight: 76,
  kcal: 2300,
  p: 160,
  f: 60,
  c: 280,
};

function completedSet(id, kg, reps = 10, overrides = {}) {
  return {
    id,
    kg,
    reps,
    completed: true,
    kind: 'work',
    assisted: false,
    rpe: null,
    ...overrides,
  };
}

function fixture() {
  const state = blankState();
  state.workouts[PREVIOUS] = {
    title: 'PUSH',
    note: '',
    exercises: [{
      id: 'previous-exercise',
      exerciseId: EXERCISE_ID,
      note: '',
      sets: [completedSet('previous-32', 32), completedSet('previous-34', 34)],
    }],
  };
  state.workouts[TODAY] = {
    title: 'PUSH',
    note: '',
    exercises: [{
      id: 'current-exercise',
      exerciseId: EXERCISE_ID,
      note: '',
      sets: [completedSet('current-36', 36)],
    }],
  };
  return state;
}

const currentExercise = state => state.workouts[TODAY].exercises[0];
const best = state => records(state)[EXERCISE_ID];

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function rejectsMutations(cases) {
  for (const [label, mutate] of cases) {
    const state = demoState(TODAY);
    mutate(state);
    assert.throws(() => validateState(state, EXERCISE_IDS), Error, label);
  }
}

test('kg/lbs conversions retain precision across repeated toggles', () => {
  near(toKg(100, 'lbs'), 45.359237);
  near(fromKg(45.359237, 'lbs'), 100);
  assert.equal(toKg(36, 'kg'), 36);
  assert.equal(fromKg(36, 'kg'), 36);

  let canonical = 45.359237;
  for (let i = 0; i < 1000; i += 1) {
    canonical = toKg(fromKg(canonical, 'lbs'), 'lbs');
  }
  near(canonical, 45.359237);
});

test('copied sets and exercises are independent and must be completed again', () => {
  const sourceSet = completedSet('source', 36, 10, { rpe: 8 });
  const copiedSet = cloneSet(sourceSet);
  assert.notEqual(copiedSet.id, sourceSet.id);
  assert.equal(copiedSet.completed, false);
  assert.equal(copiedSet.kg, 36);
  assert.equal(copiedSet.reps, 10);
  assert.equal(copiedSet.rpe, 8);

  const sourceExercise = currentExercise(fixture());
  const copiedExercise = cloneExercise(sourceExercise);
  assert.notEqual(copiedExercise.id, sourceExercise.id);
  assert.notEqual(copiedExercise.sets, sourceExercise.sets);
  assert.notEqual(copiedExercise.sets[0].id, sourceExercise.sets[0].id);
  assert.equal(copiedExercise.sets[0].completed, false);
  assert.equal(workoutStats({ exercises: [copiedExercise] }).volume, 0);

  copiedExercise.sets[0].kg = 1;
  assert.equal(sourceExercise.sets[0].kg, 36);
  assert.equal(newSet(36, 10).completed, false);
});

test('PRs exclude copied, incomplete, warmup, and assisted sets', () => {
  const state = fixture();
  currentExercise(state).sets.push(
    cloneSet(completedSet('to-copy', 900)),
    completedSet('incomplete', 300, 10, { completed: false }),
    completedSet('warmup', 200, 10, { kind: 'warmup' }),
    completedSet('assisted', 100, 10, { assisted: true }),
  );
  assert.equal(best(state).kg, 36);
  assert.equal(best(state).id, 'current-36');
});

test('correcting, deleting, or uncompleting a maximum restores the valid runner-up', () => {
  const mutations = [
    state => { currentExercise(state).sets[0].kg = 33; },
    state => { currentExercise(state).sets = []; },
    state => { currentExercise(state).sets[0].completed = false; },
  ];
  for (const mutate of mutations) {
    const state = fixture();
    mutate(state);
    assert.equal(best(state).kg, 34);
    assert.equal(best(state).date, PREVIOUS);
    assert.equal(best(state).id, 'previous-34');
  }

  const state = fixture();
  for (const workout of Object.values(state.workouts)) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) set.completed = false;
    }
  }
  assert.equal(best(state), undefined);
});

test('equal-weight records select greater repetitions, then the latest occurrence', () => {
  const state = fixture();
  state.workouts[PREVIOUS].exercises[0].sets = [completedSet('earlier', 34, 12)];
  currentExercise(state).sets = [completedSet('later-fewer', 34, 10)];
  assert.equal(best(state).id, 'earlier');

  currentExercise(state).sets[0].reps = 12;
  assert.equal(best(state).id, 'later-fewer');
  assert.equal(best(state).date, TODAY);

  currentExercise(state).sets[0].kg = 34 + 1e-8;
  currentExercise(state).sets[0].reps = 9;
  assert.equal(best(state).id, 'earlier', 'floating-point noise must not create a heavier PR');
});

test('display-unit settings never alter canonical records or completed volume', () => {
  const state = fixture();
  currentExercise(state).sets.push(completedSet('pending', 1000, 10, { completed: false }));
  const original = structuredClone(state.workouts);
  state.settings.unit = 'lbs';

  assert.equal(best(state).kg, 36);
  assert.deepEqual(state.workouts, original);
  assert.deepEqual(workoutStats(state.workouts[TODAY]), {
    sets: 1,
    total: 2,
    volume: 360,
    exercises: 1,
  });
});

test('regression: custom IDs matching Object prototype keys retain their PRs', () => {
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const state = fixture();
    state.customExercises = [{
      id,
      name: 'Custom exercise',
      group: '胸',
      equipment: 'ダンベル',
      load: 'single',
      aliases: [],
    }];
    currentExercise(state).exerciseId = id;
    const imported = validateState(state, EXERCISE_IDS);
    const result = records(imported);
    assert.equal(Object.hasOwn(result, id), true, id);
    assert.equal(result[id].kg, 36, id);
    assert.equal(result[id].id, 'current-36', id);
    assert.equal(result[EXERCISE_ID].kg, 34);
  }
});

test('food quantities consistently scale kcal/P/F/C from per-100g and per-serving values', () => {
  const entries = [
    { basis: '100g', amount: 150, kcal: 200, p: 10, f: 5, c: 25 },
    { basis: 'serving', amount: 0.5, kcal: 120, p: 24, f: 1, c: 4 },
  ];
  const original = structuredClone(entries);
  assert.deepEqual(mealTotals(entries), { kcal: 360, p: 27, f: 8, c: 39.5 });
  assert.deepEqual(entries, original, 'calculation must not mutate base nutrition values');
  assert.deepEqual(mealTotals(), { kcal: 0, p: 0, f: 0, c: 0 });
  assert.equal(macroEnergy({ p: 10, f: 5, c: 25 }), 185);
});

test('weight plans use elapsed calendar days and the latest nonfuture measurement', () => {
  const body = [
    { date: '2026-12-01', kg: 77 },
    { date: '2026-11-21', kg: 78 },
    { date: '2026-10-30', kg: 90 },
    { date: '2026-11-10', kg: 79 },
  ];
  const original = structuredClone(body);
  const result = planStats(PLAN, body, TODAY);
  assert.equal(result.span, 56);
  assert.equal(result.weekly, -0.5);
  assert.equal(result.current, 78);
  assert.equal(result.progress, 50);
  assert.equal(result.remainingDays, 35);
  assert.equal(result.change, -2);
  assert.deepEqual(body, original);
});

test('gain, maintenance, unset, and expired plans remain finite and bounded', () => {
  assert.equal(planStats(null, [], TODAY), null);
  assert.equal(planStats({ ...PLAN, targetWeight: 84 }, [{ date: TODAY, kg: 82 }], TODAY).progress, 50);
  const maintenance = planStats({ ...PLAN, targetWeight: 80 }, [], TODAY);
  assert.equal(maintenance.weekly, 0);
  assert.equal(maintenance.progress, 100);
  assert.equal(planStats(PLAN, [{ date: TODAY, kg: 74 }], TODAY).progress, 100);
  assert.equal(planStats(PLAN, [{ date: TODAY, kg: 82 }], TODAY).progress, 0);
  assert.equal(planStats(PLAN, [], '2027-01-01').remainingDays, 0);
  assert.equal(planStats({ ...PLAN, targetDate: PLAN.startDate }, [], TODAY).weekly, 0);
});

test('calendar arithmetic handles leap days and year boundaries', () => {
  assert.equal(shiftDay('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDay('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
});

test('automatic rest starts off for new journals and preserves the saved preference on restore', () => {
  assert.equal(blankState().settings.autoTimer, false);
  const sample = demoState(TODAY);
  assert.equal(sample.settings.autoTimer, false);
  for (const enabled of [true, false]) {
    sample.settings.autoTimer = enabled;
    assert.equal(validateState(sample, EXERCISE_IDS).settings.autoTimer, enabled);
  }
});

test('valid backups round-trip all records without sharing objects or restoring timers', () => {
  assert.equal(validateState(blankState(), EXERCISE_IDS).schemaVersion, 1);
  const source = demoState(TODAY);
  source.settings.unit = 'lbs';
  source.timer = { endsAt: 123456789 };
  source.routines = [{ id: 'push-routine', name: 'PUSH', subtitle: '胸と肩', exerciseIds: [EXERCISE_ID] }];
  const parsed = JSON.parse(JSON.stringify(source));
  const imported = validateState(parsed, EXERCISE_IDS);

  assert.deepEqual(imported, { ...source, timer: null });
  assert.deepEqual(records(imported), records(source));
  assert.notEqual(imported, parsed);
  assert.notEqual(imported.workouts, parsed.workouts);
  currentExercise(imported).sets[0].kg = 1;
  assert.equal(currentExercise(parsed).sets[0].kg, 34);
  assert.deepEqual(parsed.timer, { endsAt: 123456789 });
});

test('imports reject unsupported schemas, invalid settings, and invalid top-level shapes', () => {
  for (const input of [null, [], 'backup', {}, { schemaVersion: 999 }]) {
    assert.throws(() => validateState(input, EXERCISE_IDS));
  }
  rejectsMutations([
    ['unsupported schema', state => { state.schemaVersion = 2; }],
    ['unknown unit', state => { state.settings.unit = 'pounds'; }],
    ['invalid timer', state => { state.settings.timerSeconds = Infinity; }],
    ['invalid weight step', state => { state.settings.weightStep = 0; }],
    ['wrong workouts shape', state => { state.workouts = []; }],
  ]);
});

test('imports reject malformed workout numbers, duplicate IDs, and invalid dates', () => {
  rejectsMutations([
    ['NaN weight', state => { currentExercise(state).sets[0].kg = NaN; }],
    ['negative weight', state => { currentExercise(state).sets[0].kg = -1; }],
    ['zero repetitions', state => { currentExercise(state).sets[0].reps = 0; }],
    ['fractional repetitions', state => { currentExercise(state).sets[0].reps = 2.5; }],
    ['nonboolean completion', state => { currentExercise(state).sets[0].completed = 'true'; }],
    ['invalid set kind', state => { currentExercise(state).sets[0].kind = 'unknown'; }],
    ['invalid RPE', state => { currentExercise(state).sets[0].rpe = 11; }],
    ['duplicate set ID', state => { currentExercise(state).sets[1].id = currentExercise(state).sets[0].id; }],
    ['impossible calendar date', state => { state.workouts['2026-02-30'] = state.workouts[TODAY]; }],
  ]);
});

test('imports reject malformed nutrition values, meal IDs, and body measurements', () => {
  rejectsMutations([
    ['negative quantity', state => { state.meals[TODAY][0].amount = -1; }],
    ['invalid nutrition basis', state => { state.meals[TODAY][0].basis = 'kg'; }],
    ['negative protein', state => { state.meals[TODAY][0].p = -10; }],
    ['infinite calories', state => { state.foods[0].kcal = Infinity; }],
    ['duplicate meal ID', state => { state.meals[TODAY][1].id = state.meals[TODAY][0].id; }],
    ['duplicate food ID', state => { state.foods[1].id = state.foods[0].id; }],
    ['duplicate body date', state => { state.body.push({ ...state.body[0] }); }],
    ['invalid body weight', state => { state.body[0].kg = 0; }],
    ['invalid body fat', state => { state.body[0].bodyFat = 101; }],
  ]);
});

test('plan imports reject impossible dates or values while allowing gain and maintenance', () => {
  rejectsMutations([
    ['same-day goal', state => { state.plan.targetDate = state.plan.startDate; }],
    ['reversed goal dates', state => { state.plan.targetDate = shiftDay(state.plan.startDate, -1); }],
    ['invalid goal date', state => { state.plan.targetDate = '2027-02-30'; }],
    ['invalid target weight', state => { state.plan.targetWeight = 0; }],
    ['negative calorie target', state => { state.plan.kcal = -1; }],
  ]);
  for (const targetWeight of [80, 84]) {
    const state = blankState();
    state.plan = { ...PLAN, targetWeight };
    assert.equal(validateState(state, EXERCISE_IDS).plan.targetWeight, targetWeight);
  }
});

test('regression: import rejects duplicate saved-routine IDs', () => {
  const state = blankState();
  state.routines = [
    { id: 'same', name: 'PUSH A', subtitle: '', exerciseIds: [EXERCISE_ID] },
    { id: 'same', name: 'PUSH B', subtitle: '', exerciseIds: [EXERCISE_ID] },
  ];
  assert.throws(() => validateState(state, EXERCISE_IDS), /メニューID/);
  state.routines[1].id = 'different';
  assert.equal(validateState(state, EXERCISE_IDS).routines.length, 2);
});

test('imports require known exercise identities and reject catalog collisions', () => {
  rejectsMutations([
    ['unknown workout exercise', state => { currentExercise(state).exerciseId = 'missing'; }],
    ['unknown favorite', state => { state.favorites.push('missing'); }],
    ['unknown routine exercise', state => {
      state.routines = [{ id: 'bad-routine', name: 'Bad', subtitle: '', exerciseIds: ['missing'] }];
    }],
    ['custom/catalog ID collision', state => {
      state.customExercises = [{ id: EXERCISE_ID, name: 'Custom', group: '胸', equipment: 'ダンベル', load: 'single', aliases: [] }];
    }],
  ]);
});
