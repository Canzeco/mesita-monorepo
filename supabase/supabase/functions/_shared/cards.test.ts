// MESITA-3523: a remove trusts no payment method id from the browser, and a
// card Premier renews with is never detached from under it.
import { assertEquals } from "jsr:@std/assert@1";
import { cardSetupParams, removeCheck } from "./cards.ts";

Deno.test("removeCheck refuses a card on another customer", () => {
  const r = removeCheck({ id: "pm_1", customer: "cus_other" }, "cus_me", new Set());
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "not_found");
});

Deno.test("removeCheck refuses when the caller has no customer", () => {
  const r = removeCheck({ id: "pm_1", customer: "cus_me" }, null, new Set());
  assertEquals(r.ok, false);
});

Deno.test("removeCheck refuses a card Premier renews with", () => {
  const r = removeCheck({ id: "pm_1", customer: { id: "cus_me" } }, "cus_me", new Set(["pm_1"]));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.code, "in_use");
});

Deno.test("removeCheck lets the owner remove a free card", () => {
  assertEquals(removeCheck({ id: "pm_1", customer: "cus_me" }, "cus_me", new Set()).ok, true);
});

Deno.test("the card Checkout only saves: setup mode, no amount", () => {
  const p = cardSetupParams({ customer: "cus_me", consumerId: "u", returnUrl: "https://mesita.ai/wallet", nowSec: 0 });
  assertEquals(p.mode, "setup");
  assertEquals("line_items" in p, false);
  assertEquals(p.success_url, "https://mesita.ai/wallet?card={CHECKOUT_SESSION_ID}");
});
