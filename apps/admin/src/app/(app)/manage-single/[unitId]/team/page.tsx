"use client";

import { TeamSection } from "../../sections/TeamSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitTeamPage() {
  const { place } = useUnitPlace();
  return <TeamSection place={place} />;
}
