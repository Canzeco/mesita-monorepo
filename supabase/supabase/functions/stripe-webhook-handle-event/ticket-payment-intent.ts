// Connect-delivered payment_intent.{succeeded,payment_failed} → the
// reliability backstop for Mesita Pay (MESITA-1414).
//
// consumer-web-select-ticket-payment confirms the charge synchronously and
// closes the ticket itself in the same request — this handler exists for
// the rare case that crashes between Stripe confirming and that function's
// own close/rollback running (a dropped connection, a runtime timeout): the
// ticket id rides PaymentIntent.metadata (mesita-pay-charge.ts), so the
// event alone is enough to finish the job the request never got to.
//
// Idempotent both ways: finalizeInformalTicket no-ops on an already-CLOSED
// ticket, and the rollback below only fires from `paying` — a ticket the
// synchronous path already moved on from is left alone either way.

import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { TICKET_STATE } from "../_shared/ticket-state.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";
import { closeTicketAndEnqueueReview } from "../_shared/ticket-informal.ts";

async function loadPayingMesitaPayTicket(
  admin: SupabaseClient,
  ticketId: string,
) {
  const { data } = await admin
    .from("visit_tickets")
    .select("id, consumer_id, state, paid_method, project_id")
    .eq("id", ticketId)
    .maybeSingle();
  const row = data as
    | {
      id: string;
      consumer_id: string;
      state: string;
      paid_method: string | null;
      project_id: string;
    }
    | null;
  if (!row || row.state !== TICKET_STATE.paying || row.paid_method !== "mesita_pay") {
    return null;
  }
  return row;
}

export async function handleTicketPaymentIntentSucceeded(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const ticketId = intent.metadata?.ticket_id;
  if (!ticketId) return;
  const ticket = await loadPayingMesitaPayTicket(admin, ticketId);
  if (!ticket) return; // already closed by the synchronous path, or not ours
  const closed = await closeTicketAndEnqueueReview(
    admin,
    ticket.id,
    ticket.consumer_id,
    ticket.project_id,
    { paidMethod: "mesita_pay" },
  );
  if (!closed.ok) {
    throw new Error(`ticket_payment_intent_close: ${closed.error}`);
  }
}

export async function handleTicketPaymentIntentFailed(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const ticketId = intent.metadata?.ticket_id;
  if (!ticketId) return;
  const ticket = await loadPayingMesitaPayTicket(admin, ticketId);
  if (!ticket) return; // already resolved by the synchronous path
  const rollback = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: { state: TICKET_STATE.approved, paid_method: null },
    guard: { eq: { state: TICKET_STATE.paying } },
    select: "id",
  });
  if (!rollback.ok) {
    throw new Error(`ticket_payment_intent_rollback: ${rollback.error}`);
  }
}
