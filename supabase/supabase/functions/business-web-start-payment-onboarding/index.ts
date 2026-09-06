// Supabase Edge Function — business-web-start-payment-onboarding (business console)
//
// Creates (if missing) the ORGANIZATION's Stripe CONNECT account — the
// merchant of record is the organization (MESITA-1545) — PLATFORM posture,
// typeless-Standard controller + requested capabilities (the law lives in
// _shared/stripe-connect.ts) — and returns a Stripe-hosted onboarding
// Account Link. Org-owner-only: onboarding binds the organization's own
// Stripe relationship.
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
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgIdForPlace, requireOrgRole } from "../_shared/org-membership.ts";
import {
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import {
  accountSnapshotFromStripe,
  classifyExistingAccount,
  isMockConnect,
  isSupportedConnectCountry,
  isSupportedConnectEntityType,
  keyIsLive,
  MESITA_CONNECT_CAPABILITIES,
  MESITA_CONNECT_CONTROLLER,
  MESITA_CONNECT_COUNTRIES,
  MESITA_CONNECT_ENTITY_TYPES,
  mockConnectAccountId,
} from "../_shared/stripe-connect.ts";
import {
  isStripeKeyRejection,
  resolveStripeSecret,
  stripeSecretKeyProblem,
} from "../_shared/stripe-env.ts";
import {
  type PaymentAccountRow,
  writePaymentAccount,
} from "../_shared/payment-account-doc.ts";

type Body = {
  orgId?: string;
  /** The place console knows its placeId, not the org that holds it — when
   *  orgId is omitted this EF resolves it server-side (clients never query
   *  the DB). Ignored when orgId is present. */
  placeId?: string;
  returnUrl?: string;
  refreshUrl?: string;
  /** ISO-3166-1 alpha-2, allowlisted (MESITA_CONNECT_COUNTRIES). Defaults to
   *  MX — every organization onboarded so far is Mexican — but it is validated, not
   *  trusted, because Stripe bakes it into the account permanently. */
  country?: string;
  /** Stripe's `business_type` — the persona física / persona moral fork,
   *  asked before onboarding opens. Optional on the wire: the resume path
   *  only mints a link for an account that already exists. */
  entityType?: string;
};

// Stripe's OWN WORDS reach the operator. Every failure on this path is a
// configuration fact a retry cannot change — Connect not signed up for, a key
// that is actually a key id, branding missing — and Stripe names each one
// precisely. Swallowing that into "try again" sends the operator to the logs
// (or to an agent) to learn something the API already said. The Controls row
// renders `blocked` as "Stripe: <reason>", so this lands in an idiom that
// already exists.
//
// ONE exception, and it is the reason this function exists rather than a bare
// `json(err.message)`: a 401. The reader here is a RESTAURANT OWNER, not a
// Mesita operator. "Expired API Key provided: sk_test_…8QBF1y" tells them
// nothing they can act on, implies the failure is theirs, and echoes our
// platform credential into their browser — the very leak the shape guard on
// the key was added to prevent, arriving through the one door it cannot cover
// (an expired or revoked key is perfectly SHAPED, so it passes that guard and
// only dies on the first real call). Every other Stripe rejection still
// travels verbatim.
function stripeFailure(err: unknown): Response {
  const raw = (err as { raw?: { message?: unknown } }).raw?.message;
  const top = (err as { message?: unknown }).message;
  const message = typeof raw === "string"
    ? raw
    : typeof top === "string"
    ? top
    : "Stripe rejected the request.";
  if (isStripeKeyRejection(err)) {
    const secret = resolveStripeSecret();
    console.error(
      `[start-payment-onboarding] Stripe REJECTED the platform key` +
        `${secret ? ` in ${secret.name}` : ""}: ${message}. ` +
        `The key is shaped correctly but is not usable — expired, rolled, ` +
        `revoked, or issued for a different Stripe account. Rotate it.`,
    );
    return json({
      ok: false,
      error:
        "Payments aren\u2019t configured on Mesita\u2019s side yet \u2014 nothing to fix on your end. We\u2019ve been notified.",
      code: "stripe_key_rejected",
    }, 503);
  }
  return json({ ok: false, error: message, code: "stripe_error" }, 400);
}

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

  // Country is PERMANENT on the account Stripe is about to create, so it is
  // validated against the allowlist here — before the ownership check, before
  // the DB read, before Stripe is touched at all. A bad value must cost a 400,
  // never a permanently mis-countried connected account.
  const country = bodyRes.body.country ?? "MX";
  if (!isSupportedConnectCountry(country)) {
    return json({
      ok: false,
      error:
        `country must be one of ${MESITA_CONNECT_COUNTRIES.join(", ")} (got ${JSON.stringify(country)}).`,
      code: "unsupported_country",
    }, 400);
  }

  // Entity type is the OTHER answer hosted onboarding needs up front. Unlike
  // country it is a prefill Stripe may still change, so it is optional on the
  // wire — but never a passthrough: an unrecognised value would reach
  // accounts.create and be rejected there, one round trip later and in
  // Stripe's words instead of ours.
  const entityTypeRaw = bodyRes.body.entityType;
  const entityType =
    typeof entityTypeRaw === "string" && entityTypeRaw.trim() !== ""
      ? entityTypeRaw.trim()
      : null;
  if (entityType !== null && !isSupportedConnectEntityType(entityType)) {
    return json({
      ok: false,
      error:
        `entityType must be one of ${MESITA_CONNECT_ENTITY_TYPES.join(", ")} (got ${JSON.stringify(entityTypeRaw)}).`,
      code: "unsupported_entity_type",
    }, 400);
  }

  const roleRes = await requireOrgRole(admin, authRes.user, orgId, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const secret = resolveStripeSecret();
  const stripeKey = secret?.key;
  if (secret) {
    // A key that is not shaped like a key is a PLATFORM misconfiguration, and
    // the reader of this response is a restaurant owner. Refuse before Stripe
    // does: Stripe's rejection ("Invalid API Key provided: <key, middle
    // starred out>") names no env var and echoes the credential itself into a
    // merchant's browser. The operator-precise sentence — which variable, what
    // is wrong with it — goes to the EF log and to the admin health probe,
    // which is where an operator already looks; the merchant gets a sentence
    // that is true and actionable for THEM, which is "nothing, it is on us".
    const problem = stripeSecretKeyProblem(secret.name, secret.key);
    if (problem) {
      console.error(`[start-payment-onboarding] ${problem}`);
      return json({
        ok: false,
        error:
          "Payments aren\u2019t configured on Mesita\u2019s side yet \u2014 nothing to fix on your end. We\u2019ve been notified.",
        code: "stripe_key_malformed",
      }, 503);
    }
    const blocked = liveChargesBlocked(secret.key);
    if (blocked) return json({ ok: false, error: blocked, code: "stripe_live_blocked" }, 409);
  }
  const mockMode = isMockConnect(stripeKey);

  const existingRes = await admin
    .from("organization_payment_accounts")
    .select()
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existingRes.error) {
    return json({ ok: false, error: `account_read: ${existingRes.error.message}` }, 500);
  }
  const existing = (existingRes.data as PaymentAccountRow | null) ?? null;

  const action = classifyExistingAccount(existing, {
    mockMode,
    keyLive: stripeKey ? keyIsLive(stripeKey) : false,
    country,
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
      organizationId: orgId,
      row: {
        stripe_account_id: mockConnectAccountId(orgId),
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
    `${origin}/?org=${orgId}&connect=return`;
  const refreshUrl = bodyRes.body.refreshUrl ??
    `${origin}/?org=${orgId}&connect=refresh`;

  const linkFor = async (accountId: string) => {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return link.url;
  };

  if (action === "use" || action === "use_country_mismatch") {
    try {
      const url = await linkFor(existing!.stripe_account_id);
      // A country mismatch still gets a working link — the existing account is
      // real and finishing its onboarding is the useful action — but it is
      // NEVER reported as if the requested country were honoured. Country is
      // per-account permanent; changing it means deleting the account at
      // Stripe, which is an operator decision, not something an EF may infer.
      return json({
        ok: true,
        mock: false,
        url,
        account: existing,
        ...(action === "use_country_mismatch"
          ? {
            country_mismatch: true,
            requested_country: country,
            account_country: existing!.country,
          }
          : {}),
      });
    } catch (err) {
      // The account no longer exists in this universe (deleted, or a rotated
      // sandbox) — self-heal by falling through to the replace path.
      const code = (err as { code?: string }).code ?? "";
      if (code !== "resource_missing" && code !== "account_invalid") throw err;
    }
  }

  // "create", "replace", or a 404ed "use": provision a fresh account.
  // The organization's legal name prefills Stripe onboarding (company.name —
  // ignored by Stripe if the person later picks individual). Null omits the
  // field and Stripe simply asks; the create never blocks on it.
  const { data: orgRow } = await admin
    .from("organizations")
    .select("legal_name")
    .eq("id", orgId)
    .maybeSingle();
  const legalName =
    ((orgRow as { legal_name?: string | null } | null)?.legal_name ?? "").trim();

  let account: Stripe.Account;
  try {
    account = await stripe.accounts.create({
      country,
      controller: MESITA_CONNECT_CONTROLLER,
      capabilities: MESITA_CONNECT_CAPABILITIES,
      metadata: { organization_id: orgId },
      ...(entityType ? { business_type: entityType } : {}),
      // company.name is meaningless for an individual — Stripe ignores it —
      // so once the fork is known, send it only where it lands.
      ...(legalName && entityType !== "individual"
        ? { company: { name: legalName } }
        : {}),
    });
  } catch (err) {
    console.error("[start-payment-onboarding] accounts.create failed:", err);
    return stripeFailure(err);
  }

  const snapshot = accountSnapshotFromStripe(account, livemode);
  const written = existing
    ? await writePaymentAccount(admin, {
      mode: "update",
      by: "organization_id",
      id: orgId,
      patch: { stripe_account_id: account.id, ...snapshot },
    })
    : await writePaymentAccount(admin, {
      mode: "insert",
      organizationId: orgId,
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

  let url: string;
  try {
    url = await linkFor(account.id);
  } catch (err) {
    // The account exists and its row is written; only the link failed (most
    // often Connect branding is unset). Report Stripe's reason and keep the
    // account — the next press reuses it through the "use" path.
    console.error("[start-payment-onboarding] accountLinks.create failed:", err);
    return stripeFailure(err);
  }
  return json({ ok: true, mock: false, url, account: written.row });
});
