import assert from 'node:assert/strict';
import test from 'node:test';
import { EXERCISES } from '../dist/catalog.js';
import { blankState, newSet, toKg, validateState } from '../dist/core.js';
import { workoutCsv } from '../dist/share.js';
import { decodeWorkoutFile, mergeWorkoutImport, parseWorkoutImport } from '../dist/workout-import.js';

const parse = parseWorkoutImport;
const ids = EXERCISES.map(exercise => exercise.id);
const find = id => EXERCISES.find(exercise => exercise.id === id);
const merge = (state, parsed, pairs) => mergeWorkoutImport(state,parsed,new Map(pairs),EXERCISES);
const day = '2026-01-03';

for (const format of ['current', 'legacy']) {
  test(`a manually recorded set stays corrected after re-importing the same ${format} export`, () => {
    const state = blankState();
    const set = {...newSet(40,8),completed:true};
    state.workouts[day] = {title:'PUSH',note:'',exercises:[
      {id:'bench',exerciseId:'barbell-bench',note:'',sets:[set]},
    ]};
    const name = find('barbell-bench').name;
    const csv = format === 'current' ? workoutCsv(state,find,ex=>ex.load)
      : `日付,メニュー,種目,重量(kg),重量(lbs),回数,完了,重量の意味\n${day},PUSH,${name},40,,8,完了,合計`;
    const parsed = parse(csv);
    const mapping = [[name,'barbell-bench']];
    const first = merge(state,parsed,mapping);
    assert.equal(first.duplicates,1);
    const reopened = validateState(JSON.parse(JSON.stringify(first.state)),ids);
    reopened.workouts[day].exercises[0].sets[0].reps = 9;
    const again = merge(reopened,parsed,mapping);
    assert.deepEqual(again.state.workouts[day].exercises[0].sets.map(s=>[s.id,s.reps]),[[set.id,9]]);
    assert.equal(again.duplicates,1);
    assert.equal(again.added,0);
  });
}

test('a native export identifies corrected sets even before their first re-import and preserves separate identical sets', () => {
  const state = blankState();
  const sets = [newSet(40,8),newSet(40,8)];
  state.workouts[day] = {title:'PUSH',note:'',exercises:[{id:'lift',exerciseId:'barbell-bench',note:'',sets}]};
  const parsed = parse(workoutCsv(state,find,ex=>ex.load));
  const mapping = [[find('barbell-bench').name,'barbell-bench']];
  const fresh = merge(blankState(),parsed,mapping);
  assert.deepEqual(fresh.state.workouts[day].exercises[0].sets.map(s=>s.id),sets.map(s=>s.id));
  sets[0].reps = 9;
  assert.equal(merge(state,parsed,mapping).added,0);
});

test('a legacy set matched under several exercise names recognizes every checked CSV after a correction', () => {
  const id = 'barbell-bench';
  const names = ['Bench',find(id).name,'ベンチ'];
  const mapping = names.map(name => [name,id]);
  const legacy = labels => parse('日付,種目,重量,回数\n'+labels.map(name => [day,name,40,8].join(',')).join('\n'));
  let state = merge(blankState(),legacy([names[0]]),mapping).state;
  for (const name of names.slice(1)) {
    const checked = merge(state,legacy([name]),mapping);
    assert.equal(checked.duplicates,1);
    assert.equal(checked.linked,1);
    state = checked.state;
  }
  state = validateState(JSON.parse(JSON.stringify(state)),ids);
  state.workouts[day].exercises[0].sets[0].reps = 9;
  for (const name of names) assert.equal(merge(state,legacy([name]),mapping).added,0);
  // Two rows in a single CSV still represent two sets, even if both labels have matched one set before.
  const both = merge(state,legacy(names.slice(0,2)),mapping);
  assert.deepEqual(both.state.workouts[day].exercises[0].sets.map(set=>set.reps),[9,8]);
  assert.equal(merge(both.state,legacy(names.slice(0,2)),mapping).added,0);
});

