// Supabase Edge Function — admin-web-get-place-payment-account (admin console)
//
// Super-admin read of a place's Stripe Connect mirror plus the full
// pay-readiness verdict:
//   intent      places.mesita_pay_enabled   (operator intent bit, #1409)
//   global_rail visits_config.payCard       (staged rail switch)
//   capability  isConnectChargeReady(row)   (charges_enabled ∧ details_submitted)
// The verdict is informational — nothing consumes it until the gateway PR.
//
// `refresh: true` re-reads the account from Stripe and upserts the snapshot
// (refresh-on-read): the Connect webhook endpoint is an optimization whose
// dashboard setup is a human step, never a dependency. A refresh racing a
// late-retried webhook is last-writer-wins and self-heals on the next
// event/refresh — acceptable for a mirror.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

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

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const wantsRefresh = bodyRes.body.refresh === true;
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
        // The account vanished from this universe. Report honestly; the
        // onboarding EF's replace path is the fix.
        orphaned = true;
      } else {
        throw err;
      }
    }
  }

  // The pay-readiness chain — the AND the intent-bit comments promise.
  const placeRes = await admin
    .from("places")
    .select("mesita_pay_enabled")
    .eq("id", placeId)
    .maybeSingle();
  const intent =
    (placeRes.data as { mesita_pay_enabled?: unknown } | null)
      ?.mesita_pay_enabled === true;
  const visits = await loadVisitsConfig(admin);
  const globalRail = visits.payCard === true;
  const capability = isConnectChargeReady(row);

  return json({
    ok: true,
    account: row,
    orphaned,
    ready: capability,
    pay_ready: {
      intent,
      global_rail: globalRail,
      capability,
      all: intent && globalRail && capability,
    },
  });
});
