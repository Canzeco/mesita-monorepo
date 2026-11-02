// MESITA-3097 — the money rules of a prepayment: what amount is sold, which
// Checkout answer credits a balance, and how entries sum.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { balancesOf, checkPrepayAmount, classifySession, parsePrepayStart, prepayCheckoutParams } from "./wallet.ts";

const PLACE = "00000000-0000-4000-8000-000000003097";
const PURCHASE = "00000000-0000-4000-8000-0000000a3097";

Deno.test("parsePrepayStart: a Mesita return address and a positive whole amount", () => {
  const ok = parsePrepayStart({ place_id: PLACE, amount_cents: 50000, return_url: "https://mesita.ai/web/pay" });
  assert(ok.ok);
  assert(!parsePrepayStart({ place_id: PLACE, amount_cents: 50000, return_url: "https://evil.example/pay" }).ok);
  assert(!parsePrepayStart({ place_id: PLACE, amount_cents: 500.5, return_url: "https://mesita.ai/web/pay" }).ok);
  assert(!parsePrepayStart({ place_id: PLACE, amount_cents: -100, return_url: "https://mesita.ai/web/pay" }).ok);
  assert(!parsePrepayStart({ place_id: "nope", amount_cents: 50000, return_url: "https://mesita.ai/web/pay" }).ok);
});

Deno.test("checkPrepayAmount: whole pesos between 100 and 10,000; unknown currencies refused", () => {
  assertEquals(checkPrepayAmount(10000, "mxn"), null);
  assertEquals(checkPrepayAmount(1000000, "mxn"), null);
  assert(checkPrepayAmount(9900, "mxn"));
  assert(checkPrepayAmount(1000100, "mxn"));
  assert(checkPrepayAmount(50050, "mxn"));
  assert(checkPrepayAmount(50000, "eur"));
});

Deno.test("classifySession: only a paid session of THIS purchase credits", () => {
  const meta = { purchase_id: PURCHASE };
  assertEquals(classifySession({ metadata: meta, payment_status: "paid", payment_intent: "pi_1" }, PURCHASE), {
    kind: "paid",
    paymentIntent: "pi_1",
  });
  assertEquals(classifySession({ metadata: { purchase_id: "other" }, payment_status: "paid" }, PURCHASE).kind, "mismatch");
  assertEquals(classifySession({ metadata: meta, status: "open", payment_status: "unpaid" }, PURCHASE).kind, "pending");
  assertEquals(classifySession({ metadata: meta, status: "complete", payment_status: "unpaid" }, PURCHASE).kind, "pending");
  assertEquals(classifySession({ metadata: meta, status: "expired", payment_status: "unpaid" }, PURCHASE).kind, "expired");
});

Deno.test("prepayCheckoutParams: charges the place's currency, returns with the session id", () => {
  const p = prepayCheckoutParams({
    customer: "cus_1",
    purchaseId: PURCHASE,
    placeId: PLACE,
    consumerId: "c",
    amountCents: 50000,
    currency: "mxn",
    placeName: "Pangea",
    returnUrl: "https://mesita.ai/web/pay",
    nowSec: 0,
  }) as { mode: string; success_url: string; line_items: Array<{ price_data: { currency: string; unit_amount: number } }> };
  assertEquals(p.mode, "payment");
  assertEquals(p.success_url, "https://mesita.ai/web/pay?prepay={CHECKOUT_SESSION_ID}");
  assertEquals(p.line_items[0].price_data, { ...p.line_items[0].price_data, currency: "mxn", unit_amount: 50000 });
});

Deno.test("balancesOf: one balance per place, newest first, entries summed", () => {
  const b = balancesOf([
    { place_id: "a", kind: "prepay", amount_cents: 20000, currency: "mxn", created_at: "2026-11-01T10:00:00Z" },
    { place_id: "b", kind: "prepay", amount_cents: 50000, currency: "mxn", created_at: "2026-11-01T12:00:00Z" },
    { place_id: "a", kind: "prepay", amount_cents: 30000, currency: "mxn", created_at: "2026-11-01T11:00:00Z" },
  ]);
  assertEquals(b.map((x) => [x.place_id, x.balance_cents]), [["b", 50000], ["a", 50000]]);
  assertEquals(b[1].entries.map((e) => e.amount_cents), [30000, 20000]);
});
