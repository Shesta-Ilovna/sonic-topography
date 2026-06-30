import assert from 'node:assert/strict';
import {
  DEFAULT_GROUND_EQ_VALUE,
  DEFAULT_GROUND_MOTION_SPEED,
  DEFAULT_FLOATING_BLOCK_INTENSITY,
  DEFAULT_FLOATING_BLOCK_MAX_SIZE,
  DEFAULT_FLOATING_BLOCK_MIN_SIZE,
  DEFAULT_FLOATING_BLOCK_SPEED,
  DEFAULT_FLOATING_BLOCKS_ENABLED,
  DEFAULT_TERRAIN_DENSITY,
  GROUND_EQ_BAND_COUNT,
  applyGroundEqBandValue,
  defaultGroundEqBands,
  deriveTerrainGridSettings,
  normalizeGroundEqSettings,
  readGroundEqBandValue,
} from './groundEqSettings';

const defaults = normalizeGroundEqSettings(undefined);
assert.equal(defaults.bands.length, GROUND_EQ_BAND_COUNT);
assert.deepEqual(defaults.bands, defaultGroundEqBands);
assert.deepEqual(defaults.bands, [90, 92, 50, 50, 50, 50, 50, 48]);
assert.equal(defaults.motionSpeed, DEFAULT_GROUND_MOTION_SPEED);
assert.equal(defaults.amplitude, 50);
assert.equal(defaults.terrainDensity, DEFAULT_TERRAIN_DENSITY);
assert.equal(defaults.floatingBlocksEnabled, DEFAULT_FLOATING_BLOCKS_ENABLED);
assert.equal(defaults.floatingBlockIntensity, DEFAULT_FLOATING_BLOCK_INTENSITY);
assert.equal(defaults.floatingBlockMinSize, DEFAULT_FLOATING_BLOCK_MIN_SIZE);
assert.equal(defaults.floatingBlockMaxSize, DEFAULT_FLOATING_BLOCK_MAX_SIZE);
assert.equal(defaults.floatingBlockSpeed, DEFAULT_FLOATING_BLOCK_SPEED);
assert.deepEqual(defaults.enabledBands, [true, true, true, true, true, true, true, true]);

const normalized = normalizeGroundEqSettings({
  bands: [120, -5, 49.5, Number.NaN, '70' as unknown as number],
  motionSpeed: 130,
  terrainDensity: 130,
  floatingBlocksEnabled: false,
  floatingBlockIntensity: 130,
  floatingBlockMinSize: -10,
  floatingBlockMaxSize: 140,
  floatingBlockSpeed: 125,
});
assert.deepEqual(normalized.bands.slice(0, 5), [100, 0, 50, DEFAULT_GROUND_EQ_VALUE, 70]);
assert.equal(normalized.bands.length, GROUND_EQ_BAND_COUNT);
assert.equal(normalized.motionSpeed, 100);
assert.equal(normalized.terrainDensity, 100);
assert.equal(normalized.floatingBlocksEnabled, false);
assert.equal(normalized.floatingBlockIntensity, 100);
assert.equal(normalized.floatingBlockMinSize, 0);
assert.equal(normalized.floatingBlockMaxSize, 100);
assert.equal(normalized.floatingBlockSpeed, 100);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, motionSpeed: -5 }).motionSpeed, 0);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, motionSpeed: Number.NaN }).motionSpeed, DEFAULT_GROUND_MOTION_SPEED);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, terrainDensity: -5 }).terrainDensity, 0);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, terrainDensity: Number.NaN }).terrainDensity, DEFAULT_TERRAIN_DENSITY);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlocksEnabled: 'nope' as unknown as boolean }).floatingBlocksEnabled, DEFAULT_FLOATING_BLOCKS_ENABLED);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlockIntensity: -5 }).floatingBlockIntensity, 0);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlockIntensity: Number.NaN }).floatingBlockIntensity, DEFAULT_FLOATING_BLOCK_INTENSITY);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlockMinSize: Number.NaN }).floatingBlockMinSize, DEFAULT_FLOATING_BLOCK_MIN_SIZE);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlockMaxSize: Number.NaN }).floatingBlockMaxSize, DEFAULT_FLOATING_BLOCK_MAX_SIZE);
assert.equal(normalizeGroundEqSettings({ bands: defaultGroundEqBands, floatingBlockSpeed: Number.NaN }).floatingBlockSpeed, DEFAULT_FLOATING_BLOCK_SPEED);

const migrated = normalizeGroundEqSettings({
  curve: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 90, 80, 70, 60, 50],
} as any);
assert.deepEqual(migrated.bands, [0, 20, 40, 60, 80, 90, 80, 50]);
assert.equal(migrated.motionSpeed, DEFAULT_GROUND_MOTION_SPEED);

const singleChanged = normalizeGroundEqSettings({ bands: [50, 50, 85, 50, 50, 50, 50, 50], motionSpeed: 35 });
assert.equal(readGroundEqBandValue(singleChanged.bands, 'lowMid'), 85);
assert.equal(readGroundEqBandValue(singleChanged.bands, 'bass'), 50);
assert.equal(singleChanged.motionSpeed, 35);

assert.deepEqual(
  {
    gridSize: deriveTerrainGridSettings(0).gridSize,
    instanceCount: deriveTerrainGridSettings(0).instanceCount,
  },
  { gridSize: 96, instanceCount: 9216 },
);
assert.deepEqual(
  {
    gridSize: deriveTerrainGridSettings(50).gridSize,
    instanceCount: deriveTerrainGridSettings(50).instanceCount,
  },
  { gridSize: 160, instanceCount: 25600 },
);
assert.equal(deriveTerrainGridSettings(DEFAULT_TERRAIN_DENSITY).gridSize, 155);
assert.deepEqual(
  {
    gridSize: deriveTerrainGridSettings(100).gridSize,
    instanceCount: deriveTerrainGridSettings(100).instanceCount,
  },
  { gridSize: 224, instanceCount: 50176 },
);
assert.equal(deriveTerrainGridSettings(0).terrainSize, deriveTerrainGridSettings(100).terrainSize);
assert.equal(deriveTerrainGridSettings(0).spacing > deriveTerrainGridSettings(100).spacing, true);
assert.equal(deriveTerrainGridSettings(0).boxWidth > deriveTerrainGridSettings(100).boxWidth, true);

assert.equal(applyGroundEqBandValue(0.5, [50, 50, 50, 50, 50, 50, 50, 50], 'subBass'), 0.5);
assert.equal(applyGroundEqBandValue(0.5, [100, 50, 50, 50, 50, 50, 50, 50], 'subBass'), 1);
assert.equal(applyGroundEqBandValue(0.5, [0, 50, 50, 50, 50, 50, 50, 50], 'subBass') < 0.5, true);

console.log('groundEqSettings tests passed');
