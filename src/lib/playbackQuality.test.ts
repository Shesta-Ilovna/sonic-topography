import assert from 'node:assert/strict';
import {
  DEFAULT_PLAYBACK_QUALITY_SETTINGS,
  buildNeteasePlaybackUrl,
  buildQQPlaybackUrl,
  normalizePlaybackQualitySettings,
  readPlaybackQualitySettingsStorage,
  writePlaybackQualitySettingsStorage,
} from './playbackQuality';

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

assert.deepEqual(normalizePlaybackQualitySettings(null), DEFAULT_PLAYBACK_QUALITY_SETTINGS);
assert.deepEqual(normalizePlaybackQualitySettings({ qqQuality: 'lossless', neteaseBitrate: '128000' }), {
  qqQuality: 'lossless',
  neteaseBitrate: '128000',
});
assert.deepEqual(normalizePlaybackQualitySettings({ qqQuality: 'hires', neteaseBitrate: '999' }), DEFAULT_PLAYBACK_QUALITY_SETTINGS);

writePlaybackQualitySettingsStorage({ qqQuality: 'aac', neteaseBitrate: '192000' });
assert.deepEqual(readPlaybackQualitySettingsStorage(), { qqQuality: 'aac', neteaseBitrate: '192000' });

assert.equal(
  buildQQPlaybackUrl('/api/qq/audio', { mid: 'song mid', mediaMid: 'media/mid' }, { qqQuality: 'lossless', neteaseBitrate: '320000' }),
  '/api/qq/audio?mid=song+mid&mediaMid=media%2Fmid&quality=lossless',
);
assert.equal(
  buildNeteasePlaybackUrl('/api/netease/audio', '123', { qqQuality: 'exhigh', neteaseBitrate: '128000' }),
  '/api/netease/audio?id=123&br=128000',
);

console.log('playbackQuality tests passed');
