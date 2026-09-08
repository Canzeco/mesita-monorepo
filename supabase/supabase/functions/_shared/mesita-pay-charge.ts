// Mesita Pay — the direct-charge gateway (MESITA-1414).
//
// Stripe's current, non-legacy pattern for reusing a platform-saved
// PaymentMethod across connected accounts ("Share payment methods across
// multiple accounts for direct charges"):
//
//   1. Clone: POST /v1/payment_methods { customer: <platform customer>,
//      payment_method: <platform pm> } with Stripe-Account: <connected acct>.
//      The clone is an independent object, NOT kept in sync with the
//      original, and — Stripe's own words — "isn't attached to a customer"
//      so a charge against it "consumes it": it cannot be reused.
//   2. To avoid re-consuming a fresh clone (and the throwaway Customer that
//      would imply) on every single visit, attach the clone to a Customer
//      that lives on the CONNECTED account and reuse that Customer across
//      visits — Pato's decision (2026-09-02): the guest gets one durable,
//      dashboard-visible Customer per organization, cached in
//      organization_guest_customers. A fresh PaymentMethod is still cloned
//      and attached on every charge (clones can't be reused regardless),
//      but the CUSTOMER identity — and the disclosure the guest already saw
//      — stays the same visit over visit.
//   3. Charge: a normal PaymentIntent on the connected account, confirmed
//      with the attached clone.
//
// DIRECT charges only (never destination) — the frozen law in
// stripe-connect.ts. The organization is merchant of record; funds settle to
// its connected account; Mesita's application_fee_amount (if any) is the
// only money that ever touches the platform.

import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getOrganizationGuestCustomer,
  writeOrganizationGuestCustomer,
} from "./organization-guest-customer-doc.ts";

/** What a browser needs to finish a 3DS challenge on a DIRECT charge. The
 *  connected account id is not optional decoration: the intent lives on that
 *  account, so Stripe.js must be initialised against it or `handleNextAction`
 *  looks for the intent on the platform and cannot find it. */
export type ChargeAction = {
  clientSecret: string;
  paymentIntentId: string;
  connectedAccountId: string;
};

export type ChargeOutcome =
  | { ok: true; paymentIntentId: string }
  | {
    ok: false;
    /** The bank wants step-up authentication. THIS IS NOT A DEAD END any
     *  more (MESITA-1670): the PaymentIntent is live and confirmable, and
     *  `action` carries everything the browser needs to finish it. The
     *  caller must NOT roll its ticket back — the intent is real, and
     *  `payment_intent.succeeded` on the connected account will close the
     *  ticket through the webhook backstop even if the guest never comes
     *  back to this tab. Rolling back would strand a chargeable intent. */
    code: "requires_action";
    error: string;
    action: ChargeAction;
  }
  | {
    ok: false;
    /** card_declined / no_card / stripe_error: terminal, roll back and let
     *  the guest pay at the register. */
    code: "card_declined" | "no_card" | "stripe_error";
    error: string;
  };

/**
 * Resolves (creating if needed) the connected-account Customer this guest
 * clones onto for charges at `organizationId`, per the cache described
 * above. Returns the connected-account customer id.
 */
async function resolveConnectedCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  args: { organizationId: string; consumerId: string; connectedAccountId: string },
): Promise<string> {
  const cached = await getOrganizationGuestCustomer(
    admin,
    args.organizationId,
    args.consumerId,
  );
  if (cached) return cached.stripe_customer_id;

  const customer = await stripe.customers.create(
    { metadata: { consumer_id: args.consumerId, mesita_kind: "guest_clone" } },
    { stripeAccount: args.connectedAccountId },
  );
  const written = await writeOrganizationGuestCustomer(admin, {
    organizationId: args.organizationId,
    consumerId: args.consumerId,
    stripeCustomerId: customer.id,
  });
  if (!written.ok) {
    // A concurrent charge by the same guest at the same org won the upsert
    // first (or the write itself failed) — re-read and converge on
    // whichever id is now cached rather than leave two live customers.
    const raced = await getOrganizationGuestCustomer(
      admin,
      args.organizationId,
      args.consumerId,
    );
    if (raced) return raced.stripe_customer_id;
  }
  return customer.id;
}

