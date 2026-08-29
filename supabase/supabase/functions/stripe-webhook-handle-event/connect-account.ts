// Connect account.updated → mirror snapshot (the PLATFORM account layer;
// law in _shared/stripe-connect.ts, aggregate in _shared/payment-account-doc.ts).
//
// UPDATE-only by stripe_account_id: an account we don't know (not ours, or
// another universe's) is a DETECTED, acknowledged no-op — never an insert.
// Known benign race: the account.updated burst fired by accounts.create can
// reach us before the EF's row insert commits; the event is then swallowed
// with its dedupe row retained (only handler THROWS delete it). Harmless —
// onboarding emits bursts of account.updated and the admin read has
// refresh-on-read; the mirror converges on the next event or refresh.
// Livemode comes from event.livemode (Stripe.Account has no such field).

import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { accountSnapshotFromStripe } from "../_shared/stripe-connect.ts";
import { writePaymentAccount } from "../_shared/payment-account-doc.ts";

export async function handleConnectAccountUpdated(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const account = event.data.object as Stripe.Account;
  if (!account?.id) return;
  const snapshot = accountSnapshotFromStripe(account, event.livemode === true);
  const res = await writePaymentAccount(admin, {
    mode: "update",
    by: "stripe_account_id",
    id: account.id,
    patch: snapshot,
  });
  if (!res.ok) {
    throw new Error(`payment_account_mirror: ${res.error}`);
  }
  if (!res.row) {
    console.log(
      `[stripe-webhook-handle-event] account.updated for unknown account ${account.id} — acknowledged no-op (not ours, or another universe)`,
    );
  }
}
