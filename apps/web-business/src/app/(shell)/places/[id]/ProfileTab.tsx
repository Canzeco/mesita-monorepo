"use client";

// Profile — admin's Single Place profile editor, verbatim: PlaceSection
// (basics · location · hours · channels · photos) wrapping MenusSection,
// with the completeness meter above it. Saves ride the one-save bar through
// business-web-update-project, which is what admin already used.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { MenusSection } from "@/components/place-manage/sections/MenusSection";
import { ProfileCompleteness } from "@/components/place-manage/sections/ProfileCompleteness";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <ProfileCompleteness place={place} />
      <PlaceSection place={place}>
        <MenusSection key={place.id} place={place} />
      </PlaceSection>
    </div>
  );
}
