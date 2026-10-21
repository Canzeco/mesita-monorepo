// Social's SAMPLE ACTIVITY (Pato, MESITA-2520: "for the moment produce mock
// data for that shit for social. keep it clean").
//
// Made-up MEMBERS on REAL PLACES: while consumer-web-list-activity returns
// nothing, the Social tab draws these rows instead of its empty state. The
// places are the first places of Home's own All pool, so every row opens a
// real place — no place is invented (no-invented-places.test.ts, MESITA-2095).
// The members are a fixed cast with initial avatars, never borrowed photos.
// Never mixed: one real item and the sample is gone. Exit: delete this file
// when real activity flows.

import type {
  ActivityFeedItem,
  ActivityKind,
  ActivityPerson,
} from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";

type Member = {
  name: string;
  handle: string;
  followers: number;
  /** A sample shows each combination of Class and Plan (MESITA-2553). */
  guestClass?: "regular" | "vip";
  plan?: "free" | "premium";
};

/** The sample cast: first names and Instagram-style usernames. */
export const SAMPLE_MEMBERS: readonly Member[] = [
  { name: "Sofía", handle: "sofi.eats", followers: 4820 },
  { name: "Diego", handle: "diegogarza", followers: 1290 },
  {
    name: "Valeria",
    handle: "vale.mty",
    followers: 9310,
    guestClass: "vip",
    plan: "premium",
  },
  { name: "Andrés", handle: "andres_tc", followers: 760 },
  { name: "Mariana", handle: "marianaflores", followers: 2140 },
  { name: "Emilio", handle: "emiliocafe", followers: 3380, guestClass: "vip" },
  { name: "Regina", handle: "regi.brunch", followers: 6050, plan: "premium" },
  { name: "Santiago", handle: "santi.sp", followers: 1880 },
];

/** One row per entry: who, what, how long ago (minutes). One person, one
 *  place, one event (MESITA-2532). */
const SCRIPT: readonly {
  member: number;
  kind: ActivityKind;
  minutesAgo: number;
}[] = [
  { member: 0, kind: "saved", minutesAgo: 6 },
  { member: 1, kind: "viewed", minutesAgo: 24 },
  { member: 2, kind: "viewed", minutesAgo: 51 },
  { member: 3, kind: "saved", minutesAgo: 95 },
  { member: 4, kind: "saved", minutesAgo: 180 },
  { member: 5, kind: "viewed", minutesAgo: 320 },
  { member: 6, kind: "saved", minutesAgo: 600 },
  { member: 7, kind: "viewed", minutesAgo: 1500 },
];

function person(m: Member): ActivityPerson {
  return {
    name: m.name,
    avatarUrl: null,
    handleHint: m.handle.slice(0, 3),
    followers: m.followers,
    isYou: false,
    guestClass: m.guestClass ?? "regular",
    plan: m.plan ?? "free",
    anonymous: false,
  };
}

/** The sample rows over `places` (in their order), at most one per script
 *  line; none without places. */
export function sampleActivity(
  places: readonly Place[],
  now = Date.now(),
): ActivityFeedItem[] {
  if (places.length === 0) return [];
  return SCRIPT.map((line, i) => {
    const place = places[i % places.length];
    return {
      placeId: place.id,
      kind: line.kind,
      at: new Date(now - line.minutesAgo * 60_000).toISOString(),
      person: person(SAMPLE_MEMBERS[line.member]),
      distanceKm:
        typeof place.distance_km === "number" ? place.distance_km : null,
      place,
    };
  });
}
