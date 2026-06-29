import assert from 'node:assert/strict';
import {
  ACTIVE_CUSTOM_THEME_STORAGE_KEY,
  ACTIVE_THEME_STORAGE_KEY,
  CUSTOM_THEME_ID,
  createCustomThemeColors,
  DEFAULT_THEME_ID,
  defaultCustomThemeSettings,
  defaultThemeRotationSettings,
  normalizeCustomThemeSettings,
  readActiveCustomThemeStorage,
  readActiveThemeStorage,
  readCustomThemeStorage,
  readThemeRotationStorage,
} from './themes';

const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
  },
};

storage.clear();
assert.equal(DEFAULT_THEME_ID, 'minimal-monochrome');
assert.equal(readActiveThemeStorage(), 'minimal-monochrome');
assert.deepEqual(readCustomThemeStorage(), [defaultCustomThemeSettings]);
assert.equal(defaultCustomThemeSettings.background, '#ffffff');
assert.equal(defaultCustomThemeSettings.cool, '#98d2bf');
assert.equal(defaultCustomThemeSettings.warm, '#ff0000');
assert.equal(defaultCustomThemeSettings.accent, '#95abb1');
assert.equal(readActiveCustomThemeStorage(readCustomThemeStorage()), 'custom-default');
assert.deepEqual(defaultThemeRotationSettings, {
  enabled: false,
  intervalSeconds: 10,
  themeIds: ['neon-tokyo', 'nocturnal', 'cyber-forest', 'minimal-monochrome', 'custom-default', 'ink-wash'],
});
assert.deepEqual(
  readThemeRotationStorage(['ink-wash', 'nocturnal', 'neon-tokyo', 'cyber-forest', 'minimal-monochrome', 'custom-default']),
  defaultThemeRotationSettings,
);

storage.set(ACTIVE_THEME_STORAGE_KEY, 'ink-wash');
assert.equal(readActiveThemeStorage(), 'ink-wash');

storage.set(ACTIVE_THEME_STORAGE_KEY, 'missing-theme');
assert.equal(readActiveThemeStorage(), 'minimal-monochrome');

storage.set(ACTIVE_THEME_STORAGE_KEY, CUSTOM_THEME_ID);
storage.set(ACTIVE_CUSTOM_THEME_STORAGE_KEY, 'custom-default');
assert.equal(readActiveThemeStorage(), CUSTOM_THEME_ID);
assert.equal(readActiveCustomThemeStorage(readCustomThemeStorage()), 'custom-default');

const legacyTheme = normalizeCustomThemeSettings({
  id: 'legacy',
  name: 'Legacy',
  background: '#112233',
  cool: '#223344',
  warm: '#334455',
  accent: '#445566',
});

assert.equal(legacyTheme.fog, '#112233');
assert.equal(legacyTheme.fogLinkedToBackground, true);

const lockedTheme = normalizeCustomThemeSettings({
  ...legacyTheme,
  background: '#123456',
  fog: '#abcdef',
  fogLinkedToBackground: true,
});

assert.equal(lockedTheme.fog, '#123456');
assert.equal(lockedTheme.fogLinkedToBackground, true);

const unlockedTheme = normalizeCustomThemeSettings({
  ...legacyTheme,
  background: '#102030',
  fog: '#405060',
  fogLinkedToBackground: false,
});
const colors = createCustomThemeColors(unlockedTheme);

assert.equal(unlockedTheme.fog, '#405060');
assert.equal(unlockedTheme.fogLinkedToBackground, false);
assert.equal(`#${colors.uBaseColor1.getHexString()}`, '#102030');
assert.notEqual(`#${colors.uBaseColor2.getHexString()}`, '#405060');
assert.equal(`#${colors.uFogColor.getHexString()}`, '#405060');

console.log('themes tests passed');
