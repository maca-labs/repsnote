import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES } from '../dist/catalog.js';
import { addShareTemplate, blankState, validateState } from '../dist/core.js';

const ids = EXERCISES.map(exercise=>exercise.id);
test('named share texts survive a backup and do not overwrite another template with the same name', () => {
  const state = blankState();
  assert.deepEqual(validateState(state,ids),state);
  addShareTemplate(state.settings,'  ジム後  ','お疲れさま！\n#筋トレ');
  addShareTemplate(state.settings,'週末','今週の記録');
  assert.throws(()=>addShareTemplate(state.settings,'ジム後','違う文'),/使用中/);
  assert.throws(()=>addShareTemplate(state.settings,'','本文'),/名前/);
  assert.throws(()=>addShareTemplate(state.settings,'空文','  '),/投稿文/);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state)),ids).settings.shareTemplates,[
    {name:'ジム後',text:'お疲れさま！\n#筋トレ'}, {name:'週末',text:'今週の記録'},
  ]);
  state.settings.shareTemplates.push({name:'週末',text:'重複'});
  assert.throws(()=>validateState(state,ids),/定型文/);
  state.settings.shareTemplates = [{name:'誤った形式',text:8}];
  assert.throws(()=>validateState(state,ids),/定型文/);
});
