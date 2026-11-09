"use client";

// Profile — admin's Single Place profile editor: PlaceSection (basics ·
// photos · location · hours · channels), saved through
// business-web-update-place. Photos is the gallery editor (MESITA-3504).
//
// UNWIRED (Pato 2026-10-13): do not mount MenusSection (MESITA-2175) or
// ProfileCompleteness (MESITA-2179). Both components stay in the repo.

import { PlaceSection } from "@/components/place-manage/sections/PlaceSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function ProfileTab({ staff = false }: { staff?: boolean } = {}) {
  const { place } = usePlaceContext();
  return <PlaceSection place={place} staff={staff} />;
}
