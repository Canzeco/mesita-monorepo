// Two-secret verification is the ENTIRE auth story of the verify_jwt=false
// webhook surface — prove it with real signatures: a delivery signed by
// either configured secret verifies, garbage is rejected, and an unset
// Connect secret changes nothing for platform events.

import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import Stripe from "npm:stripe@17";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { verifyStripeEvent } from "./webhook-verify.ts";

const stripe = new Stripe("sk_test_dummy", { apiVersion: STRIPE_API_VERSION });
const PLATFORM_SECRET = "whsec_platform_test_secret";
const CONNECT_SECRET = "whsec_connect_test_secret";
const payload = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  type: "account.updated",
  account: "acct_123",
  livemode: false,
  data: { object: { id: "acct_123", object: "account" } },
});

// Stripe's generateTestHeaderString is synchronous and Deno's SubtleCrypto
// provider is async-only, so sign the payload by hand: the header scheme is
// `t=<unix>,v1=hmacSHA256(secret, "<unix>.<payload>")` — exactly what
// constructEventAsync verifies.
async function signedHeader(secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
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

Deno.test("platform-signed delivery verifies with the platform secret first", async () => {
  const event = await verifyStripeEvent(stripe, payload, await signedHeader(PLATFORM_SECRET), [
    PLATFORM_SECRET,
    CONNECT_SECRET,
  ]);
  assertEquals(event.id, "evt_test_1");
});

Deno.test("Connect-signed delivery verifies via the second secret", async () => {
  const event = await verifyStripeEvent(stripe, payload, await signedHeader(CONNECT_SECRET), [
    PLATFORM_SECRET,
    CONNECT_SECRET,
  ]);
  assertEquals(event.account, "acct_123");
});

Deno.test("unset Connect secret is skipped; platform events still verify", async () => {
  const event = await verifyStripeEvent(stripe, payload, await signedHeader(PLATFORM_SECRET), [
    PLATFORM_SECRET,
    undefined,
  ]);
  assertEquals(event.type, "account.updated");
});

Deno.test("a signature no configured secret produced is rejected", async () => {
  const foreign = await signedHeader("whsec_someone_else");
  await assertRejects(() =>
    verifyStripeEvent(stripe, payload, foreign, [PLATFORM_SECRET, CONNECT_SECRET])
  );
  await assertRejects(() =>
    verifyStripeEvent(stripe, payload, "t=1,v1=garbage", [PLATFORM_SECRET])
  );
});

Deno.test("no configured secrets at all rejects", async () => {
  const header = await signedHeader(PLATFORM_SECRET);
  await assertRejects(() => verifyStripeEvent(stripe, payload, header, [null, undefined]));
  assert(true);
});
