"use client";

import { ReviewsSection } from "../../sections/ReviewsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Reviews — own tab again (MESITA-834; MESITA-368 had folded it into Place).
export default function UnitReviewsPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5">
        <ReviewsSection place={place} />
      </div>
    </div>
  );
}
