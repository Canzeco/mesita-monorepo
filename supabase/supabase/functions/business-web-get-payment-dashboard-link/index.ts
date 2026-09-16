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
// Auth: owner of the PLACE — the merchant of record (MESITA-1545 put that on
// the organization; MESITA-1892 removed the layer and the place inherited it).
//
// THE SUPER-ADMIN EXEMPTION CAME BACK, and that is a real change, not a
// tidy-up. `requireOrgRole` had none on purpose — org membership was a
// business fact, and an operator acting on an org was expected to join it.
// The place-scoped `requireOwner` (auth-membership.ts) treats a super-admin as
// an owner everywhere, uniformly, and this door adopts that rather than
// inventing a second owner rule for one EF. What it costs: an operator can
// mint a login link into a restaurant's own Stripe dashboard without being on
// its team. The link is still single-use, short-lived and never stored.
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
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireOwner,
} from "../_shared/auth.ts";
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

type Body = {
  /** The merchant. One Connect account per place, so there is nothing left to
   *  resolve: the `orgId` this used to accept, and the place→org lookup behind
   *  it, went with the organization layer. */
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

  const placeId = (bodyRes.body.placeId ?? "").trim();
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const roleRes = await requireOwner(admin, authRes.user, placeId);
  if (!roleRes.ok) return roleRes.response;

  const rowRes = await admin
    .from("place_payment_accounts")
    .select()
    .eq("place_id", placeId)
    .maybeSingle();
  if (rowRes.error) {
    return json({ ok: false, error: `account_read: ${rowRes.error.message}` }, 500);
  }
  const row = (rowRes.data as PaymentAccountRow | null) ?? null;

  // Nothing to open. This is a normal state (the place has never onboarded),
  // so it answers with a code the console can branch on rather than an error
  // string it would have to pattern-match.
  if (!row) {
    return json({
      ok: false,
      error: "This place has no Stripe account yet.",
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
        "This place's Stripe account belongs to the other Stripe environment.",
      code: "account_wrong_universe",
    }, 409);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
  try {
    const link = await stripe.accounts.createLoginLink(row.stripe_account_id);
    return json({ ok: true, mock: false, url: link.url, account: row });
  } catch (err) {
    // THERE ARE TWO FAILURES HERE AND ONLY ONE OF THEM IS OURS (MESITA-1865).
    //
    // The Express Dashboard does not EXIST until the account finishes hosted
    // onboarding — `createLoginLink` refuses before that — so the commonest
    // way into this catch is an owner who closed the Stripe tab halfway. They
    // were told "payments aren't set up on Mesita's side, we've been notified",
    // which is false, unactionable, and points them away from the one thing
    // that would fix it. Stripe's own object decides which sentence they get,
    // because the mirror can be stale in either direction.
    const message = (err as { message?: string })?.message ??
      "Could not open the payments dashboard.";
    let submitted: boolean | null = null;
    try {
      const account = await stripe.accounts.retrieve(row.stripe_account_id);
      submitted = account.details_submitted === true;
      // Free the mirror from the staleness that put the button there at all.
      await writePaymentAccount(admin, {
        mode: "update",
        by: "place_id",
        id: placeId,
        patch: accountSnapshotFromStripe(account, keyIsLive(stripeKey)),
      });
    } catch (refreshErr) {
      console.error(
        `[get-payment-dashboard-link] could not re-read ${row.stripe_account_id}:`,
        refreshErr,
      );
    }

    if (submitted === false) {
      console.info(
        `[get-payment-dashboard-link] no dashboard yet for ` +
          `${row.stripe_account_id}: hosted onboarding is unfinished.`,
      );
      return json({
        ok: false,
        error:
          "Finish setting up your Stripe account first — the Stripe dashboard opens once Stripe has everything it asked for.",
        code: "onboarding_incomplete",
        account: row,
      }, 409);
    }

    // The genuine platform failure: most likely an account created BEFORE the
    // Express flip, since createLoginLink only works where the controller
    // granted Express dashboard access and controller properties are permanent.
    //
    // That is a fact about OUR configuration, and the reader is the restaurant
    // owner, so Stripe's wording goes to the log and not to their browser —
    // same rule failure-copy.ts (MESITA-1645) applies next door. The sentence
    // is duplicated rather than imported because EFs do not reach into each
    // other's directories; the test below is what keeps the two in step.
    console.error(
      `[get-payment-dashboard-link] createLoginLink failed for ` +
        `${row.stripe_account_id} — the merchant saw a generic sentence. ` +
        `Stripe said: ${message}`,
    );
    return json({
      ok: false,
      error:
        "Payments aren’t set up on Mesita’s side yet — nothing to fix on your end. We’ve been notified.",
      code: "stripe_platform_error",
    }, 503);
  }
});
