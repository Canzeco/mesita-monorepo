// Guards for the real-balance grouping/ranking/pagination (MESITA-1674).
// Pure functions taking an explicit nowMs, exactly like the emulator these
// replace kept its own rules testable without faking globals.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  clampLimit,
  type CreditLotRow,
  groupCreditLotsByOrganization,
  paginateOrgBalances,
  rankOrgBalances,
} from "./credits-balances.ts";

const T0 = 1_700_000_000_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function lot(partial: Partial<CreditLotRow> & { organizationId: string }): CreditLotRow {
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

Deno.test("groups lots by organization and sums remaining across them", () => {
  const rows = [
    lot({ organizationId: "org_a", paidCents: 50_000, bonusCents: 2_500 }),
    lot({ organizationId: "org_a", paidCents: 100_000, bonusCents: 5_000 }),
    lot({ organizationId: "org_b", paidCents: 200_000, bonusCents: 10_000 }),
  ];
  const names = new Map([["org_a", "Tacos"], ["org_b", "Quincy"]]);
  const out = groupCreditLotsByOrganization(rows, names, new Set(), T0);
  assertEquals(out.length, 2);
  const a = out.find((o) => o.organizationId === "org_a")!;
  assertEquals(a.lots.length, 2);
  assertEquals(a.totalCents, 52_500 + 105_000);
  assertEquals(a.spendableCents, a.totalCents);
});

Deno.test("a spend takes principal first, so remaining paid is exact for the bonus split", () => {
  // 100_000 paid + 5_000 bonus, 60_000 spent: principal-first means all 60_000
  // came out of the 100_000 paid half, leaving 40_000 paid + 5_000 bonus.
  const rows = [lot({ organizationId: "org_a", paidCents: 100_000, bonusCents: 5_000, spentCents: 60_000 })];
  const out = groupCreditLotsByOrganization(rows, new Map(), new Set(), T0);
  assertEquals(out[0].paidCents, 40_000);
  assertEquals(out[0].totalCents, 45_000);
});

Deno.test("a pending lot (activates in the future) counts as pending, not spendable", () => {
  const rows = [
    lot({
      organizationId: "org_a",
      activatesAt: new Date(T0 + 3 * HOUR_MS).toISOString(),
    }),
  ];
  const out = groupCreditLotsByOrganization(rows, new Map(), new Set(), T0);
  assertEquals(out[0].spendableCents, 0);
  assertEquals(out[0].pendingCents, 105_000);
  assertEquals(out[0].nearestActivationAt, new Date(T0 + 3 * HOUR_MS).toISOString());
  assertEquals(out[0].nearestExpiryAt, null);
});

Deno.test("an expired lot still reports its remaining amount in totalCents, but not spendable/pending", () => {
  const rows = [lot({ organizationId: "org_a", expiresAt: new Date(T0 - DAY_MS).toISOString() })];
  const out = groupCreditLotsByOrganization(rows, new Map(), new Set(), T0);
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
    lot({ organizationId: "org_a", expiresAt: later }),
    lot({ organizationId: "org_a", expiresAt: soon }),
  ];
  const out = groupCreditLotsByOrganization(rows, new Map(), new Set(), T0);
  assertEquals(out[0].nearestExpiryAt, soon);
});

Deno.test("acceptsMoreCredits mirrors the provided set, per organization", () => {
  const rows = [lot({ organizationId: "org_a" }), lot({ organizationId: "org_b" })];
  const out = groupCreditLotsByOrganization(rows, new Map(), new Set(["org_a"]), T0);
  assertEquals(out.find((o) => o.organizationId === "org_a")!.acceptsMoreCredits, true);
  assertEquals(out.find((o) => o.organizationId === "org_b")!.acceptsMoreCredits, false);
});

Deno.test("rankOrgBalances: spendable before pending before dead, by tier first", () => {
  const spendable = groupCreditLotsByOrganization(
    [lot({ organizationId: "spendable", paidCents: 1_000, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  const pending = groupCreditLotsByOrganization(
    [lot({ organizationId: "pending", activatesAt: new Date(T0 + HOUR_MS).toISOString(), paidCents: 999_999, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  const dead = groupCreditLotsByOrganization(
    [lot({ organizationId: "dead", expiresAt: new Date(T0 - 1).toISOString(), paidCents: 999_999, bonusCents: 0 })],
    new Map(),
    new Set(),
    T0,
  )[0];
  // Deliberately shuffled and sized so tier alone must decide the order —
  // a size-based sort would put "pending"/"dead" first since they hold more.
  const ranked = rankOrgBalances([dead, pending, spendable]);
  assertEquals(ranked.map((o) => o.organizationId), ["spendable", "pending", "dead"]);
});

Deno.test("rankOrgBalances: within a tier, biggest total first, then name", () => {
  const small = groupCreditLotsByOrganization(
    [lot({ organizationId: "b_small", paidCents: 10_000, bonusCents: 0 })],
    new Map([["b_small", "B Small"]]),
    new Set(),
    T0,
  )[0];
  const big = groupCreditLotsByOrganization(
    [lot({ organizationId: "a_big", paidCents: 500_000, bonusCents: 0 })],
    new Map([["a_big", "A Big"]]),
    new Set(),
    T0,
  )[0];
  const ranked = rankOrgBalances([small, big]);
  assertEquals(ranked.map((o) => o.organizationId), ["a_big", "b_small"]);
});

Deno.test("clampLimit: defaults, ceilings, and rejects garbage", () => {
  assertEquals(clampLimit(undefined), 20);
  assertEquals(clampLimit(0), 20);
  assertEquals(clampLimit(-5), 20);
  assertEquals(clampLimit("nope"), 20);
  assertEquals(clampLimit(10), 10);
  assertEquals(clampLimit(500), 50);
});

Deno.test("paginateOrgBalances: pages through, and stops handing back a cursor at the end", () => {
  const orgs = Array.from({ length: 45 }, (_, i) =>
    groupCreditLotsByOrganization(
      [lot({ organizationId: `org_${i}`, paidCents: 1_000 * (45 - i), bonusCents: 0 })],
      new Map(),
      new Set(),
      T0,
    )[0]);
  const ranked = rankOrgBalances(orgs);

  const page1 = paginateOrgBalances(ranked, null, 20);
  assertEquals(page1.page.length, 20);
  assert(page1.nextCursor !== null);
  assertEquals(page1.page[0].organizationId, "org_0");

  const page2 = paginateOrgBalances(ranked, page1.nextCursor, 20);
  assertEquals(page2.page.length, 20);
  assertEquals(page2.page[0].organizationId, "org_20");
  assert(page2.nextCursor !== null);

  const page3 = paginateOrgBalances(ranked, page2.nextCursor, 20);
  assertEquals(page3.page.length, 5);
  assertEquals(page3.nextCursor, null);
});

Deno.test("paginateOrgBalances: a garbage cursor is treated as the start, not a crash", () => {
  const orgs = groupCreditLotsByOrganization(
    [lot({ organizationId: "org_a" })],
    new Map(),
    new Set(),
    T0,
  );
  const out = paginateOrgBalances(orgs, "not-a-number", 20);
  assertEquals(out.page.length, 1);
});
