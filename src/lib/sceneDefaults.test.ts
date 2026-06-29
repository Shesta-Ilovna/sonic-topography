import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_STATE,
  DEFAULT_GLOBAL_SCENE_SETTINGS,
  GLOBAL_SCENE_SETTINGS_STORAGE_KEY,
  normalizeCameraState,
  readGlobalSceneSettingsStorage,
} from './sceneDefaults';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
};

storage.clear();
assert.deepEqual(readGlobalSceneSettingsStorage(), DEFAULT_GLOBAL_SCENE_SETTINGS);
assert.equal(DEFAULT_GLOBAL_SCENE_SETTINGS.rotationSpeed, 0.15);
assert.deepEqual(DEFAULT_CAMERA_POSITION, [-37.5836298835141, 25.718921008284557, 92.25687558089541]);
assert.deepEqual(DEFAULT_CAMERA_STATE.target, { x: 0, y: 0, z: 0 });
assert.deepEqual(normalizeCameraState({ position: { x: 1 } as any }), {
  position: { x: 1, y: DEFAULT_CAMERA_STATE.position.y, z: DEFAULT_CAMERA_STATE.position.z },
  target: DEFAULT_CAMERA_STATE.target,
});

storage.set(GLOBAL_SCENE_SETTINGS_STORAGE_KEY, '{"rotationSpeed":2}');
assert.deepEqual(readGlobalSceneSettingsStorage(), { rotationSpeed: 2 });

storage.set(GLOBAL_SCENE_SETTINGS_STORAGE_KEY, '{"rotationSpeed":"bad"}');
assert.deepEqual(readGlobalSceneSettingsStorage(), DEFAULT_GLOBAL_SCENE_SETTINGS);

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(currentDir, '../App.tsx'), 'utf8');
const mapSceneSource = readFileSync(resolve(currentDir, '../components/AudioVisualizer/MapScene.tsx'), 'utf8');

assert.match(appSource, /camera=\{\{ position: DEFAULT_CAMERA_POSITION/);
assert.match(appSource, /readGlobalSceneSettingsStorage/);
assert.match(mapSceneSource, /DEFAULT_CAMERA_STATE\.target/);
assert.match(mapSceneSource, /DEFAULT_CAMERA_STATE\.position/);

console.log('sceneDefaults tests passed');
