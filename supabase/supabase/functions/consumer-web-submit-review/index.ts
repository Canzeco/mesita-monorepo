// Supabase Edge Function — consumer-web-submit-review
//
// Promos v5 (MESITA-723): the consumer opts into the Google Review rung on an
// open ticket by uploading a screenshot of the review they just posted at the
// table. Sets review_status to 'submitted' so staff (business-web-verify-review)
// can approve it — approval bumps the ticket's discount to the Review rate
// (best-of, bump-only).
//
// Rules enforced here:
//   - Caller must be the ticket's consumer (the proof is personal).
//   - The place's program must run the Google Review rung at its strategy
//     (grid.review[strategy] > 0).
//   - Once per consumer × place — consumer_review_claims is checked before
//     accepting a submission (Google allows one review per account per place).
//   - Sentiment-blind by design: nothing here reads or gates on the review's
//     rating. Any rating qualifies. Keep it that way.
//
// Self-contained: own auth, own DB writes via service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { hasClaimedReview } from "../_shared/membership.ts";
import {
  loadRewardsGrid,
  offersSegment,
  placeStrategy,
} from "../_shared/rewards-config.ts";

type Body = { ticketId?: string; screenshotUrl?: string };

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
  const url = (body.screenshotUrl ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);
  if (!url) return json({ ok: false, error: "screenshotUrl is required" }, 400);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return json({ ok: false, error: "screenshotUrl must be https://" }, 400);
    }
  } catch {
    return json({ ok: false, error: "screenshotUrl is not a valid URL" }, 400);
  }

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
  if (ticket.status === "paid" || ticket.status === "cancelled") {
    return json(
      { ok: false, error: "This ticket is closed — reviews attach to open tickets." },
      409,
    );
  }
  if (
    ticket.review_status === "staff_verified" ||
    ticket.review_status === "ai_verified"
  ) {
    return json({ ok: true, ticket, alreadyVerified: true });
  }
  if (ticket.review_status === "staff_rejected") {
    return json(
      {
        ok: false,
        error:
          "This review was rejected. No more submissions allowed for this ticket.",
      },
      409,
    );
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
  if (!offersSegment(placeStrategy(placeRow.data), grid, "review")) {
    return json(
      { ok: false, error: "This place doesn't run the Google Review reward." },
      409,
    );
  }

  // Once per consumer × place.
  if (await hasClaimedReview(admin, userId, ticket.project_id)) {
    return json(
      {
        ok: false,
        code: "already_claimed",
        error: "The Google Review reward was already used at this place.",
      },
      409,
    );
  }

  const submittedAt = new Date().toISOString();
  const updated = await admin
    .from("tickets")
    .update({
      review_status: "submitted",
      review_screenshot_url: url,
      review_submitted_at: submittedAt,
      review_verified_at: null,
      review_verified_by: null,
      review_reject_reason: null,
    })
    .eq("id", ticketId)
    .select(
      "id, kind, status, review_status, review_screenshot_url, review_submitted_at",
    )
    .single();
  if (updated.error) {
    return json(
      { ok: false, error: `review_submit: ${updated.error.message}` },
      500,
    );
  }

  return json({ ok: true, ticket: updated.data });
});
