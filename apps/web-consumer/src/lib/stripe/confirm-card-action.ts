"use client";

import { loadStripe } from "@stripe/stripe-js";

// The 3DS step, and the ONLY thing Stripe.js is here for (MESITA-1670).
//
// Mesita Pay confirms its PaymentIntent SERVER-side, on the place's connected
// account. When the bank wants step-up authentication that confirm comes back
// `requires_action`, and until now that was the end of the road: the guest was
// told to pay at the register. A ticket has a register. Buying Credits will
// not, so the dead end had to go before any other money-in path is built on
// the same gateway.
//
// WHAT THIS IS NOT. No Payment Element, no `@stripe/react-stripe-js`, and no
// card entry of any kind. A card is still typed on Stripe's own hosted page
// (`consumer-web-add-card`), so no PAN ever reaches this codebase and the PCI
// posture is exactly what it was. This module takes a client secret the server
// already made and asks the browser to satisfy the challenge attached to it.
//
// `loadStripe` is called INSIDE the function, never at module scope: Stripe.js
// is a third-party script and the overwhelming majority of guests will never
// hit a challenge. Importing it lazily keeps it off every other page load.
//
// THE ACCOUNT IS NOT OPTIONAL. This is a DIRECT charge, so the intent lives on
// the connected account. Stripe.js initialised against the platform would look
// for it there, not find it, and fail with something that reads like a bad
// client secret.

export type TicketPaymentAction = {
  clientSecret: string;
  paymentIntentId: string;
  connectedAccountId: string;
  /** Handed down WITH the secret rather than read from a NEXT_PUBLIC_ build
   *  variable, so it always addresses the universe STRIPE_MODE is in. A key
   *  baked into a deploy cannot follow a mode flip. */
  publishableKey: string;
};

export async function confirmCardAction(
  action: TicketPaymentAction,
): Promise<void> {
  const stripe = await loadStripe(action.publishableKey, {
    stripeAccount: action.connectedAccountId,
  });
  if (!stripe) {
    throw new Error(
      "Couldn't reach Stripe to verify this payment — check your connection, or pay at the register.",
    );
  }
  const { error } = await stripe.handleNextAction({
    clientSecret: action.clientSecret,
  });
  // Stripe's own message is the right one here, unlike on the Connect paths:
  // the reader is the cardholder, the failure is about THEIR bank, and
  // "authentication failed" is exactly what they need to hear.
  if (error) {
    throw new Error(
      error.message ??
        "Your bank couldn't verify this payment — try again, or pay at the register.",
    );
  }
}
