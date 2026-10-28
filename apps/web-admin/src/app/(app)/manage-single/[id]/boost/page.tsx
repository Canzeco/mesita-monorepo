"use client";

import { BoostSection } from "@/components/place-manage/sections/BoostSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// Single Place › Official: who pays for this place's paid visibility
// (MESITA-2789; Boost renamed Official, MESITA-2925). Read-only.
export default function AdminPlaceBoostPage() {
  const { place } = usePlaceContext();
  return <BoostSection placeId={place.id} />;
}
