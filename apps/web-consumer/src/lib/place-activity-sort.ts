// Sort comparators for the place profile's guest-activity rails
// (MESITA-1147). Pure and side-effect free so they can be unit-tested without
// rendering — the boxes themselves only hold the selected mode in state.
//
// Sorting stays on the frontend, extending the standing decision recorded in
// components/consumer/place-detail/review-ui.tsx: these rails cap at a couple
// of dozen cards, so a round-trip per sort tap would buy nothing.
//
// Every comparator is TOTAL: each one falls through to recency so equal keys
// never leave the order up to Array.prototype.sort's stability guarantees
// across engines.

import type {
  PlaceReservation,
  PlaceStory,
  PlaceVisit,
} from "@/lib/api/place-activity";

export type StorySort = "newest" | "oldest" | "reach";
export type VisitSort = "newest" | "reward" | "reviewed";
export type ReservationSort = "newest" | "upcoming" | "party";

/** Unparseable / missing timestamps sort to the very end, never to 1970. */
export function timeMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function sortStories(
  stories: readonly PlaceStory[],
  sort: StorySort,
): PlaceStory[] {
  const copy = [...stories];
  copy.sort((a, b) => {
    const recent = timeMs(b.posted_at) - timeMs(a.posted_at);
    if (sort === "reach") return b.followers - a.followers || recent;
    return sort === "oldest" ? -recent : recent;
  });
  return copy;
}

export function sortVisits(
  visits: readonly PlaceVisit[],
  sort: VisitSort,
): PlaceVisit[] {
  const copy = [...visits];
  copy.sort((a, b) => {
    const recent = timeMs(b.visited_at) - timeMs(a.visited_at);
    if (sort === "reward") {
      return b.discount_percent - a.discount_percent || recent;
    }
    if (sort === "reviewed") {
      return Number(b.reviewed) - Number(a.reviewed) || recent;
    }
    return recent;
  });
  return copy;
}

/**
 * `upcomingFrom` is the instant "Upcoming" is measured against, passed in
 * rather than read here: reading the clock inside a render path is impure
 * (react-hooks/purity), and a comparator that moves under you is untestable.
 */
export function sortReservations(
  reservations: readonly PlaceReservation[],
  sort: ReservationSort,
  upcomingFrom: number,
): PlaceReservation[] {
  const copy = [...reservations];
  copy.sort((a, b) => {
    const recent = timeMs(b.reserved_at) - timeMs(a.reserved_at);
    if (sort === "party") return b.party_size - a.party_size || recent;
    if (sort === "upcoming") {
      // Soonest future booking first, everything already past behind it.
      const aFuture = timeMs(a.reserved_at) >= upcomingFrom;
      const bFuture = timeMs(b.reserved_at) >= upcomingFrom;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? timeMs(a.reserved_at) - timeMs(b.reserved_at) : recent;
    }
    return recent;
  });
  return copy;
}
