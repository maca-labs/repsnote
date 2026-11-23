import assert from 'node:assert/strict';
import test from 'node:test';
import {createTimerSound} from '../dist/timer-sound.js';

function audioBrowser() {
  const contexts = [];
  class AudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    tones = [];
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() {
      return {
        gain:{setValueAtTime(){}, linearRampToValueAtTime(){}},
        connect(target){this.target = target;}, disconnect(){this.target = null;},
      };
    }
    createOscillator() {
      const tone = {
        notes:[], frequency:{setValueAtTime(value, time){tone.notes.push({value,time});}},
        connect(target){this.target = target;}, disconnect(){this.target = null;},
        start(time){this.startTime = time;}, stop(time){this.stopTime = time;},
      };
      this.tones.push(tone);
      return tone;
    }
  }
  return {AudioContext, contexts, navigator:{userActivation:{isActive:true}}};
}

test('arming requires activation, stays silent and reuses the same output until muted', async () => {
  const win = audioBrowser();
  const sound = createTimerSound(win);
  win.navigator.userActivation.isActive = false;
  assert.equal(sound.play(), false);
  assert.equal(await sound.arm(), false);
  assert.equal(win.contexts.length, 0);
  win.navigator.userActivation.isActive = true;
  assert.equal(await sound.arm(), true);
  assert.equal(await sound.arm(), true);
  assert.equal(win.contexts.length, 1);
  const [context] = win.contexts;
  assert.equal(context.tones.length, 0);

  win.navigator.userActivation.isActive = false;
  assert.equal(sound.play(), true);
  assert.equal(context.tones.length, 1);
  const [tone] = context.tones;
  const gain = tone.target;
  assert.equal(gain.target, context.destination);
  assert.ok(tone.startTime >= context.currentTime && tone.stopTime - tone.startTime < 1);
  assert.ok(tone.notes[1].value > tone.notes[0].value);
  tone.onended();
  assert.equal(tone.target, null);
  assert.equal(gain.target, null);
  await sound.disarm();
  assert.equal(context.state, 'closed');
  assert.equal(sound.play(), false);
});

test('missing or suspended output is silent and an interrupted context can be rearmed', async () => {
  const missing = createTimerSound({});
  assert.equal(await missing.arm(), false);
  assert.equal(missing.play(), false);
  const win = audioBrowser();
  win.webkitAudioContext = win.AudioContext;
  delete win.AudioContext;
  const sound = createTimerSound(win);
  assert.equal(await sound.arm(), true);
  const [context] = win.contexts;
  context.state = 'interrupted';
  assert.equal(sound.play(), false);
  assert.equal(context.tones.length, 0);
  context.resume = () => Promise.reject(new Error('Audio output denied'));
  assert.equal(await sound.arm(), false);
  assert.equal(sound.play(), false);
  context.resume = async () => { context.state = 'running'; };
  assert.equal(await sound.arm(), true);
  assert.equal(sound.play(), true);
  context.createOscillator = () => { throw new Error('Device disconnected'); };
  assert.equal(sound.play(), false);
});

test('muting while a resume request is pending cannot arm the old context later', async () => {
  const win = audioBrowser();
  let release;
  win.AudioContext.prototype.resume = function () {
    return new Promise(resolve => { release = () => { this.state = 'running'; resolve(); }; });
  };
  const sound = createTimerSound(win);
  const pending = sound.arm();
  await sound.disarm();
  release();
  assert.equal(await pending, false);
  assert.equal(sound.play(), false);
});
