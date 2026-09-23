// The closed chip says WHICH day (MESITA-2047). Dos Amores is shut on
// Tuesdays; before this, a guest at 07:00 on Tuesday read "Closed · opens
// 08:30" and expected a table in ninety minutes.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { opensOnDay } = await import(
  pathToFileURL(join(SRC, 'lib', 'opens-on-day.ts')).href
);

const TUE = 2;
const MON = 1;

test('later today stays a bare time', () => {
  assert.equal(opensOnDay(0, TUE, '08:30'), '08:30');
});

test('the next day says tomorrow', () => {
  // Tuesday 07:00 at Dos Amores: shut all day, open Wednesday.
  assert.equal(opensOnDay(1, TUE, '08:30'), 'tomorrow 08:30');
});

test('two or more days out names the weekday', () => {
  // Monday 16:00: Tuesday is shut, so the next opening is Wednesday.
  assert.equal(opensOnDay(2, MON, '08:30'), 'Wed 08:30');
  assert.equal(opensOnDay(6, MON, '08:30'), 'Sun 08:30');
});

test('a week out says next', () => {
  assert.equal(opensOnDay(7, TUE, '08:30'), 'next Tue 08:30');
});

test('computeOpenState puts the day on a later-day opening', () => {
  const src = readFileSync(
    join(SRC, 'lib', 'adapters', 'place-to-detail-helpers.ts'),
    'utf8',
  );
  assert.ok(src.includes('opens_at: opensOnDay(i, dayIdx, ranges[0].open)'));
});