test('supported backup IDs round-trip exactly without becoming DOM IDs when importing on another device', () => {
  const id = 'barbell-bench', mapping = [[find(id).name,id]];
  const originalIds = [' set A ','組"<見本>,😀\r\n','~"x"'];
  const state = blankState();
  const sets = originalIds.map(id=>({...newSet(40,8),id,completed:true}));
  state.workouts[day] = {title:'PUSH',note:'',exercises:[{id:'entry',exerciseId:id,note:'',sets}]};
  validateState(state,ids);
  const csv = workoutCsv(state,find,ex=>ex.load);
  const parsed = parse(csv);
  assert.deepEqual(parsed.rows.map(row=>row.setId),originalIds);
  sets[0].reps = 9;
  assert.equal(merge(state,parsed,mapping).added,0);
  const other = validateState(merge(blankState(),parsed,mapping).state,ids);
  const imported = other.workouts[day].exercises[0].sets;
  assert.equal(new Set(imported.map(set=>set.id)).size,3);
  for (const set of imported) assert.match(set.id,/^[a-zA-Z0-9_.:-]+$/);
  assert.deepEqual(parse(workoutCsv(other,find,ex=>ex.load)).rows.map(row=>row.setId),originalIds);
  imported[1].reps = 9;
  assert.equal(merge(other,parsed,mapping).added,0);
  // Copies have an independent identity even when an old client copied import metadata.
  imported.push({...imported[0],id:'copy-1'});
  assert.deepEqual(parse(workoutCsv(other,find,ex=>ex.load)).rows.map(r=>r.setId),[...originalIds,'copy-1']);
});

test('a transcribed table can be pasted from a single AI code block', () => {
  const tsv = '日付\t種目\t重量(lb)\t回数\n2026-01-03\tダンベル\t20\t8';
  const fenced = '```tsv\r\n'+tsv+'\r\n```\n';
  assert.deepEqual(parse(fenced),parse(tsv));
});

test('reads UTF BOMs, Japanese Windows encoding, quoted cells, source names and actual units', () => {
  const source = '\uFEFF日付\t種目名\t重量\t単位\t回数\t補助\tセット数\tメモ\r\n'
    + '２０２６年１月３日\t"Quoted, ""DB"""\t５０\tlb\t9\tあり\t2\t"tab\tand\nnewline"\r\n';
  const utf16 = Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(source,'utf16le')]);
  const rows = parse(decodeWorkoutFile(utf16));
  assert.deepEqual(rows.ignoredColumns, ['メモ']);
  assert.deepEqual(rows.sources, [{name:'Quoted, "DB"',type:'strength',count:2}]);
  assert.equal(rows.rows.length,2);
  assert.deepEqual(rows.rows[0].set,{kg:toKg(50,'lbs'),reps:9,completed:true,assisted:true,kind:'work',rpe:null});
  assert.equal(rows.rows[1].date,day);
  // CP932 bytes for 日付
  assert.equal(decodeWorkoutFile(Uint8Array.of(0x93,0xfa,0x95,0x74)), '日付');
});

test('rejects malformed, ambiguous or invalid input before any record is imported', () => {
  for (const input of [
    '日付,種目,回数\n2026/2/29,スクワット,10',
    '日付,種目,回数\n2026/1/3,種目,"12',
    '日付,種目,回数\n2026/1/3,種目,12,25',
    '日付,種目,回数\n2026/1/3,種目,1.5',
    '日付,種目,回数,重量(kg),重量(lbs)\n2026/1/3,B,2,90,90',
    '日付,種目,回数,重量,単位\n2026/1/3,B,2,30,stone',
    '日付,種目,回数,重量(kg)\n2026/1/3,B,2,20lb',
    '日付,種目,回数,重量(kg),単位\n2026/1/3,B,2,100,lbs',
    '日付,種目,回数,重量(lb),単位\n2026/1/3,B,2,100,kg',
    '日付,種目,回数,完了\n2026/1/3,B,2,unknown',
    '日付,種目,回数,セット\n2026/1/3,B,2,4',
    '日付,種目,セット数,重量\n2026/1/3,B,3,20',
    '日付,種目,回数,時間(分)\n2026/1/3,B,5,\n2026/1/4,B,,10',
    '日付,種目,時間(分),歩数\n2026/1/3,B,25,2.5',
    '日付,種目,時間(分),距離(km)\n2026/1/3,B,,0',
  ]) assert.throws(() => parse(input),undefined,input);
});

