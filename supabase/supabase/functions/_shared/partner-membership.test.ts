// MESITA-1877 — the Mesita Membership ladder, and the law under it:
// LAPSE ≠ DROP. A declined yearly card must not null four rate columns and
// the monthly cap on the place that is dunning. (MESITA-1892 re-scoped the
// Membership from the organization to the place; the ladder is unchanged and
// the blast radius is now one place instead of every place an org held.)
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  isMockSubscriptionId,
  LIVE_MEMBERSHIP_STATES,
  MEMBERSHIP_CATALOG_ID,
  MEMBERSHIP_PLAN_KEY,
  membershipOutcome,
} from "./partner-membership.ts";
// The router lives in the webhook's own directory, not in _shared: it is the
// webhook's reading of a Stripe object, and only the webhook routes. Imported
// here so the test can CALL it — the alternative is grepping its source, which
// passes happily through a refactor that widens the predicate.
import { membershipRouteFor } from "../stripe-webhook-handle-event/partner-membership.ts";
import { STRIPE_CATALOG } from "./stripe-billing-catalog.ts";

const read = async (path: string) =>
  await Deno.readTextFile(new URL(path, import.meta.url));

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("past_due keeps the partnership — the whole point", () => {
  assertEquals(membershipOutcome("past_due"), "entitle");
});

Deno.test("the outcome ladder, rung by rung", () => {
  assertEquals(membershipOutcome("active"), "entitle");
  assertEquals(membershipOutcome("past_due"), "entitle");
  assertEquals(membershipOutcome("canceled"), "revoke");
  assertEquals(membershipOutcome("unpaid"), "revoke");
  // An abandoned checkout entitles nothing, so it must revoke nothing —
  // including a partnership that came through another door.
  assertEquals(membershipOutcome("incomplete"), "mirror");
  assertEquals(membershipOutcome("anything_stripe_adds_later"), "mirror");
});

Deno.test("the live states are exactly the one-live index's pair", async () => {
  assertEquals([...LIVE_MEMBERSHIP_STATES], ["active", "past_due"]);
  // The partial unique index is what makes readLiveMembership's
  // .maybeSingle() safe; if the two ever disagree, that read starts throwing
  // on a second row instead of returning one.
  //
  // Read from the migration that DEFINES the index today, not the one that
  // introduced it: MESITA-1892 dropped and rebuilt it on `place_id`, so the
  // original file is now history and pinning it would pin nothing live.
  const migration = await read(
    "../../migrations/20260915234500_the_place_is_the_only_tenant.sql",
  );
  assertStringIncludes(
    migration,
    "create unique index partner_memberships_one_live\n  on public.partner_memberships (place_id)\n  where state in ('active', 'past_due');",
  );
});

Deno.test("the entitlement writer never touches Mesita Pay", async () => {
  const body = codeOnly(await read("./partner-membership.ts"));
  assert(
    !body.includes("mesita_pay_enabled"),
    "paying for the partnership must not switch card payments on — that is the add-on's own writer (MESITA-1867), and _shared/place-rails.ts is its ONLY writer since MESITA-1892",
  );
  assert(
    !body.includes("setPlacePartnership"),
    "setPlacePartnership is the operator switch: it demands a Ready Connect account, and the Membership is not Stripe-locked",
  );
});

Deno.test("the Membership owns its own lookup row", () => {
  const entry = STRIPE_CATALOG.find((e) => e.id === MEMBERSHIP_CATALOG_ID);
  assert(entry, "the catalog must carry the Membership");
  // `org_plans` became `membership_plans` with the layer it was named for.
  assertEquals(entry.table, "membership_plans");
  assertEquals(entry.rowKey, MEMBERSHIP_PLAN_KEY);
  assertEquals(entry.interval, "year");
  // resolvePlanPrice caches the provisioned price id back onto table.rowKey.
  // Two entries sharing one row would each overwrite the other's id and mint
  // a fresh Stripe price on every checkout, forever.
  const rows = STRIPE_CATALOG.map((e) => `${e.table}.${e.rowKey}`);
  assertEquals(new Set(rows).size, rows.length, "one lookup row per entry");
  const keys = STRIPE_CATALOG.map((e) => e.lookupKey);
  assertEquals(new Set(keys).size, keys.length, "one lookup_key per entry");
});

