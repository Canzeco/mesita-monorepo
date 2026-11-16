// MESITA-3523: a remove trusts no payment method id from the browser, and a
// card Premier renews with is never detached from under it.
import { assertEquals } from "jsr:@std/assert@1";
import { addCardCheck, cardSetupIntentParams, MAX_CARDS, removeCheck } from "./cards.ts";

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

Deno.test("a second card is refused: too_many (MESITA-4168)", () => {
  const r = addCardCheck(MAX_CARDS);
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.status, 409);
    assertEquals(r.code, "too_many");
  }
  assertEquals(addCardCheck(MAX_CARDS - 1).ok, true);
});

Deno.test("the card SetupIntent only saves a card for later charges", () => {
  const p = cardSetupIntentParams({ customer: "cus_me", consumerId: "u" });
  assertEquals(p.customer, "cus_me");
  assertEquals(p.usage, "off_session");
  assertEquals(p.payment_method_types, ["card"]);
  assertEquals("amount" in p, false);
});
