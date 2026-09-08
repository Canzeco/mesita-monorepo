// Credits webhook routing + backstop (MESITA-1676).
//
// No database in the Deno EF suite at all (money-path-efs.smoke.test.ts), so
// the "a Connect-delivered event with Mesita metadata reaches the handler,
// one without does not" contract is proven at the level that's actually
// testable offline: isCreditPurchaseIntentEvent is the exact predicate
// stripe-webhook-handle-event/index.ts's switch calls to route between this
// file's handlers and ticket-payment-intent.ts's, and
// handleCreditPurchaseIntentSucceeded/Failed are tested directly against a
// fake admin client (same style as credits-readiness.test.ts).

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  handleCreditPurchaseIntentFailed,
  handleCreditPurchaseIntentSucceeded,
  isCreditPurchaseIntentEvent,
} from "./credit-payment-intent.ts";

function paymentIntentEvent(
  metadata: Record<string, string>,
  overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.Event {
  return {
    id: "evt_1",
    account: "acct_1",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_1",
        object: "payment_intent",
        metadata,
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

// ─── The routing decision ───────────────────────────────────────────────

Deno.test("a Connect-delivered intent WITH mesita_kind=credit_purchase routes to Credits", () => {
  const event = paymentIntentEvent({ mesita_kind: "credit_purchase" });
  assertEquals(isCreditPurchaseIntentEvent(event), true);
});

Deno.test("a Connect-delivered intent with NO Mesita metadata (a restaurant's own traffic) does not route to Credits", () => {
  const event = paymentIntentEvent({});
  assertEquals(isCreditPurchaseIntentEvent(event), false);
});

Deno.test("a ticket-rail intent (ticket_id metadata, no mesita_kind) does not route to Credits", () => {
  const event = paymentIntentEvent({
    ticket_id: "ticket_1",
    consumer_id: "c_1",
  });
  assertEquals(isCreditPurchaseIntentEvent(event), false);
});

// ─── The backstop handler ───────────────────────────────────────────────

function fakeAdmin(): {
  admin: SupabaseClient;
  rpcCalls: { fn: string; args: unknown }[];
} {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const admin = {
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({
        data: { ok: true, lotId: "lot_1" },
        error: null,
      });
    },
  } as unknown as SupabaseClient;
  return { admin, rpcCalls };
}

Deno.test("succeeded: calls create_credit_lot with every pinned term from metadata, keyed on the intent id", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "c_1",
    paid_cents: "50000",
    bonus_cents: "5000",
    currency: "MXN",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-12-07T10:00:00.000Z",
  });
  await handleCreditPurchaseIntentSucceeded(admin, event);
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "create_credit_lot");
  assertEquals(rpcCalls[0].args, {
    p_organization_id: "org_1",
    p_consumer_id: "c_1",
    p_paid_cents: 50000,
    p_bonus_cents: 5000,
    p_currency: "MXN",
    p_activates_at: "2026-09-08T13:00:00.000Z",
    p_expires_at: "2026-12-07T10:00:00.000Z",
    p_stripe_payment_intent_id: "pi_1",
  });
});

Deno.test("succeeded: missing pinned terms logs and skips rather than writing a malformed lot", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({ mesita_kind: "credit_purchase" }); // no terms
  await handleCreditPurchaseIntentSucceeded(admin, event);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("succeeded: an RPC error throws — the caller rolls back the dedupe marker so Stripe retries", async () => {
  const admin = {
    rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
  } as unknown as SupabaseClient;
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "c_1",
    paid_cents: "50000",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-12-07T10:00:00.000Z",
  });
  let threw = false;
  try {
    await handleCreditPurchaseIntentSucceeded(admin, event);
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test("failed: never throws and never writes — no state to roll back for a Credits purchase", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({ mesita_kind: "credit_purchase" });
  await handleCreditPurchaseIntentFailed(admin, event);
  assertEquals(rpcCalls.length, 0);
});

// ─── The gift branch (MESITA-1677) ──────────────────────────────────────
// Same event type, same mesita_kind — disambiguated by `gift: "1"` alone, so
// these tests exist to prove that ONE extra field steers the whole handler
// to a different RPC without touching the routing predicate above.

Deno.test("succeeded: a gift-flagged intent calls create_credit_gift, not create_credit_lot", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "sender_1", // the SENDER, per chargeGiftCreditsWithMesitaPay's convention
    paid_cents: "50000",
    bonus_cents: "2500",
    currency: "MXN",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-03-07T10:00:00.000Z",
    gift: "1",
    gift_code_hash: "deadbeef",
    gift_claim_expires_at: "2026-03-07T10:00:00.000Z",
    gift_expiry_days: "90",
    gift_note: "Happy birthday",
  });
  await handleCreditPurchaseIntentSucceeded(admin, event);
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "create_credit_gift");
  assertEquals(rpcCalls[0].args, {
    p_organization_id: "org_1",
    p_sender_id: "sender_1",
    p_paid_cents: 50000,
    p_bonus_cents: 2500,
    p_currency: "MXN",
    p_code_hash: "deadbeef",
    p_claim_expires_at: "2026-03-07T10:00:00.000Z",
    p_expiry_days: 90,
    p_note: "Happy birthday",
    p_stripe_payment_intent_id: "pi_1",
  });
});

Deno.test("succeeded: gift_note absent/blank normalizes to null, matching pinnedTerms' own convention", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "sender_1",
    paid_cents: "50000",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-03-07T10:00:00.000Z",
    gift: "1",
    gift_code_hash: "deadbeef",
    gift_claim_expires_at: "2026-03-07T10:00:00.000Z",
    gift_expiry_days: "90",
    gift_note: "",
  });
  await handleCreditPurchaseIntentSucceeded(admin, event);
  assertEquals(
    (rpcCalls[0].args as { p_note: string | null }).p_note,
    null,
  );
});

Deno.test("succeeded: a gift collision (a different failure than idempotent success) logs and does not throw", async () => {
  const admin = {
    rpc: () =>
      Promise.resolve({
        data: { ok: false, code: "gift_code_collision" },
        error: null,
      }),
  } as unknown as SupabaseClient;
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "sender_1",
    paid_cents: "50000",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-03-07T10:00:00.000Z",
    gift: "1",
    gift_code_hash: "deadbeef",
    gift_claim_expires_at: "2026-03-07T10:00:00.000Z",
    gift_expiry_days: "90",
  });
  // Must not throw — a collision here is not a Stripe-retryable failure.
  await handleCreditPurchaseIntentSucceeded(admin, event);
});

Deno.test("succeeded: a non-gift intent is unaffected by the gift metadata fields being absent", async () => {
  const { admin, rpcCalls } = fakeAdmin();
  const event = paymentIntentEvent({
    mesita_kind: "credit_purchase",
    organization_id: "org_1",
    consumer_id: "c_1",
    paid_cents: "50000",
    activates_at: "2026-09-08T13:00:00.000Z",
    expires_at: "2026-12-07T10:00:00.000Z",
  });
  await handleCreditPurchaseIntentSucceeded(admin, event);
  assertEquals(rpcCalls[0].fn, "create_credit_lot");
});
