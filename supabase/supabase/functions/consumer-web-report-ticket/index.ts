// Supabase Edge Function — consumer-web-report-ticket (natural caller)
//
// v3c (MESITA-851), step 7 of the lifecycle: the guest's route when the visit
// went wrong. Live from ticket creation through close and for a week after
// (_shared/ticket-report.ts), because a guest usually realises outside the
// venue.
//
// Why this exists at all: v3a took the staff verdict off the floor and v3b
// made the bill optional, so the guest has FEWER in-flow checkpoints where a
// problem surfaces. Without this, a refused discount has exactly one route —
// arguing with whoever holds the terminal.
//
// A report is EVIDENCE, not a strike. This function never touches
// strike_count, promo_paused_until, or the plan: strike 3 clears a paid
// posture, which is revenue-affecting and hard to reverse, and hanging that on
// one unverified guest claim would repeat exactly the mistake v3a removed
// (consequences from an unverifiable assertion). It lands in the operator
// inbox as `rewards.ticket_reported` and a human decides.
//
// One report per ticket — re-filing EDITS the open one, so a guest who picks
// the wrong reason or wants to add detail isn't stuck, and the inbox never
// shows one visit twice. A report already marked reviewed/dismissed is closed
// to edits.
//
// Body:     { ticketId: string, reason: ReportReason, detail?: string }
// Response: { ok: true, report: {...} } | { ok, error, code? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  isReportReason,
  isTicketReportable,
  REPORT_REASONS,
} from "../_shared/ticket-report.ts";

type Body = { ticketId?: string; reason?: string; detail?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const reason = bodyRes.body.reason;
  if (!isReportReason(reason)) {
    return json(
      {
        ok: false,
        error: `reason must be one of: ${REPORT_REASONS.join(", ")}`,
      },
      400,
    );
  }
  // The column caps at 1000; trim here so a long paste is accepted rather
  // than 400ing the guest mid-complaint.
  const detail = (bodyRes.body.detail ?? "").toString().trim().slice(0, 1000) ||
    null;

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("tickets")
    .select("id, project_id, consumer_id, status, created_at, revealed_at, cancelled_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json(
      { ok: false, error: `ticket_lookup: ${ticketRow.error.message}` },
      500,
    );
  }
  if (!ticketRow.data) return json({ ok: false, error: "Ticket not found" }, 404);
  const ticket = ticketRow.data;

  if (ticket.consumer_id !== userId) {
    return json(
      { ok: false, error: "Only the ticket's guest can report it." },
      403,
    );
  }

  if (!isTicketReportable(ticket)) {
    return json(
      {
        ok: false,
        code: "window_closed",
        error:
          "This visit is too old to report here. Write to hello@mesita.ai and we'll still look at it.",
      },
      409,
    );
  }

  // Re-file = edit, but only while the operator hasn't ruled. Read first so a
  // decided report returns a clear 409 instead of silently not updating.
  const existing = await admin
    .from("ticket_reports")
    .select("id, status")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (existing.error) {
    return json(
      { ok: false, error: `report_lookup: ${existing.error.message}` },
      500,
    );
  }

  if (existing.data && existing.data.status !== "open") {
    return json(
      {
        ok: false,
        code: "already_reviewed",
        error: "We've already looked at this report. Write to hello@mesita.ai to add anything.",
      },
      409,
    );
  }

  const row = {
    ticket_id: ticketId,
    consumer_id: userId,
    project_id: ticket.project_id,
    reason,
    detail,
  };

  // onConflict on the one-per-ticket unique index: the read above is the
  // friendly path, this is what actually wins a double-tap race.
  const saved = await admin
    .from("ticket_reports")
    .upsert(row, { onConflict: "ticket_id" })
    .select("id, reason, detail, status, created_at, updated_at")
    .single();
  if (saved.error) {
    return json(
      { ok: false, error: `report_save: ${saved.error.message}` },
      500,
    );
  }

  return json({ ok: true, report: saved.data }, existing.data ? 200 : 201);
});
