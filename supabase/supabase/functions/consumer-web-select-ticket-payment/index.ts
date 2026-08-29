// Supabase Edge Function — consumer-web-select-ticket-payment
//
// THE TICKET v4, step 5 (MESITA-1092): after approval — the last moment
// anything can change the amount — the guest picks how they settle.
//
// Exactly ONE live path: `at_place`. The guest pays the place directly,
// at the register, by whatever instrument the place accepts; the axis is WHO
// takes the money, not the instrument. No PSP on this ticket.
//
// The old C2 value `mesita` gets 410 and writes nothing (MESITA-1114). The
// rail it named is STAGED, not dead — Connect accounts landed in #1415 and
// the guest's saved cards in Me › More › Cards — but the charge path does
// not exist, so this door stays closed until the gateway PR reopens it with
// a new method value.
//
// method:null rolls `paying` back to `approved` (the guest changed their
// mind before staff confirmed) — §12's one legal backward edge.
//
// Caller: consumer. Verb: select. Noun: ticket-payment.
//
// Body:     { ticketId, method: "at_place" | null }
// Response: { ok: true, status } | 400 | 404 | 409 | 410 retired

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";
import { parseSelectTicketPaymentMethod } from "../_shared/select-ticket-payment-method.ts";

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
    .select("id, consumer_id, status, paid_method")
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

  if (method === "at_place") {
    if (ticket.status === TICKET_STATUS.paying) {
      return json({ ok: true, already: true, status: ticket.status });
    }
    if (ticket.status !== TICKET_STATUS.approved) {
      return json(
        {
          ok: false,
          code: "stale_state",
          status: ticket.status,
          error: `Ticket is ${ticket.status} — payment starts after approval.`,
        },
        409,
      );
    }
    const update = await writeTicket(admin, {
      mode: "update",
      id: ticket.id,
      patch: { status: TICKET_STATUS.paying, paid_method: "at_place" },
      guard: { eq: { status: TICKET_STATUS.approved } },
      select: "id, status",
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
    return json({ ok: true, status: TICKET_STATUS.paying });
  }

  // method === null — abandon the payment, back to approved.
  if (ticket.status === TICKET_STATUS.approved) {
    return json({ ok: true, already: true, status: ticket.status });
  }
  if (ticket.status !== TICKET_STATUS.paying) {
    return json(
      {
        ok: false,
        code: "stale_state",
        status: ticket.status,
        error: `Ticket is ${ticket.status}.`,
      },
      409,
    );
  }
  const rollback = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: { status: TICKET_STATUS.approved, paid_method: null },
    guard: { eq: { status: TICKET_STATUS.paying } },
    select: "id, status",
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
  return json({ ok: true, status: TICKET_STATUS.approved });
});