/**
 * Clones the guest's PLATFORM default PaymentMethod onto the connected
 * account and attaches it to `connectedCustomerId`, then charges it as a
 * DIRECT charge for `amountCents`. Idempotent per `idempotencyKey` — a
 * retried call (a double-tap, a client retry after a dropped response)
 * returns Stripe's cached result for the same key instead of charging
 * twice.
 */
export async function chargeTicketWithMesitaPay(
  stripe: Stripe,
  admin: SupabaseClient,
  args: {
    organizationId: string;
    connectedAccountId: string;
    consumerId: string;
    ticketId: string;
    platformCustomerId: string;
    platformPaymentMethodId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    /** Cents kept on the platform balance. Omitted (no fee) until a
     *  business decision sets one — the plumbing exists so that decision is
     *  a one-line change, not a new code path. */
    applicationFeeCents?: number;
  },
): Promise<ChargeOutcome> {
  const connectedCustomerId = await resolveConnectedCustomer(stripe, admin, {
    organizationId: args.organizationId,
    consumerId: args.consumerId,
    connectedAccountId: args.connectedAccountId,
  });

  let clonedPaymentMethodId: string;
  try {
    const cloned = await stripe.paymentMethods.create(
      {
        customer: args.platformCustomerId,
        payment_method: args.platformPaymentMethodId,
      },
      { stripeAccount: args.connectedAccountId },
    );
    await stripe.paymentMethods.attach(
      cloned.id,
      { customer: connectedCustomerId },
      { stripeAccount: args.connectedAccountId },
    );
    clonedPaymentMethodId = cloned.id;
  } catch (err) {
    return {
      ok: false,
      code: "stripe_error",
      error: `payment_method_clone: ${String(err)}`,
    };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: args.amountCents,
        currency: args.currency.toLowerCase(),
        customer: connectedCustomerId,
        payment_method: clonedPaymentMethodId,
        confirm: true,
        // The ticket id rides the PaymentIntent so the webhook — the
        // reliability backstop for the rare crash between a Stripe success
        // and this function closing the ticket itself — can find it without
        // a second lookup table.
        metadata: { ticket_id: args.ticketId, consumer_id: args.consumerId },
        ...(args.applicationFeeCents
          ? { application_fee_amount: args.applicationFeeCents }
          : {}),
      },
      { stripeAccount: args.connectedAccountId, idempotencyKey: args.idempotencyKey },
    );
    if (intent.status === "succeeded") {
      return { ok: true, paymentIntentId: intent.id };
    }
    if (intent.status === "requires_action") {
      // A client secret is the one field on a PaymentIntent that Stripe may
      // omit; without it the browser has nothing to confirm against, so this
      // degrades to the old terminal behaviour rather than promising a step
      // that cannot run.
      if (!intent.client_secret) {
        return {
          ok: false,
          code: "card_declined",
          error:
            "Your bank needs extra verification for this card — pay at the register instead.",
        };
      }
      return {
        ok: false,
        code: "requires_action",
        error: "Your bank needs to verify this payment.",
        action: {
          clientSecret: intent.client_secret,
          paymentIntentId: intent.id,
          connectedAccountId: args.connectedAccountId,
        },
      };
    }
    return {
      ok: false,
      code: "card_declined",
      error: `Payment ${intent.status} — try a different card or pay at the register.`,
    };
  } catch (err) {
    const stripeErr = err as { code?: string; type?: string; message?: string };
    if (stripeErr.type === "StripeCardError") {
      return {
        ok: false,
        code: "card_declined",
        error: stripeErr.message ??
          "Your card was declined — try a different card or pay at the register.",
      };
    }
    return { ok: false, code: "stripe_error", error: `charge: ${String(err)}` };
  }
}
