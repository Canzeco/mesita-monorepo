"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// location · hours · channels · photos) with the completeness meter above it.
// Saves ride the one-save bar through business-web-update-place, which is what
// admin already used.
//
// MENUS LEFT IN MESITA-1848. It rendered here as PlaceSection's last child,
// so the one artefact a guest actually reads was a scroll position at the
// bottom of the console's longest form. It has its own address now, and this
// page is five subjects instead of six.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { ProfileCompleteness } from "@/components/place-manage/sections/ProfileCompleteness";
import { MenusSection } from "@/components/place-manage/sections/MenusSection";
import { ReviewsSummary } from "@/components/place-manage/sections/ReviewsSummary";
import { MesitaReviewsList } from "@/components/place-manage/sections/MesitaReviewsList";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab() {
  const { place } = usePlaceContext();
  return (
    <div className="flex flex-col gap-4">
      <ProfileCompleteness place={place} />
      <PlaceSection place={place}>
        {/* The `children` seam this card has always documented, filled again
            (MESITA-1919). Menus is editable and saves through the one bar;
            the two Reviews boxes are read-only and close the masonry, which
            is what PlaceSection's own comment says they are for. */}
        <MenusSection place={place} />
        <ReviewsSummary place={place} />
        <MesitaReviewsList key={place.id} placeId={place.id} />
      </PlaceSection>
    </div>
  );
}
