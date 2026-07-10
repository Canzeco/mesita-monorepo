"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { ProductsSection } from "../../sections/ProductsSection";
import { ReviewsSection } from "../../sections/ReviewsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPlacePage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="flex flex-col gap-8">
      <PlaceSection place={place} onSaved={setPlace} />
      <div id="products" className="scroll-mt-28">
        <ProductsSection key={place.id} place={place} onSaved={setPlace} />
      </div>
      <div id="reviews" className="scroll-mt-28">
        <ReviewsSection place={place} />
      </div>
    </div>
  );
}
