"use client";

// Reviews — the cross-channel standing a place is judged on (MESITA-1807).
// The four score tiles and the Mesita sub-scores that used to sit on
// Profile; the per-review list follows in MESITA-1802 once the console has a
// door to read them through.

import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ReviewsTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <ReviewsSummary place={place} />
    </div>
  );
}
