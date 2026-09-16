// Supabase Edge Function — business-web-manage-membership
//
// The door OUT of Mesita Partner (MESITA-1891). An owner opens Stripe's own
// Billing Portal for the place's yearly Mesita Membership, and cancels there.
//
// MESITA WRITES NO CANCELLATION LOGIC, AND THAT IS THE WHOLE DESIGN. A
// "Cancel" button of our own would be a second writer of the subscription's
// fate racing the one Stripe already tells us about: we would have to decide
// immediate-versus-period-end, mirror `cancel_at_period_end`, and then handle
// the `customer.subscription.updated` that arrives moments later saying the
// same thing. The portal moves the subscription IN STRIPE, the webhook
// (`stripe-webhook-handle-event`) mirrors what came back exactly as it
// mirrors a renewal, and `partner_memberships` keeps one writer. Invoices,
// the receipt history and the card on file come along for free.
//
// Body: { placeId | projectId, returnUrl? } — returnUrl ABSOLUTE, same rule
//       Account Links taught us (MESITA-1643): no browser sets an Origin on
//       the console's server-action hop, so a relative path is Stripe's 400.
// Response: { ok: true, url: string }         a portal session to send them to
//           { ok: true, url: null, mock: true } nothing to manage in Stripe
//
// Auth: `requireOwner` on the place. Same rung as buying it
// (`business-web-start-membership`): the person who signs a yearly commitment
// is the person who ends it. An editor gets the 403 the console's own copy
// already implies.
//
// MOCK_SUBSCRIPTION IS ANSWERED, NEVER FLIPPED (MESITA-37). With the mock on
// — or with no Stripe secret at all — there is no Stripe subscription behind
// the partnership, so this returns `url: null, mock: true` and calls Stripe
// zero times. The console says so in one line, which is the same shape
// `business-web-get-payment-dashboard-link` uses for a mock Connect account.
// This EF never reads STRIPE_ALLOW_LIVE and never writes any of the three
// operator flags.
//
// NOT BEHIND `liveChargesBlocked`. That gate (MESITA-37) guards the paths
// that OPEN a charge — checkout, catalog provisioning, Connect account
// creation — and its own docblock excludes cancels. A portal session is how a
// place stops being billed; refusing it on live keys would be the one refusal
// that costs the operator money.
//
// Local:  supabase functions serve business-web-manage-membership
// Deploy: supabase functions deploy business-web-manage-membership

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
  readPlaceBillingCustomer,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";

type Body = { placeId?: unknown; projectId?: unknown; returnUrl?: unknown };

// ⚠️ DEMO MOCK — the one on/off switch shared with the checkout EFs. Agents
// must never flip it (MESITA-37); it is an operator's call. Read here only to
// answer "is there a Stripe subscription behind this partnership at all".
const MOCK_SUBSCRIPTION =
  (Deno.env.get("MOCK_SUBSCRIPTION") ?? "true").toLowerCase() !== "false";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const roleRes = await requireOwner(
    admin,
    authRes.user,
    placeId,
    "Only this place's owner can manage the Membership.",
  );
  if (!roleRes.ok) return roleRes.response;

  const stripeKey = stripeSecretKey();
  // The mock grant has no Stripe subscription, so there is nothing to open.
  // Answered BEFORE the customer read: a mock environment must not depend on
  // a column that only the real path ever fills.
  if (MOCK_SUBSCRIPTION || !stripeKey) {
    return json({ ok: true, url: null, mock: true });
  }

  const anchor = await readPlaceBillingCustomer(admin, placeId);
  if (!anchor.ok) {
    return json(
      { ok: false, error: anchor.error, code: anchor.code },
      anchor.code === "place_not_found" ? 404 : 409,
    );
  }

  const origin = req.headers.get("origin") ?? "";
  const returnUrl = str(bodyRes.body.returnUrl) ||
    `${origin}/places/${placeId}/products?membership=managed`;
  if (!/^https?:\/\//.test(returnUrl)) {
    return json(
      {
        ok: false,
        error: "returnUrl must be absolute — Stripe rejects a relative path.",
        code: "relative_return_url",
      },
      400,
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: anchor.customerId,
      return_url: returnUrl,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    // Stripe named the problem — usually "No configuration provided", which is
    // a dashboard step and not something an owner can retry into existence. So
    // say what Stripe said rather than "try again".
    const message = e instanceof Error ? e.message : String(e);
    return json(
      { ok: false, error: `Stripe: ${message}`, code: "stripe_error" },
      502,
    );
  }
});
