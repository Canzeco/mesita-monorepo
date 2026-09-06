// Supabase Edge Function — business-web-get-payment-dashboard-link
//
// The DOOR to the Express Dashboard (MESITA-1532). Under the old
// typeless-Standard controller a place logged into stripe.com itself and this
// EF had no reason to exist. Under Express (stripe-connect.ts) there is no
// public login for sandbox accounts at all, and the Express login page is not
// something we can just send someone to — the ONLY entrance is a single-use,
// account-specific link the PLATFORM mints. Without this endpoint an onboarded
// restaurant cannot see its balance, change its payout bank account, or answer
// a dispute. That is why it ships in the same PR as the controller flip and
// not "later".
//
// Auth: owner of the ORGANIZATION — the merchant of record (MESITA-1545).
// Deliberately no super-admin exemption: org membership is a business fact
// (org-membership.ts), and an operator acting on an org should join it.
//
// Single-use and short-lived: the returned URL grants access to the account
// holder's Stripe data, so it is never cached, never stored, and never sent
// anywhere but to the authenticated caller who asked for it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgIdForPlace, requireOrgRole } from "../_shared/org-membership.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";
import {
  isMockConnectAccountId,
  keyIsLive,
} from "../_shared/stripe-connect.ts";
import type { PaymentAccountRow } from "../_shared/payment-account-doc.ts";

type Body = {
  orgId?: string;
  /** The place console knows its placeId, not the org that holds it — when
   *  orgId is omitted this EF resolves it server-side. Ignored when orgId is
   *  present. */
  placeId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const admin = adminClient(envRes.env);

  const bodyOrgId = (bodyRes.body.orgId ?? "").trim();
  const bodyPlaceId = (bodyRes.body.placeId ?? "").trim();
  if (!bodyOrgId && !bodyPlaceId) {
    return json({ ok: false, error: "orgId or placeId is required" }, 400);
  }
  let orgId = bodyOrgId;
  if (!orgId) {
    const resolved = await orgIdForPlace(admin, bodyPlaceId);
    if (!resolved) {
      return json({
        ok: false,
        error: "This place has no organization to connect Stripe under yet.",
        code: "place_has_no_organization",
      }, 400);
    }
    orgId = resolved;
  }

  const roleRes = await requireOrgRole(admin, authRes.user, orgId, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const rowRes = await admin
    .from("organization_payment_accounts")
    .select()
    .eq("organization_id", orgId)
    .maybeSingle();
  if (rowRes.error) {
    return json({ ok: false, error: `account_read: ${rowRes.error.message}` }, 500);
  }
  const row = (rowRes.data as PaymentAccountRow | null) ?? null;

  // Nothing to open. This is a normal state (the organization has never onboarded),
  // so it answers with a code the console can branch on rather than an error
  // string it would have to pattern-match.
  if (!row) {
    return json({
      ok: false,
      error: "This organization has no Stripe account yet.",
      code: "not_onboarded",
    }, 409);
  }

  // A mock account has no Stripe side at all, so there is no link to mint.
  if (isMockConnectAccountId(row.stripe_account_id)) {
    return json({ ok: true, mock: true, url: null, account: row });
  }

  const stripeKey = stripeSecretKey();
  if (!stripeKey) {
    return json({
      ok: false,
      error: "Stripe is not configured.",
      code: "stripe_unconfigured",
    }, 503);
  }

  // The row points at the other universe: the current key literally cannot see
  // that account, so Stripe would answer resource_missing. Say the true thing
  // instead of forwarding a confusing vendor error.
  if (row.livemode !== keyIsLive(stripeKey)) {
    return json({
      ok: false,
      error:
        "This organization's Stripe account belongs to the other Stripe environment.",
      code: "account_wrong_universe",
    }, 409);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
  try {
    const link = await stripe.accounts.createLoginLink(row.stripe_account_id);
    return json({ ok: true, mock: false, url: link.url, account: row });
  } catch (err) {
    // The most likely cause is an account created BEFORE the Express flip:
    // createLoginLink only works where the controller granted Express
    // dashboard access, and controller properties are permanent. Stripe names
    // the problem better than we can, and every failure here is configuration
    // rather than a transient, so its message is forwarded rather than
    // replaced by a "try again" that would be false.
    console.error("[get-payment-dashboard-link] createLoginLink failed:", err);
    const message = (err as { message?: string })?.message ??
      "Could not open the payments dashboard.";
    return json({ ok: false, error: message, code: "stripe_error" }, 502);
  }
});
