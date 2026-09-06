// Supabase Edge Function — business-web-get-payment-account
//
// Reads the ORGANIZATION's Stripe Connect mirror (MESITA-1545: the merchant
// of record is the organization) for the console's Payments card. Any member
// may SEE the state — viewers included; the actions (onboard, dashboard)
// stay owner-only in their own EFs.
//
// Refresh-through by default: the platform Stripe account has no webhook
// endpoint yet (MESITA-1531), so `account.updated` never arrives on its own.
// Until it does, this read IS the sync moment — a real-universe row is
// re-fetched from Stripe and the mirror updated before answering. Pass
// refresh:false to skip (cheap poll paths).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";
import {
  accountSnapshotFromStripe,
  isMockConnectAccountId,
  keyIsLive,
} from "../_shared/stripe-connect.ts";
import {
  type PaymentAccountRow,
  writePaymentAccount,
} from "../_shared/payment-account-doc.ts";

type Body = { orgId?: string; refresh?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const orgId = (body.orgId ?? "").trim();
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);

  const admin = adminClient(envRes.env);
  const roleRes = await requireOrgRole(admin, authRes.user, orgId, [
    "owner",
    "editor",
    "viewer",
  ]);
  if (!roleRes.ok) return roleRes.response;

  const rowRes = await admin
    .from("organization_payment_accounts")
    .select()
    .eq("organization_id", orgId)
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

  return json({ ok: true, account: row, orphaned, myRole: roleRes.role });
});
