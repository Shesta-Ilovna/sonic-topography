import assert from 'node:assert/strict';

let frameId = 1;
let now = 1000;
let nextFrameCallback: FrameRequestCallback | null = null;

(globalThis as any).performance = {
  now: () => now,
};

(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = frameId++;
  nextFrameCallback = callback;
  return id;
};

(globalThis as any).cancelAnimationFrame = () => {};

class MockAudio {
  public crossOrigin = '';
  public src = '';
  public currentTime = 0;
  public duration = 0;
  public volume = 1;
  public addEventListener() {}
  public load() {}
  public play() {
    return Promise.resolve();
  }
  public pause() {}
}

(globalThis as any).Audio = MockAudio;

const { AudioEngine } = await import('./AudioEngine');
const engine = new AudioEngine();
assert.deepEqual(engine.getBeatDetectorSettings(), { sensitivity: 100 });
engine.setBeatDetectorSettings({ sensitivity: 87 });
assert.deepEqual(engine.getBeatDetectorSettings(), { sensitivity: 87 });
const data = new Uint8Array(512).fill(0);
data[0] = 255;
data[2] = 128;
data[20] = 64;

let analyserReads = 0;
(engine as any).analyser = {
  getByteFrequencyData(target: Uint8Array) {
    analyserReads += 1;
    target.set(data);
  },
};
(engine as any).dataArray = new Uint8Array(512);
engine.isPlaying = true;

const first = engine.getAudioData();
const second = engine.getAudioData();

assert.equal(typeof first.kickLevel, 'number');
assert.equal(typeof first.kickFlux, 'number');
assert.equal(typeof first.kickThreshold, 'number');
assert.equal(typeof first.kickOnset, 'number');
assert.equal(typeof first.kickEnvelope, 'number');
assert.equal(typeof first.kickConfidence, 'number');
assert.equal(typeof first.kickWindowName, 'string');
assert.equal(typeof first.kickWindowStart, 'number');
assert.equal(typeof first.kickWindowEnd, 'number');
assert.equal(first.kickLevel >= 0, true);
assert.equal(first.kickFlux >= 0, true);
assert.equal(first.kickThreshold >= 0, true);
assert.equal(first.kickOnset >= 0, true);
assert.equal(first.kickEnvelope >= 0, true);
assert.equal(first.kickConfidence >= 0, true);
assert.equal(analyserReads, 1);
assert.deepEqual(second, first);

now += 20;
nextFrameCallback?.(now);
engine.getAudioData();

assert.equal(analyserReads, 2);

console.log('audioFrameCache tests passed');
