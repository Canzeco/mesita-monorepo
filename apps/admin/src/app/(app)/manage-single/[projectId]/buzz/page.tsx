"use client";

import { BuzzSection } from "../../sections/BuzzSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitBuzzPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-6xl">
      <BuzzSection place={place} />
    </div>
  );
}
