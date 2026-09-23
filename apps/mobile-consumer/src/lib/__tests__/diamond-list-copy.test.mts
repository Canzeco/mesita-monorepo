// THE DIAMOND LIST, AND NOTHING IN BETWEEN (Pato, MESITA-2044: "there are no
// classes, either you are diamond or you are not ... Diamond List").
//
// This package had no test runner, and a guest-facing string is exactly the
// thing typecheck, lint and the web export all wave through. So: Node's own
// runner (`pnpm test` → `node --test`), no new dependency.
//
// Two halves:
//   1. BEHAVIOUR — consumer-identity.ts has no imports, so Node loads it as-is
//      (type stripping) and the helpers are asserted string for string. These
//      are the strings web's twin must match character for character.
//   2. SCAN — every guest-facing module this lane owns, comments stripped,
//      must not print a metal, VIP, a ladder word, or "Diamond" alone as a
//      status. It FAILS the moment someone puts "Bronze" or "You're Diamond"
//      back on a screen.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const identity = await import(
  pathToFileURL(join(SRC, 'lib', 'consumer-identity.ts')).href
);

const facts = (diamond: boolean, unknown = false) => ({
  diamond,
  igConnected: false,
  igHandle: null,
  igFollowers: 0,
  igReach: false,
  unknown,
});
const ON = facts(true);
const OFF = facts(false);

test('the name is always both words', () => {
  assert.equal(identity.DIAMOND_LIST, 'Diamond List');
  assert.equal(identity.DIAMOND_LIST_ES, 'Lista Diamante');
});

test('Me grid tile summary', () => {
  assert.equal(identity.diamondSummary(ON), "You're on it");
  assert.equal(identity.diamondSummary(OFF), 'Ask to join');
});

test('Me header chip label and its accessibility label', () => {
  assert.equal(identity.diamondChipLabel(ON), 'Diamond List');
  assert.equal(identity.diamondChipLabel(OFF), 'Ask to join');
  assert.equal(identity.diamondChipA11y(ON), "Diamond List: You're on it");
  assert.equal(identity.diamondChipA11y(OFF), 'Diamond List: Ask to join');
});

test('identity header accessibility label', () => {
  assert.equal(
    identity.identityHeaderA11y(ON),
    'Your Mesita identity, on the Diamond List',
  );
  assert.equal(identity.identityHeaderA11y(OFF), 'Your Mesita identity');
});

test('Diamond List page headline and how line', () => {
  assert.equal(identity.diamondHeadline(ON), "You're on the Diamond List");
  assert.equal(identity.diamondHeadline(OFF), "You're not on the list yet");
  assert.equal(
    identity.DIAMOND_LIST_HOW,
    'The Diamond List is invitation-only. Ask Mesita to join, or enter a PIN if someone gave you one.',
  );
  assert.equal(identity.diamondNote(OFF), identity.DIAMOND_LIST_HOW);
});

test('request body, PIN, member number, Help, rate rows', () => {
  assert.equal(
    identity.DIAMOND_LIST_REQUEST_BODY,
    "Hi Mesita — I'd like to join the Diamond List.\n\nWho I am:\n",
  );
  assert.equal(
    identity.DIAMOND_LIST_PIN_SUBTITLE,
    'Ten digits. It puts you on the Diamond List.',
  );
  assert.equal(identity.DIAMOND_LIST_PIN_SUCCESS, "You're on the Diamond List.");
  assert.equal(
    identity.DIAMOND_LIST_MEMBER_NUMBER_LINE,
    'Give this number when you ask to join the Diamond List.',
  );
  assert.equal(
    identity.DIAMOND_LIST_HELP_LINE,
    'Every guest gets the base discount. Guests on the Diamond List get more — the list is invitation-only, and you can ask to join from Me.',
  );
  assert.equal(identity.BASE_RATE_LABEL, 'Base');
  assert.equal(identity.BASE_RATE_HINT, 'Every guest, every visit');
  assert.equal(identity.DIAMOND_LIST_RATE_HINT, 'Invitation only');
});

// ── The scan ─────────────────────────────────────────────────────────────

// Every module that prints identity or rates to a guest in this package.
const GUEST_FACING = [
  'lib/consumer-identity.ts',
  'lib/consumer-classes.ts',
  'lib/reward-segments.ts',
  'app/(tabs)/me/index.tsx',
  'app/(tabs)/me/plan.tsx',
  'app/(tabs)/me/diamond/index.tsx',
  'app/(tabs)/me/diamond/invite.tsx',
  'components/me/DiamondModal.tsx',
  'components/me/DiamondEmulator.tsx',
  'components/me/MockControls.tsx',
  'components/me/IdentityHero.tsx',
  'components/me/HelpModal.tsx',
  'components/me/MeProfileSheets.tsx',
  'components/me/AiConnectModal.tsx',
  'components/place/place-detail/reward-matrix.tsx',
  'components/place/place-detail/rewards.tsx',
  'components/rewards/TicketScreen.tsx',
];

/** Source with every comment removed — comments may name the old ladder. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Every string literal and JSX text run — what can reach a screen. */
function printable(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  for (const m of src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    out.push(m[1]);
  }
  return out;
}

/** A module specifier ("@/lib/consumer-classes") is not copy. */
function isSpecifier(s: string): boolean {
  return /^(@\/|\.{1,2}\/|[a-z@][\w@.-]*\/)[\w@/.()[\]-]*$/.test(s);
}

/** A NativeWind className string ("bg-tier-diamond p-4") is not copy. */
function isClassNameLike(s: string): boolean {
  const tokens = s.trim().split(/\s+/);
  return (
    tokens.length > 0 &&
    tokens.every((t) => /^[a-z0-9:/[\].\-!%#]+$/.test(t)) &&
    tokens.some((t) => t.includes('-'))
  );
}

// Case-sensitive: the metals and VIP are proper nouns in copy. `gold` (a
// gradient key) and `aura` (a storage key) stay legal as code.
const BANNED_PROPER = /\b(Bronze|Silver|Gold|VIP|Aura)\b/;
// "Diamond" alone as a status noun. "Diamond List" is the only form.
const BANNED_DIAMOND = /\bDiamond\b(?! List)/;
// Ladder vocabulary in anything that reads as copy.
const BANNED_WORDS =
  /\b(class(es)?|tier(s)?|rank(s)?|rung(s)?|level(s)?|climb(s|ing)?)\b|unlock a higher|rank up/i;

for (const rel of GUEST_FACING) {
  test(`no ladder copy in ${rel}`, () => {
    const code = stripComments(readFileSync(join(SRC, rel), 'utf8'));
    for (const s of printable(code)) {
      if (isSpecifier(s)) continue;
      assert.doesNotMatch(s, BANNED_PROPER, `${rel}: "${s}"`);
      assert.doesNotMatch(s, BANNED_DIAMOND, `${rel}: "${s}"`);
      if (!isClassNameLike(s)) {
        assert.doesNotMatch(s, BANNED_WORDS, `${rel}: "${s}"`);
      }
    }
  });
}

test('the scan itself catches a regression', () => {
  const bad = [
    `<Text>You're Diamond</Text>`,
    `label="Bronze"`,
    `title: 'Not Diamond yet'`,
    `sub="earned, not bought — your class"`,
  ];
  for (const b of bad) {
    const hits = printable(b).some(
      (s) =>
        BANNED_PROPER.test(s) ||
        BANNED_DIAMOND.test(s) ||
        (!isClassNameLike(s) && BANNED_WORDS.test(s)),
    );
    assert.ok(hits, `the scan missed: ${b}`);
  }
});