Deno.test("the checkout door is owner-only and entitles nothing for real money", async () => {
  const door = codeOnly(
    await read("../business-web-start-membership/index.ts"),
  );
  // Owner of the PLACE. `requireOwner` is the place-scoped rung; unlike the
  // org check it replaced, it also lets a super-admin through, which the EF's
  // own docblock states rather than hides.
  assertStringIncludes(door, "requireOwner(admin, authRes.user, placeId)");
  // Entitlement inside the EF exists only under MOCK_SUBSCRIPTION; the real
  // path hands off to the webhook, which is the only order that cannot grant
  // a partnership for a checkout nobody paid.
  const real = door.slice(door.indexOf("REAL Stripe mode"));
  assert(
    !real.includes("applyMembershipEntitlement"),
    "the real path must not entitle — the webhook does, once Stripe confirms",
  );
  assert(
    !door.includes("isConnectChargeReady") && !door.includes("stripe_not_ready"),
    "the Membership is not Stripe-locked any more (Pato, 2026-09-15)",
  );
});

Deno.test("the webhook matches a membership before a place plan", async () => {
  const hook = codeOnly(await read("../stripe-webhook-handle-event/index.ts"));
  // resolvePlaceId falls back to the CUSTOMER, so a place that also bills the
  // older Verified SKU would have its Membership reconciled as a plan change
  // if the place-plan branch ran first.
  const membershipAt = hook.indexOf("membershipRouteFor(session)");
  const placeAt = hook.indexOf("session.metadata?.place_id");
  assert(membershipAt > 0 && placeAt > 0, "both branches must exist");
  assert(membershipAt < placeAt, "the membership branch must come first");

  const subMembershipAt = hook.indexOf("membershipRouteFor(sub)");
  const subPlaceAt = hook.indexOf("resolvePlaceId(admin, sub)");
  assert(subMembershipAt > 0 && subPlaceAt > 0, "both branches must exist");
  assert(subMembershipAt < subPlaceAt, "the membership branch must come first");
});

Deno.test("the membership router discriminates by KIND, not by having an id", async () => {
  // THE ROUTING TEST CHANGED SHAPE WITH THE SCHEMA. A Membership used to be
  // the only business object carrying organization_id and no place_id, so its
  // mere presence routed it. Since MESITA-1892 a Membership and a Verified
  // subscription BOTH carry place_id — routing on "has an id" would hand one
  // to the other's reconciler, which is a money bug either way round.
  //
  // THIS CALLS THE ROUTER. It used to grep the source for the expression, and
  // that is not the same thing: a refactor that renames a local variable
  // breaks the grep while the behaviour is untouched, and — far worse — a
  // refactor that quietly widens the predicate leaves every grep passing.
  // The one function standing between a Membership and place_subscriptions
  // deserves inputs and outputs.
  const asSub = (metadata: Record<string, string>) =>
    ({ metadata } as unknown as Parameters<typeof membershipRouteFor>[0]);

  assertEquals(
    membershipRouteFor(asSub({ mesita_kind: "business_membership", place_id: "p1" })),
    { kind: "membership", placeId: "p1" },
  );
  assertEquals(
    membershipRouteFor(asSub({ plan_key: MEMBERSHIP_PLAN_KEY, place_id: "p1" })),
    { kind: "membership", placeId: "p1" },
    "either half of the kind is enough — the door stamps both",
  );

  // THE BUG THE KIND CHECK EXISTS TO PREVENT: the place's own Verified plan
  // carries a place_id too (business-web-change-subscription stamps
  // `{ place_id, plan_key }`), and it must NOT route as a Membership.
  assertEquals(
    membershipRouteFor(asSub({ place_id: "p1", plan_key: "pro" })),
    { kind: "not_membership" },
    "a place-plan subscription is not a Membership just because it names a place",
  );
  assertEquals(
    membershipRouteFor(asSub({ place_id: "p1" })),
    { kind: "not_membership" },
    "an id alone routes nothing",
  );

  // A Membership by kind that names no place is the pre-1892 shape. It must
  // refuse rather than fall through to a resolver that guesses from the
  // customer.
  assertEquals(
    membershipRouteFor(asSub({ mesita_kind: "business_membership" })),
    { kind: "unroutable" },
  );
  assertEquals(
    membershipRouteFor(asSub({ mesita_kind: "business_membership", place_id: "  " })),
    { kind: "unroutable" },
    "whitespace is not an id",
  );

  // And the door stamps both halves of what the router reads.
  const door = codeOnly(
    await read("../business-web-start-membership/index.ts"),
  );
  assertStringIncludes(door, 'mesita_kind: "business_membership"');
  assertStringIncludes(door, "plan_key: MEMBERSHIP_PLAN_KEY");
  assertStringIncludes(door, "place_id: placeId");
});

