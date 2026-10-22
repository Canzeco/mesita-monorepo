"use client";

import { useMemo, useState } from "react";

import { ReviewCard } from "../ReviewCard";
import type { PlaceDetail } from "../../place-detail";

// decision: Pato (2026-10-16) — the channel counts live in the header and
// hide while this tab is selected. What remains is Google's reviews, stacked
// like comments: a first batch, then Show more. Not a sideways carousel.
// Show more reveals more reviews; a long quote still uses its own Read more.
//
// decision: Pato (2026-10-18, MESITA-2309) — one flat list on the page, the
// way Google Maps lists them: no box, no "Google reviews" title (each
// review's G already says where it came from), no card per review, a
// hairline between reviews.
//
// THE LIST STARTS AT THE FIRST REVIEW (Pato, MESITA-2618: "remove the stupid
// sorting of reviews. neither mention the number of reviews ... just show
// the reviews directly. the number of reviews its already told upside").
// The Newest · Highest · Lowest chips and the "395 reviews" line are gone:
// the header's Google column already prints the count ("4.9 ★ (395)"), and
// the one order is newest first.

/** How many reviews the list shows before the next Show more. */
export const REVIEW_PAGE = 5;

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

export function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [shown, setShown] = useState(REVIEW_PAGE);
  const reviews = place.google_reviews;
  const sorted = useMemo(
    () =>
      [...reviews].sort(
        (a, b) => reviewTimeMs(b.date) - reviewTimeMs(a.date),
      ),
    [reviews],
  );

  if (reviews.length === 0) return null;
  return (
    <section className="flex flex-col" aria-label="Reviews">
      <ul className="divide-border divide-y">
        {sorted.slice(0, shown).map((review, i) => (
          <li
            key={`google-${review.author}-${review.date}-${i}`}
            className="py-4"
          >
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + REVIEW_PAGE)}
          className="border-border text-foreground hover:bg-muted w-full border-t py-3 text-sm font-semibold"
        >
          Show more
        </button>
      )}
    </section>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.
