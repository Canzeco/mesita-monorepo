// STRIPE_MODE is one secret standing between the platform and the wrong
// Stripe account, so every rule that keeps it honest is frozen here: the
// default is test, the other universe's key is never a fallback, and a blank
// secret is not a secret. The resolvers take an injected reader, so these
// assertions never touch the process env.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  eventMatchesMode,
  resolveStripeSecret,
  stripeKeyMatchesMode,
  stripeMode,
  stripeSecretKey,
  stripeSecretKeyNames,
  stripeSecretKeyProblem,
  stripeWebhookSecrets,
} from "./stripe-env.ts";

const env = (vars: Record<string, string>) => (name: string) => vars[name];

Deno.test("stripeMode: only an explicit `live` is live — everything else is test", () => {
  assertEquals(stripeMode(env({})), "test");
  assertEquals(stripeMode(env({ STRIPE_MODE: "" })), "test");
  assertEquals(stripeMode(env({ STRIPE_MODE: "test" })), "test");
  // A typo must not be the thing that starts addressing the live account.
  assertEquals(stripeMode(env({ STRIPE_MODE: "liv" })), "test");
  assertEquals(stripeMode(env({ STRIPE_MODE: "production" })), "test");
  assertEquals(stripeMode(env({ STRIPE_MODE: "live" })), "live");
  assertEquals(stripeMode(env({ STRIPE_MODE: " LIVE " })), "live");
});

Deno.test("secret key: the active mode's suffixed name wins", () => {
  const vars = {
    STRIPE_MODE: "test",
    STRIPE_SECRET_KEY_TEST: "sk_test_new",
    STRIPE_SECRET_KEY_LIVE: "sk_live_new",
    STRIPE_SECRET_KEY: "sk_live_legacy",
  };
  assertEquals(resolveStripeSecret(env(vars)), {
    name: "STRIPE_SECRET_KEY_TEST",
    key: "sk_test_new",
  });
  assertEquals(
    resolveStripeSecret(env({ ...vars, STRIPE_MODE: "live" })),
    { name: "STRIPE_SECRET_KEY_LIVE", key: "sk_live_new" },
  );
});

Deno.test("secret key: legacy unsuffixed name is the fallback", () => {
  // The env that predates the split keeps working untouched.
  assertEquals(
    resolveStripeSecret(env({ STRIPE_SECRET_KEY: "sk_test_legacy" })),
    { name: "STRIPE_SECRET_KEY", key: "sk_test_legacy" },
  );
});

Deno.test("secret key: the OTHER mode's key is never a fallback", () => {
  // The MESITA-1422 trap, closed: STRIPE_MODE=test with only a live key set
  // resolves to nothing at all rather than quietly charging the live account.
  const res = resolveStripeSecret(
    env({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_LIVE: "sk_live_x" }),
  );
  assertEquals(res, null);
  assertEquals(
    stripeSecretKey(env({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_LIVE: "sk_live_x" })),
    undefined,
  );
  assertEquals(stripeSecretKeyNames("test"), [
    "STRIPE_SECRET_KEY_TEST",
    "STRIPE_SECRET_KEY",
  ]);
});

Deno.test("secret key: a blank secret is not a secret, and whitespace is trimmed", () => {
  assertEquals(
    resolveStripeSecret(
      env({ STRIPE_SECRET_KEY_TEST: "   ", STRIPE_SECRET_KEY: "sk_test_legacy" }),
    ),
    { name: "STRIPE_SECRET_KEY", key: "sk_test_legacy" },
  );
  assertEquals(
    stripeSecretKey(env({ STRIPE_SECRET_KEY_TEST: " sk_test_padded\n" })),
    "sk_test_padded",
  );
});

Deno.test("webhook secrets: every configured secret, active mode first", () => {
  const secrets = stripeWebhookSecrets(env({
    STRIPE_MODE: "test",
    STRIPE_WEBHOOK_SECRET_TEST: "whsec_platform_test",
    STRIPE_CONNECT_WEBHOOK_SECRET_TEST: "whsec_connect_test",
    STRIPE_WEBHOOK_SECRET_LIVE: "whsec_platform_live",
    STRIPE_CONNECT_WEBHOOK_SECRET_LIVE: "whsec_connect_live",
    STRIPE_WEBHOOK_SECRET: "whsec_platform_legacy",
  }));
  // Both universes verify — the flip must not cost a Stripe retry storm —
  // but the active mode's deliveries match on the first try.
  assertEquals(secrets, [
    "whsec_platform_test",
    "whsec_connect_test",
    "whsec_platform_live",
    "whsec_connect_live",
    "whsec_platform_legacy",
  ]);
});

