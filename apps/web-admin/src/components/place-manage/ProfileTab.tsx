"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// location · hours · channels · photos) with the completeness meter above it.
// Saves ride the one-save bar through admin-web-update-place.
//
// MENUS UNWIRED (MESITA-2175, Pato 2026-10-13): do not mount MenusSection.
// Upload stays off. The component and stored menus remain; Reviews is the
// only child.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { ProfileCompleteness } from "@/components/place-manage/sections/ProfileCompleteness";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <ProfileCompleteness place={place} />
      <PlaceSection place={place}>
        <ReviewsSummary place={place} />
      </PlaceSection>
    </div>
  );
}
