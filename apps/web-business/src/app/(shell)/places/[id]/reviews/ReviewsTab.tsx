"use client";

// Reviews — cross-channel standing (MESITA-1807) plus Mesita guest reviews
// (MESITA-1802). Score tiles stay read-only; individual reviews load through
// business-web-list-reviews.

import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";
import { MesitaReviewsList } from "@/components/place-manage/sections/MesitaReviewsList";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ReviewsTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <ReviewsSummary place={place} />
      <MesitaReviewsList placeId={place.id} />
    </div>
  );
}
