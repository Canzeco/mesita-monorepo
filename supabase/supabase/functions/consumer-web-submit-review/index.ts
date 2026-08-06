// Supabase Edge Function — consumer-web-submit-review
//
// Lifecycle v3 (MESITA-849): the guest leaves their Google review and tells us
// here — BEFORE the business is involved. Their declaration is the
// verification: review_status goes straight to 'self_verified'. No screenshot,
// no staff approval (that was check-web-verify-action / business-web-verify-review,
// both retired in this change).
//
// The once-per-place claim moved WITH the verification. It used to be consumed
// at approval time; now it is consumed here, at submit time, which is the only
// moment left. consumer_review_claims' (consumer_id, project_id) primary key
// is still what wins a race — the friendly check below is just the nice error.
//
// Rules enforced here:
//   - Caller must be the ticket's consumer (the proof is personal).
//   - The place's program must run the Google Review rung at its strategy
//     (grid.review[strategy] > 0).
//   - Once per consumer × place (Google allows one review per account per
//     place, so the reward can only be earned once there).
//   - Sentiment-blind by design: nothing here reads or gates on the review's
//     rating. Any rating qualifies. Keep it that way.
//
// Body:     { ticketId: string }
// Response: { ok: true, ticket: {...}, repricedPercent } | { ok, error, code? }
//
// Self-contained: own auth, own DB writes via service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { hasClaimedReview } from "../_shared/membership.ts";
import {
  isActionVerified,
  loadRewardsGrid,
  offersAction,
  placeStrategy,
} from "../_shared/rewards-config.ts";
import { repriceTicketAfterAction } from "../_shared/ticket-reprice.ts";

type Body = { ticketId?: string };

// Ticket states that can still take a task. A closed ticket can't — the
// reward is already settled.
const OPEN_TO_TASKS = new Set(["open", "awaiting_payment_confirm"]);

const ALREADY_CLAIMED = {
  ok: false,
  code: "already_claimed",
  error: "The Google Review reward was already used at this place.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("tickets")
    .select("id, project_id, consumer_id, kind, status, review_status")
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
      { ok: false, error: "Only the ticket's consumer can submit a review." },
      403,
    );
  }
  if (!OPEN_TO_TASKS.has(ticket.status)) {
    return json(
      { ok: false, error: "This ticket is closed — reviews attach to open tickets." },
      409,
    );
  }

  // Already done — idempotent, so a double-tap or a retry is harmless.
  if (isActionVerified(ticket.review_status)) {
    return json({ ok: true, ticket, alreadyVerified: true });
  }

  // The place's program must run the Google Review rung at its strategy.
  const placeRow = await admin
    .from("projects_view")
    .select(
      "id, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
    )
    .eq("id", ticket.project_id)
    .maybeSingle();
  if (placeRow.error || !placeRow.data) {
    return json({ ok: false, error: "Place not found" }, 404);
  }
  const grid = await loadRewardsGrid(admin);
  if (!offersAction(placeStrategy(placeRow.data), grid, "review")) {
    return json(
      { ok: false, error: "This place doesn't run the Google Review reward." },
      409,
    );
  }

  // Once per consumer × place — friendly check first, the primary key wins
  // any race.
  if (await hasClaimedReview(admin, userId, ticket.project_id)) {
    return json(ALREADY_CLAIMED, 409);
  }
  const claim = await admin
    .from("consumer_review_claims")
    .insert({
      consumer_id: userId,
      project_id: ticket.project_id,
      ticket_id: ticket.id,
    })
    .select("consumer_id")
    .maybeSingle();
  if (claim.error) {
    if (claim.error.code === "23505") return json(ALREADY_CLAIMED, 409);
    return json(
      { ok: false, error: `review_claim: ${claim.error.message}` },
      500,
    );
  }

  const now = new Date().toISOString();
  const updated = await admin
    .from("tickets")
    .update({
      review_status: "self_verified",
      review_submitted_at: now,
      review_verified_at: now,
      // FKs to accounts (business-side); self-verification has no approver.
      review_verified_by: null,
      review_reject_reason: null,
    })
    .eq("id", ticketId)
    .select("id, kind, status, review_status, review_submitted_at")
    .single();
  if (updated.error) {
    // Give the claim back — otherwise a transient write failure would burn the
    // guest's one shot at this place forever.
    await admin
      .from("consumer_review_claims")
      .delete()
      .eq("consumer_id", userId)
      .eq("project_id", ticket.project_id);
    return json(
      { ok: false, error: `review_submit: ${updated.error.message}` },
      500,
    );
  }

  // A task completed AFTER the bill was snapshotted re-prices it upward
  // (bump-only). Before the bill, this no-ops.
  let repricedPercent: number | null = null;
  const reprice = await repriceTicketAfterAction(admin, ticketId);
  if (reprice.ok) repricedPercent = reprice.ratePercent;

  return json({ ok: true, ticket: updated.data, repricedPercent });
});
