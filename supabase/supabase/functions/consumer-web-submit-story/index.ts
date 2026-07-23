// Supabase Edge Function — consumer-web-submit-story
//
// Authenticated. The consumer uploads the URL of their Instagram-story
// screenshot for a story-required ticket. Sets story_status to
// 'submitted' and records the screenshot URL + timestamp, so the AI
// verifier (or staff fallback) can pick it up.
//
// This function is the *queue* feeder for the verification pipeline:
//   - Submit moves the row from 'pending' (or 'ai_rejected') to 'submitted'.
//   - The AI bot polls 'submitted' rows, attempts to match the @mention
//     or location tag, and flips to 'ai_verified' / 'ai_rejected' on its own.
//   - Anything that ends up 'ai_rejected' falls to staff via
//     business-web-verify-story.
//
// Auth model: the caller must be the ticket's consumer. The validator does
// NOT submit on the consumer's behalf — that's the whole point of the proof.
//
// Self-contained: own auth, own DB writes via service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import {
  loadRewardsGrid,
  offersSegment,
  placePosture,
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
  if (!url) {
    return json({ ok: false, error: "screenshotUrl is required" }, 400);
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return json(
        { ok: false, error: "screenshotUrl must be https://" },
        400,
      );
    }
  } catch {
    return json({ ok: false, error: "screenshotUrl is not a valid URL" }, 400);
  }

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("tickets")
    .select("id, project_id, consumer_id, kind, story_status")
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
  // Promos v5 (MESITA-723): the Story rung is UNIVERSAL — any consumer may opt
  // in from 'not_required' as long as the place's program runs the Instagram
  // Story rung at its posture (grid.story[posture] > 0). Legacy kind-seeded
  // story-required tickets already sit in 'pending' and skip this gate.
  if (ticket.story_status == null || ticket.story_status === "not_required") {
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
    if (!offersSegment(placePosture(placeRow.data), grid, "story")) {
      return json(
        { ok: false, error: "This place doesn't run the Instagram Story reward." },
        409,
      );
    }
  }
  if (
    ticket.story_status === "staff_verified" ||
    ticket.story_status === "waiter_verified" ||
    ticket.story_status === "ai_verified"
  ) {
    return json({ ok: true, ticket, alreadyVerified: true });
  }
  if (
    ticket.story_status === "staff_rejected" ||
    ticket.story_status === "waiter_rejected"
  ) {
    return json(
      {
        ok: false,
        error:
          "This story was rejected. No more submissions allowed for this ticket.",
      },
      409,
    );
  }

  // Allowed inbound states: not_required (v5 universal opt-in — the place gate
  // above already passed), pending, submitted (re-upload), ai_rejected.
  const allowed = new Set(["not_required", "pending", "submitted", "ai_rejected"]);
  if (!allowed.has(ticket.story_status)) {
    return json(
      {
        ok: false,
        error: `Cannot submit a story when story_status=${ticket.story_status}`,
      },
      409,
    );
  }

  const submittedAt = new Date().toISOString();
  const updated = await admin
    .from("tickets")
    .update({
      story_status: "submitted",
      story_screenshot_url: url,
      story_submitted_at: submittedAt,
      story_verified_at: null,
      story_verified_by: null,
      story_reject_reason: null,
    })
    .eq("id", ticketId)
    .select(
      "id, kind, status, story_status, story_screenshot_url, story_submitted_at",
    )
    .single();
  if (updated.error) {
    return json(
      { ok: false, error: `story_submit: ${updated.error.message}` },
      500,
    );
  }

  return json({ ok: true, ticket: updated.data });
});
