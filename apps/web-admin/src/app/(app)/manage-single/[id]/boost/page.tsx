"use client";

import { BoostSection } from "@/components/place-manage/sections/BoostSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// Single Place › Premier: who pays for this place's paid visibility
// (MESITA-2789; Boost renamed Premier, MESITA-2925). Read-only.
export default function AdminPlaceBoostPage() {
  const { place } = usePlaceContext();
  return <BoostSection placeId={place.id} />;
}
