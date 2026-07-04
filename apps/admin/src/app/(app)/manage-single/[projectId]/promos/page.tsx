"use client";

import { PromosSection } from "../../sections/PromosSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPromosPage() {
  const { place, setPlace } = useUnitPlace();
  return <PromosSection place={place} onSaved={setPlace} />;
}
