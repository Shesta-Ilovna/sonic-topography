import assert from 'node:assert/strict';
import {
  collectNeteasePlaylistTrackIds,
  mapNeteaseSong,
  mergeNeteasePlaylistTrackDetails,
  normalizeNeteasePlaylistLimit,
} from '../../server/netease-library.mjs';

const partialTracks = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  name: `Track ${index + 1}`,
  ar: [{ name: 'Artist' }],
  al: { name: 'Album', picUrl: `https://example.test/cover-${index + 1}.jpg` },
  dt: 180000,
}));
const fullTrackIds = Array.from({ length: 70 }, (_, index) => ({ id: index + 1 }));
const detailTracks = Array.from({ length: 70 }, (_, index) => ({
  id: index + 1,
  name: `Track ${index + 1}`,
  ar: [{ name: 'Artist' }],
  al: { name: 'Album', picUrl: `https://example.test/cover-${index + 1}.jpg` },
  dt: 180000,
}));

const ids = collectNeteasePlaylistTrackIds({ tracks: partialTracks, trackIds: fullTrackIds }, 'all');
assert.equal(ids.length, 70);
assert.equal(ids[0], '1');
assert.equal(ids[69], '70');

const merged = mergeNeteasePlaylistTrackDetails(partialTracks, detailTracks, ids);
assert.equal(merged.length, 70);
assert.equal(mapNeteaseSong(merged[69]).name, 'Track 70');
assert.equal(mapNeteaseSong(merged[69]).cover, 'https://example.test/cover-70.jpg');

assert.equal(normalizeNeteasePlaylistLimit('all'), 2000);
assert.equal(normalizeNeteasePlaylistLimit('70'), 70);
assert.equal(normalizeNeteasePlaylistLimit('5000'), 2000);

console.log('neteasePlaylist tests passed');
