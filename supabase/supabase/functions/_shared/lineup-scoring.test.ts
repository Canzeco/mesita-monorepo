import { assertEquals } from "jsr:@std/assert@1";
import {
  coerceScoringSettings,
  composeFinalDeck,
  DEFAULT_SCORING_SETTINGS,
  emScore,
  gpScore,
  whenFromOpenness,
  xxControlForLevel,
  xxScore,
} from "./lineup-scoring.ts";

Deno.test("emScore clamps negatives", () => {
  assertEquals(emScore(-0.2), 0);
  assertEquals(emScore(0.8), 0.8);
});

Deno.test("gpScore zero reviews → 0", () => {
  assertEquals(gpScore(0, 4.5), 0);
  assertEquals(gpScore(null, 4.5), 0);
});

Deno.test("whenFromOpenness open-now with patience", () => {
  const bits = new Array(336).fill(false);
  for (let i = 0; i < 6; i++) bits[i] = true; // 3h open now
  const when = whenFromOpenness(bits, 0);
  assertEquals(when > 0.9, true);
});

Deno.test("xxScore control 0 → 1", () => {
  assertEquals(xxScore(0.3, 0), 1);
});

Deno.test("xxControlForLevel reads the rung the consumer picked", () => {
  const xx = { levels: { low: 0, medium: 1, high: 2, extra: 3, max: 5 } };
  assertEquals(xxControlForLevel(xx, 0), 0);
  assertEquals(xxControlForLevel(xx, 4), 5);
  // No level in the request = untouched filter = the low rung.
  assertEquals(xxControlForLevel(xx, null), 0);
  assertEquals(xxControlForLevel(xx, undefined), 0);
  // Out of range clamps onto the ladder rather than falling off it.
  assertEquals(xxControlForLevel(xx, 9), 5);
  assertEquals(xxControlForLevel(xx, -2), 0);
});

Deno.test("coerceScoringSettings: XX rungs are ints 0–5, legacy control → low", () => {
  const table = coerceScoringSettings({
    xx: { levels: { low: 0, medium: 1.6, high: 9, extra: -1, max: 5 } },
  });
  assertEquals(table.xx.levels, { low: 0, medium: 2, high: 5, extra: 0, max: 5 });

  // Pre-table blob: the flat control was the no-filter value → the low rung.
  const legacy = coerceScoringSettings({ xx: { control: 0.1 } });
  assertEquals(legacy.xx.levels, DEFAULT_SCORING_SETTINGS.xx.levels);
  assertEquals(legacy.xx.levels.low, 0);
});

Deno.test("composeFinalDeck keep-lane-on-dupe (MESITA-717)", () => {
  // O and I both top with A; on I's turn A is dupe → keep pulling I → B.
  const deck = composeFinalDeck(
    [
      { id: "A", scores: { organic: 1, inorganic: 0.9 } },
      { id: "B", scores: { organic: 0.5, inorganic: 0.8 } },
      { id: "C", scores: { organic: 0.4, inorganic: 0.1 } },
    ],
    { organic: 2, inorganic: 2 },
  );
  const ids = deck.slots.map((s) => s.id);
  // O places A; on I's turn A is a dupe → keep pulling I → B. Both lanes'
  // top-2 are {A, B}, so C (rank 3) never enters — deck is exactly [A, B].
  assertEquals(ids[0], "A");
  assertEquals(ids[1], "B");
  assertEquals(ids.length, 2);
  assertEquals(ids.includes("C"), false);
});

Deno.test("coerceScoringSettings null → defaults", () => {
  const s = coerceScoringSettings(null);
  assertEquals(s.v, 12);
  assertEquals(s.laneN, DEFAULT_SCORING_SETTINGS.laneN);
});

Deno.test("coerceScoringSettings soft-migrates v10 when keys", () => {
  const s = coerceScoringSettings({
    v: 10,
    sm: { when: { waitFloor: 0.2 }, what: { sibling: 0.6 } },
  });
  assertEquals(s.sm.when.patience, 0.2);
  assertEquals(s.sm.what.tol, 0.6);
});
