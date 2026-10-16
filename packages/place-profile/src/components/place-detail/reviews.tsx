"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { ReviewCard } from "../ReviewCard";
import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount } from "../../lib/format";

import { Box, BoxHScroll } from "./box";
import {
  type ReviewSort,
  ReviewSortChips,
  reviewTimeMs,
} from "./review-ui";

// Google, Instagram, and Facebook sit in the profile header, beside the
// photo. This tab is Google's own review cards.

export function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>("newest");
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
        onSort={setSort}
        label="Sort Google reviews"
      />
      <BoxHScroll>
        {sorted.map((review, i) => (
          <ReviewCard
            key={`google-${review.author}-${review.date}-${i}`}
            review={review}
          />
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.
