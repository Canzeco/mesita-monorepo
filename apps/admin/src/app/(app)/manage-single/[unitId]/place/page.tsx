"use client";

import { PlaceSection } from "../../sections/PlaceSection";
import { useUnitVenue } from "../../UnitVenueContext";

export default function UnitPlacePage() {
  const { venue, setVenue } = useUnitVenue();
  return <PlaceSection venue={venue} onSaved={setVenue} />;
}
