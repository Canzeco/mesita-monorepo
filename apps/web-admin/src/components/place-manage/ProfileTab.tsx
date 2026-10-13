"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// location · hours · channels · photos). Saves ride the one-save bar
// through admin-web-update-place.
//
// UNWIRED (Pato 2026-10-13): do not mount MenusSection (MESITA-2175) or
// ProfileCompleteness (MESITA-2179). Both components stay in the repo.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab() {
  const { place } = usePlaceContext();
  return (
    <PlaceSection place={place}>
      <ReviewsSummary place={place} />
    </PlaceSection>
  );
}
