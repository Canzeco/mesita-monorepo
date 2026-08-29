"use client";

// Ticket seed cache (MESITA-1029 S3/S4). The tap that creates a ticket
// already holds everything THE TICKET needs for its first paint: the create
// response carries the row (id, status, check_code, task statuses), the
// tapped Place carries the photo, category and rate columns, and the reward
// quote can START at create time instead of after two chained fetches on the
// ticket screen. NewVisitClient writes here right before router.push;
// TicketScreen peeks on mount.
//
// Module-level on purpose: the seed must survive the route transition but
// never the tab — a reload or deep link falls back to the normal fetch path
// (loading.tsx silhouette → list-tickets). Never a source of truth: the
// polled list overrides the seed the moment it lands.

import type {
  ConsumerTicketRow,
  CreatedTicket,
  RewardQuote,
} from "@/lib/api/tickets";

// Structural, not nominal (MESITA-1065): a visit now starts from TWO surfaces —
// the wallet's place list (a `Place` from consumer-web-list-places) and the
// place-detail action bar (a `PlaceDetail` from consumer-get-place). Neither
// type is a subtype of the other, and the seed only ever reads these fields,
// so it asks for exactly them. `Place` satisfies this as-is.
//
// PlaceDetail carries no `slug` and no rate columns; both stay optional here
// because they were always the SECONDARY path — the quote promise passed
// alongside the seed is where THE TICKET's real numbers come from, and the
// polled list overrides the whole row the moment it lands.
export type SeedPlace = {
  /** Server-computed per request (MESITA-1150): a guest gets a discount here
   *  RIGHT NOW. The gate every reward surface reads — `listing_type` is the
   *  stale collapsed enum and no longer decides anything a guest sees. */
  promoting?: boolean | null;
  id: string;
  name: string;
  photos?: string[] | null;
  category?: string | null;
  address?: string | null;
  price_level?: number | null;
  slug?: string | null;
  currency?: string | null;
  listing_type?: string | null;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  orders_enabled?: boolean | null;
  reservations_enabled?: boolean | null;
  products?: unknown;
  menus?: unknown;
  menu_pdf_url?: unknown;
};

type TicketSeed = {
  ticket: ConsumerTicketRow;
  /** Resolves null on failure — consumers fall back to their own fetch. */
  quote: Promise<RewardQuote | null> | null;
};

const seeds = new Map<string, TicketSeed>();

export function seedTicket(
  ticket: ConsumerTicketRow,
  quote: Promise<RewardQuote | null> | null = null,
): void {
  seeds.set(ticket.id, { ticket, quote });
  // A session only ever creates a handful of tickets; cap the map so a
  // long-lived tab can't grow it unbounded.
  if (seeds.size > 8) {
    const oldest = seeds.keys().next().value;
    if (oldest !== undefined && oldest !== ticket.id) seeds.delete(oldest);
  }
}

export function peekTicketSeed(id: string): TicketSeed | null {
  return seeds.get(id) ?? null;
}

/** The freshly created ticket as a list row, filled from what the tap knew. */
export function ticketRowFromCreate(
  t: CreatedTicket,
  place: SeedPlace,
): ConsumerTicketRow {
  return {
    id: t.id,
    status: t.status,
    story_status: t.story_status ?? null,
    story_submitted_at: null,
    story_verified_at: null,
    story_reject_reason: null,
    review_status: t.review_status ?? null,
    review_submitted_at: null,
    check_code: t.check_code,
    first_scanned_at: t.first_scanned_at ?? null,
    bill_subtotal_cents: null,
    total_cents: null,
    discount_percent: null,
    discount_cents: null,
    bill_source: null,
    currency: t.currency ?? place.currency ?? null,
    created_at: t.created_at ?? new Date().toISOString(),
    revealed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    project_id: place.id,
    place: {
      id: place.id,
      name: place.name,
      photos: place.photos ?? [],
      category: place.category ?? null,
      address: place.address ?? null,
      price_level: place.price_level ?? null,
      slug: place.slug ?? null,
      listing_type: place.listing_type ?? null,
      welcome_free_rate: place.welcome_free_rate ?? null,
      welcome_premium_rate: place.welcome_premium_rate ?? null,
      free_rate: place.free_rate ?? null,
      premium_rate: place.premium_rate ?? null,
    },
  };
}
