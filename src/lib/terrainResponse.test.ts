import assert from 'node:assert/strict';
import {
  applyKickImpulse,
  clampAnimationBlend,
  deriveKickFollowLowBands,
  mixKickIntoLowBands,
  stepKickDeform,
} from './terrainResponse';

assert.equal(clampAnimationBlend(0), 0);
assert.equal(clampAnimationBlend(0.5), 0.5);
assert.equal(clampAnimationBlend(1.5), 1);

let target = applyKickImpulse(0, 6);
assert.equal(target <= 0.75, true);

const stepped = stepKickDeform({ current: 0.2, target, delta: 0.25 });
assert.equal(stepped.current >= 0, true);
assert.equal(stepped.target >= 0, true);
assert.equal(stepped.current <= 0.75, true);
assert.equal(stepped.target <= 0.75, true);

const mixed = mixKickIntoLowBands({ subBass: 0.9, bass: 0.85, kickDeform: 0.75 });
assert.equal(mixed.subBass <= 1.2, true);
assert.equal(mixed.bass <= 1.15, true);

const silentKick = deriveKickFollowLowBands({
  kickEnvelope: 0,
  subBassEnergy: 0,
  bassEnergy: 0,
  bands: [100, 100, 50, 50, 50, 50, 50, 50],
  enabledBands: [true, true, true, true, true, true, true, true],
});
assert.equal(silentKick.subBass, 0);
assert.equal(silentKick.bass, 0);

const restingLowBands = deriveKickFollowLowBands({
  kickEnvelope: 0,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [90, 92, 50, 50, 50, 50, 50, 48],
  enabledBands: [true, true, true, true, true, true, true, true],
});
assert.equal(restingLowBands.subBass > 0.15, true);
assert.equal(restingLowBands.subBass < 0.35, true);
assert.equal(restingLowBands.bass > 0.15, true);
assert.equal(restingLowBands.bass < 0.35, true);

const defaultKick = deriveKickFollowLowBands({
  kickEnvelope: 0.4,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [90, 92, 50, 50, 50, 50, 50, 48],
  enabledBands: [true, true, true, true, true, true, true, true],
});
const mediumKick = deriveKickFollowLowBands({
  kickEnvelope: 0.25,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [90, 92, 50, 50, 50, 50, 50, 48],
  enabledBands: [true, true, true, true, true, true, true, true],
});
const neutralKick = deriveKickFollowLowBands({
  kickEnvelope: 0.4,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [50, 50, 50, 50, 50, 50, 50, 50],
  enabledBands: [true, true, true, true, true, true, true, true],
});
const boostedKick = deriveKickFollowLowBands({
  kickEnvelope: 0.4,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [100, 100, 50, 50, 50, 50, 50, 50],
  enabledBands: [true, true, true, true, true, true, true, true],
});
assert.equal(defaultKick.subBass > 0, true);
assert.equal(defaultKick.bass > 0, true);
assert.equal(defaultKick.subBass > restingLowBands.subBass * 3, true);
assert.equal(defaultKick.bass > restingLowBands.bass * 3, true);
assert.equal(defaultKick.subBass > 1.0, true);
assert.equal(defaultKick.bass > 1.0, true);
assert.equal(mediumKick.subBass > 1.1, true);
assert.equal(mediumKick.bass > 1.05, true);
assert.equal(defaultKick.subBass > neutralKick.subBass, true);
assert.equal(defaultKick.bass > neutralKick.bass, true);
assert.equal(boostedKick.subBass >= defaultKick.subBass, true);
assert.equal(boostedKick.bass >= defaultKick.bass, true);

const disabledKick = deriveKickFollowLowBands({
  kickEnvelope: 0.4,
  subBassEnergy: 0.36,
  bassEnergy: 0.42,
  bands: [100, 100, 50, 50, 50, 50, 50, 50],
  enabledBands: [false, false, true, true, true, true, true, true],
});
assert.equal(disabledKick.subBass, 0);
assert.equal(disabledKick.bass, 0);

const clampedKick = deriveKickFollowLowBands({
  kickEnvelope: 9,
  subBassEnergy: 1,
  bassEnergy: 1,
  bands: [100, 100, 50, 50, 50, 50, 50, 50],
  enabledBands: [true, true, true, true, true, true, true, true],
});
assert.equal(clampedKick.subBass <= 1.2, true);
assert.equal(clampedKick.bass <= 1.15, true);

console.log('terrainResponse tests passed');
