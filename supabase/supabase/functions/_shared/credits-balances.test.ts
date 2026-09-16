// Guards for the real-balance grouping/ranking/pagination (MESITA-1674,
// re-scoped to the place by MESITA-1892). Pure functions taking an explicit
// nowMs, exactly like the emulator these replace kept its own rules testable
// without faking globals.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  clampLimit,
  type CreditLotRow,
  groupCreditLotsByPlace,
  paginatePlaceBalances,
  rankPlaceBalances,
} from "./credits-balances.ts";

const T0 = 1_700_000_000_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function lot(partial: Partial<CreditLotRow> & { placeId: string }): CreditLotRow {
  return {
    id: crypto.randomUUID(),
    paidCents: 100_000,
    bonusCents: 5_000,
    spentCents: 0,
    currency: "MXN",
    activatesAt: new Date(T0).toISOString(),
    expiresAt: new Date(T0 + 90 * DAY_MS).toISOString(),
    createdAt: new Date(T0).toISOString(),
    ...partial,
  };
}

Deno.test("groups lots by place and sums remaining across them", () => {
  const rows = [
    lot({ placeId: "place_a", paidCents: 50_000, bonusCents: 2_500 }),
    lot({ placeId: "place_a", paidCents: 100_000, bonusCents: 5_000 }),
    lot({ placeId: "place_b", paidCents: 200_000, bonusCents: 10_000 }),
  ];
  const faces = new Map([
    ["place_a", { name: "Tacos", photoUrl: null }],
    ["place_b", { name: "Quincy", photoUrl: null }],
  ]);
  const out = groupCreditLotsByPlace(rows, faces, new Set(), T0);
  assertEquals(out.length, 2);
  const a = out.find((p) => p.placeId === "place_a")!;
  assertEquals(a.lots.length, 2);
  assertEquals(a.totalCents, 52_500 + 105_000);
  assertEquals(a.spendableCents, a.totalCents);
});

Deno.test("every balance wears its place's name and photo — there is no other branch (MESITA-1892)", () => {
  // MESITA-1816 had two cases: one place (wear the place) and two-or-more
  // (wear the organization). The org layer is gone, so the second case cannot
  // be constructed at all — a lot names exactly one place, and that place IS
  // the face. A place whose profile did not come back still gets its balance:
  // money owed never depends on the face resolving.
  const rows = [lot({ placeId: "p1" }), lot({ placeId: "p2" })];
  const faces = new Map([["p1", { name: "Taquería X", photoUrl: "https://x/p1.jpg" }]]);
  const out = groupCreditLotsByPlace(rows, faces, new Set(), T0);
  const by = (id: string) => out.find((p) => p.placeId === id)!;
  assertEquals(by("p1").placeName, "Taquería X");
  assertEquals(by("p1").photoUrl, "https://x/p1.jpg");
  assertEquals(by("p2").placeName, "A Mesita place");
  assertEquals(by("p2").photoUrl, null);
  assertEquals(out.length, 2);
});

Deno.test("a spend takes principal first, so remaining paid is exact for the bonus split", () => {
  // 100_000 paid + 5_000 bonus, 60_000 spent: principal-first means all 60_000
  // came out of the 100_000 paid half, leaving 40_000 paid + 5_000 bonus.
  const rows = [lot({ placeId: "place_a", paidCents: 100_000, bonusCents: 5_000, spentCents: 60_000 })];
  const out = groupCreditLotsByPlace(rows, new Map(), new Set(), T0);
  assertEquals(out[0].paidCents, 40_000);
  assertEquals(out[0].totalCents, 45_000);
});

Deno.test("a pending lot (activates in the future) counts as pending, not spendable", () => {
  const rows = [
    lot({
      placeId: "place_a",
      activatesAt: new Date(T0 + 3 * HOUR_MS).toISOString(),
    }),
  ];
  const out = groupCreditLotsByPlace(rows, new Map(), new Set(), T0);
  assertEquals(out[0].spendableCents, 0);
  assertEquals(out[0].pendingCents, 105_000);
  assertEquals(out[0].nearestActivationAt, new Date(T0 + 3 * HOUR_MS).toISOString());
  assertEquals(out[0].nearestExpiryAt, null);
});

Deno.test("an expired lot still reports its remaining amount in totalCents, but not spendable/pending", () => {
  const rows = [lot({ placeId: "place_a", expiresAt: new Date(T0 - DAY_MS).toISOString() })];
  const out = groupCreditLotsByPlace(rows, new Map(), new Set(), T0);
  assertEquals(out[0].totalCents, 105_000);
  assertEquals(out[0].spendableCents, 0);
  assertEquals(out[0].pendingCents, 0);
  // Expired money is excluded from the "still-unspent principal" figure too —
  // it is dead, not draw-able, so it should not inflate what reads as "you paid".
  assertEquals(out[0].paidCents, 0);
});

