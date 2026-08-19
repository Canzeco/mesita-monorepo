// Supabase Edge Function — consumer-web-report-ticket (product caller)
//
// v3c (MESITA-851), step 7 of the reward-ticket lifecycle: the guest reports
// a problem with a visit. This is the ONLY route a guest has that isn't
// arguing with the person holding the terminal — v3a took staff out of
// adjudicating tasks and v3b made the bill optional, so the in-flow moments
// where a problem used to surface are gone.
//
// A report is EVIDENCE, never an automatic strike. Deliberate: a strike
// pauses a paid place's promos for 30 days, and the guest holds their own
// QR — letting an unverified tap trigger that would hand every guest a
// button that costs a place real money. Reports land `open` for an operator
// to read in admin-web-list-notifications and act on with the existing
// business-web-record-strike path.
//
// Window: from creation until REPORT_WINDOW_DAYS after the ticket closed —
// a guest usually realises they were shorted once they're outside the venue.
//
// Body:     { ticketId: string, reason: string, details?: string }
// Response: { ok: true, report } | 400 | 404 | 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

// Mirrors the CHECK on public.ticket_reports.reason.
const REASONS = [
  "discount_refused",
  "closed_without_honoring",
  "qr_not_scanned",
  "other",
] as const;
type Reason = (typeof REASONS)[number];

const REPORT_WINDOW_DAYS = 14;
const MAX_DETAILS = 1000;

type Body = { ticketId?: string; reason?: string; details?: string };

function isReason(v: unknown): v is Reason {
  return (REASONS as readonly unknown[]).includes(v);
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

  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const reason = bodyRes.body.reason;
  if (!isReason(reason)) {
    return json(
      { ok: false, error: `reason must be one of: ${REASONS.join(", ")}` },
      400,
    );
  }

  const rawDetails = typeof bodyRes.body.details === "string"
    ? bodyRes.body.details.trim()
    : "";
  if (rawDetails.length > MAX_DETAILS) {
    return json(
      { ok: false, error: `details must be ${MAX_DETAILS} characters or fewer` },
      400,
    );
  }
  const details = rawDetails.length > 0 ? rawDetails : null;

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("visit_tickets")
    .select("id, consumer_id, project_id, status, created_at, revealed_at, cancelled_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json(
      { ok: false, error: `ticket_lookup: ${ticketRow.error.message}` },
      500,
    );
  }
  if (!ticketRow.data || ticketRow.data.consumer_id !== authRes.user.id) {
    // Uniform miss — never confirms someone else's ticket exists.
    return json({ ok: false, error: "Ticket not found" }, 404);
  }
  const ticket = ticketRow.data;

  // The window closes REPORT_WINDOW_DAYS after the ticket ended. A live
  // ticket is always reportable — that is the point of "live for the whole
  // ticket".
  const endedAt = (ticket.revealed_at ?? ticket.cancelled_at) as string | null;
  if (endedAt) {
    const closedMs = new Date(endedAt).getTime();
    const deadline = closedMs + REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Number.isFinite(closedMs) && Date.now() > deadline) {
      return json(
        {
          ok: false,
          code: "window_closed",
          error:
            `This visit is more than ${REPORT_WINDOW_DAYS} days old. Contact Mesita support instead.`,
        },
        409,
      );
    }
  }

  const inserted = await admin
    .from("ticket_reports")
    .insert({
      ticket_id: ticket.id,
      consumer_id: ticket.consumer_id,
      project_id: ticket.project_id,
      reason,
      details,
    })
    .select("id, reason, details, status, created_at")
    .single();
  if (inserted.error) {
    // The partial unique index (one OPEN report per ticket) is the guard
    // against a guest filing the same complaint repeatedly.
    if (inserted.error.code === "23505") {
      return json(
        {
          ok: false,
          code: "already_reported",
          error: "You already reported this visit — Mesita is looking at it.",
        },
        409,
      );
    }
    return json(
      { ok: false, error: `report_insert: ${inserted.error.message}` },
      500,
    );
  }

  return json({ ok: true, report: inserted.data });
});
