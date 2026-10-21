// Social v1 (MESITA-2442): the three events and how they are read back.
//
// Activity, not reviews (Pato, 2026-10-19): saved · viewed · went, one row per
// consumer × place × kind in public.place_activity. Who may appear (Instagram
// connected + Show my activity + not deleted) is decided in SQL
// (place_activity_visible); this module only shapes what those readers return:
// the feed's events (one row each, newest first, near the guest) and the
// place profile's line.

export const ACTIVITY_KINDS = ["saved", "viewed", "went"] as const;
export type ActivityKind = typeof ACTIVITY_KINDS[number];

export function isActivityKind(v: unknown): v is ActivityKind {
  return typeof v === "string" &&
    (ACTIVITY_KINDS as readonly string[]).includes(v);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only Mesita places carry activity. A Google-only card (`g:<id>`) is not a
 *  row yet, so its save stays in the browser until the place is created. */
export function isMesitaPlaceId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** One person as the feed and the line show them. */
export type ActivityPerson = {
  name: string;
  avatarUrl: string | null;
  /** The first three letters of the Instagram username, never the whole of
   *  it (Pato, MESITA-2522: "i don't really want the instagram username since
   *  it might cause the users to abandond my app … just clicing maybe first 3
   *  letters"). Null without Instagram. */
  handleHint: string | null;
  followers: number;
  isYou: boolean;
  /** Diamond, yes or no — granted by hand (MESITA-2044, MESITA-2548). */
  diamond: boolean;
  /** The plan, free or premium (MESITA-2548). */
  plan: ConsumerPlan;
};

export type ConsumerPlan = "free" | "premium";

/** Anything but "premium" reads as free: the column is checked, but an old
 *  row or a missing field must never show a plan the member does not have. */
export function toPlan(v: unknown): ConsumerPlan {
  return v === "premium" ? "premium" : "free";
}

/** "perdon" → "per"; a shorter handle keeps one letter. */
export function handleHint(handle: string | null | undefined): string | null {
  const h = handle?.trim().replace(/^@/, "").toLowerCase();
  if (!h) return null;
  return h.length > 3 ? h.slice(0, 3) : h.slice(0, 1);
}

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
  diamond?: boolean | null;
  plan?: string | null;
  total?: number | string | null;
};

export function toPerson(row: ActivityRow, viewerId: string): ActivityPerson {
  const first = row.first_name?.trim();
  return {
    // Never "@handle": the whole username does not leave the server.
    name: first || "A member",
    avatarUrl: row.avatar_url ?? null,
    handleHint: handleHint(row.instagram_handle),
    followers: Math.max(
      0,
      Math.trunc(Number(row.instagram_followers_count ?? 0)) || 0,
    ),
    isYou: row.consumer_id === viewerId,
    diamond: row.diamond === true,
    plan: toPlan(row.plan),
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
};

/** Every row is its own event, newest first ("list all the fucking events"),
 *  by time only. A row with no place or an unknown verb is dropped. */
export function feedEvents(
  rows: readonly ActivityRow[],
  viewerId: string,
): FeedEvent[] {
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .flatMap((row) =>
      row.place_id && isActivityKind(row.kind)
        ? [{
          placeId: row.place_id,
          kind: row.kind,
          at: row.created_at,
          person: toPerson(row, viewerId),
        }]
        : []
    );
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

/** The line under a place's title: "Perdón and 3 others saw this". People
 *  first; null when nobody visible has touched the place. */
export function socialLine(
  lead: ActivityPerson | null,
  total: number,
): string | null {
  if (!lead || total <= 0) return null;
  const who = lead.isYou ? "You" : lead.name;
  const rest = total - 1;
  if (rest <= 0) return `${who} saw this`;
  return `${who} and ${rest} ${rest === 1 ? "other" : "others"} saw this`;
}
