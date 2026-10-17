"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { ReviewCard } from "../ReviewCard";
import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount } from "../../lib/format";

import { Box } from "./box";
import {
  type ReviewSort,
  ReviewSortChips,
  reviewTimeMs,
} from "./review-ui";

// decision: Pato (2026-10-16) — the channel counts live in the header and
// hide while this tab is selected. What remains is Google's reviews, stacked
// like comments: a first batch, then Show more. Not a sideways carousel.
// Newest / Highest / Lowest stay. Show more reveals more reviews; a long
// quote still uses its own Read more.

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
    <Box
      title="Google reviews"
      icon={Star}
      iconColor="text-muted-foreground"
      right={
        place.google.count != null
          ? `${formatCompactCount(place.google.count, true)} total`
          : undefined
      }
    >
      <ReviewSortChips
        sort={sort}
        onSort={(next) => {
          if (next !== sort) setShown(REVIEW_PAGE);
          setSort(next);
        }}
        label="Sort Google reviews"
      />
      <div className="flex flex-col gap-3">
        {sorted.slice(0, shown).map((review, i) => (
          <ReviewCard
            key={`google-${review.author}-${review.date}-${i}`}
            review={review}
          />
        ))}
      </div>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + REVIEW_PAGE)}
          className="border-border text-foreground hover:bg-muted w-full rounded-xl border py-2.5 text-sm font-semibold"
        >
          Show more
        </button>
      )}
    </Box>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.
