"use client";

import { PromosSection } from "../../sections/PromosSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPromosPage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-6xl">
      <PromosSection place={place} onSaved={setPlace} />
    </div>
  );
}
