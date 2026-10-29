// Social v1 (MESITA-2442): the two events and how they are read back.
//
// Activity, not reviews (Pato, 2026-10-19): saved · viewed, one row per
// consumer × place × kind in public.place_activity. There is no `went` for now
// (Pato, MESITA-2567: "there is no visited. there is only viewed and liked"):
// it is refused on write and dropped on read; the table's CHECK still allows
// it, so it can come back without a migration. Who may appear (a verified
// Instagram + Public profile + not deleted, and never for a view, MESITA-2594)
// is decided in SQL (place_activity_visible and the readers); this module only
// shapes what those readers return, and masks handles for a viewer who does
// not show their own (seesHandles):
// the feed's events (one row each, newest first, near the guest) and the
// place profile's line.

import { isUuid } from "./place-id.ts";

export const ACTIVITY_KINDS = ["saved", "viewed"] as const;
export type ActivityKind = typeof ACTIVITY_KINDS[number];

export function isActivityKind(v: unknown): v is ActivityKind {
  return typeof v === "string" &&
    (ACTIVITY_KINDS as readonly string[]).includes(v);
}

/** Only Mesita places carry activity. A Google-only card (`g:<id>`) is not a
 *  row yet, so its save stays in the browser until the place is created. */
export function isMesitaPlaceId(v: unknown): v is string {
  return isUuid(v);
}

/** One person as the feed and the line show them. */
export type ActivityPerson = {
  name: string;
  avatarUrl: string | null;
  /** The verified Instagram username, without "@" (MESITA-2590 shows it in
   *  full), or masked to "per***" when handleLocked. Null without a named
   *  Instagram: an anonymous member never carries one. */
  handle: string | null;
  /** The handle is masked because the viewer does not show their own
   *  (MESITA-2594, Pato: "to see others people instagram, you need to both
   *  have your instagram connected and have your account in public, else we
   *  just show the three first letters and the rest is ***"). The full
   *  handle never left the server; the app offers no Instagram link. */
  handleLocked: boolean;
  followers: number;
  isYou: boolean;
  /** Class: regular or vip, through a partner (MESITA-2553). */
  guestClass: ConsumerClass;
  /** Plan: free or premium, the subscription (MESITA-2553). */
  plan: ConsumerPlan;
  /** A verified Instagram (MESITA-2608): the Instagram mark on the face.
   *  Carried on anonymous rows too; the handle itself is not. */
  instagram: boolean;
  /** No handle on this row: a member without a verified Instagram
   *  (MESITA-2580), any view in the feed (MESITA-2594), or Public profile off.
   *  The FIRST NAME still shows (MESITA-2612: "A member" is gone), and so do
   *  Class, Plan, the Instagram flag and, unless Public profile is off, the
   *  photo (MESITA-2608). Every row is a door to the person card
   *  (MESITA-2609). */
  anonymous: boolean;
};

/** Plan and Class are independent (Pato, MESITA-2553). */
export type ConsumerPlan = "free" | "premium";
export type ConsumerClass = "regular" | "vip";

const unknownSeen = new Set<string>();

/** Logs a value the CHECK should have made impossible, once per value. */
function noteUnknown(field: string, v: unknown): void {
  if (v == null) return;
  const key = `${field}:${String(v)}`;
  if (unknownSeen.has(key)) return;
  unknownSeen.add(key);
  console.warn(`unknown_${field}_value`, JSON.stringify({ value: String(v) }));
}

/** Anything but "premium" reads as free: an old row or a missing field must never
 *  show a plan the member does not have. */
export function toPlan(v: unknown): ConsumerPlan {
  if (v === "premium") return "premium";
  if (v !== "free") noteUnknown("plan", v);
  return "free";
}

/** Anything but "vip" reads as regular, for the same reason. */
export function toClass(v: unknown): ConsumerClass {
  if (v === "vip") return "vip";
  if (v !== "regular") noteUnknown("guest_class", v);
  return "regular";
}

/** "perdon" → "per***": the first three letters, the rest hidden
 *  (MESITA-2594). Never the length: always three stars. */
export function maskHandle(handle: string): string {
  return `${handle.slice(0, 3)}***`;
}

/** Whether a viewer sees other members' full handles (MESITA-2594): only
 *  with their own Instagram verified and their profile public. */
export function seesHandles(
  viewer: {
    instagram_verified_at: string | null;
    appear_anonymous: boolean | null;
  } | null,
): boolean {
  return viewer != null && viewer.instagram_verified_at != null &&
    viewer.appear_anonymous !== true;
}

/** "@Perdon " → "perdon", or null. */
export function cleanHandle(handle: string | null | undefined): string | null {
  const h = handle?.trim().replace(/^@/, "").toLowerCase();
  return h || null;
}

