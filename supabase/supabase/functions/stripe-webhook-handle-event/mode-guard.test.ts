// The mode guard, end-to-end through the real handler (MESITA-1530).
//
// Both universes' endpoints can be pointed at this one URL, so a live-universe
// delivery arriving while STRIPE_MODE=test is CORRECTLY SIGNED — it passes
// verification and is stopped only by the livemode check. That check runs
// before adminClient(), so this test needs no DB: a handler that ever let such
// an event through would reach for the network here and fail loudly.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { loadEFHandler, setDummyEnv } from "../_shared/ef-test-harness.ts";

const WEBHOOK_SECRET = "whsec_mode_guard_test";

// Same hand-rolled header as webhook-verify.test.ts: Stripe's synchronous
// generateTestHeaderString cannot use Deno's async-only SubtleCrypto.
async function signedHeader(payload: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${timestamp}.${payload}`),
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

Deno.test("a signed LIVE event under STRIPE_MODE=test is acked, not processed", async () => {
  setDummyEnv({
    STRIPE_MODE: "test",
    STRIPE_SECRET_KEY_TEST: "sk_test_mode_guard",
    STRIPE_WEBHOOK_SECRET_LIVE: WEBHOOK_SECRET,
  });
  try {
    const payload = JSON.stringify({
      id: "evt_live_1",
      object: "event",
      type: "customer.subscription.deleted",
      livemode: true,
      data: { object: { id: "sub_live_1", object: "subscription" } },
    });
    const h = await loadEFHandler("../stripe-webhook-handle-event/index.ts");
    const res = await h(
      new Request("http://ef.local/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": await signedHeader(payload),
        },
        body: payload,
      }),
    );
    // 200 so Stripe stops retrying an event this deployment will never want.
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ignored, "livemode_mismatch");
    assert(body.received);
  } finally {
    for (
      const n of [
        "STRIPE_MODE",
        "STRIPE_SECRET_KEY_TEST",
        "STRIPE_WEBHOOK_SECRET_LIVE",
      ]
    ) Deno.env.delete(n);
  }
});
