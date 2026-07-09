"use client";

import { ReviewsSection } from "../../sections/ReviewsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitReviewsPage() {
  const { place } = useUnitPlace();
  return <ReviewsSection place={place} />;
}
