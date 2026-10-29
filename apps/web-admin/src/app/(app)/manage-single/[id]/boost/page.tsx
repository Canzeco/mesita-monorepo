"use client";

import { BoostSection } from "@/components/place-manage/sections/BoostSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// Single Place › Premier: who pays for this place's paid visibility
// (MESITA-2995; Premier MESITA-2925, Boost MESITA-2789): the line, the
// periods, and the operator's grant / end grant / remove pledge.
export default function AdminPlaceBoostPage() {
  const { place } = usePlaceContext();
  return <BoostSection placeId={place.id} />;
}
