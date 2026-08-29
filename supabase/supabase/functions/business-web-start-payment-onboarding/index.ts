// Supabase Edge Function — business-web-start-payment-onboarding (business console)
//
// Creates (if missing) the place's Stripe CONNECT account — PLATFORM posture,
// typeless-Standard controller + requested capabilities (the law lives in
// _shared/stripe-connect.ts) — and returns a Stripe-hosted onboarding
// Account Link. Owner-only: onboarding binds the place's own Stripe
// relationship, same level as changing the subscription.
//
// No charges here, ever. This is the ACCOUNT layer only; the charge path
// (direct charges + application fees) is the gateway PR's scope. Live keys
// are refused via liveChargesBlocked (MESITA-37 — account creation counts as
// provisioning something that later gets charged).
//
// Mock: unlike MOCK_SUBSCRIPTION this defaults to REAL test-universe
// accounts when the TEST key is present (provable infrastructure); mock only
// when MOCK_CONNECT=true or no key. Transition law (mock never overwrites
// real; real replaces mock; universe mismatch replaceable) is
// classifyExistingAccount in _shared/stripe-connect.ts.

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
  requireOwner,
} from "../_shared/auth.ts";
import {
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import {
  accountSnapshotFromStripe,
  classifyExistingAccount,
  isMockConnect,
  keyIsLive,
  MESITA_CONNECT_CAPABILITIES,
  MESITA_CONNECT_CONTROLLER,
  mockConnectAccountId,
} from "../_shared/stripe-connect.ts";
import {
  type PaymentAccountRow,
  writePaymentAccount,
} from "../_shared/payment-account-doc.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  returnUrl?: string;
  refreshUrl?: string;
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
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);

  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    placeId,
    "Only owners can start payment onboarding.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    const blocked = liveChargesBlocked(stripeKey);
    if (blocked) return json({ ok: false, error: blocked, code: "stripe_live_blocked" }, 409);
  }
  const mockMode = isMockConnect(stripeKey);

  const existingRes = await admin
    .from("place_payment_accounts")
    .select()
    .eq("place_id", placeId)
    .maybeSingle();
  if (existingRes.error) {
    return json({ ok: false, error: `account_read: ${existingRes.error.message}` }, 500);
  }
  const existing = (existingRes.data as PaymentAccountRow | null) ?? null;

  const action = classifyExistingAccount(existing, {
    mockMode,
    keyLive: stripeKey ? keyIsLive(stripeKey) : false,
  });

  // ── Mock mode: insert-if-missing, NEVER overwrite a real row. ─────────────
  if (mockMode) {
    if (action === "return_untouched") {
      return json({ ok: true, mock: false, url: null, account: existing });
    }
    if (action === "use") {
      return json({ ok: true, mock: true, url: null, account: existing });
    }
    const inserted = await writePaymentAccount(admin, {
      mode: "insert",
      placeId,
      row: {
        stripe_account_id: mockConnectAccountId(placeId),
        livemode: false,
      },
    });
    if (!inserted.ok) {
      return json({ ok: false, error: `account_insert: ${inserted.error}` }, 500);
    }
    return json({ ok: true, mock: true, url: null, account: inserted.row });
  }

  // ── Real mode (test universe until the MESITA-37 ritual). ─────────────────
  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
  const livemode = keyIsLive(stripeKey!);
  const origin = req.headers.get("origin") ?? "";
  const returnUrl = bodyRes.body.returnUrl ??
    `${origin}/unit/${placeId}/promos?connect=return`;
  const refreshUrl = bodyRes.body.refreshUrl ??
    `${origin}/unit/${placeId}/promos?connect=refresh`;

  const linkFor = async (accountId: string) => {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return link.url;
  };

  if (action === "use") {
    try {
      const url = await linkFor(existing!.stripe_account_id);
      return json({ ok: true, mock: false, url, account: existing });
    } catch (err) {
      // The account no longer exists in this universe (deleted, or a rotated
      // sandbox) — self-heal by falling through to the replace path.
      const code = (err as { code?: string }).code ?? "";
      if (code !== "resource_missing" && code !== "account_invalid") throw err;
    }
  }

  // "create", "replace", or a 404ed "use": provision a fresh account.
  const account = await stripe.accounts.create({
    country: "MX",
    controller: MESITA_CONNECT_CONTROLLER,
    capabilities: MESITA_CONNECT_CAPABILITIES,
    metadata: { place_id: placeId },
  });

  const snapshot = accountSnapshotFromStripe(account, livemode);
  const written = existing
    ? await writePaymentAccount(admin, {
      mode: "update",
      by: "place_id",
      id: placeId,
      patch: { stripe_account_id: account.id, ...snapshot },
    })
    : await writePaymentAccount(admin, {
      mode: "insert",
      placeId,
      row: { stripe_account_id: account.id, ...snapshot },
    });
  if (!written.ok || !written.row) {
    // Don't leave an orphan that a retry would duplicate: best-effort delete
    // of the just-created account, then fail loudly.
    try {
      await stripe.accounts.del(account.id);
    } catch (delErr) {
      console.error(
        `[start-payment-onboarding] orphan cleanup failed for ${account.id}:`,
        delErr,
      );
    }
    const reason = written.ok ? "row_missing_after_write" : written.error;
    return json({ ok: false, error: `account_write: ${reason}` }, 500);
  }

  const url = await linkFor(account.id);
  return json({ ok: true, mock: false, url, account: written.row });
});
