// Supabase Edge Function — consumer-web-submit-story
//
// Lifecycle v3 (MESITA-849): the guest posts their tagged Instagram story and
// tells us here — BEFORE the business is involved at all. Their declaration is
// the verification: story_status goes straight to 'self_verified'. No
// screenshot, no queue, no staff verdict.
//
// Why self-attestation and not a check: there is no Instagram connection in
// this product. The follower count behind the Influencer class is itself
// self-declared (consumer-web-claim-instagram takes it from the request body),
// and no code path has ever read Instagram to confirm a post — the "AI
// verifier" the old flow deferred to was only ever consumer-web-mock-story-detect,
// a dev helper. The staff verdict it fell back to was a human guessing from a
// screenshot the guest chose. v3 stops pretending: the guest asserts, the place
// applies the discount in front of them and can refuse, and MESITA-851 gives
// the guest the matching route in the other direction.
//
// What still gates a story, because these are checkable:
//   - The caller must be the ticket's consumer.
//   - Connected Instagram (MESITA-909 — `instagram_handle` set). Class is
//     the rate ladder; Story is a universal action gated on the account.
//   - The place must actually run the Story rung at its strategy.
//
// Body:     { ticketId: string }
// Response: { ok: true, ticket: {...}, repricedPercent } | { ok, error }
//
// Self-contained: own auth, own DB writes via service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
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
    .select("id, project_id, consumer_id, kind, status, story_status")
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
      { ok: false, error: "Only the ticket's consumer can submit a story." },
      403,
    );
  }
  if (!OPEN_TO_TASKS.has(ticket.status)) {
    return json(
      {
        ok: false,
        error: "This ticket is closed — stories attach to open tickets.",
      },
      409,
    );
  }

  // Already done — idempotent, so a double-tap or a retry is harmless.
  if (isActionVerified(ticket.story_status)) {
    return json({ ok: true, ticket, alreadyVerified: true });
  }

  // MESITA-909: Story is a universal action gated on a connected Instagram
  // account — not on Influencer class. Class still prices the rung (the
  // guest's own class row of the action matrix); connection is the door.
  const consumerRow = await admin
    .from("consumers")
    .select("instagram_handle")
    .eq("id", userId)
    .maybeSingle();
  if (consumerRow.error) {
    return json(
      { ok: false, error: `consumer_lookup: ${consumerRow.error.message}` },
      500,
    );
  }
  if (!consumerRow.data?.instagram_handle?.trim()) {
    return json(
      {
        ok: false,
        error:
          "Connect your Instagram in Me to unlock the Story bonus, then try again.",
      },
      403,
    );
  }

  // The place must run the Story rung at its strategy (grid.story[strategy]
  // > 0) — checked on every submit, not just a fresh opt-in, because the
  // ticket may have been created before the place changed its program.
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
  if (!offersAction(placeStrategy(placeRow.data), grid, "story")) {
    return json(
      { ok: false, error: "This place doesn't run the Instagram Story reward." },
      409,
    );
  }

  const now = new Date().toISOString();
  const updated = await admin
    .from("tickets")
    .update({
      story_status: "self_verified",
      story_submitted_at: now,
      story_verified_at: now,
      // tickets.story_verified_by FKs to accounts (business-side) — a consumer
      // id can't go here, and self-verification has no approver anyway.
      story_verified_by: null,
      story_reject_reason: null,
    })
    .eq("id", ticketId)
    .select("id, kind, status, story_status, story_submitted_at")
    .single();
  if (updated.error) {
    return json(
      { ok: false, error: `story_submit: ${updated.error.message}` },
      500,
    );
  }

  // A task completed AFTER the bill was snapshotted re-prices it upward
  // (bump-only). Before the bill, this no-ops — check-web-submit-bill already
  // prices with the verified story in the qualifying set.
  let repricedPercent: number | null = null;
  const reprice = await repriceTicketAfterAction(admin, ticketId);
  if (reprice.ok) repricedPercent = reprice.ratePercent;

  return json({ ok: true, ticket: updated.data, repricedPercent });
});
