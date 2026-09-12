"use client";

// Capabilities — admin's Controls tab (a rename that stops at the label):
// Offerings · Partnership · Visit Rewards · Visits · Orders · Reservations.
import { Suspense } from "react";
import { PromosSection } from "@/components/place-manage/sections/PromosSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function CapabilitiesTab() {
  const { place, setPlace } = usePlaceContext();
  return (
    <Suspense fallback={null}>
      <PromosSection place={place} onSaved={setPlace} />
    </Suspense>
  );
}
