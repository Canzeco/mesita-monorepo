// The cancel door's one decision, in both directions (MESITA-1891 review).
//
// This EF had no test at all. The thing it decides is whether an owner who
// presses "Manage membership" reaches Stripe's Billing Portal or is told
// there is nothing to manage — and it is the ONLY cancel path in the product,
// so a wrong answer in the second direction leaves a paying place with no way
// to stop being billed.
//
// The first cut asked `MOCK_SUBSCRIPTION || !stripeKey`: an environment flag,
// never the place. Both tests below would have passed on the flag alone in
// the safe direction; the third is the one that could not.
import { assert, assertEquals } from "jsr:@std/assert";
import { membershipPortalIsMock } from "./portal-gate.ts";

/** Comments stripped, the same idiom `control-affordances.test.ts` uses over
 *  in web-business: the docblock below NAMES the flag while explaining why it
 *  is not asked, and a raw scan would read that explanation as the mistake. */
const SRC = (await Deno.readTextFile(new URL("./index.ts", import.meta.url)))
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const KEY = "sk_test_abc";

Deno.test("no Stripe key ⇒ the mock answer, whatever the row says", () => {
  // There is no Stripe to open a portal against. This half of the old
  // short-circuit is kept deliberately, and it is checked first.
  assert(membershipPortalIsMock(null, null));
  assert(membershipPortalIsMock("", { stripe_subscription_id: "sub_real" }));
  assert(membershipPortalIsMock(undefined, { stripe_subscription_id: "sub_real" }));
});

Deno.test("no live membership row ⇒ the mock answer", () => {
  // A place that never bought anything, and the state a mock environment is
  // usually in. Nothing to manage is the truth here.
  assert(membershipPortalIsMock(KEY, null));
});

Deno.test("a mock_* grant is not a subscription ⇒ the mock answer", () => {
  // What MOCK_SUBSCRIPTION writes: `mock_<placeId>`, state active. Handing
  // that id to Stripe would 400, and there is genuinely no billing behind it.
  assert(membershipPortalIsMock(KEY, { stripe_subscription_id: "mock_place-1" }));
});

Deno.test("a REAL subscription opens the portal, even where a flag says mock", () => {
  // THE DIRECTION THE FLAG GOT WRONG. A place bought a real yearly Membership
  // while MOCK_SUBSCRIPTION was off; an operator later flipped it back on for
  // a demo or a staging restore. Stripe keeps charging either way, so the
  // owner must still reach the portal — this function never asks the flag, so
  // there is no input that can take it away from them.
  assertEquals(
    membershipPortalIsMock(KEY, { stripe_subscription_id: "sub_1Ab2Cd" }),
    false,
  );
  // A null id on a live row is not a real subscription id either: it is an
  // `incomplete` mirror that never reached `active`, and `readLiveMembership`
  // would not return it — but if it ever did, sending null to Stripe is worse
  // than the mock sentence.
  assert(membershipPortalIsMock(KEY, { stripe_subscription_id: null }));
});

Deno.test("the EF asks the row, and no longer asks the flag", () => {
  // The wiring, which the pure function above cannot see. Both halves matter:
  // reading MOCK_SUBSCRIPTION back into this file would restore the defect
  // even with the gate in place.
  assert(
    !SRC.includes("MOCK_SUBSCRIPTION"),
    "the cancel door must not read the operator's mock flag",
  );
  assert(
    SRC.includes("readLiveMembership"),
    "the mock answer must come from the place's membership row",
  );
  assert(
    SRC.includes("membershipPortalIsMock"),
    "the decision belongs to portal-gate.ts, not to a second inline copy",
  );
  // The row read has to happen BEFORE the portal session, or the gate guards
  // nothing.
  assert(
    SRC.indexOf("membershipPortalIsMock") < SRC.indexOf("billingPortal.sessions.create"),
    "the gate must precede the Stripe call it guards",
  );
});
