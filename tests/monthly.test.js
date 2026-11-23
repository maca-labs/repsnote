import test from 'node:test';
import assert from 'node:assert/strict';
import {blankState, cloneSet, EPS, monthlySummary, newCardioSet, newSet, recordUpdateCount} from '../dist/core.js';

const done = (kg, reps, extra={}) => ({...newSet(kg,reps), completed:true, ...extra});
const run = (minutes, distanceKm=null) => ({...newCardioSet(), minutes, distanceKm, kcal:600, completed:true});
const exercise = (exerciseId, ...sets) => ({exerciseId, sets});
const workout = (...exercises) => ({exercises});
const food = (kcal, amount=1, basis='serving') => ({kcal, p:0, f:0, c:0, basis, amount});

test('monthly summary includes only completed activities and distinguishes missing logs from zero', () => {
  const state = blankState();
  state.workouts = {
    '2027-01-02':workout(exercise('barbell-bench',done(60,5),done(20,10,{kind:'warmup'}),newSet(200,10)),
      exercise('cardio-running',run(15.5),cloneSet(run(15.5)))),
    '2027-01-25':workout(exercise('cardio-running',run(24))),
    '2027-01-31':workout(exercise('barbell-bench',newSet(90,8))),
    '2026-12-31':workout(exercise('barbell-bench',done(50,8))),
    '2027-02-01':workout(exercise('barbell-bench',done(70,8))),
  };
  state.meals = {
    '2026-12-31':[food(2000)], '2027-01-02':[food(100,150,'100g'),food(450)],
    '2027-01-04':[food(0)], '2027-01-30':[], '2027-02-01':[food(2000)],
  };
  state.body = [
    {date:'2027-02-01',kg:68}, {date:'2027-01-30',kg:69.3}, {date:'2027-01-02',kg:71.2},
    {date:'2026-12-31',kg:70},
  ];
  assert.deepEqual(monthlySummary(state,'2027-01'),{
    month:'2027-01',trainingDays:2,strengthSets:2,volumeKg:500,updatedExercises:1,
    cardioSessions:2,cardioMinutes:39.5,cardioDistanceKm:null,cardioDistanceCount:0,mealDays:2,avgKcal:300,
    bodyDays:2,bodyMeasurements:2,firstWeightKg:71.2,lastWeightKg:69.3,
  });
  assert.deepEqual(monthlySummary(state,'2027-03'),{
    month:'2027-03',trainingDays:0,strengthSets:0,volumeKg:0,updatedExercises:0,
    cardioSessions:0,cardioMinutes:0,cardioDistanceKm:null,cardioDistanceCount:0,mealDays:0,avgKcal:null,
    bodyDays:0,bodyMeasurements:0,firstWeightKg:null,lastWeightKg:null,
  });
  state.meals['2027-03-01'] = [food(0)];
  assert.equal(monthlySummary(state,'2027-03').avgKcal,0);
});

test('monthly cardio totals follow completed sessions across days and distinguish a missing distance from zero', () => {
  const state = blankState();
  const ride = run(30,8.75);
  state.workouts = {
    '2026-12-31':workout(exercise('cardio-running',run(60,11))),
    '2027-01-01':workout(exercise('cardio-running',run(12.5,1.25),cloneSet(run(25,4))),
      exercise('cardio-walking',run(6))),
    '2027-01-31':workout(exercise('cardio-cycling',ride),exercise('barbell-bench',done(40,8))),
    '2027-02-01':workout(exercise('cardio-walking',run(15,0))),
  };
  function totals(month) {
    const {cardioMinutes,cardioSessions,cardioDistanceKm,cardioDistanceCount} = monthlySummary(state,month);
    return [cardioMinutes,cardioSessions,cardioDistanceKm,cardioDistanceCount];
  }
  assert.deepEqual(totals('2027-01'),[48.5,3,10,2]);
  assert.deepEqual(totals('2027-02'),[15,1,0,1]);
  ride.completed = false;
  assert.deepEqual(totals('2027-01'),[18.5,2,1.25,1]);
});

test('monthly updates count each improved exercise once and recompute after a historical correction', () => {
  const state = blankState();
  state.workouts = {
    '2027-02-01':workout(exercise('barbell-bench',done(99,8))),
    '2027-01-30':workout(exercise('barbell-bench',done(65,1)),exercise('pushup',done(0,12))),
    '2027-01-01':workout(exercise('barbell-bench',done(55,1)),exercise('pushup',done(0,10))),
    '2026-12-30':workout(exercise('barbell-bench',done(50,8))),
    '2027-01-10':workout(exercise('barbell-bench',done(58,8)),exercise('leg-press',done(100,8),done(110,8))),
    '2027-01-12':workout(exercise('leg-press',newSet(150,8),done(150,8,{assisted:true}))),
  };
  const summary = () => monthlySummary(state,'2027-01').updatedExercises;
  assert.equal(summary(),2);
  state.workouts['2026-12-30'].exercises[0].sets[0].kg = 80;
  assert.equal(summary(),1);
  delete state.workouts['2027-01-01'];
  assert.equal(summary(),0);
});

test('month and individual days agree when a shifting EPS window changes the bodyweight repetition baseline', () => {
  const state = blankState();
  state.workouts = {
    '2027-01-02':workout(exercise('pushup',done(10+EPS*.8,1))),
    '2027-01-03':workout(exercise('pushup',done(10+EPS*.8,12))),
    '2026-12-31':workout(exercise('pushup',done(10-EPS*.8,30),done(10,10))),
  };
  assert.equal(recordUpdateCount(state,'2027-01-02'),0);
  assert.equal(recordUpdateCount(state,'2027-01-03'),1);
  assert.equal(monthlySummary(state,'2027-01').updatedExercises,1);
});
