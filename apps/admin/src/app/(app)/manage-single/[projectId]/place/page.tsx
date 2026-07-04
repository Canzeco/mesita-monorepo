"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPlacePage() {
  const { place, setPlace } = useUnitPlace();
  return <PlaceSection place={place} onSaved={setPlace} />;
}
