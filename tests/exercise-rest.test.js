import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES } from '../dist/catalog.js';
import { blankState, exerciseRestSeconds, setExerciseRestSeconds, validateState } from '../dist/core.js';

const catalogIds=EXERCISES.map(ex=>ex.id);
const restore=state=>validateState(JSON.parse(JSON.stringify(state)),catalogIds);

test('rest preferences follow exercise IDs across saves, with the global timer as fallback',()=>{
  const state=blankState();
  state.customExercises=[{...EXERCISES[0],id:'__proto__'}];
  setExerciseRestSeconds(state,'__proto__',35);
  setExerciseRestSeconds(state,'leg-press',180);
  const loaded=restore(state);
  assert.equal(exerciseRestSeconds(loaded,'__proto__'),35);
  assert.equal(exerciseRestSeconds(loaded,'leg-press'),180);
  assert.equal(exerciseRestSeconds(loaded,'dumbbell-press'),90);
  setExerciseRestSeconds(loaded,'leg-press',null);
  loaded.settings.timerSeconds=60;
  assert.equal(exerciseRestSeconds(restore(loaded),'leg-press'),60);
  assert.equal(exerciseRestSeconds(loaded,'__proto__'),35);
});

test('exercise rest duration allows 10–3600 whole seconds and validates backed-up overrides',()=>{
  const state=blankState();
  for(const seconds of [10,3600]) {
    setExerciseRestSeconds(state,'leg-press',seconds);
    assert.equal(exerciseRestSeconds(restore(state),'leg-press'),seconds);
  }
  for(const seconds of [0,9,3601,10.5,NaN,'60']){
    assert.throws(()=>setExerciseRestSeconds(state,'leg-press',seconds));
    state.settings.exerciseRestSeconds={'leg-press':seconds};
    assert.throws(()=>restore(state));
  }
  state.settings.exerciseRestSeconds={missing:60};
  assert.throws(()=>restore(state));
  state.settings.exerciseRestSeconds=[];
  assert.throws(()=>restore(state));
});
