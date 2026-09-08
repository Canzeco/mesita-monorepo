// Supabase Edge Function — consumer-web-select-ticket-payment
//
// THE TICKET v4, step 5 (MESITA-1092): after approval — the last moment
// anything can change the amount — the guest picks how they settle.
//
// Two live paths, WHO takes the money:
//   - `at_place`: the guest pays the place directly, at the register, by
//     whatever instrument it accepts. No PSP.
//   - `mesita_pay` (MESITA-1414): the gateway. Clones the guest's saved
//     platform card onto the place's organization's connected Stripe
//     account and runs a DIRECT charge (_shared/mesita-pay-charge.ts) —
//     confirmed synchronously, so a success closes the ticket immediately
//     via the same closeTicketAndEnqueueReview the staff check page uses,
//     no register touch needed. A decline, a card needing extra bank
//     verification (no client-side 3DS step exists yet), or the place not
//     actually being chargeable all roll the ticket back to `approved` so
//     the guest can fall back to at_place.
//
// The old C2 value `mesita` gets 410 and writes nothing (MESITA-1114) — a
// closed door, not the one `mesita_pay` reopens.
//
// method:null rolls `paying` back to `approved` (the guest changed their
// mind before staff confirmed, or a mesita_pay attempt failed) — §12's one
// legal backward edge.
//
// Caller: consumer. Verb: select. Noun: ticket-payment.
//
// Body:     { ticketId, method: "at_place" | "mesita_pay" | null }
// Response: { ok: true, state } | 400 | 402 | 404 | 409 | 410 retired

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { TICKET_STATE, CLOSED_TICKET_STATE } from "../_shared/ticket-state.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";
import { closeTicketAndEnqueueReview } from "../_shared/ticket-informal.ts";
import { parseSelectTicketPaymentMethod } from "../_shared/select-ticket-payment-method.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { resolveChargeableOrganizationAccount } from "../_shared/mesita-pay-readiness.ts";
import { chargeTicketWithMesitaPay } from "../_shared/mesita-pay-charge.ts";
import {
  ensureConsumerCustomer,
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import { cardsMockMode, defaultPaymentMethodId } from "../_shared/consumer-cards.ts";
import { stripePublishableKey, stripeSecretKey } from "../_shared/stripe-env.ts";

type Body = { ticketId?: string; method?: string | null };

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
  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const parsed = parseSelectTicketPaymentMethod(bodyRes.body.method);
  if (!parsed.ok) return json(parsed.body, parsed.status);
  const method = parsed.method;

  const admin = adminClient(envRes.env);
  const ticketRow = await admin
    .from("visit_tickets")
    .select(
      "id, consumer_id, state, paid_method, project_id, approved_amount_due_cents, currency",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json({
      ok: false,
      error: `ticket_lookup: ${ticketRow.error.message}`,
    }, 500);
  }
  if (!ticketRow.data || ticketRow.data.consumer_id !== authRes.user.id) {
    return json({ ok: false, error: "Ticket not found" }, 404);
  }
  const ticket = ticketRow.data;

  if (method === "mesita_pay") {
    // Retry-safe: a prior call that transitioned to `paying` but crashed
    // before the charge resolved may be retried — the idempotency key below
    // means Stripe itself never double-charges for the same attempt.
    if (
      ticket.state === TICKET_STATE.paying &&
      ticket.paid_method !== "mesita_pay"
    ) {
      return json(
        {
          ok: false,
          code: "stale_state",
          state: ticket.state,
          error: "Already paying at the register — refresh.",
        },
        409,
      );
    }
    if (
      ticket.state !== TICKET_STATE.approved &&
      ticket.state !== TICKET_STATE.paying
    ) {
      return json(
        {
          ok: false,
          code: "stale_state",
          state: ticket.state,
          error: `Ticket is ${ticket.state} — payment starts after approval.`,
        },
        409,
      );
    }
    const amountCents = ticket.approved_amount_due_cents as number | null;
    if (amountCents === null || amountCents === undefined) {
      return json(
        { ok: false, error: "Ticket has no approved amount due" },
        500,
      );
    }

    const visitsConfig = await loadVisitsConfig(admin);
    const chargeable = await resolveChargeableOrganizationAccount(
      admin,
      visitsConfig.payCard,
      ticket.project_id as string | null,
    );
    if (!chargeable) {
      return json(
        {
          ok: false,
          code: "not_chargeable",
          error: "Mesita Pay isn't available for this place — pay at the register.",
        },
        409,
      );
    }

    const stripeKey = stripeSecretKey();
    if (cardsMockMode(stripeKey)) {
      return json(
        {
          ok: false,
          code: "no_card",
          error: "Add a card in Me › Cards before paying with Mesita Pay.",
        },
        409,
      );
    }
    const liveBlock = liveChargesBlocked(stripeKey!);
    if (liveBlock) {
      return json({ ok: false, error: liveBlock, code: "stripe_live_blocked" }, 409);
    }
    const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
    const platformCustomerId = await ensureConsumerCustomer(
      admin,
      stripe,
      authRes.user.id,
    );
    const paymentMethodId = await defaultPaymentMethodId(
      stripe,
      platformCustomerId,
    );
    if (!paymentMethodId) {
      return json(
        {
          ok: false,
          code: "no_card",
          error: "Add a card in Me › Cards before paying with Mesita Pay.",
        },
        409,
      );
    }

    if (ticket.state === TICKET_STATE.approved) {
      const start = await writeTicket(admin, {
        mode: "update",
        id: ticket.id,
        patch: { state: TICKET_STATE.paying, paid_method: "mesita_pay" },
        guard: { eq: { state: TICKET_STATE.approved } },
        select: "id, state",
      });
      if (!start.ok) {
        return json({ ok: false, error: `ticket_update: ${start.error}` }, 500);
      }
      if (!start.row) {
        return json(
          { ok: false, code: "stale_state", error: "Ticket changed — refresh." },
          409,
        );
      }
    }

    const outcome = await chargeTicketWithMesitaPay(stripe, admin, {
      organizationId: chargeable.organizationId,
      connectedAccountId: chargeable.connectedAccountId,
      consumerId: authRes.user.id,
      ticketId: ticket.id as string,
      platformCustomerId,
      platformPaymentMethodId: paymentMethodId,
      amountCents,
      currency: (ticket.currency as string | null) ?? "MXN",
      idempotencyKey: `mesita-pay:${ticket.id}:${amountCents}`,
    });

    // THE BANK WANTS A STEP, AND THAT IS NOT A FAILURE (MESITA-1670).
    //
    // The branch below this one rolls the ticket back to `approved` so the
    // guest can pay at the register. Doing that here would be a bug with
    // money in it: the PaymentIntent is LIVE and confirmable, so a rollback
    // leaves a chargeable intent pointing at a ticket that no longer claims
    // to be paying — and `payment_intent.succeeded` would then arrive at a
    // webhook whose loader refuses anything not still in `paying`.
    //
    // So the ticket STAYS in `paying` and the response carries what the
    // browser needs to finish. If the guest abandons the challenge, the
    // intent simply never succeeds and staff can cancel the ticket; if they
    // complete it in a tab that then dies, the webhook backstop closes it
    // without this request ever running again.
    //
    // 200, not 402: the request did what was asked. Only a terminal outcome
    // is a payment failure.
    if (!outcome.ok && outcome.code === "requires_action") {
      const publishableKey = stripePublishableKey();
      if (!publishableKey) {
        // No browser-safe key means no challenge can be run, and an intent
        // was already created. Say so as an operator problem rather than
        // blaming the card: the guest's fallback is the register either way,
        // but the log has to name the missing variable.
        console.error(
          "mesita-pay 3DS: no STRIPE_PUBLISHABLE_KEY for the active mode; " +
            `intent ${outcome.action.paymentIntentId} left unconfirmed`,
        );
        return json(
          {
            ok: false,
            code: "requires_action",
            error:
              "Your bank needs extra verification for this card — pay at the register instead.",
          },
          402,
        );
      }
      return json({
        ok: true,
        state: TICKET_STATE.paying,
        requiresAction: { ...outcome.action, publishableKey },
      });
    }

    if (!outcome.ok) {
      // Roll back to approved so the guest can fall back to at_place —
      // guarded so a state that changed underneath (staff cancelled while
      // the charge was in flight) is reported, not silently overwritten.
      await writeTicket(admin, {
        mode: "update",
        id: ticket.id,
        patch: { state: TICKET_STATE.approved, paid_method: null },
        guard: { eq: { state: TICKET_STATE.paying } },
        select: "id",
      });
      return json({ ok: false, code: outcome.code, error: outcome.error }, 402);
    }

    const closed = await closeTicketAndEnqueueReview(
      admin,
      ticket.id,
      ticket.consumer_id as string,
      ticket.project_id as string,
      { paidMethod: "mesita_pay" },
    );
    if (!closed.ok) {
      // The charge succeeded — never leave the ticket stuck in `paying`
      // over a close-side failure. Surface it distinctly: this needs a
      // human look, not a retry that could double-charge.
      return json(
        {
          ok: false,
          code: "charged_not_closed",
          error: `Payment succeeded but closing the ticket failed: ${closed.error}`,
        },
        500,
      );
    }
    return json({ ok: true, state: CLOSED_TICKET_STATE });
  }

  if (method === "at_place") {
    if (ticket.state === TICKET_STATE.paying) {
      return json({ ok: true, already: true, state: ticket.state });
    }
    if (ticket.state !== TICKET_STATE.approved) {
      return json(
        {
          ok: false,
          code: "stale_state",
          state: ticket.state,
          error: `Ticket is ${ticket.state} — payment starts after approval.`,
        },
        409,
      );
    }
    const update = await writeTicket(admin, {
      mode: "update",
      id: ticket.id,
      patch: { state: TICKET_STATE.paying, paid_method: "at_place" },
      guard: { eq: { state: TICKET_STATE.approved } },
      select: "id, state",
    });
    if (!update.ok) {
      return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
    }
    if (!update.row) {
      return json({
        ok: false,
        code: "stale_state",
        error: "Ticket changed — refresh.",
      }, 409);
    }
    return json({ ok: true, state: TICKET_STATE.paying });
  }

  // method === null — abandon the payment, back to approved.
  if (ticket.state === TICKET_STATE.approved) {
    return json({ ok: true, already: true, state: ticket.state });
  }
  if (ticket.state !== TICKET_STATE.paying) {
    return json(
      {
        ok: false,
        code: "stale_state",
        state: ticket.state,
        error: `Ticket is ${ticket.state}.`,
      },
      409,
    );
  }
  const rollback = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: { state: TICKET_STATE.approved, paid_method: null },
    guard: { eq: { state: TICKET_STATE.paying } },
    select: "id, state",
  });
  if (!rollback.ok) {
    return json({ ok: false, error: `ticket_update: ${rollback.error}` }, 500);
  }
  if (!rollback.row) {
    return json({
      ok: false,
      code: "stale_state",
      error: "Ticket changed — refresh.",
    }, 409);
  }
  return json({ ok: true, state: TICKET_STATE.approved });
});
