"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import {
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
} from "../BrandLogos";
import { ReviewCard } from "../ReviewCard";
import type { PlaceDetail } from "../../place-detail";
import { formatCompactCount, formatRating } from "../../lib/format";

import { Box, BoxHScroll } from "./box";
import {
  ExternalCard,
  type ReviewSort,
  ReviewSortChips,
  reviewTimeMs,
} from "./review-ui";

// ── 3. Reviews summary ──────────────────────────────────────────────────

export function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
  const rating = formatRating(place.google.rating);
  const cards = [
    rating != null ? (
      <ExternalCard
        key="google"
        logo={<GoogleLogo />}
        icon="star"
        value={rating}
        meta={
          place.google.count != null
            ? `${formatCompactCount(place.google.count, true)} reviews`
            : "Google"
        }
      />
    ) : null,
    place.instagram.followers != null ? (
      <ExternalCard
        key="instagram"
        logo={<InstagramLogo />}
        icon="users"
        value={formatCompactCount(place.instagram.followers, false)}
        meta="followers"
      />
    ) : null,
    place.facebook.followers != null ? (
      <ExternalCard
        key="facebook"
        logo={<FacebookLogo />}
        icon="users"
        value={formatCompactCount(place.facebook.followers, false)}
        meta="followers"
      />
    ) : null,
  ].filter((card) => card != null);
  if (cards.length === 0) return null;
  return (
    <Box title="Reviews summary" icon={Star} iconColor="text-muted-foreground">
      <div
        className={
          cards.length >= 3
            ? "grid grid-cols-3 gap-2"
            : cards.length === 2
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-2"
        }
      >
        {cards}
      </div>
    </Box>
  );
}

// ── 4. Individual reviews (Reviews tab: Google's cards) ─────────────────

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
