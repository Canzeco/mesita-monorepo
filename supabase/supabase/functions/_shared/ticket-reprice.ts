// Promos v5 (MESITA-723) — bump-only ticket re-pricing.
//
// Actions (Instagram Story · Google Review) verify AFTER the bill is
// snapshotted, so an approval re-resolves the best-of rate and re-prices the
// ticket UPWARD only — the guest's discount can never drop (no clawback).
// A fresh discounted bill lands in the consumer's Pay inbox so both sides see
// the new amount before staff confirm payment.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { computeTicketBill } from "./business-ticket-billing.ts";
import { hasMesitaReview, isConsumerFirstVisit } from "./membership.ts";
import {
  isActionVerified,
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";
import { ratesForBilling } from "./ticket-rate-snapshot.ts";
import { resolveBillCapPesos } from "./discount-cap.ts";
import { placeInstagramHandleForPayload } from "./ticket-bill-payload.ts";
import { writeTicket } from "./ticket-doc.ts";
import { rowPlaceId } from "./place-id.ts";

type RepriceTicketRow = {
  id: string;
  place_id: string;
  consumer_id: string;
  status: string;
  story_status: string | null;
  review_status: string | null;
  bill_subtotal_cents: number | null;
  tip_cents: number | null;
  tip_pct: number | null;
  discount_percent: number | null;
  approved_at: string | null;
  currency: string | null;
};

// The live best-of rate for a ticket, resolved fresh (v3b, MESITA-850):
// place strategy × operator grid × the guest's current qualifying set
// (class, first visit, story/review self-attestations, Mesita review).
// Shared by the reprice below, validate-web-get-ticket's cap-as-instruction
// offer, and consumer-web-submit-ticket-total's fallback record.
export async function resolveLiveTicketRate(
  admin: SupabaseClient,
  ticket: {
    id: string;
    project_id?: string;
    place_id?: string;
    consumer_id: string;
    story_status: string | null;
    review_status: string | null;
  },
): Promise<
  | { ok: true; ratePercent: number; capPesos: number }
  | { ok: false; error: string }
> {
  const placeId = rowPlaceId(ticket);
  if (!placeId) return { ok: false, error: "place not found" };

  const [placeRes, consumerRes, grid, firstVisit, mesitaReviewed] = await Promise
    .all([
      admin
        .from("profiles")
        .select(
          "id, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, monthly_promo_cap",
        )
        .eq("id", placeId)
        .maybeSingle(),
      admin
        .from("consumers")
        .select("id, class_key, plan")
        .eq("id", ticket.consumer_id)
        .maybeSingle(),
      loadRewardsGrid(admin),
      isConsumerFirstVisit(
        admin,
        ticket.consumer_id,
        placeId,
        ticket.id,
      ),
      hasMesitaReview(admin, ticket.id),
    ]);
  if (placeRes.error || !placeRes.data) {
    return { ok: false, error: "place not found" };
  }
  if (consumerRes.error || !consumerRes.data) {
    return { ok: false, error: "consumer not found" };
  }

  const ticketRatesRes = await admin
    .from("visit_tickets")
    .select(
      "welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, rates_snapshotted_at",
    )
    .eq("id", ticket.id)
    .maybeSingle();
  const ticketRatesRow = ticketRatesRes.data ?? {};

  const billingRates = ratesForBilling(
    ticketRatesRow as Record<string, unknown>,
    placeRes.data as Record<string, unknown>,
  );
  const ratePercent = resolveTicketRate(
    placeStrategy(billingRates as Record<string, unknown>),
    grid,
    {
      classKey: consumerRes.data.class_key,
      isFirstVisit: firstVisit,
      storyVerified: isActionVerified(ticket.story_status),
      reviewVerified: isActionVerified(ticket.review_status),
      mesitaReviewed,
    },
  );
  return {
    ok: true,
    ratePercent,
    capPesos: resolveBillCapPesos(
      placeRes.data as Record<string, unknown>,
      grid.cap,
    ),
  };
}

// Recompute the ticket's discount after an action verification. No-ops when
// the ticket has no bill yet (the bill step prices with the verified action
// already in the qualifying set) or when the new rate doesn't beat the
// snapshotted one. Returns the applied percent (or null when unchanged).
export async function repriceTicketAfterAction(
  admin: SupabaseClient,
  ticketId: string,
): Promise<{ ok: true; ratePercent: number | null } | { ok: false; error: string }> {
  const ticketRes = await admin
    .from("visit_tickets")
    .select(
      "id, place_id, consumer_id, status, story_status, review_status, bill_subtotal_cents, tip_cents, tip_pct, discount_percent, approved_at, currency",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRes.error || !ticketRes.data) {
    return { ok: false, error: ticketRes.error?.message ?? "ticket not found" };
  }
  const ticket = ticketRes.data as RepriceTicketRow;
  const placeId = rowPlaceId(ticket);
  if (!placeId) return { ok: false, error: "ticket not found" };

  // v4 (MESITA-1092): approval FREEZES the amount. A task landing after
  // the staff approved still counts on a future visit, but this ticket's
  // numbers are what the waiter committed to — never move them.
  if (ticket.approved_at != null) return { ok: true, ratePercent: null };

  const subtotal = ticket.bill_subtotal_cents ?? 0;
  if (subtotal <= 0) return { ok: true, ratePercent: null }; // not billed yet

  // The Pay-inbox refresh below still needs the place's display fields.
  const placeRes = await admin
    .from("profiles")
    .select("id, name, slug, photos, instagram_url")
    .eq("id", placeId)
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
  };

  const liveRes = await resolveLiveTicketRate(admin, ticket);
  if (!liveRes.ok) return liveRes;
  const { ratePercent } = liveRes;

  // Bump-only: never lower a snapshotted discount.
  if (ratePercent <= (ticket.discount_percent ?? 0)) {
    return { ok: true, ratePercent: null };
  }

  // C4-7: the reprice carries the guest's tip forward byte-identically —
  // preset recomputes on the (unchanged) subtotal, custom carries the cents.
  const billRes = computeTicketBill({
    subtotal,
    ratePercent,
    capPesos: liveRes.capPesos,
    tipPct: ticket.tip_pct,
    carryTipCents: ticket.tip_cents,
  });
  if (!billRes.ok) return { ok: false, error: billRes.error };
  const snap = billRes.snapshot;

  const update = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: {
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
      total_cents: snap.totalCents,
    },
    select: "id",
    single: true,
  });
  if (!update.ok) return { ok: false, error: update.error };

  // Refresh the consumer's Pay inbox with the improved bill.
  await admin.from("consumer_notifications").insert({
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
      bill_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      discount_cents: snap.discountCents ?? 0,
      discount_percent: snap.discountPercent ?? 0,
      total_reward_cents: snap.discountCents ?? 0,
      reward_cap_mxn: liveRes.capPesos,
      amount_due_cents: snap.amountDueCents,
      currency: ticket.currency ?? "MXN",
    },
  });

  return { ok: true, ratePercent };
}
