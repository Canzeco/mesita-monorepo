// Contract smoke tests for the money-path Edge Functions (MESITA-142).
//
// These EFs move real money (Stripe subscriptions, ticket billing). We lock
// their REQUEST/RESPONSE CONTRACT at the gate: every one must
//   • answer the CORS preflight (OPTIONS -> 200),
//   • reject the wrong HTTP method (-> 405),
//   • reject an unauthenticated caller (-> 401)  [webhook: -> 400 no signature]
// before any DB / Stripe work happens.
//
// No port is bound, no DB is hit, no Stripe call is made: the harness
// intercepts Deno.serve to capture the real production handler and invokes it
// with crafted Requests. The dummy Supabase env only lets the guard chain
// advance past readEFEnv() to the auth check; a missing bearer short-circuits
// to 401 before any client is constructed.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  jsonRequest,
  loadEFHandler,
  readBody,
  setDummyEnv,
} from "./ef-test-harness.ts";

setDummyEnv();

// POST-only, JWT-gated EFs (the common shape). `accepts` lists the allowed
// methods so we can pick a disallowed one for the 405 probe.
const JWT_EFS: { name: string; path: string; accepts: string[] }[] = [
  // business-web-create-ticket retired by Tickets v2 (MESITA-806) — guests
  // create their own tickets now.
  { name: "consumer-web-create-ticket", path: "../consumer-web-create-ticket/index.ts", accepts: ["POST"] },
  { name: "consumer-web-cancel-ticket", path: "../consumer-web-cancel-ticket/index.ts", accepts: ["POST"] },
  { name: "business-web-mark-ticket-paid", path: "../business-web-mark-ticket-paid/index.ts", accepts: ["POST"] },
  { name: "business-web-cancel-ticket", path: "../business-web-cancel-ticket/index.ts", accepts: ["POST"] },
  { name: "business-web-list-tickets", path: "../business-web-list-tickets/index.ts", accepts: ["POST"] },
  { name: "business-web-change-subscription", path: "../business-web-change-subscription/index.ts", accepts: ["POST"] },
  { name: "consumer-web-create-subscription", path: "../consumer-web-create-subscription/index.ts", accepts: ["POST"] },
  { name: "consumer-web-submit-ticket-review", path: "../consumer-web-submit-ticket-review/index.ts", accepts: ["POST"] },
  { name: "consumer-web-submit-story", path: "../consumer-web-submit-story/index.ts", accepts: ["POST"] },
  { name: "consumer-web-submit-review", path: "../consumer-web-submit-review/index.ts", accepts: ["POST"] },
  { name: "consumer-web-list-pay-notifications", path: "../consumer-web-list-pay-notifications/index.ts", accepts: ["POST"] },
  { name: "consumer-web-list-tickets", path: "../consumer-web-list-tickets/index.ts", accepts: ["GET", "POST"] },
  // THE TICKET v4 (MESITA-1088/1091/1092): the guest's bill, the live poll,
  // the settle pick.
  { name: "consumer-web-submit-ticket-bill", path: "../consumer-web-submit-ticket-bill/index.ts", accepts: ["POST"] },
  { name: "consumer-web-get-ticket", path: "../consumer-web-get-ticket/index.ts", accepts: ["POST"] },
  { name: "consumer-web-select-ticket-payment", path: "../consumer-web-select-ticket-payment/index.ts", accepts: ["POST"] },
  // Stripe Connect PLATFORM account layer (skeleton, no charges).
  { name: "business-web-start-payment-onboarding", path: "../business-web-start-payment-onboarding/index.ts", accepts: ["POST"] },
  { name: "admin-web-get-place-payment-account", path: "../admin-web-get-place-payment-account/index.ts", accepts: ["POST"] },
  // The Express Dashboard door (MESITA-1532): it mints a single-use link that
  // grants access to the account holder's Stripe data, so its auth gate is
  // money-path-critical even though it moves no money itself.
  { name: "business-web-get-payment-dashboard-link", path: "../business-web-get-payment-dashboard-link/index.ts", accepts: ["POST"] },
];

// The public check surface (Tickets v2, MESITA-806): verify_jwt=false,
// code-possession auth. No 401 probes — instead assert the uniform 404 on a
// missing/implausible code fires BEFORE any DB work (the plausibility gate
// and the null ip-hash shortcut make these probes network-free).
const PUBLIC_CHECK_EFS: { name: string; path: string }[] = [
  { name: "validate-web-get-ticket", path: "../validate-web-get-ticket/index.ts" },
  { name: "validate-web-mark-paid", path: "../validate-web-mark-paid/index.ts" },
  // THE TICKET v4 handshake (MESITA-1090/1092). A validate-web EF scaffolded
  // from a consumer template would inherit requireAuthedUser and 401 a
  // surface with no login by design — these probes are what catches it.
  { name: "validate-web-scan-ticket", path: "../validate-web-scan-ticket/index.ts" },
  { name: "validate-web-approve-ticket", path: "../validate-web-approve-ticket/index.ts" },
  { name: "validate-web-request-fix", path: "../validate-web-request-fix/index.ts" },
  { name: "validate-web-poll-ticket", path: "../validate-web-poll-ticket/index.ts" },
  { name: "validate-web-validate-ticket", path: "../validate-web-validate-ticket/index.ts" },
];

