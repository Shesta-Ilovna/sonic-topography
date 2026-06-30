import assert from 'node:assert/strict';
import {
  BEAT_DETECTOR_STORAGE_KEY,
  createBeatDetectorState,
  createBeatTimelineState,
  deriveBeatDetectorParams,
  getBeatLampValue,
  normalizeBeatDetectorSettings,
  readBeatDetectorSettingsStorage,
  stepBeatDetector,
  stepBeatTimeline,
  writeBeatDetectorSettingsStorage,
} from './beatDetector';

function frame(bins: Record<number, number>) {
  const data = new Uint8Array(512);
  for (const [index, value] of Object.entries(bins)) {
    data[Number(index)] = value;
  }
  return data;
}

assert.equal(normalizeBeatDetectorSettings().sensitivity, 100);
assert.equal(normalizeBeatDetectorSettings({ sensitivity: -10 }).sensitivity, 0);
assert.equal(normalizeBeatDetectorSettings({ sensitivity: 120 }).sensitivity, 100);
assert.equal(normalizeBeatDetectorSettings({ sensitivity: Number.NaN }).sensitivity, 100);

const strictParams = deriveBeatDetectorParams({ sensitivity: 0 });
const defaultParams = deriveBeatDetectorParams({ sensitivity: 50 });
const sensitiveParams = deriveBeatDetectorParams({ sensitivity: 100 });
assert.equal(defaultParams.thresholdStdDevGain, 1.8);
assert.equal(defaultParams.thresholdFloor, 0.028);
assert.equal(defaultParams.minTriggerFlux, 0.045);
assert.equal(strictParams.thresholdStdDevGain > defaultParams.thresholdStdDevGain, true);
assert.equal(strictParams.thresholdFloor > defaultParams.thresholdFloor, true);
assert.equal(strictParams.minTriggerFlux > defaultParams.minTriggerFlux, true);
assert.equal(sensitiveParams.thresholdStdDevGain < defaultParams.thresholdStdDevGain, true);
assert.equal(sensitiveParams.thresholdFloor < defaultParams.thresholdFloor, true);
assert.equal(sensitiveParams.minTriggerFlux < defaultParams.minTriggerFlux, true);

let savedStorageValue = '';
const previousWindow = (globalThis as any).window;
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => (key === BEAT_DETECTOR_STORAGE_KEY ? savedStorageValue : null),
    setItem: (key: string, value: string) => {
      if (key === BEAT_DETECTOR_STORAGE_KEY) savedStorageValue = value;
    },
  },
};
writeBeatDetectorSettingsStorage({ sensitivity: 83 });
assert.deepEqual(readBeatDetectorSettingsStorage(), { sensitivity: 83 });
savedStorageValue = '{bad-json';
assert.deepEqual(readBeatDetectorSettingsStorage(), { sensitivity: 100 });
(globalThis as any).window = {
  localStorage: {
    getItem: () => {
      throw new Error('storage blocked');
    },
    setItem: () => {
      throw new Error('storage blocked');
    },
  },
};
assert.doesNotThrow(() => writeBeatDetectorSettingsStorage({ sensitivity: 72 }));
assert.deepEqual(readBeatDetectorSettingsStorage(), { sensitivity: 100 });
(globalThis as any).window = previousWindow;

let state = createBeatDetectorState();
let result = stepBeatDetector({ state, frequencyData: frame({}), deltaSeconds: 1 / 60 });
assert.equal(result.kickOnset, 0);
assert.equal(result.kickLevel, 0);
assert.equal(result.kickEnvelope, 0);

state = createBeatDetectorState();
let sustained = result;
for (let i = 0; i < 120; i++) {
  sustained = stepBeatDetector({
    state,
    frequencyData: frame({ 1: 120, 2: 118, 3: 112 }),
    deltaSeconds: 1 / 60,
  });
  state = sustained.state;
}
assert.equal(sustained.kickOnset, 0);
assert.equal(sustained.kickEnvelope > 0, true);
assert.equal(sustained.kickEnvelope < 0.18, true);

state = createBeatDetectorState();
for (let i = 0; i < 20; i++) {
  result = stepBeatDetector({ state, frequencyData: frame({ 1: 18, 2: 15 }), deltaSeconds: 1 / 60 });
  state = result.state;
}
result = stepBeatDetector({ state, frequencyData: frame({ 1: 240, 2: 235 }), deltaSeconds: 1 / 60 });
state = result.state;
assert.equal(result.kickOnset, 0);
result = stepBeatDetector({ state, frequencyData: frame({ 1: 80, 2: 75 }), deltaSeconds: 1 / 60 });
state = result.state;
assert.equal(result.kickOnset, 1);
assert.equal(result.kickFlux > result.kickThreshold, true);
assert.equal(result.kickEnvelope > 0.2, true);

const repeated = stepBeatDetector({ state, frequencyData: frame({ 1: 250, 2: 245 }), deltaSeconds: 1 / 60 });
assert.equal(repeated.kickOnset, 0);

let strictState = createBeatDetectorState();
let strictResult = stepBeatDetector({
  state: strictState,
  frequencyData: frame({ 1: 26, 2: 26 }),
  deltaSeconds: 1 / 60,
  settings: { sensitivity: 0 },
});
strictState = strictResult.state;
strictResult = stepBeatDetector({
  state: strictState,
  frequencyData: frame({}),
  deltaSeconds: 1 / 60,
  settings: { sensitivity: 0 },
});
assert.equal(strictResult.kickOnset, 0);

let sensitiveState = createBeatDetectorState();
let sensitiveResult = stepBeatDetector({
  state: sensitiveState,
  frequencyData: frame({ 1: 26, 2: 26 }),
  deltaSeconds: 1 / 60,
  settings: { sensitivity: 100 },
});
sensitiveState = sensitiveResult.state;
sensitiveResult = stepBeatDetector({
  state: sensitiveState,
  frequencyData: frame({}),
  deltaSeconds: 1 / 60,
  settings: { sensitivity: 100 },
});
assert.equal(sensitiveResult.kickOnset, 1);

state = createBeatDetectorState();
for (let i = 0; i < 18; i++) {
  result = stepBeatDetector({ state, frequencyData: frame({ 4: i % 2 ? 220 : 30, 5: i % 2 ? 210 : 25 }), deltaSeconds: 1 / 60 });
  state = result.state;
}
assert.equal(result.activeWindow.name, 'Punch');

let timeline = createBeatTimelineState();
timeline = stepBeatTimeline({ state: timeline, now: 1000, onset: true });
timeline = stepBeatTimeline({ state: timeline, now: 2500, onset: true });
timeline = stepBeatTimeline({ state: timeline, now: 6200, onset: false, windowMs: 4000 });
assert.deepEqual(timeline.beats, [2500]);
assert.equal(getBeatLampValue({ now: 2620, lastBeatAt: timeline.lastBeatAt }), 1);
assert.equal(getBeatLampValue({ now: 2850, lastBeatAt: timeline.lastBeatAt }), 0);

console.log('beatDetector tests passed');
