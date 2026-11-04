"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// location · hours · channels), saved through admin-web-update-place. The
// gallery is not edited in admin (MESITA-2794).
//
// UNWIRED (Pato 2026-10-13): do not mount MenusSection (MESITA-2175) or
// ProfileCompleteness (MESITA-2179). Both components stay in the repo.

import { ActionStatesCard } from "@/components/place-manage/sections/ActionStatesCard";
import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// Actions moved here from Admin (MESITA-3205). Staff only: its switches are
// Mesita's, and business-web-update-place refuses them from an owner.
export function ProfileTab({ staff }: { staff: boolean }) {
  const { place } = usePlaceContext();
  return <PlaceSection place={place}>{staff ? <ActionStatesCard place={place} /> : null}</PlaceSection>;
}
