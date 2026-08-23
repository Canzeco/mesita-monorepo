"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { MenusSection } from "../../sections/MenusSection";
import { ProfileCompleteness } from "../../sections/ProfileCompleteness";
import { usePlaceContext } from "../../PlaceContext";

// Place — the editable profile, with Menus as a card in the same
// masonry. Reviews folded into Performance; the Mesita-internal cards live on
// the Admin tab (MESITA-834 + amendments).
export default function PlaceProfilePage() {
  const { place } = usePlaceContext();

  return (
    <div className="mx-auto max-w-7xl">
      {/* Full-width banner above the masonry — client-computed, no backend. */}
      <ProfileCompleteness place={place} />
      <PlaceSection place={place}>
        <MenusSection key={place.id} place={place} />
      </PlaceSection>
    </div>
  );
}
