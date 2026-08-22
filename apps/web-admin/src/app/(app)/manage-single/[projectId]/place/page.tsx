"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { ProductsSection } from "../../sections/ProductsSection";
import { ProfileCompleteness } from "../../sections/ProfileCompleteness";
import { usePlaceContext } from "../../PlaceContext";

// Place — the editable profile, with Products (menus) as a card in the same
// masonry. Reviews folded into Performance; the Mesita-internal cards live on
// the Admin tab (MESITA-834 + amendments).
export default function PlaceProfilePage() {
  const { place, setPlace } = usePlaceContext();

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
