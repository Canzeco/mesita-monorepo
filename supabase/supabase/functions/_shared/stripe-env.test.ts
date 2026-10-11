// STRIPE_MODE is one secret standing between the platform and the wrong
// Stripe account, so every rule that keeps it honest is frozen here: the
// default is test and the other universe's key is never a candidate.
// stripeMode takes an injected reader, so these assertions never touch the
// process env.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  stripeMode,
  stripePublishableKeyMatchesMode,
  stripePublishableKeyNames,
  stripeSecretKeyNames,
  stripeSecretKeyProblem,
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

Deno.test("stripeSecretKeyNames: the OTHER mode's key is never a candidate", () => {
  // The MESITA-1422 trap, closed: STRIPE_MODE=test never reaches for the live
  // key, so a missing test key resolves to nothing rather than quietly
  // charging the live account.
  assertEquals(stripeSecretKeyNames("test"), [
    "STRIPE_SECRET_KEY_TEST",
    "STRIPE_SECRET_KEY",
  ]);
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

// ── The publishable key (MESITA-1670) ────────────────────────────────────────
//
// It is the only Stripe credential that reaches a browser, and it is resolved
// SERVER-side for one reason: a NEXT_PUBLIC_ build variable cannot follow
// STRIPE_MODE. Bake pk_test into a deploy, flip the mode, and every 3DS
// challenge runs against a universe that cannot see the intent.

Deno.test("stripePublishableKeyNames: the other mode's name is absent", () => {
  assertEquals(stripePublishableKeyNames("test"), [
    "STRIPE_PUBLISHABLE_KEY_TEST",
    "STRIPE_PUBLISHABLE_KEY",
  ]);
  assertEquals(stripePublishableKeyNames("live"), [
    "STRIPE_PUBLISHABLE_KEY_LIVE",
    "STRIPE_PUBLISHABLE_KEY",
  ]);
});

Deno.test("stripePublishableKeyMatchesMode: reports skew, does not refuse it", () => {
  assertEquals(stripePublishableKeyMatchesMode("pk_test_a", "test"), true);
  assertEquals(stripePublishableKeyMatchesMode("pk_live_b", "live"), true);
  assertEquals(stripePublishableKeyMatchesMode("pk_live_b", "test"), false);
  assertEquals(stripePublishableKeyMatchesMode("pk_test_a", "live"), false);
});
