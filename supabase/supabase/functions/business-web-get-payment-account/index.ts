// Supabase Edge Function — business-web-get-payment-account
//
// Reads the ORGANIZATION's Stripe Connect mirror (MESITA-1545: the merchant
// of record is the organization) for the console's Payments card. Any member
// may SEE the state — viewers included; the actions (onboard, dashboard)
// stay owner-only in their own EFs.
//
// With `placeId`, also returns the pay-readiness verdict the Capabilities
// rung renders (intent / global_rail / capability) — the only piece
// `admin-web-get-place-payment-account` had that this door lacked
// (MESITA-1740). Org-id callers keep the previous shape.
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
import { requireOrgRole } from "../_shared/org-membership.ts";
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

type Body = { orgId?: string; placeId?: string; projectId?: string; refresh?: boolean };

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
  const orgIdFromBody = (body.orgId ?? "").trim();
  if (!placeId && !orgIdFromBody) {
    return json({ ok: false, error: "orgId or placeId is required" }, 400);
  }

  const admin = adminClient(envRes.env);
  let orgId = orgIdFromBody;
  let myRole: string | null = null;
  let placeIntent: boolean | null = null;

  if (placeId) {
    const memberRes = await requireMembership(admin, authRes.user, placeId);
    if (!memberRes.ok) return memberRes.response;
    myRole = memberRes.membership.role;
    const orgRes = await admin
      .from("places")
      .select("organization_id")
      .eq("id", placeId)
      .maybeSingle();
    if (orgRes.error) {
      return json({ ok: false, error: `org_read: ${orgRes.error.message}` }, 500);
    }
    orgId =
      (orgRes.data as { organization_id?: string | null } | null)
        ?.organization_id ?? "";
  } else {
    const roleRes = await requireOrgRole(admin, authRes.user, orgId, [
      "owner",
      "editor",
      "viewer",
    ]);
    if (!roleRes.ok) return roleRes.response;
    myRole = roleRes.role;
  }

  const rowRes = orgId
    ? await admin
      .from("organization_payment_accounts")
      .select()
      .eq("organization_id", orgId)
      .maybeSingle()
    : { data: null, error: null };
  if (rowRes.error) {
    return json({ ok: false, error: `account_read: ${rowRes.error.message}` }, 500);
  }
  let row = (rowRes.data as PaymentAccountRow | null) ?? null;
  let orphaned = false;

  const stripeKey = stripeSecretKey();
  const wantsRefresh = body.refresh !== false;
  const refreshable = wantsRefresh && row !== null && stripeKey && orgId &&
    !isMockConnectAccountId(row.stripe_account_id) &&
    row.livemode === keyIsLive(stripeKey);
  if (refreshable) {
    const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
    try {
      const account = await stripe.accounts.retrieve(row!.stripe_account_id);
      const snapshot = accountSnapshotFromStripe(account, keyIsLive(stripeKey!));
      const written = await writePaymentAccount(admin, {
        mode: "update",
        by: "organization_id",
        id: orgId,
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

  if (!placeId) {
    return json({ ok: true, account: row, orphaned, myRole });
  }

  const placeRes = await admin
    .from("place_profiles")
    .select("mesita_pay_enabled")
    .eq("id", placeId)
    .maybeSingle();
  placeIntent =
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