/** The name of a member who never gave a first name: the Me header's own
 *  fallback (MESITA-2612; "A member" is retired). */
export const MEMBER_FALLBACK_NAME = "Mesita member";

/** A row from place_activity_feed / place_activity_people. */
export type ActivityRow = {
  consumer_id: string;
  place_id?: string;
  kind: string;
  created_at: string;
  first_name: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  instagram_followers_count: number | null;
  guest_class?: string | null;
  plan?: string | null;
  anonymous?: boolean | null;
  /** place_activity_feed only (MESITA-2608): a verified Instagram. */
  instagram?: boolean | null;
  /** place_activity_feed only (MESITA-2853): where the event happened. */
  lat?: number | null;
  lng?: number | null;
  total?: number | string | null;
};

export function toPerson(
  row: ActivityRow,
  viewerId: string,
  canSeeHandles = true,
): ActivityPerson {
  const isYou = row.consumer_id === viewerId;
  // Always a name (MESITA-2612): the first name, or the Me header's own
  // fallback when the member never gave one.
  const first = row.first_name?.trim() || MEMBER_FALLBACK_NAME;
  if (row.anonymous === true) {
    // No handle, no followers; the face and the name show (MESITA-2608,
    // MESITA-2612). SQL already blanked the photo for Public profile off.
    return {
      name: first,
      avatarUrl: row.avatar_url ?? null,
      handle: null,
      handleLocked: false,
      followers: 0,
      isYou,
      guestClass: toClass(row.guest_class),
      plan: toPlan(row.plan),
      instagram: row.instagram === true,
      anonymous: true,
    };
  }
  const handle = cleanHandle(row.instagram_handle);
  // Your own handle is never masked to you.
  const locked = handle != null && !isYou && !canSeeHandles;
  return {
    // The name is the first name, never "@handle"; the handle rides beside it.
    name: first,
    avatarUrl: row.avatar_url ?? null,
    handle: handle && locked ? maskHandle(handle) : handle,
    handleLocked: locked,
    followers: Math.max(
      0,
      Math.trunc(Number(row.instagram_followers_count ?? 0)) || 0,
    ),
    isYou,
    guestClass: toClass(row.guest_class),
    plan: toPlan(row.plan),
    // place_activity_people (the line under a place) has no flag; a named
    // row there always has a verified handle.
    instagram: row.instagram ?? handle != null,
    anonymous: false,
  };
}

/** One feed item: one member, one place, one verb (Pato, MESITA-2532:
 *  "don't mention and Xothers, is juse one person one place events"). No
 *  collapsing; the client never says "and N others". */
export type FeedEvent = {
  placeId: string;
  kind: ActivityKind;
  at: string;
  person: ActivityPerson;
  // No point and no event distance (MESITA-2946, Pato: "someone can move
  // between two notifications and use some trigonometry … to find
  // someone"): two viewer spots and two km locate the member. The row shows
  // the place's distance only.
};

/** Every row is its own event, newest first ("list all the fucking events"),
 *  by time only. A row with no place or an unknown verb is dropped. */
export function feedEvents(
  rows: readonly ActivityRow[],
  viewerId: string,
  canSeeHandles = true,
): FeedEvent[] {
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .flatMap((row) =>
      row.place_id && isActivityKind(row.kind)
        ? [{
          placeId: row.place_id,
          kind: row.kind,
          at: row.created_at,
          person: toPerson(row, viewerId, canSeeHandles),
        }]
        : []
    );
}

/** Where an event happened (MESITA-2853), as track-activity stores it: a device fix, or null when either
 *  half is missing or out of range. */
export function eventPoint(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Near you (MESITA-2532: "uner you radious or near you"): inside the
 *  operator's Area circle around the guest's point. Without a point there is
 *  no circle, so everything counts; with one, a place whose distance is
 *  unknown cannot be shown to be near and is left out. */
export function nearYou(
  distanceKm: number | null,
  radiusKm: number,
  hasPoint: boolean,
): boolean {
  if (!hasPoint) return true;
  return distanceKm != null && distanceKm <= radiusKm;
}

/** The line under a place's title: "Perdón and 3 others liked this". Likes
 *  only (MESITA-2594: a view is never named); null when no named member has
 *  liked the place. */
export function socialLine(
  lead: ActivityPerson | null,
  total: number,
): string | null {
  if (!lead || total <= 0) return null;
  const who = lead.isYou ? "You" : lead.name;
  const rest = total - 1;
  if (rest <= 0) return `${who} liked this`;
  return `${who} and ${rest} ${rest === 1 ? "other" : "others"} liked this`;
}
