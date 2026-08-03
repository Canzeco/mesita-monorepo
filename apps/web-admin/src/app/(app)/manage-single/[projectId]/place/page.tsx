"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { ProductsSection } from "../../sections/ProductsSection";
import { ProfileCompleteness } from "../../sections/ProfileCompleteness";
import { useUnitPlace } from "../../UnitPlaceContext";

// Place — the editable profile, with Products (menus) as a card in the same
// masonry. Reviews has its own tab; the operator/meta cards live on Settings
// (MESITA-834 + amendments).
export default function UnitPlacePage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      {/* Full-width banner above the masonry — client-computed, no backend. */}
      <ProfileCompleteness place={place} />
      <PlaceSection place={place} onSaved={setPlace}>
        <ProductsSection key={place.id} place={place} onSaved={setPlace} />
      </PlaceSection>
    </div>
  );
}
