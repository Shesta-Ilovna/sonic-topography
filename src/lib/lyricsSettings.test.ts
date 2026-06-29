import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_SPATIAL_ORBIT_OFFSET,
  DEFAULT_STYLE_CONFIG,
  MAX_CHARS_PER_LINE_MAX,
  MAX_CHARS_PER_LINE_MIN,
  SPATIAL_ORBIT_OFFSET_MAX,
  SPATIAL_ORBIT_OFFSET_MIN,
  DEFAULT_LYRICS_SETTINGS,
  normalizeLyricsSettings,
} from './lyricsSettings';

assert.equal(DEFAULT_STYLE_CONFIG.maxCharsPerLine, DEFAULT_MAX_CHARS_PER_LINE);
assert.equal(DEFAULT_STYLE_CONFIG.spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);

const empty = normalizeLyricsSettings({});
assert.equal(empty.style, 'spatial-wall');
assert.equal(empty.songyancai.activeFontSize, 43);
assert.equal(empty.songyancai.inactiveFontSize, 15);
assert.equal(empty.songyancai.maxCharsPerLine, DEFAULT_MAX_CHARS_PER_LINE);
assert.equal(empty.songyancai.karaokeColor, '#f21818');
assert.equal(empty['dynamic-bounce'].activeFontSize, 64);
assert.equal(empty['dynamic-bounce'].inactiveFontSize, 16);
assert.equal(empty['dynamic-bounce'].maxCharsPerLine, MAX_CHARS_PER_LINE_MAX);
assert.equal(empty['dynamic-bounce'].followThemeGlow, false);
assert.equal(empty['dynamic-bounce'].karaokeColor, '#969292');
assert.equal(empty['dynamic-bounce'].fontFamily, 'sans-serif');
assert.equal(empty['spatial-wall'].activeFontSize, 30);
assert.equal(empty['spatial-wall'].inactiveFontSize, 28);
assert.equal(empty['spatial-wall'].maxCharsPerLine, 27);
assert.equal(empty['spatial-wall'].position, 'center-left');
assert.equal(empty['spatial-wall'].fontFamily, 'sans-serif');
assert.equal(empty.songyancai.spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);
assert.equal(empty['dynamic-bounce'].spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);
assert.equal(empty['spatial-wall'].spatialOrbitOffset, -38);
assert.deepEqual(empty, DEFAULT_LYRICS_SETTINGS);

const clampedLow = normalizeLyricsSettings({
  style: 'songyancai',
  songyancai: { maxCharsPerLine: -10 },
});
assert.equal(clampedLow.songyancai.maxCharsPerLine, MAX_CHARS_PER_LINE_MIN);

const clampedHigh = normalizeLyricsSettings({
  style: 'spatial-wall',
  'spatial-wall': { maxCharsPerLine: 999 },
});
assert.equal(clampedHigh['spatial-wall'].maxCharsPerLine, MAX_CHARS_PER_LINE_MAX);

const orbitClampedLow = normalizeLyricsSettings({
  style: 'spatial-wall',
  'spatial-wall': { spatialOrbitOffset: -999 },
});
assert.equal(orbitClampedLow['spatial-wall'].spatialOrbitOffset, SPATIAL_ORBIT_OFFSET_MIN);

const orbitClampedHigh = normalizeLyricsSettings({
  style: 'spatial-wall',
  'spatial-wall': { spatialOrbitOffset: 999 },
});
assert.equal(orbitClampedHigh['spatial-wall'].spatialOrbitOffset, SPATIAL_ORBIT_OFFSET_MAX);

const legacyFlat = normalizeLyricsSettings({
  style: 'dynamic-bounce',
  activeFontSize: 44,
  maxCharsPerLine: 18,
});
assert.equal(legacyFlat.songyancai.maxCharsPerLine, 18);
assert.equal(legacyFlat['dynamic-bounce'].maxCharsPerLine, 18);
assert.equal(legacyFlat['spatial-wall'].maxCharsPerLine, 18);
assert.equal(legacyFlat.songyancai.spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);
assert.equal(legacyFlat['dynamic-bounce'].spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);
assert.equal(legacyFlat['spatial-wall'].spatialOrbitOffset, DEFAULT_SPATIAL_ORBIT_OFFSET);

console.log('lyrics settings tests passed');
