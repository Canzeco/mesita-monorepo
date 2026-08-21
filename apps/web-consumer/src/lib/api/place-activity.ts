// Guest activity on one place — the Instagram stories, visits, orders and
// reservations rails on the place profile's Reviews tab (MESITA-1147).
//
// Backed by `consumer-web-get-place-activity`, fetched lazily the first time
// the Reviews tab is opened rather than folded into the server-rendered place
// payload: Place is the tab guests land on, and it shouldn't pay for three
// feeds it never shows.
//
// The EF has already applied guest-to-guest privacy (MESITA-913) — private
// accounts arrive as "Anonymous guest", opted-out guests are absent, and no
// bill total, phone number or reservation note is ever on the wire. Nothing
// here re-derives identity; it only bridges the class vocabulary.

import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClassKey, identityForClassKey } from "@/lib/consumer-data";

import { invokeEF } from "./_invoke";

type GuestFields = {
  name: string;
  handle: string;
  /** v2 metal, bridged from the LEGACY key the server still sends. */
  class_key: ClassKey;
  followers: number;
};

export type PlaceStory = GuestFields & {
  id: string;
  screenshot_url: string;
  posted_at: string;
  verified: boolean;
};

export type PlaceVisit = GuestFields & {
  id: string;
  visited_at: string;
  discount_percent: number;
  reviewed: boolean;
};

export type PlaceReservation = GuestFields & {
  id: string;
  reserved_at: string;
  party_size: number;
};

/**
 * Order tickets are scoped but NOT built — there is no orders table (entity
 * model, 2026-08-18). The EF always returns [], and the Featured Orders box
 * renders an explicit "not live yet" state rather than vanishing. Typed now so
 * that wiring orders later is a data change, not a shape change.
 */
export type PlaceOrder = GuestFields & {
  id: string;
  ordered_at: string;
};

export type PlaceActivity = {
  stories: PlaceStory[];
  visits: PlaceVisit[];
  orders: PlaceOrder[];
  reservations: PlaceReservation[];
};

export const EMPTY_PLACE_ACTIVITY: PlaceActivity = {
  stories: [],
  visits: [],
  orders: [],
  reservations: [],
};

type RawGuest = Omit<GuestFields, "class_key"> & { class_key?: string | null };

function bridgeGuest<T extends RawGuest>(
  row: T,
): Omit<T, "class_key"> & { class_key: ClassKey } {
  // Only the class half is kept: a guest's PLAN is private and must never
  // reach another guest (same rule as the Mesita review cards).
  return { ...row, class_key: identityForClassKey(row.class_key).cls };
}

export async function apiFetchPlaceActivity(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<PlaceActivity> {
  const data = await invokeEF<{
    stories?: (RawGuest & Omit<PlaceStory, keyof GuestFields>)[];
    visits?: (RawGuest & Omit<PlaceVisit, keyof GuestFields>)[];
    orders?: (RawGuest & Omit<PlaceOrder, keyof GuestFields>)[];
    reservations?: (RawGuest & Omit<PlaceReservation, keyof GuestFields>)[];
  }>(client, "consumer-web-get-place-activity", { id: idOrSlug });

  return {
    stories: (data.stories ?? []).map(bridgeGuest),
    visits: (data.visits ?? []).map(bridgeGuest),
    orders: (data.orders ?? []).map(bridgeGuest),
    reservations: (data.reservations ?? []).map(bridgeGuest),
  };
}
