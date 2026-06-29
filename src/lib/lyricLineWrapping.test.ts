import assert from 'node:assert/strict';
import { splitLineToMeasuredWidth, wrapLyricTextLines } from './lyricLineWrapping';

assert.deepEqual(wrapLyricTextLines('一二三四五六七八九十', 4), ['一二三四', '五六七八', '九十']);
assert.deepEqual(wrapLyricTextLines('Too numb to let it hurt', 8), ['Too numb', 'to let', 'it hurt']);
assert.deepEqual(wrapLyricTextLines('singleverylongword', 6), ['single', 'verylo', 'ngword']);
assert.deepEqual(wrapLyricTextLines('  Baby   I am cold  ', 24), ['Baby I am cold']);

const monospaceMeasure = (value: string) => Array.from(value).length;
assert.deepEqual(
  splitLineToMeasuredWidth('In the car pretending I got all the', 32, monospaceMeasure),
  ['In the car pretending I got all', 'the'],
);
assert.deepEqual(
  splitLineToMeasuredWidth('singleverylongword', 6, monospaceMeasure),
  ['single', 'verylo', 'ngword'],
);
assert.deepEqual(
  splitLineToMeasuredWidth('一二三四五六七八九十', 4, monospaceMeasure),
  ['一二三四', '五六七八', '九十'],
);

console.log('lyric line wrapping tests passed');
