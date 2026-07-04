"use client";

import { ScanSection } from "../../sections/ScanSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitScanPage() {
  const { place } = useUnitPlace();
  return <ScanSection place={place} />;
}
