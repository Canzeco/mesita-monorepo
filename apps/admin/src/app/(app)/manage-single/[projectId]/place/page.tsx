"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { ProductsSection } from "../../sections/ProductsSection";
import { ReviewsSection } from "../../sections/ReviewsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPlacePage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      <PlaceSection place={place} onSaved={setPlace}>
        <ProductsSection key={place.id} place={place} onSaved={setPlace} />
        <ReviewsSection place={place} />
      </PlaceSection>
    </div>
  );
}
