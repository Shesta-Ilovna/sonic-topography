import assert from 'node:assert/strict';
import { DEFAULT_DISPLAY_SETTINGS, readDisplaySettingsStorage } from './displaySettings';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
};

storage.clear();
assert.deepEqual(readDisplaySettingsStorage(), DEFAULT_DISPLAY_SETTINGS);
assert.equal(DEFAULT_DISPLAY_SETTINGS.showLeftIcon, true);
assert.equal(DEFAULT_DISPLAY_SETTINGS.showRightIcon, true);
assert.equal(DEFAULT_DISPLAY_SETTINGS.showBottomPlayer, true);
assert.equal(DEFAULT_DISPLAY_SETTINGS.showLyrics, true);
assert.equal(DEFAULT_DISPLAY_SETTINGS.showCover, true);
assert.deepEqual(DEFAULT_DISPLAY_SETTINGS.clock, {
  visible: false,
  position: 'top-center',
  size: 200,
  color: '#f50000',
  followThemeColor: true,
  opacity: 0.7,
});

console.log('displaySettings tests passed');
