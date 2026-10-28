// Social v1 (MESITA-2442): the two events (saved · viewed; no went since
// MESITA-2567) and the four ways they are read back. One helper per call, each one Edge Function.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Place } from "./places";

export type ActivityKind = "saved" | "viewed";

/** A member as Social shows them: always by first name (MESITA-2612), with
 *  the full @handle when they verified Instagram and keep Public profile on
 *  (MESITA-2590); else no handle (`anonymous`, MESITA-2580). */
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
  /** A verified Instagram (MESITA-2608): the Instagram mark on the face,
   *  on anonymous rows too. */
  instagram: boolean;
  /** No handle on this row: a member without Instagram (MESITA-2580), a
   *  view in the feed (MESITA-2594) or Public profile off. The first name
   *  still shows (MESITA-2612), and the face (MESITA-2608): photo, Class and
   *  the Instagram flag, the photo blank when Public profile is off. */
  anonymous: boolean;
};

/** One feed item: one member, one place, one verb — never collapsed
 *  (MESITA-2532). */
export type ActivityFeedItem = {
  placeId: string;
  kind: ActivityKind;
  at: string;
  person: ActivityPerson;
  /** Km from the guest's point to the PLACE, the only distance a row shows
   *  (MESITA-2946). Null without a guest point. */
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
  input: {
    kind: ActivityKind;
    placeId: string;
    on?: boolean;
    quiet?: boolean;
    /** Where the device is now (MESITA-2853): the feed says how far away
     *  the event happened. Omitted without a fix. */
    at?: { lat: number; lng: number } | null;
  },
): Promise<{ enriching: boolean }> {
  if (!isMesitaPlaceId(input.placeId)) return { enriching: false };
  // A `viewed` says whether the place is mid-Enrich after it (MESITA-2952).
  const res = await invokeEF<{ kind: ActivityKind; on: boolean; enriching?: boolean }>(
    client,
    "consumer-web-track-activity",
    {
      kind: input.kind,
      place_id: input.placeId,
      on: input.on ?? true,
      // A backfilled pre-Social save stays out of the feed (MESITA-2460).
      ...(input.quiet ? { quiet: true } : {}),
      ...(input.at ? { lat: input.at.lat, lng: input.at.lng } : {}),
    },
  );
  return { enriching: res.enriching === true };
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

/** One event in a member's history: what they did, where, when. */
export type MemberHistoryItem = {
  placeId: string;
  kind: ActivityKind;
  at: string;
  place: Place;
};

/** The member behind one feed event and their whole history, liked and
 *  viewed, newest first: Social's person card (MESITA-2609, replacing
 *  MESITA-2583's liked-only list). The event names the member, never an id
 *  (MESITA-2460). The person is named by a like's rule, so the card may name
 *  a handle the row did not; a deleted member returns null. */
export async function apiMemberHistory(
  client: SupabaseClient,
  event: Pick<ActivityFeedItem, "placeId" | "kind" | "at">,
): Promise<{ person: ActivityPerson | null; items: MemberHistoryItem[] }> {
  const { person, items } = await invokeEF<{
    person: ActivityPerson | null;
    items: MemberHistoryItem[];
  }>(client, "consumer-web-list-activity", {
    scope: "history",
    place_id: event.placeId,
    kind: event.kind,
    at: event.at,
  });
  return { person, items };
}
