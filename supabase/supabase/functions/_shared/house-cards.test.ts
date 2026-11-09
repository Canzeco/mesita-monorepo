import { assertEquals } from "jsr:@std/assert@1";
import { withPins } from "./house-cards.ts";
import type { Balance } from "./wallet.ts";

const held: Balance = {
  place_id: "a",
  currency: "mxn",
  balance_cents: 12000,
  available_cents: 12000,
  pending_cents: 0,
  spendable_cents: 12000,
  last_at: "2026-11-09T10:00:00Z",
  entries: [],
};

Deno.test("a pinned place with no entries is a $0 card after the ones holding money", () => {
  const out = withPins([held], [{ place_id: "b", added_at: "2026-11-09T11:00:00Z" }], "mxn");
  assertEquals(out.map((b) => [b.place_id, b.balance_cents, b.pinned]), [["a", 12000, false], ["b", 0, true]]);
});

Deno.test("a pinned place that holds money is never listed twice and keeps its balance", () => {
  const out = withPins([held], [{ place_id: "a", added_at: "2026-11-09T11:00:00Z" }], "mxn");
  assertEquals(out.length, 1);
  assertEquals([out[0].balance_cents, out[0].pinned], [12000, true]);
});
