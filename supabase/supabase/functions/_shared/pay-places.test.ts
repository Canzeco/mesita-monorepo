// MESITA-3457 — the Pay tab's list: who is listed, in what order, and that
// every row carries the server's card minimum (money rule).

import { assertEquals } from "jsr:@std/assert@1";
import { MIN_CHARGE_CENTS } from "./money.ts";
import { NEAR_RADIUS_M, OPEN_ALL_BELOW, PAY_PLACES_LIMIT, type PayPlaceInput, payPlaces, readLocation } from "./pay-places.ts";

const AT = { lat: 25.6866, lng: -100.3161 };
const minCents = (c: string) => MIN_CHARGE_CENTS[c] ?? 0;

function row(id: string, over: Partial<PayPlaceInput> = {}): PayPlaceInput {
  return {
    place_id: id, name: id, lat: AT.lat, lng: AT.lng, tier: null, mesita_pay: true, currency: "mxn",
    card_ok: true, available_cents: 0, pending_cents: 0, cashback_bps: 0, paid_recent: null, ...over,
  };
}
// ~1 km and ~5 km north of AT.
const north = (km: number) => ({ lat: AT.lat + km / 111.2, lng: AT.lng });

Deno.test("every row carries the server's card minimum", () => {
  const [p] = payPlaces([row("a")], { at: AT, cardPlaceCount: 1, testMode: true, minCents });
  assertEquals(p.card_min_cents, MIN_CHARGE_CENTS.mxn);
  assertEquals(p.test_mode, true);
  assertEquals(p.marks, { tier: null, mesita_pay: true });
});

Deno.test("credit places first, then nearest; places with neither are dropped", () => {
  const rows = [
    row("far-card", north(5)),
    row("near-card", north(1)),
    row("credit-far", { ...north(9), card_ok: false, available_cents: 100_00 }),
    row("nothing", { card_ok: false }),
  ];
  const ids = payPlaces(rows, { at: AT, cardPlaceCount: 2, testMode: false, minCents }).map((p) => p.place_id);
  assertEquals(ids, ["credit-far", "near-card", "far-card"]);
});

Deno.test("pending-only credit still lists the place", () => {
  const ids = payPlaces([row("p", { card_ok: false, pending_cents: 220_00 })], { at: null, cardPlaceCount: 0, testMode: false, minCents })
    .map((p) => p.place_id);
  assertEquals(ids, ["p"]);
});

Deno.test(`below ${OPEN_ALL_BELOW} card places every one is listed; from ${OPEN_ALL_BELOW} on, only within ${NEAR_RADIUS_M} m`, () => {
  const rows = [row("near", north(1)), row("far", north(5)), row("credit-far", { ...north(9), available_cents: 1 })];
  const young = payPlaces(rows, { at: AT, cardPlaceCount: OPEN_ALL_BELOW - 1, testMode: false, minCents }).map((p) => p.place_id);
  assertEquals(young, ["credit-far", "near", "far"]);
  const grown = payPlaces(rows, { at: AT, cardPlaceCount: OPEN_ALL_BELOW, testMode: false, minCents }).map((p) => p.place_id);
  assertEquals(grown, ["credit-far", "near"]);
  const blind = payPlaces(rows, { at: null, cardPlaceCount: OPEN_ALL_BELOW, testMode: false, minCents }).map((p) => p.place_id);
  assertEquals(blind, ["credit-far"]);
});

Deno.test("the answer is capped", () => {
  const rows = Array.from({ length: PAY_PLACES_LIMIT + 10 }, (_, i) => row(`p${i}`));
  assertEquals(payPlaces(rows, { at: AT, cardPlaceCount: 1, testMode: false, minCents }).length, PAY_PLACES_LIMIT);
});

Deno.test("location: both or neither, a bad one names its field", () => {
  assertEquals(readLocation({}), { ok: true, coords: null });
  assertEquals(readLocation({ lat: 25.687, lng: -100.316 }), { ok: true, coords: { lat: 25.687, lng: -100.316 } });
  assertEquals(readLocation({ lat: "25", lng: -100 }), { ok: false, field: "lat" });
  assertEquals(readLocation({ lat: 25 }), { ok: false, field: "lng" });
  assertEquals(readLocation({ lat: 25, lng: 200 }), { ok: false, field: "lng" });
});
