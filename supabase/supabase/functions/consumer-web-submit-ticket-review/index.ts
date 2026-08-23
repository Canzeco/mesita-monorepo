// Supabase Edge Function — consumer-web-submit-ticket-review
//
// Post-visit review (Food, Service, Ambience, Value, Overall + comments).
//
// ONE review per account per place (MESITA-825) — NOT per ticket. The upsert
// conflicts on (consumer_id, project_id), matching the unique constraint added
// in 20260802232526, so a guest's second visit to the same place edits their
// existing review rather than creating a duplicate.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { prepareTicketForReview } from "../_shared/ticket-review-notify.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

type Body = {
  ticketId?: string;
  food?: number;
  service?: number;
  ambience?: number;
  value?: number;
  overall?: number;
  comments?: string;
};

function score(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.trunc(n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const ticketId = (body.ticketId ?? "").trim();
  const food = score(body.food);
  const service = score(body.service);
  const ambience = score(body.ambience);
  const value = score(body.value);
  const overall = score(body.overall);
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);
  if (
    food == null ||
    service == null ||
    ambience == null ||
    value == null ||
    overall == null
  ) {
    return json(
      {
        ok: false,
        error: "food, service, ambience, value, and overall must be 1–5",
      },
      400,
    );
  }

  const admin = adminClient(envRes.env);

  const prepared = await prepareTicketForReview(admin, ticketId, userId);
  if (!prepared.ok) {
    return json({ ok: false, error: prepared.error }, 409);
  }

  const ticket = await admin
    .from("visit_tickets")
    .select("id, consumer_id, project_id, status")
    .eq("id", ticketId)
    .eq("consumer_id", userId)
    .maybeSingle();
  if (ticket.error || !ticket.data) {
    return json({ ok: false, error: "Ticket not found" }, 404);
  }

  const comments = String(body.comments ?? "").trim().slice(0, 2000);
  if (comments.length < 50) {
    return json(
      { ok: false, error: "A note of at least 50 characters is required" },
      400,
    );
  }

  const insert = await admin
    .from("ticket_reviews")
    .upsert(
      {
        ticket_id: ticketId,
        consumer_id: userId,
        project_id: ticket.data.project_id,
        food,
        service,
        ambience,
        value,
        overall,
        comments,
      },
      // ONE review per account per place (MESITA-825). A repeat visit to the
      // same place UPDATES the existing review instead of inserting a second
      // one; ticket_id above is rewritten to the ticket it was last edited
      // from, which is what the check page and notifications join on.
      { onConflict: "consumer_id,project_id" },
    )
    .select("id")
    .single();
  if (insert.error) {
    return json({ ok: false, error: insert.error.message }, 500);
  }

  const now = new Date().toISOString();

  // v4 fix loop (MESITA-1090): the Mesita review is a proof-shaped action —
  // landing it clears an outstanding proof/reward send-back so staff can
  // approve. Best-effort: the review itself already saved.
  await writeTicket(admin, {
    mode: "update",
    id: ticketId,
    patch: { fix_requested: null, fix_note: null },
    guard: { in: { fix_requested: ["proof", "reward"] } },
  });

  await admin
    .from("consumer_notifications")
    .update({ status: "completed", resolved_at: now })
    .eq("ticket_id", ticketId)
    .eq("consumer_id", userId)
    .eq("kind", "review")
    .eq("status", "pending");

  return json({ ok: true, reviewId: insert.data.id });
});
