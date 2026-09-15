// MESITA-1889 — the failure this file prevents: a legacy per-place Stripe
// subscription moves `places.plan` behind the Membership's back.
//
// Before this, `reconcilePlaceSubscription` was an ENTITLEMENT writer. A live
// per-place subscription granted `plan=pro`; a lapsed one revoked it. Both
// branches ran on a webhook delivery Mesita no longer sells: the per-place
// Verified checkout is retired (business-web-change-subscription), and the
// organization's yearly Mesita Membership is the one door onto `partnered`
// and onto every held place's plan.
//
// Two ways that bites with both writers live. A stale per-place subscription
// finally cancelling would DROP a place whose organization is paid up — the
// revoke branch only checked that `places.plan` still matched the lapsed
// subscription's plan_key, which it does, because the Membership put it
// there. And a per-place subscription still billing would keep re-granting
// `plan=pro` to a place whose organization let its Membership lapse.
//
// The mirror stays. `place_subscriptions` is BILLING, not entitlement, and a
// legacy subscription has to remain observable — this is the same split as
// `partner_memberships` vs `organizations.partnered`.

import { assert } from "jsr:@std/assert@1";

const HOOK = new URL("./index.ts", import.meta.url);

/** Code only: the comments above the function describe the branches that are
 *  gone, and a scan that read them would pass on the prose alone. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const hook = codeOnly(await Deno.readTextFile(HOOK));

/** The body of `reconcilePlaceSubscription`, brace-matched from its header. */
function reconcilePlaceSubscriptionBody(src: string): string {
  const head = src.indexOf("async function reconcilePlaceSubscription(");
  assert(head > 0, "reconcilePlaceSubscription must still exist");
  const open = src.indexOf("{", src.indexOf("): Promise<void>", head));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced braces in reconcilePlaceSubscription");
}

Deno.test("reconcilePlaceSubscription never calls writePlace", () => {
  const body = reconcilePlaceSubscriptionBody(hook);
  assert(
    !body.includes("writePlace("),
    "a per-place subscription must not move places.plan — the organization's " +
      "Mesita Membership is the only entitlement door (MESITA-1889)",
  );
  assert(
    !body.includes('.from("places")'),
    "it has no reason to read the place row any more either",
  );
  assert(
    !body.includes("applyListingTypeToPatch("),
    "listing_type rides along with a plan write, and there is no plan write",
  );
});

Deno.test("reconcilePlaceSubscription still mirrors the subscription", () => {
  const body = reconcilePlaceSubscriptionBody(hook);
  assert(
    body.includes('.from("place_subscriptions")') && body.includes(".upsert("),
    "billing stays observable: a legacy subscription must still land in " +
      "place_subscriptions, or it goes invisible instead of inert",
  );
  assert(
    body.includes("place_subscription_mirror"),
    "a failed mirror must still throw so Stripe retries",
  );
});

Deno.test("the entitlement writer that remains is the Membership's", () => {
  // Same file, different branch: organizations keep their one writer. If this
  // ever fails, the two doors are back.
  assert(
    hook.includes("reconcilePartnerMembership("),
    "the Membership reconciler must still be wired into the webhook",
  );
});
