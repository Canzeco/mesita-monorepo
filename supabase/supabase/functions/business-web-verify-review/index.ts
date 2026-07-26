// Supabase Edge Function — business-web-verify-review
//
// Promos v5 (MESITA-723): staff approve or reject the consumer's Google Review
// proof for a ticket. Approval:
//   1. claims the once-per-consumer×place ledger row (consumer_review_claims)
//      — a conflict means the reward was already used, so the verification is
//      rejected instead of double-paying;
//   2. bumps the ticket's snapshotted discount to the Review rate when it
//      beats the current percent (best-of, bump-only — never lowers).
// Reject is informational only. Sentiment-blind by design: staff verify that
// A review exists, never WHAT it says — nothing here reads the rating.
//
// Self-contained: own auth, own DB writes, no function-to-function calls.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { repriceTicketAfterAction } from "../_shared/ticket-reprice.ts";

type Body = {
  ticketId?: string;
  decision?: "approve" | "reject";
  reason?: string;
};

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
  const body = bodyRes.body;
  const ticketId = (body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") {
    return json(
      { ok: false, error: "decision must be 'approve' or 'reject'" },
      400,
    );
  }
  const reason = (body.reason ?? "").toString().trim().slice(0, 240) || null;

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("tickets")
    .select(
      "id, project_id, consumer_id, kind, status, review_status, total_cents",
    )
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

  if (ticket.review_status == null || ticket.review_status === "not_required") {
    return json(
      { ok: false, error: `Ticket ${ticket.id} has no review step to verify.` },
      409,
    );
  }

  const memberRes = await requireMembership(admin, authRes.user, ticket.project_id);
  if (!memberRes.ok) return memberRes.response;

  // Idempotency: terminal states return the row untouched.
  if (
    ticket.review_status === "staff_verified" ||
    ticket.review_status === "staff_rejected"
  ) {
    return json({ ok: true, ticket, alreadyDecided: true });
  }

  const verifiedAt = new Date().toISOString();

  if (decision === "approve") {
    // Claim-once ledger first — losing the race means the reward was already
    // used at this place (Google allows one review per account per place).
    const claim = await admin
      .from("consumer_review_claims")
      .insert({
        consumer_id: ticket.consumer_id,
        project_id: ticket.project_id,
        ticket_id: ticket.id,
      })
      .select("consumer_id")
      .maybeSingle();
    if (claim.error) {
      const alreadyClaimed = claim.error.code === "23505";
      if (!alreadyClaimed) {
        return json(
          { ok: false, error: `review_claim: ${claim.error.message}` },
          500,
        );
      }
      const rejected = await admin
        .from("tickets")
        .update({
          review_status: "staff_rejected",
          review_verified_at: verifiedAt,
          review_verified_by: userId,
          review_reject_reason: "already_claimed",
        })
        .eq("id", ticketId)
        .select("id, kind, status, review_status, review_reject_reason")
        .single();
      return json(
        {
          ok: false,
          code: "already_claimed",
          error: "The Google Review reward was already used at this place.",
          ticket: rejected.data ?? null,
        },
        409,
      );
    }
  }

  const nextReviewStatus = decision === "approve"
    ? "staff_verified"
    : "staff_rejected";

  const updated = await admin
    .from("tickets")
    .update({
      review_status: nextReviewStatus,
      review_verified_at: verifiedAt,
      review_verified_by: userId,
      review_reject_reason: decision === "reject" ? reason : null,
    })
    .eq("id", ticketId)
    .select(
      "id, kind, status, review_status, review_verified_at, review_reject_reason",
    )
    .single();
  if (updated.error) {
    return json(
      { ok: false, error: `ticket_update: ${updated.error.message}` },
      500,
    );
  }

  // A verified review joins the best-of set — bump the snapshotted discount if
  // the Review rate beats it (no-op when the ticket isn't billed yet).
  let repricedPercent: number | null = null;
  const billed = (ticket.total_cents ?? 0) > 0;
  if (decision === "approve" && billed) {
    const reprice = await repriceTicketAfterAction(admin, ticketId);
    if (reprice.ok) repricedPercent = reprice.ratePercent;
  }

  return json({ ok: true, ticket: updated.data, repricedPercent });
});
