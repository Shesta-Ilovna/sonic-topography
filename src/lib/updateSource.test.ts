import { strict as assert } from 'node:assert';
import { normalizeUpdateSource } from './updateSource';

assert.deepEqual(normalizeUpdateSource(undefined), {
  configured: false,
  provider: 'github',
  owner: '',
  repo: '',
});

assert.deepEqual(normalizeUpdateSource({ provider: 'github', owner: ' yin ', repo: ' sonic-topography ' }), {
  configured: true,
  provider: 'github',
  owner: 'yin',
  repo: 'sonic-topography',
});

assert.deepEqual(normalizeUpdateSource({ owner: 'yin/sonic-topography' }), {
  configured: true,
  provider: 'github',
  owner: 'yin',
  repo: 'sonic-topography',
});

console.log('updateSource tests passed');
