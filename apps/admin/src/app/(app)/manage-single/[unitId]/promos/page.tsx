"use client";

import { PromosSection } from "../../sections/PromosSection";
import { useUnitVenue } from "../../UnitVenueContext";

export default function UnitPromosPage() {
  const { venue, setVenue } = useUnitVenue();
  return <PromosSection venue={venue} onSaved={setVenue} />;
}
