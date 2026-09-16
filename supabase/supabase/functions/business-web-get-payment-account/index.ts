// Supabase Edge Function — business-web-get-payment-account
//
// Reads the PLACE's Stripe Connect mirror for the console's Payments card.
// The merchant of record was the organization (MESITA-1545) until MESITA-1892
// removed that layer; `place_payment_accounts` is one row per place, so the
// place the caller is looking at IS the account. Any member may SEE the state
// — viewers included; the actions (onboard, dashboard) stay owner-only in
// their own EFs.
//
// It answers the pay-readiness verdict the Capabilities rung renders (intent /
// global_rail / capability) on every call. That used to be the `placeId`-only
// half of a two-shaped response — an `orgId` caller got a thinner body
// (MESITA-1740). There is no org-shaped caller any more, so there is one
// response shape, and the branch that could return a verdict-less body is
// gone rather than kept as a default.
//
// Refresh-through by default: the platform Stripe account has no webhook
// endpoint yet (MESITA-1531), so `account.updated` never arrives on its own.
// Until it does, this read IS the sync moment — a real-universe row is
// re-fetched from Stripe and the mirror updated before answering. Pass
// refresh:false to skip (cheap poll paths).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";
import {
  accountSnapshotFromStripe,
  isMockConnectAccountId,
  keyIsLive,
} from "../_shared/stripe-connect.ts";
import {
  isConnectChargeReady,
  type PaymentAccountRow,
  writePaymentAccount,
} from "../_shared/payment-account-doc.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";

type Body = { placeId?: string; projectId?: string; refresh?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, placeId);
  if (!memberRes.ok) return memberRes.response;
  const myRole = memberRes.membership.role;

  const rowRes = await admin
    .from("place_payment_accounts")
    .select()
    .eq("place_id", placeId)
    .maybeSingle();
  if (rowRes.error) {
    return json({ ok: false, error: `account_read: ${rowRes.error.message}` }, 500);
  }
  let row = (rowRes.data as PaymentAccountRow | null) ?? null;
  let orphaned = false;

  const stripeKey = stripeSecretKey();
  const wantsRefresh = body.refresh !== false;
  const refreshable = wantsRefresh && row !== null && stripeKey &&
    !isMockConnectAccountId(row.stripe_account_id) &&
    row.livemode === keyIsLive(stripeKey);
  if (refreshable) {
    const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
    try {
      const account = await stripe.accounts.retrieve(row!.stripe_account_id);
      const snapshot = accountSnapshotFromStripe(account, keyIsLive(stripeKey!));
      const written = await writePaymentAccount(admin, {
        mode: "update",
        by: "place_id",
        id: placeId,
        patch: snapshot,
      });
      if (written.ok && written.row) row = written.row;
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "resource_missing" || code === "account_invalid") {
        // The account vanished from this universe (rotated sandbox, deleted
        // account). Report honestly; the onboarding EF's replace path heals.
        orphaned = true;
      } else {
        throw err;
      }
    }
  }

  // The pay-readiness chain. `place_profiles.mesita_pay_enabled` is the WHOLE
  // intent leg now: it used to be ANDed with the organization's own bit, and
  // MESITA-1892 folded that half into this column at migration time.
  const placeRes = await admin
    .from("place_profiles")
    .select("mesita_pay_enabled")
    .eq("id", placeId)
    .maybeSingle();
  const placeIntent =
    (placeRes.data as { mesita_pay_enabled?: unknown } | null)
      ?.mesita_pay_enabled === true;
  const visits = await loadVisitsConfig(admin);
  const globalRail = visits.payCard === true;
  const capability = isConnectChargeReady(row);

  return json({
    ok: true,
    account: row,
    orphaned,
    myRole,
    ready: capability,
    pay_ready: {
      intent: placeIntent,
      global_rail: globalRail,
      capability,
      all: placeIntent && globalRail && capability,
    },
  });
});
