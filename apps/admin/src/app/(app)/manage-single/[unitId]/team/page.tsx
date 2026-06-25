"use client";

import { TeamSection } from "../../sections/TeamSection";
import { useUnitVenue } from "../../UnitVenueContext";

export default function UnitTeamPage() {
  const { venue } = useUnitVenue();
  return <TeamSection venue={venue} />;
}
