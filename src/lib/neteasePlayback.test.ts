import assert from 'node:assert/strict';
import {
  buildNeteasePlayerUrl,
  neteasePlayableUrlCacheKey,
  normalizeNeteaseBitrate,
} from '../../server/netease-playback.mjs';

assert.equal(normalizeNeteaseBitrate('128000'), '128000');
assert.equal(normalizeNeteaseBitrate('192000'), '192000');
assert.equal(normalizeNeteaseBitrate('320000'), '320000');
assert.equal(normalizeNeteaseBitrate(''), '320000');
assert.equal(normalizeNeteaseBitrate('999999'), '320000');

assert.equal(
  buildNeteasePlayerUrl('123', '128000'),
  'https://music.163.com/api/song/enhance/player/url?id=123&ids=%5B123%5D&br=128000',
);

assert.notEqual(
  neteasePlayableUrlCacheKey('123', 'MUSIC_U=abc', '128000'),
  neteasePlayableUrlCacheKey('123', 'MUSIC_U=abc', '320000'),
);

console.log('neteasePlayback tests passed');
