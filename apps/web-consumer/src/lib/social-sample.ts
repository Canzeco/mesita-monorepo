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

type Member = { name: string; handle: string; followers: number };

/** The sample cast: first names and Instagram-style usernames. */
export const SAMPLE_MEMBERS: readonly Member[] = [
  { name: "Sofía", handle: "sofi.eats", followers: 4820 },
  { name: "Diego", handle: "diegogarza", followers: 1290 },
  { name: "Valeria", handle: "vale.mty", followers: 9310 },
  { name: "Andrés", handle: "andres_tc", followers: 760 },
  { name: "Mariana", handle: "marianaflores", followers: 2140 },
  { name: "Emilio", handle: "emiliocafe", followers: 3380 },
  { name: "Regina", handle: "regi.brunch", followers: 6050 },
  { name: "Santiago", handle: "santi.sp", followers: 1880 },
];

/** One row per entry: who, what, how many others, how long ago (minutes). */
const SCRIPT: readonly {
  member: number;
  kind: ActivityKind;
  others: number;
  minutesAgo: number;
}[] = [
  { member: 0, kind: "saved", others: 0, minutesAgo: 6 },
  { member: 1, kind: "went", others: 2, minutesAgo: 24 },
  { member: 2, kind: "viewed", others: 0, minutesAgo: 51 },
  { member: 3, kind: "saved", others: 4, minutesAgo: 95 },
  { member: 4, kind: "went", others: 0, minutesAgo: 180 },
  { member: 5, kind: "viewed", others: 1, minutesAgo: 320 },
  { member: 6, kind: "saved", others: 0, minutesAgo: 600 },
  { member: 7, kind: "went", others: 3, minutesAgo: 1500 },
];

function person(m: Member): ActivityPerson {
  return {
    name: m.name,
    avatarUrl: null,
    handleHint: m.handle.slice(0, 3),
    followers: m.followers,
    isYou: false,
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
    const lead = person(SAMPLE_MEMBERS[line.member]);
    return {
      placeId: place.id,
      kind: line.kind,
      at: new Date(now - line.minutesAgo * 60_000).toISOString(),
      lead,
      people: [lead],
      others: line.others,
      distanceKm:
        typeof place.distance_km === "number" ? place.distance_km : null,
      place,
    };
  });
}
