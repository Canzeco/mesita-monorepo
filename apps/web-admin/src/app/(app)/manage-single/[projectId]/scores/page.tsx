"use client";

import { ScoresSection } from "../../sections/ScoresSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitScoresPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-6xl">
      <ScoresSection place={place} />
    </div>
  );
}
