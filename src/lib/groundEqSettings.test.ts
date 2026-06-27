import assert from 'node:assert/strict';
import {
  DEFAULT_GROUND_EQ_VALUE,
  DEFAULT_GROUND_MOTION_SPEED,
  GROUND_EQ_BAND_COUNT,
  applyGroundEqBandValue,
  defaultGroundEqBands,
  normalizeGroundEqSettings,
  readGroundEqBandValue,
} from './groundEqSettings';

const defaults = normalizeGroundEqSettings(undefined);
assert.equal(defaults.bands.length, GROUND_EQ_BAND_COUNT);
assert.deepEqual(defaults.bands, defaultGroundEqBands);
assert.equal(defaults.bands.every((value) => value === DEFAULT_GROUND_EQ_VALUE), true);
assert.equal(defaults.motionSpeed, DEFAULT_GROUND_MOTION_SPEED);

const normalized = normalizeGroundEqSettings({ bands: [120, -5, 49.5, Number.NaN, '70' as unknown as number], motionSpeed: 130 });
assert.deepEqual(normalized.bands.slice(0, 5), [100, 0, 50, DEFAULT_GROUND_EQ_VALUE, 70]);
assert.equal(normalized.bands.length, GROUND_EQ_BAND_COUNT);
assert.equal(normalized.motionSpeed, 100);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, motionSpeed: -5 }).motionSpeed, 0);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, motionSpeed: Number.NaN }).motionSpeed, DEFAULT_GROUND_MOTION_SPEED);

const migrated = normalizeGroundEqSettings({
  curve: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 90, 80, 70, 60, 50],
} as any);
assert.deepEqual(migrated.bands, [0, 20, 40, 60, 80, 90, 80, 50]);
assert.equal(migrated.motionSpeed, DEFAULT_GROUND_MOTION_SPEED);

const singleChanged = normalizeGroundEqSettings({ bands: [50, 50, 85, 50, 50, 50, 50, 50], motionSpeed: 35 });
assert.equal(readGroundEqBandValue(singleChanged.bands, 'lowMid'), 85);
assert.equal(readGroundEqBandValue(singleChanged.bands, 'bass'), 50);
assert.equal(singleChanged.motionSpeed, 35);

assert.equal(applyGroundEqBandValue(0.5, [50, 50, 50, 50, 50, 50, 50, 50], 'subBass'), 0.5);
assert.equal(applyGroundEqBandValue(0.5, [100, 50, 50, 50, 50, 50, 50, 50], 'subBass'), 1);
assert.equal(applyGroundEqBandValue(0.5, [0, 50, 50, 50, 50, 50, 50, 50], 'subBass') < 0.5, true);

console.log('groundEqSettings tests passed');
