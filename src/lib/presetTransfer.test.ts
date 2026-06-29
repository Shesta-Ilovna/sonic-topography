import assert from 'node:assert/strict';
import {
  PRESET_TRANSFER_VERSION,
  createPresetTransferPackage,
  normalizePresetTransferPackage,
  normalizeTransferPlaylists,
  writePresetTransferPackage,
} from './presetTransfer';
import { NETEASE_COOKIE_STORAGE_KEY } from './neteaseCookie';
import { QQ_COOKIE_STORAGE_KEY } from './qqCookie';

const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
  },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

storage.clear();
storage.set(NETEASE_COOKIE_STORAGE_KEY, 'MUSIC_U=abc;\nNMTID=def;');
storage.set(QQ_COOKIE_STORAGE_KEY, 'qqmusic_uin=123;');
let preset = createPresetTransferPackage();
assert.equal(preset.data.neteaseCookie, undefined);
assert.equal(preset.data.qqCookie, undefined);
assert.equal(preset.data.groundEqSettings.terrainDensity, 46);
assert.equal(preset.data.groundEqSettings.floatingBlocksEnabled, true);
assert.equal(preset.data.groundEqSettings.floatingBlockIntensity, 55);
assert.equal(preset.data.groundEqSettings.floatingBlockMinSize, 9);
assert.equal(preset.data.groundEqSettings.floatingBlockMaxSize, 26);
assert.equal(preset.data.groundEqSettings.floatingBlockSpeed, 77);
assert.equal(preset.data.lyricsSettings?.songyancai.maxCharsPerLine, 24);
assert.equal(preset.data.lyricsSettings?.style, 'spatial-wall');
assert.equal(preset.data.lyricsSettings?.['spatial-wall'].spatialOrbitOffset, -38);

preset = createPresetTransferPackage({ includeCookies: true });
assert.equal(preset.data.neteaseCookie, 'MUSIC_U=abc; NMTID=def');
assert.equal(preset.data.qqCookie, 'qqmusic_uin=123; uin=123');

assert.throws(() => normalizePresetTransferPackage({ app: 'sonic-topography', version: 999, data: {} }), /Sonic Topography/);

const playlists = normalizeTransferPlaylists([{ id: 'custom', name: 'Custom', songs: [{ id: '123', name: 'Song' }] }]);
assert.equal(playlists[0].id, 'favorites');
assert.equal(playlists[1].songs[0].id, 123);

const legacyPresetPackage = {
  app: 'sonic-topography',
  version: PRESET_TRANSFER_VERSION,
  exportedAt: '2026-01-01T00:00:00.000Z',
  data: {
    playlists,
    triggerSettings: {
      Pulse: { threshold: 2, cooldown: 999 },
      Meteor: { enabled: true },
    },
    groundEqSettings: {
      bands: [120, -2, 50],
      motionSpeed: 130,
      terrainDensity: 130,
      floatingBlocksEnabled: false,
      floatingBlockIntensity: 130,
      floatingBlockMinSize: -10,
      floatingBlockMaxSize: 140,
      floatingBlockSpeed: 125,
    },
    customThemes: [{ id: 'custom-a', name: 'A', background: '#000000', cool: '#111111', warm: '#222222', accent: '#333333', glowIntensity: 5 }],
    activeCustomThemeId: 'custom-a',
    activeThemeId: 'custom',
    themeRotation: { enabled: true, intervalSeconds: 1, themeIds: ['custom-a'] },
    lyricsSettings: {
      style: 'spatial-wall',
      songyancai: { maxCharsPerLine: -1 },
      'dynamic-bounce': { maxCharsPerLine: 18 },
      'spatial-wall': { maxCharsPerLine: 999 },
    },
    neteaseCookie: 'MUSIC_U=xyz;',
  },
};

const imported = writePresetTransferPackage(legacyPresetPackage as any);

assert.equal(imported.data.triggerSettings.Pulse?.threshold, 1);
assert.equal(imported.data.triggerSettings.Pulse?.cooldown, 300);
assert.deepEqual(imported.data.groundEqSettings.bands.slice(0, 3), [100, 0, 50]);
assert.equal(imported.data.groundEqSettings.motionSpeed, 100);
assert.equal(imported.data.groundEqSettings.terrainDensity, 100);
assert.equal(imported.data.groundEqSettings.floatingBlocksEnabled, false);
assert.equal(imported.data.groundEqSettings.floatingBlockIntensity, 100);
assert.equal(imported.data.groundEqSettings.floatingBlockMinSize, 0);
assert.equal(imported.data.groundEqSettings.floatingBlockMaxSize, 100);
assert.equal(imported.data.groundEqSettings.floatingBlockSpeed, 100);
assert.equal(imported.data.customThemes[0].glowIntensity, 2.2);
assert.equal(imported.data.customThemes[0].fog, '#000000');
assert.equal(imported.data.customThemes[0].fogLinkedToBackground, true);
assert.equal(imported.data.lyricsSettings?.songyancai.maxCharsPerLine, 8);
assert.equal(imported.data.lyricsSettings?.['dynamic-bounce'].maxCharsPerLine, 18);
assert.equal(imported.data.lyricsSettings?.['spatial-wall'].maxCharsPerLine, 48);
assert.equal(storage.get(NETEASE_COOKIE_STORAGE_KEY), 'MUSIC_U=xyz');

console.log('presetTransfer tests passed');
