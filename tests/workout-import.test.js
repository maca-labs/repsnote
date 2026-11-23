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