test('requires explicit targets or skip and applies the whole batch on a new state', () => {
  const p = parse('日付,種目,回数,重量,時間(分)\n2026/1/3,腕立て,14,,\n2026/1/3,ラン,,,15');
  const state = blankState();
  assert.throws(() => merge(state,p,[['腕立て','pushup']]),/取り込み先/);
  assert.throws(() => merge(state,p,[['腕立て','barbell-bench'],['ラン',null]]),/重量/);
  assert.throws(() => merge(state,p,[['腕立て','pushup'],['ラン','barbell-bench']]),/種類/);
  assert.deepEqual(state.workouts,{});
  const result = merge(state,p,[['腕立て','pushup'],['ラン',null]]);
  assert.equal(result.added,1); assert.equal(result.skipped,1);
  assert.equal(result.state.workouts[day].exercises[0].sets[0].kg,0);
  assert.deepEqual(state.workouts,{});
  validateState(result.state,ids);
});

test('merges matching sets as a multiset and recognizes repeated imports after a correction', () => {
  const state = blankState();
  state.workouts[day] = {title:'Existing title',note:'keep',exercises:[
    {id:'exercise',exerciseId:'barbell-bench',note:'keep note',sets:[{...newSet(40,8),completed:true}]},
  ]};
  const p = parse('日付,種目,重量,回数,メニュー\n2026/1/3,B,40,8,Imported\n2026/1/3,B,40,8,Imported\n2026/1/3,B,40,8,Imported');
  const mapping = [['B','barbell-bench']];
  const a = merge(state,p,mapping);
  assert.equal(a.added,2); assert.equal(a.duplicates,1);
  const entry = a.state.workouts[day].exercises[0];
  assert.equal(a.state.workouts[day].title,'Existing title');
  assert.equal(entry.note,'keep note');
  assert.equal(new Set(entry.sets.map(s => s.id)).size,3);
  entry.sets[1].kg = 45;
  const restored = validateState(JSON.parse(JSON.stringify(a.state)),ids);
  const b = merge(restored,p,mapping);
  assert.equal(b.duplicates,3); assert.equal(b.added,0);
  assert.deepEqual(b.state.workouts[day].exercises[0].sets.map(s=>s.kg),[40,45,40]);
});

test('round-trips REPS NOTE strength, cardio and unfinished sets through CSV', () => {
  const state = blankState();
  state.workouts[day] = {title:'=my,"workout"',note:'',exercises:[
    {id:'lift',exerciseId:'barbell-bench',note:'',sets:[
      {...newSet(40.504,8),completed:true,kind:'warmup',assisted:true,rpe:8.5},newSet(50,12),
    ]},
    {id:'run',exerciseId:'cardio-running',note:'',sets:[
      {id:'cardio-set',completed:true,minutes:24.5,distanceKm:2,inclinePct:-1,speedKmh:0,kcal:110.25,steps:0},
    ]},
  ]};
  const csv = workoutCsv(state,find,ex=>ex.load);
  const p = parse(csv);
  const mapping = p.sources.map(({name})=>[name,EXERCISES.find(ex=>ex.name===name).id]);
  const a = merge(blankState(),p,mapping);
  assert.equal(a.added,3);
  assert.equal(a.state.workouts[day].title,state.workouts[day].title);
  assert.equal(workoutCsv(a.state,find,ex=>ex.load),csv);
  assert.equal(merge(state,p,mapping).duplicates,3);
  validateState(a.state,ids);
});
