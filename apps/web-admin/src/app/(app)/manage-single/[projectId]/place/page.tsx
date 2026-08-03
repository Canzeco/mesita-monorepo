"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { ProfileCompleteness } from "../../sections/ProfileCompleteness";
import { useUnitPlace } from "../../UnitPlaceContext";

// Place — the editable profile. Reviews/Products moved to their own tabs and
// the operator/meta cards to Settings (MESITA-834).
export default function UnitPlacePage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      {/* Full-width banner above the masonry — client-computed, no backend. */}
      <ProfileCompleteness place={place} />
      <PlaceSection place={place} onSaved={setPlace} />
    </div>
  );
}
