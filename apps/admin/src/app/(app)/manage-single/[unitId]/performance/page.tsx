"use client";

import { PerformanceSection } from "../../sections/PerformanceSection";
import { useUnitVenue } from "../../UnitVenueContext";

export default function UnitPerformancePage() {
  const { venue } = useUnitVenue();
  return <PerformanceSection venue={venue} />;
}
