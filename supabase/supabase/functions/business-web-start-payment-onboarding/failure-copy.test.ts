// The audience test (MESITA-1645). Every case here answers one question:
// would a restaurant owner know what to do after reading this?
import { assert, assertEquals } from "jsr:@std/assert";
import {
  classifyOnboardingFailure,
  PLATFORM_FAULT_COPY,
  stripeMessageOf,
  TRANSIENT_COPY,
} from "./failure-copy.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("THE REGRESSION: the sentence a restaurant actually read never ships again", () => {
  // 2026-09-07, 07:14:15Z, verbatim in a red box on business.mesita.ai.
  const err = {
    type: "StripeInvalidRequestError",
    statusCode: 400,
    raw: {
      message:
        "When `stripe_dashboard[type]=express`, your platform must collect fees and be liable for negative balances or refunds and chargebacks.",
    },
  };
  const v = classifyOnboardingFailure(err, { keyRejected: false });
  assertEquals(v.passthrough, false);
  assertEquals(v.error, PLATFORM_FAULT_COPY);
  assert(!v.error.includes("stripe_dashboard"));
  // Still recoverable from the log — swallowing it silently is the other bug.
  assert(stripeMessageOf(err).includes("stripe_dashboard"));
});

Deno.test("an unknown future Stripe rejection is refused BY DEFAULT", () => {
  // The whole point of the inversion: nobody has to remember to add it.
  const v = classifyOnboardingFailure(
    { statusCode: 400, raw: { message: "Some rule invented in 2027." } },
    { keyRejected: false },
  );
  assertEquals(v.error, PLATFORM_FAULT_COPY);
  assertEquals(v.code, "stripe_platform_error");
  assertEquals(v.status, 503);
});

Deno.test("the two fields the owner actually chose pass through", () => {
  for (const param of ["country", "business_type"]) {
    const v = classifyOnboardingFailure(
      { statusCode: 400, param, raw: { message: `Invalid ${param}: 'ZZ'` } },
      { keyRejected: false },
    );
    assertEquals(v.passthrough, true);
    assertEquals(v.status, 400);
    assert(v.error.includes(param));
  }
});

Deno.test("a rejection naming one of OUR fields does not", () => {
  const v = classifyOnboardingFailure(
    { statusCode: 400, param: "controller[stripe_dashboard][type]", raw: { message: "nope" } },
    { keyRejected: false },
  );
  assertEquals(v.passthrough, false);
  assertEquals(v.error, PLATFORM_FAULT_COPY);
});

Deno.test("Stripe having a bad minute is not a permanent error", () => {
  // These rendered as permanent before: same red box, same dead end.
  for (const statusCode of [429, 500, 503]) {
    const v = classifyOnboardingFailure({ statusCode }, { keyRejected: false });
    assertEquals(v.error, TRANSIENT_COPY);
    assertEquals(v.code, "stripe_unavailable");
  }
});

Deno.test("transient beats field: a 429 says try again, not a parameter lecture", () => {
  const v = classifyOnboardingFailure(
    { statusCode: 429, param: "country", raw: { message: "Too many requests" } },
    { keyRejected: false },
  );
  assertEquals(v.error, TRANSIENT_COPY);
});

Deno.test("a rejected platform key never echoes the credential", () => {
  const v = classifyOnboardingFailure(
    { statusCode: 401, raw: { message: "Expired API Key provided: sk_test_...8QBF1y" } },
    { keyRejected: true },
  );
  assertEquals(v.error, PLATFORM_FAULT_COPY);
  assert(!v.error.includes("sk_test"));
});

Deno.test("the handler no longer has a verbatim passthrough of its own", () => {
  // The old tail was `json({ ok: false, error: message, code: "stripe_error" }, 400)`.
  // If it comes back, everything above is decoration.
  assert(
    !SRC.includes('code: "stripe_error"'),
    "the deny-list default must be gone from the handler",
  );
  assert(
    SRC.includes("classifyOnboardingFailure("),
    "the handler must route failures through the allowlist",
  );
});

Deno.test("Stripe's words always reach the LOG, even when the merchant is spared", () => {
  assert(
    SRC.includes("console.error") && SRC.includes("Stripe said:"),
    "a swallowed error with no operator log is the other failure mode",
  );
});
