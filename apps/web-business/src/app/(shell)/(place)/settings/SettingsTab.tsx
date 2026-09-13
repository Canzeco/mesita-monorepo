"use client";

// Settings — admin's Controls tab (a rename that stops at the label; it was
// the Capabilities view until MESITA-1815, and the capability rows are still
// what it holds): Offerings · Partnership · Visit Rewards · Visits · Orders ·
// Reservations.
import { Suspense } from "react";
import { PromosSection } from "@/components/place-manage/sections/PromosSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function SettingsTab() {
  const { place, setPlace } = usePlaceContext();
  return (
    <Suspense fallback={null}>
      <PromosSection place={place} onSaved={setPlace} />
    </Suspense>
  );
}
