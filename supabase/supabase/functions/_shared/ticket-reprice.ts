// Promos v5 (MESITA-723) — bump-only ticket re-pricing.
//
// Actions (Instagram Story · Google Review) verify AFTER the bill is
// snapshotted, so an approval re-resolves the best-of rate and re-prices the
// ticket UPWARD only — the guest's discount can never drop (no clawback).
// A fresh discounted bill lands in the consumer's Pay inbox so both sides see
// the new amount before staff confirm payment.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { computeTicketBill } from "./business-ticket-billing.ts";
import { isConsumerFirstVisit } from "./membership.ts";
import {
  isActionVerified,
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";
import { placeInstagramHandleForPayload } from "./ticket-bill-payload.ts";

type RepriceTicketRow = {
  id: string;
  project_id: string;
  consumer_id: string;
  kind: string;
  status: string;
  story_status: string | null;
  review_status: string | null;
  check_subtotal_cents: number | null;
  discount_percent: number | null;
  currency: string | null;
};

// Recompute the ticket's discount after an action verification. No-ops when
// the ticket has no bill yet (the bill step prices with the verified action
// already in the qualifying set) or when the new rate doesn't beat the
// snapshotted one. Returns the applied percent (or null when unchanged).
export async function repriceTicketAfterAction(
  admin: SupabaseClient,
  ticketId: string,
): Promise<{ ok: true; ratePercent: number | null } | { ok: false; error: string }> {
  const ticketRes = await admin
    .from("tickets")
    .select(
      "id, project_id, consumer_id, kind, status, story_status, review_status, check_subtotal_cents, discount_percent, currency",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRes.error || !ticketRes.data) {
    return { ok: false, error: ticketRes.error?.message ?? "ticket not found" };
  }
  const ticket = ticketRes.data as RepriceTicketRow;

  const subtotal = ticket.check_subtotal_cents ?? 0;
  if (subtotal <= 0) return { ok: true, ratePercent: null }; // not billed yet

  const placeRes = await admin
    .from("projects_view")
    .select(
      "id, name, slug, photos, instagram_url, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
    )
    .eq("id", ticket.project_id)
    .maybeSingle();
  if (placeRes.error || !placeRes.data) {
    return { ok: false, error: "place not found" };
  }
  const place = placeRes.data as {
    id: string;
    name: string;
    slug: string | null;
    photos: string[] | null;
    instagram_url: string | null;
  } & Record<string, unknown>;

  const consumerRes = await admin
    .from("consumers")
    .select("id, class_key")
    .eq("id", ticket.consumer_id)
    .maybeSingle();
  if (consumerRes.error || !consumerRes.data) {
    return { ok: false, error: "consumer not found" };
  }

  const grid = await loadRewardsGrid(admin);
  const firstVisit = await isConsumerFirstVisit(
    admin,
    ticket.consumer_id,
    ticket.project_id,
    ticket.id,
  );
  const ratePercent = resolveTicketRate(placeStrategy(place), grid, {
    classKey: consumerRes.data.class_key,
    isFirstVisit: firstVisit,
    storyVerified: isActionVerified(ticket.story_status),
    reviewVerified: isActionVerified(ticket.review_status),
  });

  // Bump-only: never lower a snapshotted discount.
  if (ratePercent <= (ticket.discount_percent ?? 0)) {
    return { ok: true, ratePercent: null };
  }

  const billRes = computeTicketBill({
    subtotal,
    ratePercent,
    capPesos: grid.cap,
  });
  if (!billRes.ok) return { ok: false, error: billRes.error };
  const snap = billRes.snapshot;

  const update = await admin
    .from("tickets")
    .update({
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
      total_cents: snap.totalCents,
    })
    .eq("id", ticket.id)
    .select("id")
    .single();
  if (update.error) return { ok: false, error: update.error.message };

  // Refresh the consumer's Pay inbox with the improved bill.
  await admin.from("consumer_pay_notifications").insert({
    consumer_id: ticket.consumer_id,
    ticket_id: ticket.id,
    kind: "bill",
    status: "completed",
    resolved_at: new Date().toISOString(),
    payload: {
      project_id: place.id,
      place_slug: place.slug ?? null,
      place_name: place.name,
      place_photo_url: place.photos?.[0] ?? null,
      place_instagram_handle: placeInstagramHandleForPayload(place.instagram_url),
      ticket_kind: ticket.kind,
      check_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      discount_cents: snap.discountCents ?? 0,
      discount_percent: snap.discountPercent ?? 0,
      total_reward_cents: snap.discountCents ?? 0,
      reward_cap_mxn: grid.cap,
      amount_due_cents: snap.amountDueCents,
      currency: ticket.currency ?? "MXN",
    },
  });

  return { ok: true, ratePercent };
}
