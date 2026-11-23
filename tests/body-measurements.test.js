import assert from 'node:assert/strict';
import test from 'node:test';
import {buildAiPrompt} from '../dist/ai-prompt.js';
import {EXERCISES} from '../dist/catalog.js';
import {blankState, bodyMeasurementAsOf, compareBodyMeasurements, monthlySummary, planStats, validateState} from '../dist/core.js';
import {monthlyShareReport} from '../dist/month-share.js';
import {currentWeightLabel} from '../dist/share.js';

const day = '2026-11-23';
const legacy = {date:day, kg:72.4, bodyFat:null};
const morning = {id:'morning', date:day, time:'07:10', kg:71.9, bodyFat:16};
const evening = {id:'evening', date:day, time:'21:30', kg:72.1, bodyFat:null};
const repeated = {...evening, id:'evening-again', kg:72};
const ids = EXERCISES.map(ex=>ex.id);

test('old daily entries and separate same-minute readings survive backup together', () => {
  const state = blankState();
  state.body = [evening, legacy, repeated, morning];
  const restored = validateState(JSON.parse(JSON.stringify(state)), ids);
  assert.deepEqual(restored.body, state.body);
  assert.deepEqual([...restored.body].sort(compareBodyMeasurements), [legacy, morning, evening, repeated]);
  assert.deepEqual(restored.body[1], legacy);
});

test('malformed times, duplicate IDs and ambiguous legacy rows cannot be restored', () => {
  const state = blankState();
  for (const body of [
    [legacy, {...legacy, kg:80}], [morning, {...morning, date:'2026-11-24'}],
    [{...morning, id:''}], [{...legacy, time:'07:10'}],
    ...['', '7:00', '24:00', '00:60', '08:30:00', 7].map(time=>[{...morning,time}]),
  ]) {
    state.body = body;
    assert.throws(()=>validateState(state, ids), /体重/);
  }
});

test('current, monthly and daily summaries use all readings in local date/time order', () => {
  const state = blankState();
  state.body = [{...legacy, date:'2026-12-01', kg:99}, evening, legacy, repeated, morning];
  const before = structuredClone(state.body);
  const plan = {startDate:'2026-11-01',targetDate:'2026-12-01',startWeight:74,targetWeight:70};
  const endOfDay = new Date(day+'T23:59:00');
  assert.equal(planStats(plan,state.body,day,endOfDay).current,72);
  assert.equal(currentWeightLabel(state.body,day,endOfDay),'現在 72 kg');
  const summary = monthlySummary(state,'2026-11');
  assert.equal(summary.bodyDays,1);
  assert.equal(summary.bodyMeasurements,4);
  assert.equal(summary.firstWeightKg,72.4);
  assert.equal(summary.lastWeightKg,72);
  assert.ok(monthlyShareReport(summary,'kg',true,true).textLines.includes('体重（初回 → 最終） 72.4 → 72 kg'));
  assert.ok(monthlyShareReport(summary,'kg',false,true).textLines.includes('体重の記録日数 1日'));
  const prompt = buildAiPrompt(state,day);
  assert.match(prompt,/当日の体重　時刻未記録 72.4 kg、07:10 71.9 kg、21:30 72.1 kg、21:30 72 kg/);
  assert.ok(!prompt.includes('99 kg'));
  assert.deepEqual(state.body,before);
});

test('current metrics ignore later readings today and include the entire selected past day', () => {
  const clock = new Date(day+'T15:00:00');
  const past = {date:'2026-11-22',time:'23:59',kg:73.8};
  const am = {...morning,time:'07:00'};
  const pm = {...evening,time:'23:00'};
  const records = [past, am, pm, legacy];
  const asOfNow = bodyMeasurementAsOf(day,clock);
  assert.deepEqual(records.filter(asOfNow),[past,am,legacy]);
  assert.equal(asOfNow({...pm,time:'15:00'}),true);
  assert.equal(asOfNow({...pm,time:'15:01'}),false);
  assert.deepEqual(records.filter(bodyMeasurementAsOf(past.date,clock)),[past]);
  const plan = {startDate:'2026-11-01',targetDate:'2026-12-01',startWeight:74,targetWeight:70};
  assert.equal(planStats(plan,records,day,clock).current,am.kg);
  assert.equal(currentWeightLabel(records,day,clock),'現在 71.9 kg');
  assert.equal(currentWeightLabel([pm],day,clock),'現在の体重は未記録');
  assert.equal(currentWeightLabel([pm,legacy],day,clock),'現在 72.4 kg');
});