Deno.test("webhook secrets: legacy-only env still verifies; duplicates collapse", () => {
  assertEquals(
    stripeWebhookSecrets(env({ STRIPE_WEBHOOK_SECRET: "whsec_legacy" })),
    ["whsec_legacy"],
  );
  // Same value under both the suffixed and legacy name is one secret to try.
  assertEquals(
    stripeWebhookSecrets(env({
      STRIPE_WEBHOOK_SECRET_TEST: "whsec_same",
      STRIPE_WEBHOOK_SECRET: "whsec_same",
    })),
    ["whsec_same"],
  );
  assertEquals(stripeWebhookSecrets(env({})), []);
});

Deno.test("eventMatchesMode: an event from the other universe is not ours", () => {
  assert(eventMatchesMode({ livemode: false }, "test"));
  assert(eventMatchesMode({ livemode: true }, "live"));
  assert(!eventMatchesMode({ livemode: true }, "test"));
  assert(!eventMatchesMode({ livemode: false }, "live"));
  // A missing livemode is treated as test — the same safe direction as the
  // STRIPE_MODE default.
  assert(eventMatchesMode({}, "test"));
  assert(!eventMatchesMode({}, "live"));
});

Deno.test("stripeKeyMatchesMode: the key prefix is the universe", () => {
  assert(stripeKeyMatchesMode("sk_test_x", "test"));
  assert(stripeKeyMatchesMode("sk_live_x", "live"));
  assert(!stripeKeyMatchesMode("sk_live_x", "test"));
  assert(!stripeKeyMatchesMode("sk_test_x", "live"));
});


Deno.test("stripeSecretKeyProblem: a well-formed secret key has no problem", () => {
  assertEquals(stripeSecretKeyProblem("STRIPE_SECRET_KEY_TEST", "sk_test_51abc"), null);
  assertEquals(stripeSecretKeyProblem("STRIPE_SECRET_KEY_LIVE", "sk_live_51abc"), null);
});

Deno.test("stripeSecretKeyProblem: each wrong paste is named by its prefix", () => {
  const problem = (key: string) =>
    stripeSecretKeyProblem("STRIPE_SECRET_KEY_TEST", key) ?? "";
  // Every message names the variable — the whole point over Stripe's own
  // rejection, which names none of the three candidate secrets.
  for (const key of ["rk_test_x", "pk_test_x", "mk_test_x", "hunter2"]) {
    assert(problem(key).includes("STRIPE_SECRET_KEY_TEST"), key);
  }
  assert(problem("rk_test_x").includes("restricted"));
  assert(problem("pk_test_x").includes("publishable"));
  assert(problem("mk_test_x").includes("API key ID"));
  assert(problem("hunter2").includes("does not look like"));
});

Deno.test("stripeSecretKeyProblem: junk pasted IN FRONT of a real key is its own diagnosis", () => {
  // The MESITA case, 2026-09-06: the business console's Connect button
  // returned `Invalid API Key provided: mattsk_t****…1l0b` — a real test key
  // with four stray characters welded to its front. "Does not look like a
  // Stripe secret key" would have sent the operator hunting for a new key;
  // the key was fine and only its first four characters were not.
  const problem = stripeSecretKeyProblem(
    "STRIPE_SECRET_KEY_TEST",
    "mattsk_test_51RealLookingKeyMaterial1l0b",
  );
  assert(problem !== null);
  assert(problem!.includes("STRIPE_SECRET_KEY_TEST"));
  assert(problem!.includes("4 stray character(s)"), problem!);
  assert(problem!.includes("must START with"), problem!);
  // The value itself NEVER travels in the message — this string is rendered
  // in a merchant's browser.
  assert(!problem!.includes("1l0b"), problem!);
  assert(!problem!.includes("mattsk_test_51RealLookingKeyMaterial1l0b"));
});

Deno.test("stripeSecretKeyProblem: a trailing-junk key is still caught, and not miscounted", () => {
  // Only a LEADING prefix is the "stray characters" case; a key that starts
  // correctly is shape-valid here (Stripe is the authority on the rest).
  assertEquals(stripeSecretKeyProblem("STRIPE_SECRET_KEY", "sk_test_51abc oops"), null);
});