for (const ef of PUBLIC_CHECK_EFS) {
  Deno.test(`${ef.name}: OPTIONS preflight -> 200 with CORS`, async () => {
    const h = await loadEFHandler(ef.path);
    const res = await h(new Request("http://ef.local/", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    await res.body?.cancel();
  });

  Deno.test(`${ef.name}: disallowed method -> 405`, async () => {
    const h = await loadEFHandler(ef.path);
    const res = await h(new Request("http://ef.local/", { method: "DELETE" }));
    assertEquals(res.status, 405);
    await res.body?.cancel();
  });

  Deno.test(`${ef.name}: missing code -> uniform 404, no auth required`, async () => {
    const h = await loadEFHandler(ef.path);
    const res = await h(jsonRequest({}, { method: "POST", bearer: null }));
    // submit-bill validates the subtotal only after the code, so an empty
    // body must already be the uniform miss (or a 400 for its own field —
    // never a 401).
    assert(
      res.status === 404 || res.status === 400,
      `${ef.name} must never 401 (got ${res.status})`,
    );
    await res.body?.cancel();
  });
}

for (const ef of JWT_EFS) {
  Deno.test(`${ef.name}: OPTIONS preflight -> 200 with CORS`, async () => {
    const h = await loadEFHandler(ef.path);
    const res = await h(new Request("http://ef.local/", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    await res.body?.cancel();
  });

  Deno.test(`${ef.name}: disallowed method -> 405`, async () => {
    const h = await loadEFHandler(ef.path);
    // DELETE is never accepted by any of these handlers.
    const res = await h(new Request("http://ef.local/", { method: "DELETE" }));
    assertEquals(res.status, 405);
    await res.body?.cancel();
  });

  Deno.test(`${ef.name}: no auth -> 401 (before any DB/Stripe work)`, async () => {
    const h = await loadEFHandler(ef.path);
    const method = ef.accepts.includes("POST") ? "POST" : "GET";
    const res = await h(jsonRequest({}, { method, bearer: null }));
    assertEquals(res.status, 401, `${ef.name} must 401 an unauthenticated caller`);
    const body = await readBody(res);
    assert(
      typeof body === "object" && body !== null && (body as { ok?: boolean }).ok === false,
      `${ef.name} 401 body should be { ok:false, ... }`,
    );
  });

  Deno.test(`${ef.name}: malformed bearer -> 401`, async () => {
    const h = await loadEFHandler(ef.path);
    const method = ef.accepts.includes("POST") ? "POST" : "GET";
    const res = await h(
      jsonRequest({}, { method, headers: { Authorization: "NotBearer xyz" } }),
    );
    assertEquals(res.status, 401);
    await res.body?.cancel();
  });
}

// ─── Stripe webhook: signature-gated, not JWT-gated ───────────────────────
// verify_jwt is disabled at the gateway; security rests on the Stripe
// signature. Contract: POST-only (plain-text 405), and a POST with no
// stripe-signature header is a 400 before any event is processed.

Deno.test("stripe-webhook-handle-event: non-POST -> 405", async () => {
  setDummyEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
  const h = await loadEFHandler("../stripe-webhook-handle-event/index.ts");
  const res = await h(new Request("http://ef.local/", { method: "GET" }));
  assertEquals(res.status, 405);
  await res.body?.cancel();
});

Deno.test("stripe-webhook-handle-event: POST without stripe-signature -> 400", async () => {
  setDummyEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
  const h = await loadEFHandler("../stripe-webhook-handle-event/index.ts");
  const res = await h(
    new Request("http://ef.local/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
  assertEquals(res.status, 400);
  const text = await res.text();
  assert(/signature/i.test(text), "400 should mention the missing signature");
});

Deno.test("stripe-webhook-handle-event: a bogus signature fails verification -> 400", async () => {
  setDummyEnv({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
  const h = await loadEFHandler("../stripe-webhook-handle-event/index.ts");
  const res = await h(
    new Request("http://ef.local/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
      body: JSON.stringify({ id: "evt_1", type: "checkout.session.completed" }),
    }),
  );
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

// validate-web-request-fix validates its closed fix vocabulary BEFORE any DB
// work — an unknown fix is a client bug, not a lookup, and must never 500.
Deno.test("validate-web-request-fix: unknown fix enum -> 400 before any DB work", async () => {
  const h = await loadEFHandler("../validate-web-request-fix/index.ts");
  const res = await h(
    jsonRequest({ code: "abcdefghijklmnopqrstuv", fix: "vibes" }, {
      method: "POST",
      bearer: null,
    }),
  );
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("validate-web-request-fix: over-length note -> 400, not 500", async () => {
  const h = await loadEFHandler("../validate-web-request-fix/index.ts");
  const res = await h(
    jsonRequest(
      { code: "abcdefghijklmnopqrstuv", fix: "bill", note: "x".repeat(300) },
      { method: "POST", bearer: null },
    ),
  );
  assertEquals(res.status, 400);
  await res.body?.cancel();
});
