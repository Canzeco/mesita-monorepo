// MESITA-3457 — the Pay tab's list: who is listed and in what order.
// MESITA-4708: no card places; rows list by credit, outside or offers.

import { assertEquals } from "jsr:@std/assert@1";
import { NEAR_RADIUS_M, OPEN_ALL_BELOW, PAY_PLACES_LIMIT, type PayPlaceInput, payPlaces, readLocation } from "./pay-places.ts";

const AT = { lat: 25.6866, lng: -100.3161 };

function row(id: string, over: Partial<PayPlaceInput> = {}): PayPlaceInput {
  return {
    place_id: id, name: id, lat: AT.lat, lng: AT.lng, tier: null, mesita_pay: true, currency: "mxn",
    available_cents: 0, pending_cents: 0, outside_ok: true, offers_ok: false, paid_recent: null, photo: null, address: null, ...over,
  };
}
// ~1 km and ~5 km north of AT.
const north = (km: number) => ({ lat: AT.lat + km / 111.2, lng: AT.lng });

Deno.test("every row carries the mode and the marks; never a card part (MESITA-4708)", () => {
  const [p] = payPlaces([row("a")], { at: AT, outsidePlaceCount: 1, testMode: true });
  assertEquals("card_ok" in p || "card_min_cents" in p, false);
  assertEquals(p.test_mode, true);
  assertEquals(p.marks, { tier: null, mesita_pay: true });
});

Deno.test("nearest first, credit or not (MESITA-3536); places with neither are dropped", () => {
  const rows = [
    row("far-outside", north(5)),
    row("near-outside", north(1)),
    row("credit-far", { ...north(9), outside_ok: false, available_cents: 100_00 }),
    row("nothing", { outside_ok: false }),
  ];
  const ids = payPlaces(rows, { at: AT, outsidePlaceCount: 2, testMode: false }).map((p) => p.place_id);
  assertEquals(ids, ["near-outside", "far-outside", "credit-far"]);
});

Deno.test("pending-only credit still lists the place", () => {
  const ids = payPlaces([row("p", { outside_ok: false, pending_cents: 220_00 })], { at: null, outsidePlaceCount: 0, testMode: false })
    .map((p) => p.place_id);
  assertEquals(ids, ["p"]);
});

Deno.test(`below ${OPEN_ALL_BELOW} outside places every one is listed; from ${OPEN_ALL_BELOW} on, only within ${NEAR_RADIUS_M} m`, () => {
  const rows = [row("near", north(1)), row("far", north(5)), row("credit-far", { ...north(9), available_cents: 1 })];
  const young = payPlaces(rows, { at: AT, outsidePlaceCount: OPEN_ALL_BELOW - 1, testMode: false }).map((p) => p.place_id);
  assertEquals(young, ["near", "far", "credit-far"]);
  const grown = payPlaces(rows, { at: AT, outsidePlaceCount: OPEN_ALL_BELOW, testMode: false }).map((p) => p.place_id);
  assertEquals(grown, ["near", "credit-far"]);
  const blind = payPlaces(rows, { at: null, outsidePlaceCount: OPEN_ALL_BELOW, testMode: false }).map((p) => p.place_id);
  assertEquals(blind, ["credit-far"]);
});

Deno.test("the answer is capped", () => {
  const rows = Array.from({ length: PAY_PLACES_LIMIT + 10 }, (_, i) => row(`p${i}`));
  assertEquals(payPlaces(rows, { at: AT, outsidePlaceCount: 1, testMode: false }).length, PAY_PLACES_LIMIT);
});

Deno.test("location: both or neither, a bad one names its field", () => {
  assertEquals(readLocation({}), { ok: true, coords: null });
  assertEquals(readLocation({ lat: 25.687, lng: -100.316 }), { ok: true, coords: { lat: 25.687, lng: -100.316 } });
  assertEquals(readLocation({ lat: "25", lng: -100 }), { ok: false, field: "lat" });
  assertEquals(readLocation({ lat: 25 }), { ok: false, field: "lng" });
  assertEquals(readLocation({ lat: 25, lng: 200 }), { ok: false, field: "lng" });
});

// MESITA-3545: a place with a place code is listed (the guest
// types the waiter's code there) and counts toward the radius rule;
// with neither, it is not listed.
Deno.test("an active Mesita place with no offer is listed, past the radius (MESITA-4986)", () => {
  const plain = row("plain", { outside_ok: false, offers_ok: false, on_mesita: true, ...north(9) });
  const ids = payPlaces([plain, row("nothing", { outside_ok: false })], { at: AT, outsidePlaceCount: OPEN_ALL_BELOW, testMode: false })
    .map((p) => p.place_id);
  assertEquals(ids, ["plain"]);
});

Deno.test("payPlaces: an outside-only place is listed and obeys the radius", () => {
  const out = row("o", { outside_ok: true, ...north(0.5) });
  const none = row("n", { outside_ok: false, ...north(0.5) });
  const far = row("f", { outside_ok: true, ...north(9) });
  const small = payPlaces([out, none, far], { at: AT, outsidePlaceCount: 2, testMode: true });
  assertEquals(small.map((p) => [p.place_id, p.outside_ok]), [["o", true], ["f", true]]);
  const big = payPlaces([out, none, far], { at: AT, outsidePlaceCount: 25, testMode: true });
  assertEquals(big.map((p) => p.place_id), ["o"]);
});
