// THE DECK IS ALWAYS 50, CYCLED FROM WHATEVER IS REAL (MESITA-2047).
//
// Web Scroll has cycled its deck since MESITA-1703; the swipe deck here served
// one card and then "You're caught up" — with a catalog of one place, that is
// the whole app. Two halves, same shape as diamond-list-copy.test.mts:
//   1. BEHAVIOUR — cycle-deck.ts has no imports, so Node loads it as-is.
//   2. SCAN — SwipeDeck swipes the cycled deck but counts the REAL one, and
//      keeps the engine's banded order on the ranked path.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const { DECK_SIZE, cycleDeck } = await import(
  pathToFileURL(join(SRC, 'lib', 'cycle-deck.ts')).href
);

// A hand-mirrored twin of web's `const DECK_SIZE = 50;`, which web pins in
// place-feed-grid.test.tsx. Not read across packages on purpose: this job only
// runs on mobile paths, so a web-only PR could break it and hand the red to
// the next unrelated mobile PR.
test('the deck is 50, the same as web Scroll', () => {
  assert.equal(DECK_SIZE, 50);
});

test('one place fills the deck with that place', () => {
  const deck = cycleDeck([{ id: 'dos-amores' }]);
  assert.equal(deck.length, 50);
  assert.ok(deck.every((p: { id: string }) => p.id === 'dos-amores'));
});

test('several places repeat in order, never invented', () => {
  const deck = cycleDeck(['a', 'b', 'c']);
  assert.equal(deck.length, 50);
  assert.deepEqual(deck.slice(0, 7), ['a', 'b', 'c', 'a', 'b', 'c', 'a']);
  assert.deepEqual([...new Set(deck)].sort(), ['a', 'b', 'c']);
});

test('an empty catalog stays empty — the real empty state still shows', () => {
  assert.deepEqual(cycleDeck([]), []);
});

test('SwipeDeck swipes the cycled deck and counts the real one', () => {
  const src = readFileSync(join(SRC, 'components', 'swipe', 'SwipeDeck.tsx'), 'utf8');
  assert.ok(src.includes('const cycled = useMemo(() => cycleDeck(deck), [deck]);'));
  assert.ok(src.includes('places={cycled}'));
  assert.ok(src.includes('if (idx >= cycled.length)'));
  // The Filters sheet and the empty states read the REAL deck, never 50.
  assert.ok(src.includes('count: deck.length'));
  assert.ok(src.includes('if (deck.length === 0)'));
  // A repeated id needs the position in its key, or the card never remounts.
  assert.ok(src.includes('key={`${v.id}-${idx}`}'));
});

test('the ranked deck keeps the engine order — no partner float over it', () => {
  const src = readFileSync(join(SRC, 'components', 'swipe', 'SwipeDeck.tsx'), 'utf8');
  const fetchStart = src.indexOf('async function fetchSwipeDeck');
  const fetchFn = src.slice(fetchStart, src.indexOf('} catch (err) {', fetchStart));
  assert.ok(fetchFn.includes('return result.deck;'));
  assert.ok(!fetchFn.includes('sortPartnersFirst('));
});

test('Start over deals the engine order again — never a shuffle', () => {
  // The deck carries closed places behind the open ones since MESITA-2047; a
  // shuffle on restart would deal a shut place first.
  const src = readFileSync(join(SRC, 'components', 'swipe', 'SwipeDeck.tsx'), 'utf8');
  const start = src.indexOf('const restart = useCallback');
  assert.ok(start > -1);
  const restart = src.slice(start, src.indexOf('}, [deckQuery, restarting]);', start));
  assert.ok(restart.includes('setOverridePlaces(result.deck);'));
  assert.ok(!restart.includes('shuffleDeck('));
  assert.ok(!restart.includes('sortPartnersFirst('));
});
