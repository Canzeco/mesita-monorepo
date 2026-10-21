// Social v1 (MESITA-2442): the two events (saved · viewed; no went since
// MESITA-2567) and the four ways they are read back. One helper per call, each one Edge Function.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Place } from "./places";

export type ActivityKind = "saved" | "viewed";

/** A member as Social shows them: named, with the full @handle, when they
 *  verified Instagram and did not choose to appear as "A member"; else
 *  anonymous (MESITA-2580, MESITA-2590). */
export type ActivityPerson = {
  name: string;
  avatarUrl: string | null;
  /** The verified Instagram username, without "@" (MESITA-2590), or
   *  "per***" when handleLocked. */
  handle: string | null;
  /** You see others' Instagram only if you show yours (MESITA-2594): the
   *  server masked this handle because your own Instagram is not connected
   *  or your profile is private. Never link it. */
  handleLocked: boolean;
  followers: number;
  isYou: boolean;
  /** Class and Plan, independent (MESITA-2553). */
  guestClass: "regular" | "vip";
  plan: "free" | "premium";
  /** A member without Instagram (MESITA-2580): "A member", no photo,
   *  handle, followers or Class, and no person card. */
  anonymous: boolean;
};

/** One feed item: one member, one place, one verb — never collapsed
 *  (MESITA-2532). */
export type ActivityFeedItem = {
  placeId: string;
  kind: ActivityKind;
  at: string;
  person: ActivityPerson;
  distanceKm: number | null;
  place: Place;
};

export type PlaceActivity = {
  /** "Perdón and 3 others liked this" (likes only, MESITA-2594), or null. */
  line: string | null;
  people: ActivityPerson[];
  total: number;
  me: { saved: boolean };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Activity is recorded on Mesita places only; a Google-only card (`g:…`)
 *  is not a row yet. */
export function isMesitaPlaceId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function apiTrackActivity(
  client: SupabaseClient,
  input: { kind: ActivityKind; placeId: string; on?: boolean; quiet?: boolean },
): Promise<void> {
  if (!isMesitaPlaceId(input.placeId)) return;
  await invokeEF<{ kind: ActivityKind; on: boolean }>(
    client,
    "consumer-web-track-activity",
    {
      kind: input.kind,
      place_id: input.placeId,
      on: input.on ?? true,
      // A backfilled pre-Social save stays out of the feed (MESITA-2460).
      ...(input.quiet ? { quiet: true } : {}),
    },
  );
}

export async function apiListActivityFeed(
  client: SupabaseClient,
  from: { lat: number; lng: number } | null,
): Promise<ActivityFeedItem[]> {
  const { items } = await invokeEF<{ items: ActivityFeedItem[] }>(
    client,
    "consumer-web-list-activity",
    from ? { scope: "feed", lat: from.lat, lng: from.lng } : { scope: "feed" },
  );
  return items;
}

export async function apiPlaceActivity(
  client: SupabaseClient,
  placeId: string,
): Promise<PlaceActivity> {
  const { line, people, total, me } = await invokeEF<PlaceActivity>(
    client,
    "consumer-web-list-activity",
    { scope: "place", place_id: placeId },
  );
  return { line, people, total, me };
}

export async function apiSavedActivity(
  client: SupabaseClient,
): Promise<{ ids: string[]; places: Place[] }> {
  const { ids, places } = await invokeEF<{ ids: string[]; places: Place[] }>(
    client,
    "consumer-web-list-activity",
    { scope: "saved" },
  );
  return { ids, places };
}

/** The places the member behind one feed event liked, newest first: Social's
 *  person card (MESITA-2583). The event names the member, never an id
 *  (MESITA-2460); an anonymous member's event returns none. */
export async function apiLikedPlaces(
  client: SupabaseClient,
  event: Pick<ActivityFeedItem, "placeId" | "kind" | "at">,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    "consumer-web-list-activity",
    {
      scope: "liked",
      place_id: event.placeId,
      kind: event.kind,
      at: event.at,
    },
  );
  return places;
}
