// Social v1 (MESITA-2442): the three events (saved · viewed · went) and the
// three ways they are read back. One helper per call, each one Edge Function.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Place } from "./places";

export type ActivityKind = "saved" | "viewed" | "went";

/** A member as Social shows them. Only Instagram-connected members who left
 *  Show my activity on ever come back from the server, and never with their
 *  whole username: `handleHint` is its first three letters (MESITA-2522). */
export type ActivityPerson = {
  name: string;
  avatarUrl: string | null;
  handleHint: string | null;
  followers: number;
  isYou: boolean;
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
  /** "Perdón and 3 others saw this", or null when nobody visible has. */
  line: string | null;
  people: ActivityPerson[];
  total: number;
  me: { saved: boolean; went: boolean };
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
