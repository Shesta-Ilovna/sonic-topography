import assert from 'node:assert/strict';
import {
  createKickEnvelopeState,
  stepKickEnvelope,
} from './kickEnvelope';

const idle = stepKickEnvelope({
  state: createKickEnvelopeState(),
  rawKickLevel: 0,
  onset: false,
  deltaSeconds: 1 / 60,
});

assert.equal(idle.kickLevel, 0);
assert.equal(idle.kickOnset, 0);
assert.equal(idle.kickEnvelope, 0);

let sustained = createKickEnvelopeState();
for (let i = 0; i < 90; i++) {
  sustained = stepKickEnvelope({
    state: sustained,
    rawKickLevel: 0.42,
    onset: false,
    deltaSeconds: 1 / 60,
  });
}

assert.equal(sustained.kickOnset, 0);
assert.equal(sustained.kickEnvelope > 0, true);
assert.equal(sustained.kickEnvelope < 0.13, true);

const hit = stepKickEnvelope({
  state: sustained,
  rawKickLevel: 0.85,
  onset: true,
  deltaSeconds: 1 / 60,
});

assert.equal(hit.kickOnset, 1);
assert.equal(hit.kickEnvelope > sustained.kickEnvelope * 3, true);
assert.equal(hit.kickEnvelope <= 1, true);

const released = stepKickEnvelope({
  state: hit,
  rawKickLevel: 0.12,
  onset: false,
  deltaSeconds: 0.2,
});

assert.equal(released.kickOnset, 0);
assert.equal(released.kickEnvelope < hit.kickEnvelope, true);
assert.equal(released.kickEnvelope < hit.kickEnvelope * 0.18, true);
assert.equal(released.kickEnvelope >= released.kickLevel * 0.18, true);

console.log('kickEnvelope tests passed');
