"use client";

import { useMemo, useState } from "react";

import { ReviewCard } from "../ReviewCard";
import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

import { type ReviewSort, ReviewSortChips, reviewTimeMs } from "./review-ui";
import { Section } from "./section";

// decision: Pato (2026-10-19, MESITA-2441) — on the one scroll, Reviews
// shows three (newest first), then "See all" opens the full sortable list
// in place. The tab that held the list is gone.

/** How many reviews the scroll shows before "See all". */
export const REVIEW_PREVIEW = 3;

function newestFirst(reviews: PlaceDetail["google_reviews"]) {
  return [...reviews].sort((a, b) => reviewTimeMs(b.date) - reviewTimeMs(a.date));
}

export function ReviewsSection({ place }: { place: PlaceDetail }) {
  const [all, setAll] = useState(false);
  const reviews = place.google_reviews;
  if (reviews.length === 0) return null;
  const rating = formatRating(place.google.rating);
  const total = place.google.count ?? reviews.length;
  const right = rating
    ? `★ ${rating} · ${formatCompactCount(total, true)} reviews`
    : `${formatCompactCount(total, true)} reviews`;
  return (
    <Section title="Reviews" right={right}>
      {all ? (
        <GoogleReviewsBox place={place} />
      ) : (
        <>
          <ul className="divide-border -mt-1 divide-y">
            {newestFirst(reviews)
              .slice(0, REVIEW_PREVIEW)
              .map((review, i) => (
                <li key={`google-${review.author}-${review.date}-${i}`} className="py-4">
                  <ReviewCard review={review} />
                </li>
              ))}
          </ul>
          {reviews.length > REVIEW_PREVIEW && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="border-border text-foreground hover:bg-muted min-h-11 w-full rounded-lg border text-sm font-semibold"
            >
              See all {reviews.length} reviews
            </button>
          )}
        </>
      )}
    </Section>
  );
}

// The full list "See all" opens: Google's reviews stacked like comments, a
// first batch, then Show more. Not a sideways carousel.
// Newest / Highest / Lowest stay. Show more reveals more reviews; a long
// quote still uses its own Read more.
//
// decision: Pato (2026-10-18, MESITA-2309) — one flat list on the page, the
// way Google Maps lists them: no box, no "Google reviews" title (each
// review's G already says where it came from), no card per review, a
// hairline between reviews. The sort is a light row above the list.

/** How many reviews the list shows before the next Show more. */
export const REVIEW_PAGE = 5;

export function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [shown, setShown] = useState(REVIEW_PAGE);
  const reviews = place.google_reviews;
  const sorted = useMemo(() => {
    const copy = [...reviews];
    copy.sort((a, b) => {
      if (sort === "highest") {
        return (
          b.rating - a.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      if (sort === "lowest") {
        return (
          a.rating - b.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      return reviewTimeMs(b.date) - reviewTimeMs(a.date);
    });
    return copy;
  }, [reviews, sort]);

  if (reviews.length === 0) return null;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-1">
        <ReviewSortChips
          sort={sort}
          onSort={(next) => {
            if (next !== sort) setShown(REVIEW_PAGE);
            setSort(next);
          }}
          label="Sort reviews"
        />
      </div>
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
    </div>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.
