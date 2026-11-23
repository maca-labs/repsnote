import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES, ROUTINES } from '../dist/catalog.js';
import { deleteRoutine, editExercise, getExercises, getRoutines, saveRoutine } from '../dist/catalog-settings.js';
import { blankState, monthlySummary, newSet, records, validateState } from '../dist/core.js';
import { buildAiPrompt } from '../dist/ai-prompt.js';

const ids = EXERCISES.map(exercise => exercise.id);
const restore = state => validateState(JSON.parse(JSON.stringify(state)), ids);
const builtIn = ROUTINES[0];
const day = '2026-11-23';
const pressId = 'barbell-bench';
const custom = {id:'machine-A', name:'脚プレス', group:'脚', equipment:'マシン', load:'stack', aliases:[]};

test('built-in routine edits, deletion and custom menus persist independently of recorded days', () => {
  const state = blankState();
  state.customExercises.push({...custom});
  state.workouts[day] = {title:builtIn.name, note:'', exercises:[]};
  const archived = structuredClone(state.workouts);
  const edited = {id:builtIn.id,name:'胸と脚',subtitle:'金曜日',exerciseIds:[custom.id,pressId]};
  saveRoutine(state,edited);
  saveRoutine(state,{id:'friday',name:'別メニュー',exerciseIds:[pressId]});
  saveRoutine(state,{id:'friday',name:'金曜日',exerciseIds:[pressId,custom.id]});
  edited.exerciseIds.reverse();
  const restored = restore(state);
  assert.deepEqual(getRoutines(restored)[0].exerciseIds,[custom.id,pressId]);
  assert.deepEqual(getRoutines(restored).at(-1),{id:'friday',name:'金曜日',subtitle:'',exerciseIds:[pressId,custom.id]});
  for (const id of [builtIn.id,'friday']) deleteRoutine(restored,id);
  assert.deepEqual(getRoutines(restore(restored)).map(r=>r.id), ROUTINES.slice(1).map(r=>r.id));
  assert.deepEqual(restored.workouts,archived);
  assert.deepEqual(getRoutines(blankState())[0],builtIn);
});

test('regrouped exercises retain their actual loads, history, favorites and AI names', () => {
  const state = blankState();
  state.customExercises = [{...custom}];
  state.favorites = [pressId,custom.id];
  state.settings.exerciseUnits = {[pressId]:'lbs'};
  state.workouts[day] = {title:'PUSH',note:'',exercises:[
    {id:'a',exerciseId:pressId,sets:[{...newSet(30,7),completed:true}]},
    {id:'b',exerciseId:'cardio-walking',sets:[{id:'walk',completed:true,minutes:12}]},
  ]};
  const baseline = records(state);
  editExercise(state,pressId,{name:'平ベンチ',group:'肩'});
  editExercise(state,custom.id,{name:'脚マシンA',group:'有酸素'});
  editExercise(state,'cardio-walking',{name:'坂道ウォーク',group:'脚'});
  const restored = restore(state), catalog = getExercises(restored);
  assert.deepEqual(catalog.find(e=>e.id===pressId), {
    ...EXERCISES.find(e=>e.id===pressId), name:'平ベンチ',group:'肩',
    aliases:[...EXERCISES.find(e=>e.id===pressId).aliases,'ベンチプレス'],
  });
  assert.equal(catalog.find(e=>e.id===custom.id).load,'stack');
  assert.equal(catalog.find(e=>e.id==='cardio-walking').load,'cardio');
  assert.equal(monthlySummary(restored,day.slice(0,7)).cardioMinutes,12);
  assert.deepEqual(records(restored),baseline);
  assert.deepEqual(restored.favorites,[pressId,custom.id]);
  assert.match(buildAiPrompt(restored,day),/平ベンチ/);
  assert.match(buildAiPrompt(restored,day),/坂道ウォーク/);
  assert.equal(getExercises(blankState()).find(e=>e.id===pressId).name,'ベンチプレス');
});

test('invalid edits and malformed backup overrides are rejected without changing existing records', () => {
  const state = blankState();
  for (const bad of [
    () => editExercise(state,'unknown',{name:'名称',group:'背中'}),
    () => editExercise(state,pressId,{name:'',group:'背中'}),
    () => editExercise(state,pressId,{name:'平ベンチ',group:'unknown'}),
    () => saveRoutine(state,{id:'a',name:'空',exerciseIds:[]}),
    () => saveRoutine(state,{id:'push',name:'不正',exerciseIds:[pressId,pressId]}),
    () => saveRoutine(state,{id:'push',name:'不正',exerciseIds:['missing']}),
  ]) assert.throws(bad);
  assert.deepEqual(state,blankState());
  for (const bad of [
    {exerciseOverrides:{'barbell-bench':{name:'変更',group:'胸',load:'cardio'}}},
    {exerciseOverrides:{'unknown':{name:'変更',group:'胸'}}},
    {routineOverrides:{'push':{name:'変更',subtitle:'',exerciseIds:['missing']}}},
    {routineOverrides:{'unknown':null}},
  ]) assert.throws(()=>restore({...state,...bad}));
  assert.deepEqual(restore(state),state);
});
