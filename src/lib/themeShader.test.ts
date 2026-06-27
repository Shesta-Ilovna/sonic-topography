import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const shaderPath = resolve(currentDir, '../components/AudioVisualizer/CustomShaderMaterial.ts');
const shaderSource = readFileSync(shaderPath, 'utf8');

assert.match(shaderSource, /vec3 brightCool = mix\(coolCore, vec3\(1\.0\), 0\.24\)/);
assert.match(shaderSource, /uniform vec3 uFogColor/);
assert.match(shaderSource, /vec3 backdropColor = uFogColor/);
assert.match(shaderSource, /mix\(finalColor, backdropColor, alphaBlend/);
assert.doesNotMatch(shaderSource, /vec3 atmosphericColor = uFogColor/);
assert.doesNotMatch(shaderSource, /vec3\(0\.4,\s*0\.8,\s*1\.0\)/);

console.log('themeShader tests passed');