Deno.test("nearestExpiryAt/nearestActivationAt pick the SOONEST across multiple lots", () => {
  const soon = new Date(T0 + 2 * DAY_MS).toISOString();
  const later = new Date(T0 + 40 * DAY_MS).toISOString();
  const rows = [
    lot({ placeId: "place_a", expiresAt: later }),
    lot({ placeId: "place_a", expiresAt: soon }),
  ];
  const out = groupCreditLotsByPlace(rows, new Map(), new Set(), T0);
  assertEquals(out[0].nearestExpiryAt, soon);
});

Deno.test("acceptsMoreCredits mirrors the provided set, per place", () => {
  const rows = [lot({ placeId: "place_a" }), lot({ placeId: "place_b" })];
  const out = groupCreditLotsByPlace(rows, new Map(), new Set(["place_a"]), T0);
  assertEquals(out.find((p) => p.placeId === "place_a")!.acceptsMoreCredits, true);
  assertEquals(out.find((p) => p.placeId === "place_b")!.acceptsMoreCredits, false);
});

Deno.test("rankPlaceBalances: spendable before pending before dead, by tier first", () => {
  const spendable = groupCreditLotsByPlace(
    [lot({ placeId: "spendable", paidCents: 1_000, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  const pending = groupCreditLotsByPlace(
    [lot({ placeId: "pending", activatesAt: new Date(T0 + HOUR_MS).toISOString(), paidCents: 999_999, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  const dead = groupCreditLotsByPlace(
    [lot({ placeId: "dead", expiresAt: new Date(T0 - 1).toISOString(), paidCents: 999_999, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  // Deliberately shuffled and sized so tier alone must decide the order —
  // a size-based sort would put "pending"/"dead" first since they hold more.
  const ranked = rankPlaceBalances([dead, pending, spendable]);
  assertEquals(ranked.map((p) => p.placeId), ["spendable", "pending", "dead"]);
});

Deno.test("rankPlaceBalances: within a tier, biggest total first, then name", () => {
  const small = groupCreditLotsByPlace(
    [lot({ placeId: "b_small", paidCents: 10_000, bonusCents: 0 })],
    new Map([["b_small", { name: "B Small", photoUrl: null }]]),
    new Set(),
    T0,
  )[0];
  const big = groupCreditLotsByPlace(
    [lot({ placeId: "a_big", paidCents: 500_000, bonusCents: 0 })],
    new Map([["a_big", { name: "A Big", photoUrl: null }]]),
    new Set(),
    T0,
  )[0];
  const ranked = rankPlaceBalances([small, big]);
  assertEquals(ranked.map((p) => p.placeId), ["a_big", "b_small"]);
});

Deno.test("clampLimit: defaults, ceilings, and rejects garbage", () => {
  assertEquals(clampLimit(undefined), 20);
  assertEquals(clampLimit(0), 20);
  assertEquals(clampLimit(-5), 20);
  assertEquals(clampLimit("nope"), 20);
  assertEquals(clampLimit(10), 10);
  assertEquals(clampLimit(500), 50);
});

Deno.test("paginatePlaceBalances: pages through, and stops handing back a cursor at the end", () => {
  const places = Array.from({ length: 45 }, (_, i) =>
    groupCreditLotsByPlace(
      [lot({ placeId: `place_${i}`, paidCents: 1_000 * (45 - i), bonusCents: 0 })],
      new Map(),
      new Set(),
      T0,
    )[0]);
  const ranked = rankPlaceBalances(places);

  const page1 = paginatePlaceBalances(ranked, null, 20);
  assertEquals(page1.page.length, 20);
  assert(page1.nextCursor !== null);
  assertEquals(page1.page[0].placeId, "place_0");

  const page2 = paginatePlaceBalances(ranked, page1.nextCursor, 20);
  assertEquals(page2.page.length, 20);
  assertEquals(page2.page[0].placeId, "place_20");
  assert(page2.nextCursor !== null);

  const page3 = paginatePlaceBalances(ranked, page2.nextCursor, 20);
  assertEquals(page3.page.length, 5);
  assertEquals(page3.nextCursor, null);
});

Deno.test("paginatePlaceBalances: a garbage cursor is treated as the start, not a crash", () => {
  const places = groupCreditLotsByPlace(
    [lot({ placeId: "place_a" })],
    new Map(),
    new Set(),
    T0,
  );
  const out = paginatePlaceBalances(places, "not-a-number", 20);
  assertEquals(out.page.length, 1);
});
