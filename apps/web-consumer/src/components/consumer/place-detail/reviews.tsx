"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import {
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
} from "@/components/consumer/BrandLogos";
import { ReviewCard } from "@/components/consumer/ReviewCard";
import type { PlaceDetail } from "@/lib/mock/place";
import { formatCompactCount, formatRating } from "@/lib/utils";

import { Box, BoxHScroll } from "./box";
import {
  ExternalCard,
  type ReviewSort,
  ReviewSortChips,
  reviewTimeMs,
} from "./review-ui";

// ── 3. Reviews summary ──────────────────────────────────────────────────

export function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
  // The three outside channels in a 3-up grid — same shape, different
  // source. Google carries a rating and a count; Instagram and Facebook
  // carry reach.
  return (
    <Box title="Reviews summary" icon={Star} iconColor="text-muted-foreground">
      <div className="grid grid-cols-3 gap-2">
        <ExternalCard
          logo={<GoogleLogo />}
          icon="star"
          value={formatRating(place.google.rating)!}
          meta={`${formatCompactCount(place.google.count, true)} reviews`}
        />
        <ExternalCard
          logo={<InstagramLogo />}
          icon="users"
          value={formatCompactCount(place.instagram.followers, false)}
          meta="followers"
        />
        <ExternalCard
          logo={<FacebookLogo />}
          icon="users"
          value={formatCompactCount(place.facebook.followers, false)}
          meta="followers"
        />
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
      right={`${formatCompactCount(place.google.count, true)} total`}
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
