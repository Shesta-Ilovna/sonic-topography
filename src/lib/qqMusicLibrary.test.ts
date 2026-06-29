import assert from 'node:assert/strict';
import {
  isQQFavoritePlaylistName,
  mapQQPlaylistSummary,
  mapQQPlaylistTrack,
  normalizeQQPlaylistTrackLimit,
  qualityCandidatesFrom,
} from '../../server/qq-music.mjs';

const favorite = mapQQPlaylistSummary({
  dissid: '123',
  diss_name: '我喜欢',
  song_cnt: 42,
  diss_cover: 'cover.jpg',
}, 'created');

assert.equal(favorite.provider, 'qq');
assert.equal(favorite.id, '123');
assert.equal(favorite.name, '我喜欢');
assert.equal(favorite.trackCount, 42);
assert.equal(favorite.isFavorite, true);
assert.equal(isQQFavoritePlaylistName('喜欢的音乐'), true);
assert.equal(isQQFavoritePlaylistName('普通歌单'), false);

const qzone = mapQQPlaylistSummary({
  dissid: 'qz',
  diss_name: 'Qzone 背景音乐',
}, 'collect');
assert.equal(qzone.isLowSignal, true);

const song = mapQQPlaylistTrack({
  songid: 998,
  songmid: 'abcMID',
  name: '晴天',
  album: { name: '叶惠美', mid: 'albumMID' },
  singer: [{ id: 1, mid: 'artistMID', name: '周杰伦' }],
  interval: 269,
  file: { media_mid: 'mediaMID' },
});

assert.equal(song.provider, 'qq');
assert.equal(song.id, 'abcMID');
assert.equal(song.qqId, 998);
assert.equal(song.mid, 'abcMID');
assert.equal(song.mediaMid, 'mediaMID');
assert.equal(song.artist, '周杰伦');
assert.equal(song.album, '叶惠美');
assert.equal(song.duration, 269000);
assert.match(song.cover, /albumMID/);

const defaultQuality = qualityCandidatesFrom('');
assert.equal(defaultQuality[0].level, 'exhigh');
assert.equal(defaultQuality[0].prefix, 'M800');

const explicitLossless = qualityCandidatesFrom('lossless');
assert.equal(explicitLossless[0].level, 'lossless');

const explicitAac = qualityCandidatesFrom('aac');
assert.equal(explicitAac[0].level, 'aac');
assert.equal(explicitAac[0].prefix, 'C400');

assert.equal(normalizeQQPlaylistTrackLimit('all'), 2000);
assert.equal(normalizeQQPlaylistTrackLimit('500'), 500);
assert.equal(normalizeQQPlaylistTrackLimit('5000'), 2000);
assert.equal(normalizeQQPlaylistTrackLimit(''), 500);

console.log('qqMusicLibrary tests passed');
