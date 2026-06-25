"use client";

import { ScanSection } from "../../sections/ScanSection";
import { useUnitVenue } from "../../UnitVenueContext";

export default function UnitScanPage() {
  const { venue } = useUnitVenue();
  return <ScanSection venue={venue} />;
}
