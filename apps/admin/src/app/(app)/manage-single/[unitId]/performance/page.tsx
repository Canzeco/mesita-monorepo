"use client";

import { PerformanceSection } from "../../sections/PerformanceSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitPerformancePage() {
  const { place } = useUnitPlace();
  return <PerformanceSection place={place} />;
}