Deno.test("a membership that names no place is acked, never guessed at", async () => {
  // Metadata is frozen on the Stripe subscription, and Stripe re-sends that
  // same object on every renewal and lapse for the rest of its year — so a
  // Membership sold before MESITA-1892 keeps arriving stamped with a tenant
  // that no longer exists, naming no place, long after the layer is gone.
  const router = codeOnly(
    await read("../stripe-webhook-handle-event/partner-membership.ts"),
  );
  assertStringIncludes(router, '{ kind: "unroutable" }');

  const hook = codeOnly(await read("../stripe-webhook-handle-event/index.ts"));
  // It must BREAK, not fall through: the place branch's resolver falls back
  // to the customer and would reconcile the Membership onto someone's plan.
  assertEquals(
    hook.split("logUnroutableMembership(event)").length - 1,
    2,
    "both event branches must handle the unroutable shape",
  );
});

// ─── The three holes Bugbot found on the money path (MESITA-1877) ───────────

Deno.test("a mock grant never blocks the real door", async () => {
  assertEquals(isMockSubscriptionId("mock_abc"), true);
  assertEquals(isMockSubscriptionId("sub_abc"), false);
  assertEquals(isMockSubscriptionId(null), false);

  const door = codeOnly(
    await read("../business-web-start-membership/index.ts"),
  );
  // MOCK_SUBSCRIPTION writes `mock_<placeId>` rows with state active. Once an
  // operator turns the flag off, every place that took a mock grant would be a
  // permanent partner with nothing billable behind it — and the already-member
  // gate would refuse the only door out.
  assertStringIncludes(door, "if (live.row && (mockMode || !liveIsMock))");
  // The read has to carry the id for that to be decidable at all.
  assertStringIncludes(
    codeOnly(await read("./partner-membership.ts")),
    "stripe_subscription_id, current_period_end",
  );
});

Deno.test("a superseded subscription is cancelled AT STRIPE, not just mirrored", async () => {
  const hook = codeOnly(
    await read("../stripe-webhook-handle-event/partner-membership.ts"),
  );
  // Stripe redirects home the instant a session completes and this webhook
  // arrives on its own connection, so an owner who pays twice in that window
  // has two live subscriptions. Retiring one MIRROR would hide the second
  // from the console and bill it every year regardless.
  assertStringIncludes(hook, "await cancelIfStillBillable(stripe, priorId)");
  const cancelAt = hook.indexOf("await cancelIfStillBillable(stripe, priorId)");
  const retireAt = hook.indexOf('.update({ state: "canceled" })');
  assert(cancelAt > 0 && retireAt > 0, "both steps must exist");
  assert(cancelAt < retireAt, "cancel at Stripe BEFORE retiring the mirror");
  // A failed cancel must 500 so Stripe retries — the only exceptions are
  // Stripe's own two ways of saying there is nothing left to cancel.
  assertStringIncludes(hook, "membership_cancel_prior_live");
});

Deno.test("two concurrent checkouts converge on ONE billing customer", async () => {
  const billing = codeOnly(await read("./stripe-billing.ts"));
  const fn = billing.slice(
    billing.indexOf("export async function ensurePlaceBillingCustomer"),
  );
  // The unique index is on the customer ID, so two DIFFERENT ids for one place
  // both satisfy it and the later write simply wins — it can never serialize
  // this. Stripe's own idempotency key is what makes the two callers share an
  // object; the compare-and-set is what stops an anchor being overwritten.
  assertStringIncludes(fn, "idempotencyKey: `place-billing-customer-${placeId}`");
  assertStringIncludes(fn, '.is("stripe_billing_customer_id", null)');
});

