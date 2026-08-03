// Review-inbox prep + consumer review notification — extracted from
// ticket-informal so bill math and review notify can evolve independently.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { placeInstagramHandleForPayload } from "./ticket-bill-payload.ts";

// v3 (MESITA-849): the Mesita review is a task the guest does BEFORE the scan,
// so a live ticket is reviewable — it no longer has to reach the end of the
// visit first. `awaiting_story` is gone with the staff verdict that resolved it.
const REVIEW_READY_STATUSES = new Set([
  "open",
  "awaiting_payment_confirm",
  "revealed",
]);

/** Ensure the review inbox row exists before the consumer submits a review. */
export async function prepareTicketForReview(
  admin: SupabaseClient,
  ticketId: string,
  consumerId: string,
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const ticket = await admin
    .from("tickets")
    .select("id, project_id, status")
    .eq("id", ticketId)
    .eq("consumer_id", consumerId)
    .maybeSingle();
  if (ticket.error || !ticket.data) {
    return { ok: false, error: ticket.error?.message ?? "Ticket not found" };
  }

  const row = ticket.data;
  if (REVIEW_READY_STATUSES.has(row.status)) {
    await ensureConsumerReviewNotification(
      admin,
      consumerId,
      ticketId,
      row.project_id,
    );
    return { ok: true, projectId: row.project_id };
  }

  return { ok: false, error: "Ticket is not ready for review" };
}

export async function ensureConsumerReviewNotification(
  admin: SupabaseClient,
  consumerId: string,
  ticketId: string,
  projectId: string,
): Promise<void> {
  const existing = await admin
    .from("consumer_pay_notifications")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("consumer_id", consumerId)
    .eq("kind", "review")
    .maybeSingle();
  if (existing.data) return;

  const [placeRes, ticketRes] = await Promise.all([
    admin
      .from("projects_view")
      .select("name, slug, photos, instagram_url")
      .eq("id", projectId)
      .single(),
    admin
      .from("tickets")
      .select(
        "kind, discount_cents, discount_percent, total_cents, check_subtotal_cents, tip_cents",
      )
      .eq("id", ticketId)
      .single(),
  ]);

  const v = placeRes.data;
  const t = ticketRes.data;
  const discount = t?.discount_cents ?? 0;

  await admin.from("consumer_pay_notifications").insert({
    consumer_id: consumerId,
    ticket_id: ticketId,
    kind: "review",
    status: "pending",
    payload: {
      project_id: projectId,
      place_slug: v?.slug ?? null,
      place_name: v?.name ?? "Partner place",
      place_photo_url: v?.photos?.[0] ?? null,
      place_instagram_handle: placeInstagramHandleForPayload(v?.instagram_url),
      ticket_kind: t?.kind ?? null,
      check_subtotal_cents: t?.check_subtotal_cents ?? null,
      tip_cents: t?.tip_cents ?? null,
      discount_cents: discount,
      discount_percent: t?.discount_percent ?? null,
      total_reward_cents: discount,
      total_cents: t?.total_cents ?? null,
      currency: "MXN",
    },
  });
}
