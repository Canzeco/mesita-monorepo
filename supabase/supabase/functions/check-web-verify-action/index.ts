// Supabase Edge Function — check-web-verify-action (natural caller: the
// public check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// Staff approve or reject a SUBMITTED story/review right on the check page
// (the page shows the screenshot so the human can eyeball it). This replaces
// the console path of business-web-verify-story / business-web-verify-review
// for v2 tickets — the console panel had zero callers anyway. The AI
// verifier stays primary for public accounts; this is the human fallback.
//
// *_verified_by is NULL here — there is no auth user on this surface. Every
// downstream read of that column tolerates null (checked at build time).
//
// Body:     { code, action: "story"|"review", decision: "approve"|"reject", reason? }
// Response: { ok: true, ... } | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { repriceTicketAfterAction } from "../_shared/ticket-reprice.ts";
import {
  type CheckEvent,
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadTicketByCheckCode,
  logCheckEvent,
} from "../_shared/ticket-check.ts";

type Body = {
  code?: string;
  action?: string;
  decision?: string;
  reason?: string;
};

// Only a human-decidable state can flip: submitted (fresh) or ai_rejected
// (the AI said no, staff overrule with their own eyes).
const DECIDABLE = new Set(["submitted", "ai_rejected"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = (bodyRes.body.code ?? "").toString().trim();
  if (!code) return checkNotFound(json);

  const action = bodyRes.body.action;
  if (action !== "story" && action !== "review") {
    return json({ ok: false, error: "action must be 'story' or 'review'" }, 400);
  }
  const decision = bodyRes.body.decision;
  if (decision !== "approve" && decision !== "reject") {
    return json({ ok: false, error: "decision must be 'approve' or 'reject'" }, 400);
  }
  const reason = (bodyRes.body.reason ?? "").toString().trim().slice(0, 300) || null;

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 30 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  const statusCol = action === "story" ? "story_status" : "review_status";
  const current = action === "story" ? ticket.story_status : ticket.review_status;

  if (current == null || current === "not_required") {
    return json(
      { ok: false, error: `This ticket has no ${action} step to verify.` },
      409,
    );
  }
  // Idempotency: staff-terminal states return untouched.
  if (current === "staff_verified" || current === "staff_rejected") {
    return json({ ok: true, alreadyDecided: true, state: current });
  }
  if (!DECIDABLE.has(current)) {
    return json(
      {
        ok: false,
        error: action === "story"
          ? "The guest hasn't submitted their story yet."
          : "The guest hasn't submitted their review yet.",
        code: "not_submitted",
      },
      409,
    );
  }

  const verifiedAt = new Date().toISOString();

  // Review approval consumes the once-per-place claim FIRST (ported verbatim
  // from business-web-verify-review — losing the race means the reward was
  // already used at this place).
  if (action === "review" && decision === "approve") {
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
      if (claim.error.code !== "23505") {
        return json(
          { ok: false, error: `review_claim: ${claim.error.message}` },
          500,
        );
      }
      await admin
        .from("tickets")
        .update({
          review_status: "staff_rejected",
          review_verified_at: verifiedAt,
          review_verified_by: null,
          review_reject_reason: "already_claimed",
        })
        .eq("id", ticket.id);
      return json(
        {
          ok: false,
          code: "already_claimed",
          error: "The Google Review reward was already used at this place.",
        },
        409,
      );
    }
  }

  const nextStatus = decision === "approve" ? "staff_verified" : "staff_rejected";
  const patch: Record<string, unknown> = action === "story"
    ? {
      story_status: nextStatus,
      story_verified_at: verifiedAt,
      story_verified_by: null,
      story_reject_reason: decision === "reject" ? reason : null,
    }
    : {
      review_status: nextStatus,
      review_verified_at: verifiedAt,
      review_verified_by: null,
      review_reject_reason: decision === "reject" ? reason : null,
    };

  // A story approval on a billed awaiting_story ticket advances the
  // lifecycle to the paid-received gate.
  const billed = (ticket.total_cents ?? 0) > 0;
  if (
    action === "story" && decision === "approve" && billed &&
    ticket.status === "awaiting_story"
  ) {
    patch.status = "awaiting_payment_confirm";
  }

  const updated = await admin
    .from("tickets")
    .update(patch)
    .eq("id", ticket.id)
    .select(`id, status, ${statusCol}`)
    .single();
  if (updated.error) {
    return json({ ok: false, error: `ticket_update: ${updated.error.message}` }, 500);
  }

  // Approved actions join the best-of set — bump-only reprice when billed.
  let repricedPercent: number | null = null;
  if (decision === "approve" && billed) {
    const reprice = await repriceTicketAfterAction(admin, ticket.id);
    if (reprice.ok) repricedPercent = reprice.ratePercent;
  }

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  const event: CheckEvent = `${action}_${decision === "approve" ? "approved" : "rejected"}` as CheckEvent;
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event,
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({
    ok: true,
    state: nextStatus,
    status: updated.data.status,
    repricedPercent,
  });
});