Deno.test("cancelling a superseded subscription must not revoke the live one", async () => {
  const hook = codeOnly(
    await read("../stripe-webhook-handle-event/partner-membership.ts"),
  );
  // `stripe.subscriptions.cancel` makes Stripe emit
  // customer.subscription.deleted for the prior, and that event comes back
  // here carrying the SAME place_id. Read alone its state says revoke, so the
  // place would lose `partnered` and drop to free while the membership that
  // replaced it is live and paid — a double-payment repair turning into an
  // outage.
  assertStringIncludes(hook, 'if (outcome === "revoke")');
  assertStringIncludes(hook, "readLiveMembership(admin, placeId)");
  assertStringIncludes(hook, 'if (remaining.row) {');
  // The mirror must already be written when that read runs, or the dead row
  // is still in the live set and answers for itself.
  const mirrorAt = hook.indexOf("membership_mirror");
  const readAt = hook.indexOf("membership_read_remaining");
  assert(mirrorAt > 0 && readAt > 0, "both must exist");
  assert(
    mirrorAt < readAt,
    "mirror the incoming state BEFORE reading what is still live",
  );
});

Deno.test("the prior cancel survives a Stripe retry", async () => {
  const hook = codeOnly(
    await read("../stripe-webhook-handle-event/partner-membership.ts"),
  );
  // A cancel that succeeds and is then followed by a failed write 500s, and
  // Stripe redelivers — at which point a SECOND cancel on an already-canceled
  // subscription is an error, not a no-op. Rethrowing it wedges the reconcile
  // forever: the mirror never retires and the new membership never upserts.
  assertStringIncludes(hook, "cancelIfStillBillable");
  assertStringIncludes(hook, "DEAD_STRIPE_STATUSES");
  assertStringIncludes(hook, "nothingLeftToCancel");
  // Both of Stripe's "nothing to cancel" answers count as success.
  assertStringIncludes(hook, '"resource_missing"');
  assert(
    hook.includes("already"),
    "an already-canceled subscription is the goal already met",
  );
  // Read the live object before acting: a dead status is skipped, not tried.
  const retrieveAt = hook.indexOf("subscriptions.retrieve(subscriptionId)");
  const cancelAt = hook.indexOf("subscriptions.cancel(subscriptionId)");
  assert(retrieveAt > 0 && cancelAt > 0 && retrieveAt < cancelAt);
});

Deno.test("a revoke asks STRIPE when the mirror says nothing is left", async () => {
  const hook = codeOnly(
    await read("../stripe-webhook-handle-event/partner-membership.ts"),
  );
  // The two events race and neither ordering may drop a paying place. The
  // mirror answers the ordinary one. It CANNOT answer the inverted one —
  // the deleted event overtaking the replacement's upsert — because in that
  // window the prior is already retired and the replacement is not written
  // yet, and the two arrive as separate requests with different event ids, so
  // `stripe_events` does not serialize them.
  assertStringIncludes(hook, "placeHasAnotherLiveSubscription(stripe, sub, placeId)");
  assertStringIncludes(hook, "BILLABLE_STRIPE_STATUSES");
  // MATCHED ON THE PLACE *AND* THE KIND. This matched `metadata.organization_id`
  // until MESITA-1892, and only Memberships carried that key — so "another
  // subscription for the same tenant" could only ever mean another MEMBERSHIP.
  // Re-pointing it at `place_id` silently widened it, because the place's own
  // Verified plan carries one: without the kind check, a place holding both
  // answers "something else is live" when its Membership is cancelled, the
  // revoke downgrades to a no-op, and the place stays `partnered` having
  // stopped paying. Both halves, or the guard is the bug.
  assertStringIncludes(hook, 'metaString(s.metadata?.place_id) === placeId');
  assertStringIncludes(hook, "isMembershipMetadata(s.metadata)");
  // And it is asked ONLY on the revoke path — never on the renewals that are
  // almost every delivery.
  const guardAt = hook.indexOf("placeHasAnotherLiveSubscription(stripe, sub, placeId)");
  const revokeAt = hook.indexOf('if (outcome === "revoke")');
  assert(revokeAt > 0 && guardAt > revokeAt, "the guard lives inside the revoke branch");
  // A failed Stripe read must NOT read as "nothing else is live": that answer
  // nulls four rate columns and the monthly cap on the place, and
  // joinPlacePatch never restores them.
  const fn = hook.slice(hook.indexOf("async function placeHasAnotherLiveSubscription"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert(!body.includes("catch"), "a Stripe failure throws so Stripe retries");
});
