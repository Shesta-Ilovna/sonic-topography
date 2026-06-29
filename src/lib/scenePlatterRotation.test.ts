import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mapScenePath = resolve(currentDir, '../components/AudioVisualizer/MapScene.tsx');
const shaderPath = resolve(currentDir, '../components/AudioVisualizer/CustomShaderMaterial.ts');
const uiPath = resolve(currentDir, '../components/UI/UI.tsx');
const source = readFileSync(mapScenePath, 'utf8');
const shaderSource = readFileSync(shaderPath, 'utf8');
const uiSource = readFileSync(uiPath, 'utf8');

assert.match(source, /const visualPlatterRef = useRef<THREE\.Group>\(null\)/);
assert.match(source, /const platterRotationRef = useRef\(0\)/);
assert.doesNotMatch(source, /PLATTER_AUTO_ROTATION_SCALE/);
assert.match(source, /visualPlatterRef\.current\.rotation\.y = platterRotationRef\.current/);
assert.match(source, /platterRotationRef\.current \+= rotationSpeed \* delta/);
const frameStart = source.indexOf('useFrame((state, delta) => {');
const frameEnd = source.indexOf('\n  });', frameStart);
const frameSource = source.slice(frameStart, frameEnd);
assert.ok(frameStart >= 0 && frameEnd > frameStart, 'MapScene should define a useFrame loop');
assert.ok(
  frameSource.indexOf('platterRotationRef.current += rotationSpeed * delta') <
    frameSource.indexOf('if (!materialRef.current) return'),
  'platter auto-rotation should not be blocked by missing materialRef',
);
assert.doesNotMatch(frameSource, /camera\.position/);
assert.match(source, /enableRotate/);
assert.doesNotMatch(source, /enableRotate=\{false\}/);
assert.doesNotMatch(source, /\sautoRotate(?:\s|=)/);
assert.doesNotMatch(source, /autoRotateSpeed/);
assert.match(source, /function toPlatterLocalPoint\(point: THREE\.Vector3\)/);
assert.match(source, /visualPlatterRef\.current\.worldToLocal\(localPointRef\.current\.copy\(point\)\)/);
assert.match(source, /const localPoint = toPlatterLocalPoint\(e\.point\)/);
assert.doesNotMatch(source, /PLATTER_DRAG_ROTATION_SPEED/);
assert.doesNotMatch(source, /platterDragRef/);
assert.doesNotMatch(source, /onPointerMove=\{handlePointerMove\}/);
assert.match(shaderSource, /modelMatrix\s*\*\s*instanceMatrix\s*\*\s*vec4\(pos,\s*1\.0\)/);
assert.match(shaderSource, /gl_Position\s*=\s*projectionMatrix\s*\*\s*viewMatrix\s*\*\s*worldPosition/);
assert.doesNotMatch(shaderSource, /vec4\s+worldPosition\s*=\s*instanceMatrix\s*\*\s*vec4\(pos,\s*1\.0\)/);
const updateCustomThemeStart = uiSource.indexOf('const updateCustomTheme = (patch: Partial<CustomThemeSettings>) => {');
const updateCustomThemeEnd = uiSource.indexOf('\n  const useCustomTheme', updateCustomThemeStart);
assert.ok(updateCustomThemeStart >= 0 && updateCustomThemeEnd > updateCustomThemeStart, 'UI should define updateCustomTheme before useCustomTheme');
const updateCustomThemeSource = uiSource.slice(updateCustomThemeStart, updateCustomThemeEnd);
assert.match(updateCustomThemeSource, /onThemeChange\(CUSTOM_THEME_ID\)/);

console.log('scene platter rotation tests passed');
