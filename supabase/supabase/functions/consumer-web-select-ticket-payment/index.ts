// Supabase Edge Function — consumer-web-select-ticket-payment
//
// THE TICKET v4, step 5 (MESITA-1092): after approval — the last moment
// anything can change the amount — the guest picks how they settle.
//
// C2 — exactly ONE live path: `at_place`. The guest pays the place directly,
// at the register, by whatever instrument the place accepts; the axis is WHO
// takes the money, not the instrument. `mesita` (card through Mesita) is
// STAGED: the client renders it as coming, and a client that calls it anyway
// gets 501 code:"staged" and writes nothing. No PSP, no chargebacks, no
// refunds this pass — the spec itself promises the restaurant never handles
// a refund.
//
// method:null rolls `paying` back to `approved` (the guest changed their
// mind before staff confirmed) — §12's one legal backward edge.
//
// Caller: consumer. Verb: select. Noun: ticket-payment.
//
// Body:     { ticketId, method: "at_place" | "mesita" | null }
// Response: { ok: true, status } | 400 | 404 | 409 | 501 staged

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";

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

  const method = bodyRes.body.method ?? null;
  if (method !== null && method !== "at_place" && method !== "mesita") {
    return json(
      { ok: false, error: "method must be at_place, mesita, or null" },
      400,
    );
  }
  if (method === "mesita") {
    // Staged (C2): named so the UI can render the real shape, never charged.
    return json(
      {
        ok: false,
        code: "staged",
        error: "Card through Mesita isn't live yet — pay at the place.",
      },
      501,
    );
  }

  const admin = adminClient(envRes.env);
  const ticketRow = await admin
    .from("visit_tickets")
    .select("id, consumer_id, status, paid_method")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json({ ok: false, error: `ticket_lookup: ${ticketRow.error.message}` }, 500);
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
    const update = await admin
      .from("visit_tickets")
      .update({ status: TICKET_STATUS.paying, paid_method: "at_place" })
      .eq("id", ticket.id)
      .eq("status", TICKET_STATUS.approved)
      .select("id, status")
      .maybeSingle();
    if (update.error) {
      return json({ ok: false, error: `ticket_update: ${update.error.message}` }, 500);
    }
    if (!update.data) {
      return json({ ok: false, code: "stale_state", error: "Ticket changed — refresh." }, 409);
    }
    return json({ ok: true, status: TICKET_STATUS.paying });
  }

  // method === null — abandon the payment, back to approved.
  if (ticket.status === TICKET_STATUS.approved) {
    return json({ ok: true, already: true, status: ticket.status });
  }
  if (ticket.status !== TICKET_STATUS.paying) {
    return json(
      { ok: false, code: "stale_state", status: ticket.status, error: `Ticket is ${ticket.status}.` },
      409,
    );
  }
  const rollback = await admin
    .from("visit_tickets")
    .update({ status: TICKET_STATUS.approved, paid_method: null })
    .eq("id", ticket.id)
    .eq("status", TICKET_STATUS.paying)
    .select("id, status")
    .maybeSingle();
  if (rollback.error) {
    return json({ ok: false, error: `ticket_update: ${rollback.error.message}` }, 500);
  }
  if (!rollback.data) {
    return json({ ok: false, code: "stale_state", error: "Ticket changed — refresh." }, 409);
  }
  return json({ ok: true, status: TICKET_STATUS.approved });
});
