// MESITA-1877 — the Mesita Membership ladder, and the law under it:
// LAPSE ≠ DROP. A declined yearly card must not null four rate columns and
// the monthly cap on every place an organization holds.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  isMockSubscriptionId,
  LIVE_MEMBERSHIP_STATES,
  MEMBERSHIP_CATALOG_ID,
  MEMBERSHIP_PLAN_KEY,
  membershipOutcome,
} from "./partner-membership.ts";
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
  const migration = await read(
    "../../migrations/20260915183500_partner_membership_yearly.sql",
  );
  assertStringIncludes(
    migration,
    "where state in ('active', 'past_due')",
  );
});

Deno.test("the entitlement writer never touches Mesita Pay", async () => {
  const body = codeOnly(await read("./partner-membership.ts"));
  assert(
    !body.includes("mesita_pay_enabled"),
    "paying for the partnership must not switch card payments on — that is the add-on's own writer (MESITA-1867)",
  );
  assert(
    !body.includes("setOrgPartnership"),
    "setOrgPartnership is the operator switch: it demands a Ready Connect account and writes mesita_pay_enabled",
  );
});

Deno.test("the Membership owns its own lookup row", () => {
  const entry = STRIPE_CATALOG.find((e) => e.id === MEMBERSHIP_CATALOG_ID);
  assert(entry, "the catalog must carry the Membership");
  assertEquals(entry.table, "org_plans");
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
  assertStringIncludes(door, "requireOrgRole(");
  assertStringIncludes(door, '["owner"]');
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

Deno.test("the webhook matches a membership before a place", async () => {
  const hook = codeOnly(await read("../stripe-webhook-handle-event/index.ts"));
  // resolvePlaceId falls back to the CUSTOMER, so an organization that also
  // has a place subscription on file would have its membership reconciled
  // onto a place if the place branch ran first.
  const orgAt = hook.indexOf("organizationIdFor(session)");
  const placeAt = hook.indexOf("session.metadata?.place_id");
  assert(orgAt > 0 && placeAt > 0, "both branches must exist");
  assert(orgAt < placeAt, "the membership branch must come first");

  const subOrgAt = hook.indexOf("organizationIdFor(sub)");
  const subPlaceAt = hook.indexOf("resolvePlaceId(admin, sub)");
  assert(subOrgAt > 0 && subPlaceAt > 0, "both branches must exist");
  assert(subOrgAt < subPlaceAt, "the membership branch must come first");
});

// ─── The three holes Bugbot found on the money path (MESITA-1877) ───────────

Deno.test("a mock grant never blocks the real door", async () => {
  assertEquals(isMockSubscriptionId("mock_abc"), true);
  assertEquals(isMockSubscriptionId("sub_abc"), false);
  assertEquals(isMockSubscriptionId(null), false);

  const door = codeOnly(
    await read("../business-web-start-membership/index.ts"),
  );
  // MOCK_SUBSCRIPTION writes `mock_<orgId>` rows with state active. Once an
  // operator turns the flag off, every org that took a mock grant would be a
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
  assertStringIncludes(hook, "stripe.subscriptions.cancel(priorId)");
  const cancelAt = hook.indexOf("stripe.subscriptions.cancel");
  const retireAt = hook.indexOf('.update({ state: "canceled" })');
  assert(cancelAt > 0 && retireAt > 0, "both steps must exist");
  assert(cancelAt < retireAt, "cancel at Stripe BEFORE retiring the mirror");
  // A failed cancel must 500 so Stripe retries — the only exception is a
  // subscription Stripe says is already gone.
  assertStringIncludes(hook, 'code !== "resource_missing"');
  assertStringIncludes(hook, "membership_cancel_prior_live");
});

Deno.test("two concurrent checkouts converge on ONE billing customer", async () => {
  const billing = codeOnly(await read("./stripe-billing.ts"));
  const fn = billing.slice(billing.indexOf("export async function ensureOrgBillingCustomer"));
  // The unique index is on the customer ID, so two DIFFERENT ids for one org
  // both satisfy it and the later write simply wins — it can never serialize
  // this. Stripe's own idempotency key is what makes the two callers share an
  // object; the compare-and-set is what stops an anchor being overwritten.
  assertStringIncludes(fn, "idempotencyKey: `org-billing-customer-${orgId}`");
  assertStringIncludes(fn, '.is("stripe_billing_customer_id", null)');
});
