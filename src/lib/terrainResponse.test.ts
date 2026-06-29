import assert from 'node:assert/strict';
import {
  applyKickImpulse,
  clampAnimationBlend,
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

console.log('terrainResponse tests passed');
