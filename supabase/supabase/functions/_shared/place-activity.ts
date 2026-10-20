// Social v1 (MESITA-2442): the three events and how they are read back.
//
// Activity, not reviews (Pato, 2026-10-19): saved · viewed · went, one row per
// consumer × place × kind in public.place_activity. Who may appear (Instagram
// connected + Show my activity + not deleted) is decided in SQL
// (place_activity_visible); this module only shapes what those readers return:
// the feed's collapsed items and their order, and the place profile's line.

export const ACTIVITY_KINDS = ["saved", "viewed", "went"] as const;
export type ActivityKind = typeof ACTIVITY_KINDS[number];

export function isActivityKind(v: unknown): v is ActivityKind {
  return typeof v === "string" && (ACTIVITY_KINDS as readonly string[]).includes(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only Mesita places carry activity. A Google-only card (`g:<id>`) is not a
 *  row yet, so its save stays in the browser until the place is created. */
export function isMesitaPlaceId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** One person as the feed and the line show them. */
export type ActivityPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  handle: string | null;
  followers: number;
  isYou: boolean;
};

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
  total?: number | string | null;
};

export function toPerson(row: ActivityRow, viewerId: string): ActivityPerson {
  const first = row.first_name?.trim();
  const handle = row.instagram_handle?.trim() || null;
  return {
    id: row.consumer_id,
    name: first || (handle ? `@${handle}` : "A member"),
    avatarUrl: row.avatar_url ?? null,
    handle,
    followers: Math.max(0, Math.trunc(Number(row.instagram_followers_count ?? 0)) || 0),
    isYou: row.consumer_id === viewerId,
  };
}

/** A collapsed feed item: same place + same verb is one item. */
export type FeedGroup = {
  placeId: string;
  kind: ActivityKind;
  at: string;
  lead: ActivityPerson;
  /** Up to three faces, lead first. */
  people: ActivityPerson[];
  /** Everyone else who did the same thing here. */
  others: number;
};

/** Collapse rows (newest first) into one item per place × verb. The item's
 *  time and lead are its newest row. */
export function groupFeed(rows: readonly ActivityRow[], viewerId: string): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const row of sorted) {
    if (!row.place_id || !isActivityKind(row.kind)) continue;
    const key = `${row.place_id}|${row.kind}`;
    const person = toPerson(row, viewerId);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        placeId: row.place_id,
        kind: row.kind,
        at: row.created_at,
        lead: person,
        people: [person],
        others: 0,
      });
      continue;
    }
    g.others += 1;
    if (g.people.length < 3) g.people.push(person);
  }
  return [...groups.values()];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Newest first by day; within a day, the nearer place first, then newest.
 *  `distanceKm` is null when the guest's location or the place's is unknown,
 *  and an unknown distance sorts after every known one. */
export function orderFeed<T extends { at: string; distanceKm: number | null }>(
  items: readonly T[],
  now: Date,
): T[] {
  const day = (iso: string) => Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
  return [...items].sort((a, b) => {
    const d = day(a.at) - day(b.at);
    if (d !== 0) return d;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.at.localeCompare(a.at);
  });
}

/** The line under a place's title: "Perdón and 3 others saw this". People
 *  first; null when nobody visible has touched the place. */
export function socialLine(lead: ActivityPerson | null, total: number): string | null {
  if (!lead || total <= 0) return null;
  const who = lead.isYou ? "You" : lead.name;
  const rest = total - 1;
  if (rest <= 0) return `${who} saw this`;
  return `${who} and ${rest} ${rest === 1 ? "other" : "others"} saw this`;
}
