"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// location · hours · channels), saved through admin-web-update-place. The
// gallery is not edited in admin (MESITA-2794).
//
// UNWIRED (Pato 2026-10-13): do not mount MenusSection (MESITA-2175) or
// ProfileCompleteness (MESITA-2179). Both components stay in the repo.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab() {
  const { place } = usePlaceContext();
  return <PlaceSection place={place} />;
}
